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
  POND,
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
// Fels ist nur eine Stufe höher als der Boden: In der Ansicht von vorn verdeckt er sonst die Reihe dahinter
const rock = (): Cell => ({ h: 2, ground: 'stone', deco: 'rock', region: 'border', solid: true });
const water = (region: Cell['region']): Cell => ({ h: 0, ground: 'water', deco: null, region, solid: false });
const flowerColor = (seed: number, x: number, y: number) =>
  GAME_COLORS.flowers[hash(seed, x, y, 7) % GAME_COLORS.flowers.length];

const lichtung = REGIONS[0];

/** Rand der Lichtung: Ellipse mit leichtem Wackeln aus dem Seed, damit der Felsring natürlich aussieht */
function edge(seed: number, x: number, y: number) {
  const { rx, ry } = lichtung.shape;
  const d = (x / rx) ** 2 + (y / ry) ** 2;
  const wobble = 1 + (valueNoise(seed + 21, x, y, 4) - 0.5) * 0.3;
  return d / wobble; // < 1 innen, 1 … 1,55 Felsen, darüber Landschaft
}
const ROCK_OUTER = 1.55;

/** Die drei Felder eines großen Tores: in einer geraden Reihe, so tief wie das innerste Felsfeld der drei Spalten */
function gateCells(seed: number, side: 'n' | 'o' | 's' | 'w'): Point[] {
  const [dx, dy] = { n: [0, -1], s: [0, 1], o: [1, 0], w: [-1, 0] }[side];
  const first = (off: number) => {
    for (let t = 1; t < 40; t++) if (edge(seed, dx ? dx * t : off, dy ? dy * t : off) >= 1) return t;
    return 40;
  };
  const t = Math.min(first(-1), first(0), first(1));
  return [-1, 0, 1].map((off) => [dx ? dx * t : off, dy ? dy * t : off] as Point);
}

/** Die Lichtung als feste Karte: Bett in der Mitte, Teich, Hügel, Bäume, Felsring, große Tore */
function buildStart(seed: number, opts: { garden?: boolean }): Map<string, Cell> {
  const map = new Map<string, Cell>();
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  const { rx, ry } = lichtung.shape;
  const spawns = new Set(lichtung.animals.map((a) => key(a.at[0], a.at[1])));
  const R = Math.ceil(Math.max(rx, ry) * 1.6);

  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const e = edge(seed, x, y);
      if (e >= ROCK_OUTER) continue; // Landschaft
      if (e >= 1) {
        set(x, y, { ...rock(), h: 2 + (hash(seed, x, y, 22) % 2) });
        continue;
      }
      const c = grass('lichtung');
      const near = Math.max(Math.abs(x - HOME.bed[0]), Math.abs(y - HOME.bed[1]));
      if (near <= HOME.clear || spawns.has(key(x, y))) {
        set(x, y, c); // am Bett und an den Startplätzen der Tiere flach und frei
        continue;
      }
      const p = ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2;
      const roll = rand01(seed, x, y, 1);
      if (p <= 1) {
        set(x, y, { ...water('lichtung'), deco: roll < 0.25 ? 'lily' : null });
        continue;
      }
      if (p <= 1.8) {
        set(x, y, { ...c, ...(roll < 0.4 ? { deco: 'reed' as const } : { ground: 'sand' as const }) });
        continue;
      }
      if (valueNoise(seed + 30, x, y, 6) > 0.66 && e < 0.8) c.h = 2;
      if (roll < 0.05 && near > HOME.clear + 1) Object.assign(c, { deco: 'tree', solid: true });
      else if (roll < 0.065) Object.assign(c, { deco: 'bush', solid: true });
      else if (roll < 0.2) Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
      else if (roll < 0.22) c.deco = 'fern';
      else if (roll < 0.23) c.deco = 'mushroom';
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
  return map;
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
  else if (roll < 0.175 && h >= 2) Object.assign(c, { deco: 'boulder', solid: true });
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
  const regions = buildStart(seed, opts);
  const cache = new ChunkCache<Cell>((cx, cy) => {
    const cells: Cell[] = [];
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++)
        cells.push(dress(seed, x, y, regions.get(key(x, y)) ?? wildCell(seed, x, y)));
    return cells;
  });
  const gates = new Map(GATES.map((g) => [g.id, gateCells(seed, g.side)] as const));
  return { seed, cell: (x, y) => cache.get(x, y), gates };
}

/** Höhe, auf der man auf einem Feld steht – null, wenn man dort nicht stehen kann */
export function standHeight(world: World, open: readonly GateId[], x: number, y: number): number | null {
  const c = world.cell(x, y);
  if (c.gate) return open.includes(c.gate) ? 1 : null;
  if (c.solid || c.ground === 'water') return null;
  return c.h;
}

/** Ein Schritt geht, wenn man auf beiden Feldern stehen kann und höchstens eine Ebene hoch oder runter muss */
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
  return from !== null && to !== null && Math.abs(to - from) <= 1;
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
