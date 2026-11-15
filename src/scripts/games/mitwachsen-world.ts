// Welt von Mitwachsen – rein und deterministisch: Derselbe Seed ergibt immer dieselbe Welt.
// In der Mitte die Lichtung mit dem Bett, ringsum natürliche Felsen mit vier großen Toren (vorerst zu). Außen herum
// endlose Landschaft aus Rauschen, berechnet in Stücken. Der Garten entsteht später (für Tests: { garden: true }).
// Spezifikation: docs/specs/mitwachsen.md

import { CHUNK, ChunkCache } from '../../lib/games/chunks';
import { hash, rand01, valueNoise } from '../../lib/games/rng';
import {
  GAME_COLORS,
  GATES,
  HOME,
  REGIONS,
  WILD_SPECIES,
  type GateId,
  type Point,
  type Rect,
  type RegionId,
  type SpeciesId,
} from '../../data/games/mitwachsen';

export type Ground = 'grass' | 'stone' | 'water' | 'path' | 'sand';
export type Deco =
  | 'tree'
  | 'bush'
  | 'flower'
  | 'reed'
  | 'lily'
  | 'rock'
  | 'fence'
  | 'gate'
  | 'bridge'
  | 'bed'
  | 'sign'
  | 'hedge'
  | 'arch'
  | 'fern'
  | 'boulder'
  | 'mushroom'
  | 'biggate';
export type TreeKind = 'oak' | 'birch' | 'autumn' | 'blossom';

export type Cell = {
  h: number; // Oberkante in Ebenen: Wasser 0, Boden 1, Hügel bis 3
  ground: Ground;
  deco: Deco | null;
  color?: string; // Blumenfarbe
  region: RegionId | 'wild' | 'border'; // border: Fels, Zaun oder Wasser zwischen Gegenden
  solid: boolean; // Deko versperrt das Feld (Baum, Busch, Fels, Zaun, Bett, Tafel)
  gate?: GateId; // Tor oder Brücke: begehbar, sobald offen
  sign?: GateId; // Tafel zu diesem Tor
  garden?: true; // Inneres des Gartens, in dem gefundene Tiere zu Hause sind
  gardenGate?: true; // Rosenbogen in der Hecke
  tree?: TreeKind; // Baumart bei deco 'tree'
  tufts?: number; // Grasbüschel auf dem Feld (nur Zierde, begehbar)
  shade?: number; // Farbfleck im Boden: −1 dunkler … +1 heller (große, weiche Flecken)
};

export type World = {
  readonly seed: number;
  cell(x: number, y: number): Cell;
  /** Wohnort jedes Tiers der Lichtung: nächstes vom Bett aus erreichbares Feld zum Wunschort */
  readonly spawns: ReadonlyMap<SpeciesId, Point>;
  /** Felder der großen Tore (hängen vom Seed ab, weil der Felsrand leicht unregelmäßig ist) */
  readonly gates: ReadonlyMap<GateId, readonly Point[]>;
};

export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const key = (x: number, y: number) => `${x},${y}`;

function cellsOf(r: Rect): Point[] {
  const out: Point[] = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push([x, y]);
  return out;
}
const ring = (r: Rect): Point[] =>
  cellsOf({ x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 }).filter(([x, y]) => !inRect(r, x, y));

const grass = (region: Cell['region']): Cell => ({ h: 1, ground: 'grass', deco: null, region, solid: false });
// Fels kann man besteigen (eine Stufe hoch geht immer); der Felsring hält die Figur über seine Höhe auf
const rock = (h: number): Cell => ({ h, ground: 'stone', deco: 'rock', region: 'border', solid: false });
const water = (region: Cell['region']): Cell => ({ h: 0, ground: 'water', deco: null, region, solid: false });
const flowerColor = (seed: number, x: number, y: number) =>
  GAME_COLORS.flowers[hash(seed, x, y, 7) % GAME_COLORS.flowers.length];

