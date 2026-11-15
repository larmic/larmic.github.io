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
  regionAnimalList,
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
  | 'biggate'
  | 'portal';
export type TreeKind = 'oak' | 'birch' | 'autumn' | 'blossom';
export type Portal = { gate: Point; gateExit: Point; home: Point; homeExit: Point };

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
  portal?: { id: GateId; side: 'gate' | 'home' }; // Portal (Tor-Seite oder über dem Bett)
  shade?: number; // Farbfleck im Boden: −1 dunkler … +1 heller (große, weiche Flecken)
};

export type World = {
  readonly seed: number;
  cell(x: number, y: number): Cell;
  /** Wohnort jedes Tiers der Lichtung: nächstes vom Bett aus erreichbares Feld zum Wunschort */
  readonly spawns: ReadonlyMap<string, Point>; // je Tier-Kennung
  /** Portale: je Tor eines daneben und eines über dem Bett, mit dem Feld, auf dem man herauskommt */
  readonly portals: ReadonlyMap<GateId, Portal>;
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
// Der Felsring ist eine feste Grenze: nicht zu betreten, also weder zu besteigen noch hineinzufallen
const rock = (h: number): Cell => ({ h, ground: 'stone', deco: 'rock', region: 'border', solid: true });
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
/** Felsring in Terrassen (nur fürs Auge, betreten kann man ihn nicht): innen 3, dann 4, außen 5 */
const ringHeight = (e: number) => (e < 1.08 ? 3 : e < 1.16 ? 4 : 5);
/** Bäume und Büsche stehen einzeln: im Umkreis von so vielen Feldern kein weiteres Hindernis */
const OBSTACLE_GAP = 2;

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

/**
 * Portale: neben dem Tor (drei Felder zur Seite, mindestens zwei nach innen, so weit, bis es frei auf der Lichtung
 * steht – der Felsrand wackelt) und über dem Bett (HOME.portals). Herauskommen jeweils auf dem Feld davor,
 * Richtung Lichtung bzw. Bett.
 */
function portalsOf(seed: number): Map<GateId, Portal> {
  const out = new Map<GateId, Portal>();
  const inside = (x: number, y: number) => edge(seed, x, y) < 0.97;
  for (const g of GATES) {
    const [mx, my] = gateCells(seed, g.side)[1];
    const [ix, iy] = { n: [0, 1], s: [0, -1], o: [-1, 0], w: [1, 0] }[g.side]; // nach innen
    const [sx, sy] = g.side === 'n' || g.side === 's' ? [1, 0] : [0, 1]; // zur Seite
    const at = (t: number): Point => [mx + ix * t + sx * 3, my + iy * t + sy * 3];
    const free = (t: number) =>
      [-1, 0, 1].every((o) => [t, t + 1, t + 2].every((u) => inside(at(u)[0] + sx * o, at(u)[1] + sy * o)));
    let t = 2;
    while (t < 40 && !free(t)) t++;
    const [hx, hy] = HOME.portals[g.id];
    out.set(g.id, {
      gate: at(t),
      gateExit: at(t + 1),
      home: [hx, hy],
      homeExit: [hx, hy + 1],
    });
  }
  return out;
}

/** Lichtung als feste Karte: Bett in der Mitte, Hügel, Teiche, Wäldchen, Blumenwiesen, Steine, Felsring, große Tore */
function buildStart(seed: number, opts: { garden?: boolean }): { map: Map<string, Cell>; spawns: Map<string, Point> } {
  const map = new Map<string, Cell>();
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);
  const { rx, ry } = lichtung.shape;
  const R = Math.ceil(Math.max(rx, ry) * 1.25) + 2;
  // Felder werden Reihe für Reihe gesetzt; es genügt, die schon gesetzten Nachbarn anzuschauen
  const obstacleNear = (x: number, y: number) => {
    for (let dy = -OBSTACLE_GAP; dy <= 0; dy++)
      for (let dx = -OBSTACLE_GAP; dx <= OBSTACLE_GAP; dx++) {
        const d = map.get(key(x + dx, y + dy))?.deco;
        if (d === 'tree' || d === 'bush') return true;
      }
    return false;
  };

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
      const forest = valueNoise(seed + 32, x, y, 16) > 0.62; // lichte Haine: etwas mehr Bäume, aber einzeln
      const meadow = valueNoise(seed + 33, x, y, 12) > 0.6; // Blumenwiesen
      const far = near > HOME.clear + 1 && !obstacleNear(x, y);
      if (far && roll < (forest ? 0.07 : 0.012)) Object.assign(c, { deco: 'tree', solid: true });
      else if (far && roll < (forest ? 0.09 : 0.02))
        Object.assign(c, { deco: 'bush', solid: true }); // Beerenbusch
      else if (roll < (meadow ? 0.45 : 0.12)) Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
      else if (roll < (meadow ? 0.47 : 0.145)) c.deco = forest ? 'mushroom' : 'fern';
      else if (far && roll < (meadow ? 0.475 : 0.16)) Object.assign(c, { h: c.h + 1, ground: 'stone' }); // Stein zum Klettern
      set(x, y, c);
    }
  set(HOME.bed[0], HOME.bed[1], { ...grass('lichtung'), deco: 'bed', solid: true });

  for (const g of GATES)
    for (const [x, y] of gateCells(seed, g.side))
      set(x, y, { ...grass('border'), ground: 'stone', deco: 'biggate', gate: g.id, solid: false });

  // Portale: Platz ringsum flach und frei, damit man hin- und herauskommt
  for (const [id, p] of portalsOf(seed))
    for (const [[px, py], side] of [
      [p.gate, 'gate'],
      [p.home, 'home'],
    ] as const) {
      for (let dy = -1; dy <= 2; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (map.get(key(px + dx, py + dy))?.region === 'lichtung') set(px + dx, py + dy, grass('lichtung'));
      set(px, py, { ...grass('lichtung'), deco: 'portal', portal: { id, side } });
    }

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
  smooth(map);

  // Vor jedem Tor ein freier Gang nach innen, bis er auf erreichbares Land trifft (Teiche, Bäume, Felsnischen)
  const before = new Set(reachOf(map).map(([x, y]) => key(x, y)));
  for (const g of GATES) {
    const [mx, my] = gateCells(seed, g.side)[1];
    const [ix, iy] = { n: [0, 1], s: [0, -1], o: [-1, 0], w: [1, 0] }[g.side];
    for (let t = 1; t < 100 && (t < 4 || !before.has(key(mx + ix * t, my + iy * t))); t++)
      for (const o of [-1, 0, 1]) {
        const x = mx + ix * t + iy * o,
          y = my + iy * t + ix * o;
        const c = map.get(key(x, y));
        if (c && (c.region === 'lichtung' || c.deco === 'rock')) set(x, y, { ...grass('lichtung'), h: c.h || 1 });
      }
  }
  smooth(map);

  // Was man nicht erreichen kann, wird Fels: keine Ecken, die man sieht, aber nie betreten kann
  const reach = reachOf(map);
  const reached = new Set(reach.map(([x, y]) => key(x, y)));
  for (const [k, c] of map)
    if (c.region === 'lichtung' && !c.solid && c.ground !== 'water' && !reached.has(k)) map.set(k, rock(3));
  return { map, spawns: findSpawns(seed, map, reach) };
}

