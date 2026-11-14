// Welt von threeyear – rein und deterministisch: Derselbe Seed ergibt immer dieselbe Welt.
// In der Mitte die von Hand entworfenen Gegenden (Zuhause, Blumenwiese, Teich), jede ringsum abgeschlossen und nur
// durch ihr Tor erreichbar. Außen herum endlose Landschaft aus Rauschen, berechnet in Stücken.
// Spezifikation: docs/specs/threeyear.md

import { CHUNK, ChunkCache } from '../../lib/games/chunks';
import { hash, rand01, valueNoise } from '../../lib/games/rng';
import {
  BORDERS,
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
} from '../../data/games/threeyear';

export type Ground = 'grass' | 'stone' | 'water' | 'path' | 'sand';
export type Deco = 'tree' | 'bush' | 'flower' | 'reed' | 'lily' | 'rock' | 'fence' | 'gate' | 'bridge' | 'bed' | 'sign';

export type Cell = {
  h: number; // Oberkante in Ebenen: Wasser 0, Boden 1, Hügel bis 3
  ground: Ground;
  deco: Deco | null;
  color?: string; // Blumenfarbe
  region: RegionId | 'wild' | 'border'; // border: Fels, Zaun oder Wasser zwischen Gegenden
  solid: boolean; // Deko versperrt das Feld (Baum, Busch, Fels, Zaun, Bett, Tafel)
  gate?: GateId; // Tor oder Brücke: begehbar, sobald offen
  sign?: GateId; // Tafel zu diesem Tor
  pen?: true; // Inneres des Geheges
  penGate?: true; // Öffnung im Gehege-Zaun
};

export type World = { readonly seed: number; cell(x: number, y: number): Cell };

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

/** Die von Hand entworfenen Gegenden als feste Karte; Zufall (Blumen, Seerosen) kommt aus dem Seed */
function buildRegions(seed: number): Map<string, Cell> {
  const map = new Map<string, Cell>();
  const set = (x: number, y: number, c: Cell) => map.set(key(x, y), c);

  for (const r of REGIONS) for (const [x, y] of ring(r.area)) set(x, y, rock());
  for (const r of REGIONS)
    for (const [x, y] of cellsOf(r.area)) {
      const c = grass(r.id);
      const roll = rand01(seed, x, y, 1);
      if (r.id === 'teich') {
        const d = ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2;
        if (d <= 1) {
          set(x, y, { ...water('teich'), deco: roll < 0.25 ? 'lily' : null });
          continue;
        }
        if (d <= 1.9 && roll < 0.45) c.deco = 'reed';
      } else if (roll < (r.id === 'wiese' ? 0.3 : 0.08)) {
        c.deco = 'flower';
        c.color = flowerColor(seed, x, y);
      }
      set(x, y, c);
    }

  for (const b of BORDERS)
    for (const [x, y] of cellsOf(b.area)) {
      if (b.kind === 'water') set(x, y, water('border'));
      else if (b.kind === 'path') set(x, y, { ...grass('border'), ground: 'path' });
      else set(x, y, { ...grass('border'), deco: 'fence', solid: true });
    }

  // Zuhause: Bäume, Bett, Gehege
  for (const [x, y] of HOME.trees) set(x, y, { ...grass('zuhause'), deco: 'tree', solid: true });
  set(HOME.bed[0], HOME.bed[1], { ...grass('zuhause'), deco: 'bed', solid: true });
  for (const [x, y] of ring(HOME.pen)) set(x, y, { ...grass('zuhause'), deco: 'fence', solid: true });
  for (const [x, y] of cellsOf(HOME.pen)) set(x, y, { ...grass('zuhause'), pen: true });
  set(HOME.penGate[0], HOME.penGate[1], { ...grass('zuhause'), ground: 'path', penGate: true });

  for (const g of GATES) {
    const [x, y] = g.at;
    set(
      x,
      y,
      g.kind === 'bruecke'
        ? { ...water('border'), deco: 'bridge', gate: g.id }
        : { ...grass('border'), deco: 'gate', gate: g.id },
    );
    set(g.sign[0], g.sign[1], { ...grass(g.region), deco: 'sign', solid: true, sign: g.id });
  }
  return map;
}

/** Endlose Landschaft: sanfte Hügel (Stufen meist eine Ebene), Teiche mit Sandufer, Bäume, Büsche, Blumen */
function wildCell(seed: number, x: number, y: number): Cell {
  // Vor dem Pfad vom Zuhause ist es flach und frei; von dort steigt das Gelände höchstens alle zwei Felder um eine
  // Ebene. So gibt es keine Wand aus zwei Stufen, und der Weg hinaus ist bei jedem Seed offen.
  const [ex, ey] = HOME.exit;
  const d = Math.max(Math.abs(x - ex) - 3, ey + 1 - y, y - (ey + 5), 0);
  const n = valueNoise(seed, x, y, 11);
  const h = Math.min(n < 0.4 ? 1 : n < 0.66 ? 2 : 3, 1 + Math.floor(d / 2));
  if (d < 2) return { ...grass('wild'), h };
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
  return c;
}

export function createWorld(seed: number): World {
  const regions = buildRegions(seed);
  const cache = new ChunkCache<Cell>((cx, cy) => {
    const cells: Cell[] = [];
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) cells.push(regions.get(key(x, y)) ?? wildCell(seed, x, y));
    return cells;
  });
  return { seed, cell: (x, y) => cache.get(x, y) };
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