const lichtung = REGIONS[0];

/** Rand der Lichtung: Ellipse mit leichtem Wackeln aus dem Seed, damit der Felsring natürlich aussieht */
function edge(seed: number, x: number, y: number) {
  const { rx, ry } = lichtung.shape;
  const d = (x / rx) ** 2 + (y / ry) ** 2;
  const wobble = 1 + (valueNoise(seed + 21, x, y, 4) - 0.5) * 0.3;
  return d / wobble; // < 1 innen, 1 … ROCK_OUTER Felsen, darüber Landschaft
}
const ROCK_OUTER = 1.32;
/**
 * Felsring in Terrassen: innen 3 (vom Hügel aus erreichbar), dann 4, außen 6. Von 4 auf 6 sind es zwei Stufen:
 * Man kann auf die Felsen klettern und schauen, aber nicht hinüber. Von außen (Landschaft höchstens 3) auch nicht.
 */
const ringHeight = (e: number) => (e < 1.08 ? 3 : e < 1.16 ? 4 : 6);

/** Die drei Felder eines großen Tores: in einer geraden Reihe, so tief wie das innerste Felsfeld der drei Spalten */
function gateCells(seed: number, side: 'n' | 'o' | 's' | 'w'): Point[] {
  const [dx, dy] = { n: [0, -1], s: [0, 1], o: [1, 0], w: [-1, 0] }[side];
  const first = (off: number) => {
    for (let t = 1; t < 160; t++) if (edge(seed, dx ? dx * t : off, dy ? dy * t : off) >= 1) return t;
    return 160;
  };
  const t = Math.min(first(-1), first(0), first(1));
  return [-1, 0, 1].map((off) => [dx ? dx * t : off, dy ? dy * t : off] as Point);
}

/** Lichtung als feste Karte: Bett in der Mitte, Hügel, Teiche, Wäldchen, Blumenwiesen, Steine, Felsring, große Tore */
function buildStart(
  seed: number,
  opts: { garden?: boolean },
): { map: Map<string, Cell>; spawns: Map<SpeciesId, Point> } {
  const map = new Map<string, Cell>();
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  const { rx, ry } = lichtung.shape;
  const R = Math.ceil(Math.max(rx, ry) * 1.25) + 2;

  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const e = edge(seed, x, y);
      if (e >= ROCK_OUTER) continue; // Landschaft
      if (e >= 1) {
        set(x, y, rock(ringHeight(e)));
        continue;
      }
      const c = grass('lichtung');
      const near = Math.max(Math.abs(x - HOME.bed[0]), Math.abs(y - HOME.bed[1]));
      if (near <= HOME.clear) {
        set(x, y, c); // am Bett flach und frei
        continue;
      }
      const roll = rand01(seed, x, y, 1);
      const wet = valueNoise(seed + 31, x, y, 9);
      if (wet < 0.15 && near > HOME.clear + 2) {
        set(x, y, { ...water('lichtung'), deco: roll < 0.2 ? 'lily' : null });
        continue;
      }
      if (wet < 0.2 && near > HOME.clear + 1) {
        set(x, y, { ...c, ...(roll < 0.35 ? { deco: 'reed' as const } : { ground: 'sand' as const }) });
        continue;
      }
      const hill = valueNoise(seed + 30, x, y, 10);
      c.h = near <= HOME.clear + 2 ? 1 : hill < 0.45 ? 1 : hill < 0.68 ? 2 : 3;
      const forest = valueNoise(seed + 32, x, y, 16) > 0.62; // Wäldchen
      const meadow = valueNoise(seed + 33, x, y, 12) > 0.6; // Blumenwiesen
      const far = near > HOME.clear + 1;
      if (far && roll < (forest ? 0.28 : 0.025)) Object.assign(c, { deco: 'tree', solid: true });
      else if (far && roll < (forest ? 0.32 : 0.04)) Object.assign(c, { deco: 'bush', solid: true });
      else if (roll < (meadow ? 0.45 : 0.12)) Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
      else if (roll < (meadow ? 0.47 : 0.145)) c.deco = forest ? 'mushroom' : 'fern';
      else if (far && roll < (meadow ? 0.475 : 0.16)) Object.assign(c, { h: c.h + 1, ground: 'stone' }); // Stein zum Klettern
      set(x, y, c);
    }
  set(HOME.bed[0], HOME.bed[1], { ...grass('lichtung'), deco: 'bed', solid: true });

  for (const g of GATES)
    for (const [x, y] of gateCells(seed, g.side))
      set(x, y, { ...grass('border'), ground: 'stone', deco: 'biggate', gate: g.id, solid: false });

  if (opts.garden) {
    for (const [x, y] of ring(HOME.garden)) set(x, y, { ...grass('lichtung'), deco: 'hedge', solid: true });
    for (const [x, y] of cellsOf(HOME.garden)) set(x, y, { ...grass('lichtung'), garden: true });
    set(HOME.gardenGate[0], HOME.gardenGate[1], {
      ...grass('lichtung'),
      ground: 'path',
      gardenGate: true,
      deco: 'arch',
    });
  }
  return { map, spawns: findSpawns(map) };
}