/**
 * Keine Stufe höher als eins: Benachbarte Felder der Lichtung unterscheiden sich um höchstens eine Ebene.
 * So kommt man überall hinauf, wo man heruntergefallen ist, und nirgends in eine Grube, aus der es nicht herausgeht.
 * Felder werden nur abgesenkt; flache Stellen (am Bett, an Portalen und Toren) ziehen die Hügel ringsum herunter.
 */
function smooth(map: Map<string, Cell>) {
  const land = (c: Cell | undefined) => !!c && c.ground !== 'water' && (c.region === 'lichtung' || !!c.gate);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, cell] of map) {
      let c = cell;
      if (!land(c) || c.gate) continue;
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = map.get(key(x + dx, y + dy));
        if (!land(n) || c.h <= n!.h + 1) continue;
        map.set(k, (c = { ...c, h: n!.h + 1 }));
        changed = true;
      }
    }
  }
}

/** Felder, die vom Bett aus zu Fuß erreichbar sind */
function reachOf(map: Map<string, Cell>): Point[] {
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
  return reach;
}

/**
 * Wohnorte der Tiere: Felder der Lichtung, die vom Bett aus zu Fuß erreichbar sind. Das erste Tier jeder Art wohnt
 * nah an seinem Wunschort, die weiteren verteilt der Seed über die ganze Lichtung (mit Abstand zueinander und zum Bett).
 */
function findSpawns(seed: number, map: Map<string, Cell>, reach: Point[]): Map<string, Point> {
  const spawns = new Map<string, Point>();
  const taken: Point[] = [];
  const free = (p: Point, gap: number) => taken.every(([x, y]) => (x - p[0]) ** 2 + (y - p[1]) ** 2 >= gap * gap);
  const land = reach.filter(([x, y]) => map.get(key(x, y))!.region === 'lichtung');
  const all = regionAnimalList(lichtung);
  for (const { id, species, n } of all) {
    if (n !== 1) continue;
    const at = lichtung.animals.find((a) => a.species === species)!.at;
    let best: Point | null = null,
      bestD = Infinity;
    for (const p of land) {
      const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2;
      if (d < bestD && free(p, 1)) [best, bestD] = [p, d];
    }
    if (!best) continue;
    taken.push(best);
    spawns.set(id, best);
  }
  // Die weiteren: Felder in einer Reihenfolge aus dem Seed, jedes mit Abstand zu allen anderen
  const shuffled = [...land].sort((a, b) => hash(seed, a[0], a[1], 77) - hash(seed, b[0], b[1], 77));
  const rest = all.filter((a) => a.n !== 1);
  for (const gap of [9, 5, 1]) {
    for (const p of shuffled) {
      if (!rest.length) break;
      const [x, y] = p;
      if (Math.max(Math.abs(x - HOME.bed[0]), Math.abs(y - HOME.bed[1])) < 6 || !free(p, gap)) continue;
      const { id } = rest.shift()!;
      taken.push(p);
      spawns.set(id, p);
    }
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
  return { seed, cell: (x, y) => cache.get(x, y), gates, spawns, portals: portalsOf(seed) };
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