/** Wohnorte der Tiere: Felder der Lichtung, die vom Bett aus zu Fuß erreichbar sind, je nah am Wunschort */
function findSpawns(map: Map<string, Cell>): Map<SpeciesId, Point> {
  const stand = (x: number, y: number) => {
    const c = map.get(key(x, y));
    return !c || c.solid || c.ground === 'water' || c.gate ? null : c.h;
  };
  const reach: Point[] = [];
  const seen = new Set<string>();
  const queue: Point[] = HOME.wake.filter(([x, y]) => stand(x, y) !== null);
  for (const p of queue) seen.add(key(p[0], p[1]));
  while (queue.length) {
    const [x, y] = queue.shift()!;
    reach.push([x, y]);
    const h = stand(x, y)!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = key(x + dx, y + dy);
      const to = stand(x + dx, y + dy);
      if (seen.has(k) || to === null || to - h > 1) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  const taken = new Set<string>();
  const spawns = new Map<SpeciesId, Point>();
  for (const { species, at } of lichtung.animals) {
    let best: Point | null = null,
      bestD = Infinity;
    for (const p of reach) {
      const c = map.get(key(p[0], p[1]))!;
      if (c.region !== 'lichtung' || taken.has(key(p[0], p[1]))) continue;
      const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2;
      if (d < bestD) [best, bestD] = [p, d];
    }
    if (!best) continue;
    taken.add(key(best[0], best[1]));
    spawns.set(species, best);
  }
  return spawns;
}

/** Endlose Landschaft: sanfte Hügel (Stufen meist eine Ebene), Teiche mit Sandufer, Bäume, Büsche, Blumen */
function wildCell(seed: number, x: number, y: number): Cell {
  const n = valueNoise(seed, x, y, 11);
  const h = n < 0.4 ? 1 : n < 0.66 ? 2 : 3;
  const wet = valueNoise(seed + 1, x, y, 7);
  if (h === 1 && wet < 0.17) return water('wild');
  const c = grass('wild');
  c.h = h;
  if (h === 1 && wet < 0.23) {
    c.ground = 'sand';
    return c;
  }
  const roll = rand01(seed, x, y, 2);
  if (roll < 0.035) Object.assign(c, { deco: 'tree', solid: true });
  else if (roll < 0.05) Object.assign(c, { deco: 'bush', solid: true });
  else if (roll < 0.14) Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
  else if (roll < 0.165) c.deco = 'fern';
  else if (roll < 0.175)
    Object.assign(c, { h: h + 1, ground: 'stone' }); // Stein zum Klettern
  else if (roll < 0.183) c.deco = 'mushroom';
  return c;
}

/**
 * Zierde für jedes Feld, ändert nichts an den Regeln: Farbflecken im Boden, Grasbüschel und die Baumart.
 * Bäume wachsen in Gruppen: Herbst- und Blütenbäume dort, wo ein weiches Rauschen hoch bzw. niedrig ist.
 */
function dress(seed: number, x: number, y: number, c: Cell): Cell {
  const out: Cell = { ...c, shade: (valueNoise(seed + 9, x, y, 5) - 0.5) * 2 };
  if (c.deco === 'tree' && !c.tree) {
    const patch = valueNoise(seed + 5, x, y, 14);
    out.tree =
      c.region === 'lichtung'
        ? (['oak', 'blossom', 'birch', 'oak', 'autumn'] as const)[hash(seed, x, y, 12) % 5] // bunt gemischt
        : patch > 0.66
          ? 'autumn'
          : patch < 0.27
            ? 'blossom'
            : rand01(seed, x, y, 12) < 0.3
              ? 'birch'
              : 'oak';
  }
  if (c.ground === 'grass' && !c.deco && !c.garden && !c.gate) {
    const r = rand01(seed, x, y, 11);
    if (r < 0.7) out.tufts = 1 + (hash(seed, x, y, 13) % 3);
  }
  return out;
}

export function createWorld(seed: number, opts: { garden?: boolean } = {}): World {
  const { map: regions, spawns } = buildStart(seed, opts);
  const cache = new ChunkCache<Cell>((cx, cy) => {
    const cells: Cell[] = [];
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++)
        cells.push(dress(seed, x, y, regions.get(key(x, y)) ?? wildCell(seed, x, y)));
    return cells;
  });
  const gates = new Map(GATES.map((g) => [g.id, gateCells(seed, g.side)] as const));
  return { seed, cell: (x, y) => cache.get(x, y), gates, spawns };
}

/** Höhe, auf der man auf einem Feld steht – null, wenn man dort nicht stehen kann */
export function standHeight(world: World, open: readonly GateId[], x: number, y: number): number | null {
  const c = world.cell(x, y);
  if (c.gate) return open.includes(c.gate) ? 1 : null;
  if (c.solid || c.ground === 'water') return null;
  return c.h;
}

/** Ein Schritt geht, wenn man auf beiden Feldern stehen kann und höchstens eine Ebene hinauf muss; herunter geht immer */
export function canStep(
  world: World,
  open: readonly GateId[],
  fx: number,
  fy: number,
  tx: number,
  ty: number,
): boolean {
  const from = standHeight(world, open, fx, fy);
  const to = standHeight(world, open, tx, ty);
  return from !== null && to !== null && to - from <= 1;
}

// ---------- Tiere der endlosen Landschaft ----------

export type WildSpawn = { id: string; species: SpeciesId; x: number; y: number };

/** Tiere eines Stücks der Landschaft – immer dieselben an derselben Stelle; Kennung aus Stück und Nummer */
export function wildAnimals(world: World, cx: number, cy: number): WildSpawn[] {
  const roll = rand01(world.seed, cx, cy, 3);
  const count = roll < 0.4 ? 1 : roll < 0.55 ? 2 : 0;
  const out: WildSpawn[] = [];
  for (let n = 0; n < count; n++) {
    for (let t = 0; t < 16; t++) {
      const h = hash(world.seed, cx, cy, n, t);
      const x = cx * CHUNK + (h % CHUNK),
        y = cy * CHUNK + ((h >>> 8) % CHUNK);
      const c = world.cell(x, y);
      if (c.region !== 'wild' || standHeight(world, [], x, y) === null || out.some((o) => o.x === x && o.y === y))
        continue;
      out.push({ id: `wild:${cx}:${cy}:${n}`, species: WILD_SPECIES[(h >>> 16) % WILD_SPECIES.length], x, y });
      break;
    }
  }
  return out;
}
