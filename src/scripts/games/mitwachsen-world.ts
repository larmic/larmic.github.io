// Welt von Mitwachsen – rein und deterministisch: Derselbe Seed ergibt immer dieselbe Welt.
// In der Mitte die Lichtung mit dem Bett, ringsum natürliche Felsen mit vier großen Toren (vorerst zu). Außen herum
// endlose Landschaft aus Rauschen, berechnet in Stücken. Ums Bett die Wiese, auf der gefundene Tiere zu Hause sind.
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

export type Ground =
  | 'grass'
  | 'stone'
  | 'water'
  | 'path'
  | 'sand'
  // Welten hinter den Toren
  | 'snow'
  | 'ice'
  | 'basalt'
  | 'lava'
  | 'cave'
  | 'cloud'
  | 'sky' // Leere zwischen den Wolken
  | 'moss';
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
  | 'gatetower' // Turm eines großen Tors (fest; das Torhaus zeichnet die Ansicht)
  | 'portal'
  | 'portalside' // Säule eines Portals (fest)
  | 'cactus'
  | 'crystal'
  | 'stalagmite'
  | 'bigshroom'
  | 'cloudpuff'
  | 'trough' // Futtertrog auf der Wiese
  | 'watertrough'; // Wassertrog
export type TreeKind = 'oak' | 'birch' | 'autumn' | 'blossom' | 'pine' | 'snowpine' | 'palm' | 'dead';
/** Portal je Tor: Feld am Tor und am Bett, je mit dem Feld davor (dort kommt man heraus) und der Blickrichtung */
export type Portal = {
  gate: Point;
  gateExit: Point;
  gateFacing: Point; // Richtung, in die das Portal am Tor schaut (zur Lichtung)
  home: Point;
  homeExit: Point;
  homeFacing: Point; // zum Bett
};
/** Ein großes Tor: fünf Felder in einer Reihe, nach außen in eine Achsenrichtung, dahinter die Welt `id` */
export type GatePlace = {
  id: GateId;
  cells: readonly Point[];
  mid: Point;
  out: Point; // nach außen (weg von der Lichtung)
  angle: number; // Winkel von der Mitte aus: In dieser Richtung liegt die Welt des Tors
};

export type Cell = {
  h: number; // Oberkante in Ebenen: Wasser 0, Boden 1, Hügel bis 3
  ground: Ground;
  deco: Deco | null;
  color?: string; // Blumenfarbe
  region: RegionId | 'wild' | 'border'; // border: Fels, Zaun oder Wasser zwischen Gegenden
  solid: boolean; // Deko versperrt das Feld (Baum, Busch, Fels, Zaun, Bett, Tafel)
  gate?: GateId; // Tor oder Brücke: begehbar, sobald offen
  sign?: GateId; // Tafel zu diesem Tor
  garden?: true; // Wiese ums Bett: Hier sind gefundene Tiere zu Hause
  tree?: TreeKind; // Baumart bei deco 'tree'
  tufts?: number; // Grasbüschel auf dem Feld (nur Zierde, begehbar)
  portal?: { id: GateId; side: 'gate' | 'home' }; // Portal (am Tor oder am Bett)
  biome?: GateId; // Welt hinter einem Tor
  part?: { id: GateId; side?: 'gate' | 'home' }; // Turm eines Tors oder Säule eines Portals: gehört zu dieser Welt
  shade?: number; // Farbfleck im Boden: −1 dunkler … +1 heller (große, weiche Flecken)
};

export type World = {
  readonly seed: number;
  cell(x: number, y: number): Cell;
  /** Wohnort jedes Tiers der Lichtung: nächstes vom Bett aus erreichbares Feld zum Wunschort */
  readonly spawns: ReadonlyMap<string, Point>; // je Tier-Kennung
  /** Portale: je Tor eines daneben und eines im Kreis um das Bett, mit dem Feld, auf dem man herauskommt */
  readonly portals: ReadonlyMap<GateId, Portal>;
  /** Die großen Tore: Lage und Reihenfolge würfelt der Seed */
  readonly gates: ReadonlyMap<GateId, GatePlace>;
};

export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const key = (x: number, y: number) => `${x},${y}`;

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
  return d / wobble; // < 1 innen, darüber Felsen bis zum festen Außenrand (outside)
}
const ROCK_OUTER = 1.52; // fester Außenrand ohne Wackeln: Der Felsring ist überall mindestens gut zehn Felder dick
const outside = (x: number, y: number) => (x / lichtung.shape.rx) ** 2 + (y / lichtung.shape.ry) ** 2 >= ROCK_OUTER;
/** Felsring in Terrassen (nur fürs Auge, betreten kann man ihn nicht): innen 3, dann 4, außen 5 */
const ringHeight = (e: number) => (e < 1.08 ? 3 : e < 1.16 ? 4 : 5);
/** Bäume und Büsche stehen einzeln: im Umkreis von so vielen Feldern kein weiteres Hindernis */
const OBSTACLE_GAP = 2;

export const GATE_HALF = 2; // Tor: Mitte ± 2 Felder
export const TOWER = 2; // Türme links und rechts, je zwei Felder breit
const BAY_HALF = GATE_HALF + TOWER + 1; // Bucht vor dem Torhaus: so breit (Mitte ± 5), bis zur Lichtung frei
const PORTAL_SIDE = GATE_HALF + TOWER + 2; // das Portal steht gleich neben dem Turm (Mitte ± 6), auf Höhe des Tors

const sign = (v: number) => (v < 0 ? -1 : 1);
/** Achse, die einer Richtung am nächsten kommt */
const axis = (dx: number, dy: number): Point => (Math.abs(dx) >= Math.abs(dy) ? [sign(dx), 0] : [0, sign(dy)]);

/** Ein Torplatz: Tor, Türme, Platz davor und Gang dahinter in Koordinaten (u entlang des Tors, t nach außen) */
type Layout = GatePlace & {
  depth: number; // t der Torreihe
  at: (u: number, t: number) => Point;
  side: number; // Portal links (−1) oder rechts (+1) vom Tor
};

/**
 * Die großen Tore aus dem Seed: gleichmäßig um die Lichtung verteilt (mit etwas Spiel), in gewürfelter Reihenfolge.
 * Jedes Tor steht in einer geraden Reihe, so tief im Fels wie die tiefste Stelle des Torhauses: davor ein freier
 * Platz, dahinter ein Gang durch den Fels in seine Welt.
 */
function layouts(seed: number): Layout[] {
  const { rx, ry } = lichtung.shape;
  const order = GATES.map((g, i) => ({ g, k: hash(seed, i, 91) })).sort((a, b) => a.k - b.k);
  const start = rand01(seed, 5, 5, 3) * Math.PI * 2;
  return order.map(({ g }, i) => {
    const angle = start + (i * Math.PI * 2) / GATES.length + (rand01(seed, i, 0, 4) - 0.5) * 0.25;
    const c = Math.cos(angle),
      sn = Math.sin(angle);
    const out = axis(ry * c, rx * sn); // Richtung der Ellipsen-Normale
    const across: Point = out[0] ? [0, 1] : [1, 0];
    const base = Math.round(across[0] ? c * rx : sn * ry); // Lage entlang des Tors
    const at = (u: number, t: number): Point => [
      across[0] * (base + u) + out[0] * t,
      across[1] * (base + u) + out[1] * t,
    ];
    const first = (u: number) => {
      for (let t = 1; t < 200; t++) if (edge(seed, ...at(u, t)) >= 1) return t;
      return 200;
    };
    let depth = 0;
    for (let u = -GATE_HALF - TOWER; u <= GATE_HALF + TOWER; u++) depth = Math.max(depth, first(u));
    const cells: Point[] = [];
    for (let u = -GATE_HALF; u <= GATE_HALF; u++) cells.push(at(u, depth));
    const side = hash(seed, i, 92) % 2 ? 1 : -1;
    return { id: g.id, cells, mid: at(0, depth), out, angle, depth, at, side };
  });
}

/** Portale: neben dem Tor auf dem Torplatz, zur Lichtung schauend; ihr Partner im Kreis um das Bett, in Torrichtung */
function portalsOf(places: readonly Layout[]): Map<GateId, Portal> {
  const out = new Map<GateId, Portal>();
  for (const p of places) {
    const u = p.side * PORTAL_SIDE;
    const r = HOME.portalRing;
    const home: Point = [
      HOME.bed[0] + Math.round(Math.cos(p.angle) * r),
      HOME.bed[1] + Math.round(Math.sin(p.angle) * r),
    ];
    const homeFacing = axis(HOME.bed[0] - home[0], HOME.bed[1] - home[1]);
    out.set(p.id, {
      gate: p.at(u, p.depth - 2),
      gateExit: p.at(u, p.depth - 3),
      gateFacing: [-p.out[0], -p.out[1]],
      home,
      homeExit: [home[0] + homeFacing[0], home[1] + homeFacing[1]],
      homeFacing,
    });
  }
  return out;
}

/** Lichtung als feste Karte: Bett in der Mitte, Hügel, Teiche, Wäldchen, Blumenwiesen, Steine, Felsring, große Tore */
function buildStart(seed: number, places: readonly Layout[]): { map: Map<string, Cell>; spawns: Map<string, Point> } {
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
      if (outside(x, y)) continue; // Landschaft
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

  // Große Tore: Platz davor frei, Tor und Türme in der Torreihe, dahinter ein Gang durch den Fels in die Welt
  for (const p of places) {
    const span = GATE_HALF + TOWER;
    // Bucht vor dem Torhaus, auf der Seite des Portals breiter, damit es gleich neben dem Turm stehen kann
    const [u0, u1] = p.side < 0 ? [-PORTAL_SIDE - 2, BAY_HALF] : [-BAY_HALF, PORTAL_SIDE + 2];
    for (let u = u0; u <= u1; u++)
      for (let t = p.depth - 1; t >= p.depth - 60; t--) {
        const [x, y] = p.at(u, t);
        if (map.get(key(x, y))?.region === 'lichtung' && t < p.depth - 2) break; // weiter innen ist schon Lichtung
        set(x, y, grass('lichtung'));
      }
    for (let u = -span; u <= span; u++) {
      const [x, y] = p.at(u, p.depth);
      if (Math.abs(u) <= GATE_HALF) set(x, y, { ...grass('border'), ground: 'stone', deco: 'biggate', gate: p.id });
      else set(x, y, { ...rock(1), deco: 'gatetower', part: { id: p.id } });
    }
    for (let t = p.depth + 1; t < p.depth + 200; t++) {
      let beyond = true;
      for (let u = -span; u <= span; u++) {
        const [x, y] = p.at(u, t);
        if (Math.abs(u) > GATE_HALF) set(x, y, rock(ringHeight(1.1)));
        else set(x, y, passage(seed, p.id, x, y));
        if (!outside(x, y)) beyond = false;
      }
      if (beyond) break;
    }
  }

  // Portale: drei Felder breit (Säule, Portal, Säule), Platz ringsum flach und frei
  for (const [id, p] of portalsOf(places))
    for (const [[px, py], [fx, fy], side] of [
      [p.gate, p.gateFacing, 'gate'],
      [p.home, p.homeFacing, 'home'],
    ] as const) {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (map.get(key(px + dx, py + dy))?.region === 'lichtung') set(px + dx, py + dy, grass('lichtung'));
      set(px, py, { ...grass('lichtung'), deco: 'portal', portal: { id, side } });
      for (const o of [-1, 1])
        set(px + fy * o, py + fx * o, { ...grass('lichtung'), deco: 'portalside', solid: true, part: { id, side } });
    }

  // Wiese ums Bett: eben und frei, mit Futter und Wasser; am Rand ein paar Blumen
  const r = HOME.meadow;
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.5) continue;
      const [x, y] = [HOME.bed[0] + dx, HOME.bed[1] + dy];
      const c = map.get(key(x, y));
      if (!c || c.deco === 'bed' || c.deco === 'portal' || c.deco === 'portalside') continue;
      const edgeFlower = d > r - 0.5 && hash(seed, x, y, 15) % 3 === 0;
      set(x, y, {
        ...grass('lichtung'),
        garden: true,
        ...(edgeFlower ? { deco: 'flower' as const, color: flowerColor(seed, x, y) } : {}),
      });
    }
  for (const [[x, y], deco] of [
    [HOME.food, 'trough'],
    [HOME.water, 'watertrough'],
  ] as const)
    set(x, y, { ...grass('lichtung'), garden: true, deco, solid: true });
  smooth(map);

  // Vom Torplatz ein freier Gang nach innen, bis er auf erreichbares Land trifft (Teiche, Bäume)
  const before = new Set(reachOf(map).map(([x, y]) => key(x, y)));
  for (const p of places)
    for (let t = p.depth - 3; t > p.depth - 200 && !before.has(key(...p.at(0, t))); t--)
      for (const u of [-1, 0, 1]) {
        const [x, y] = p.at(u, t);
        const c = map.get(key(x, y));
        if (c && (c.region === 'lichtung' || c.deco === 'rock')) set(x, y, { ...grass('lichtung'), h: c.h || 1 });
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
  const land = reach.filter(([x, y]) => map.get(key(x, y))!.region === 'lichtung' && !map.get(key(x, y))!.garden);
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

/** Welt eines Feldes außerhalb der Lichtung: die des Tors, in dessen Richtung es liegt (Grenzen leicht gewellt) */
function biomeOf(seed: number, places: readonly GatePlace[], x: number, y: number): GateId {
  const { rx, ry } = lichtung.shape;
  const a = Math.atan2(y / ry, x / rx) + (valueNoise(seed + 41, x, y, 24) - 0.5) * 0.3;
  let best = places[0],
    bestD = Infinity;
  for (const p of places) {
    const d = Math.abs(Math.atan2(Math.sin(a - p.angle), Math.cos(a - p.angle)));
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best.id;
}

const CRYSTALS = ['#b48cf0', '#6fd6f0', '#f08cc8'];
const CAPS = ['#d9473a', '#4f7fd9', '#e0a03a'];

/**
 * Endlose Landschaft in der Welt eines Tors: Höhen meist eine Stufe, dazu Boden, Wasser und Pflanzen des Themas.
 * Wald (Bäume, Farne, Beeren), Eis (Schnee, zugefrorene Seen, Eisblöcke, Schneetannen), Sand (Dünen, Kakteen, Oasen
 * mit Palmen), Wasser (Inseln mit Palmen), Lava (Basalt, glühende Seen, kahle Bäume), Höhle (dunkler Stein,
 * leuchtende Kristalle, Tropfsteine), Wolken (Wolkeninseln über dem Himmel), Pilze (Moos und Riesenpilze).
 */
function biomeCell(seed: number, theme: GateId, x: number, y: number): Cell {
  const n = valueNoise(seed, x, y, 11);
  const wet = valueNoise(seed + 1, x, y, 7);
  const roll = rand01(seed, x, y, 2);
  const h = n < 0.4 ? 1 : n < 0.66 ? 2 : 3;
  const c: Cell = { ...grass('wild'), h, biome: theme };
  const tree = (kind: TreeKind) => Object.assign(c, { deco: 'tree', solid: true, tree: kind });
  switch (theme) {
    case 'wald':
      if (h === 1 && wet < 0.14) return { ...water('wild'), biome: theme, deco: roll < 0.15 ? 'lily' : null };
      if (roll < 0.11) tree((['oak', 'birch', 'pine', 'autumn'] as const)[hash(seed, x, y, 12) % 4]);
      else if (roll < 0.14) Object.assign(c, { deco: 'bush', solid: true });
      else if (roll < 0.22) c.deco = 'fern';
      else if (roll < 0.25) c.deco = 'mushroom';
      else if (roll < 0.3) Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
      return c;
    case 'eis':
      c.ground = 'snow';
      if (h === 1 && wet < 0.2) return { ...c, ground: 'ice' }; // zugefrorener See, begehbar
      if (roll < 0.06) tree('snowpine');
      else if (roll < 0.09) Object.assign(c, { ground: 'ice', h: h + 1 }); // Eisblock zum Klettern
      return c;
    case 'sand': {
      c.ground = 'sand';
      const dune = valueNoise(seed + 2, x, y, 9);
      c.h = dune < 0.45 ? 1 : dune < 0.7 ? 2 : 3;
      if (wet < 0.1) return { ...water('wild'), biome: theme };
      if (wet < 0.15)
        return roll < 0.35
          ? { ...c, h: 1, ground: 'grass', deco: 'tree', solid: true, tree: 'palm' }
          : { ...c, h: 1, ground: 'grass' };
      if (roll < 0.025) Object.assign(c, { deco: 'cactus', solid: true });
      return c;
    }
    case 'wasser':
      if (wet < 0.62) return { ...water('wild'), biome: theme, deco: roll < 0.04 ? 'lily' : null };
      c.h = 1;
      c.ground = wet < 0.7 ? 'sand' : 'grass';
      if (roll < 0.08) tree('palm');
      else if (c.ground === 'grass' && roll < 0.16)
        Object.assign(c, { deco: 'flower', color: flowerColor(seed, x, y) });
      return c;
    case 'lava':
      c.ground = 'basalt';
      // glühende Flüsse und Seen: man kommt nicht hinein, sie leuchten nur
      if (Math.abs(valueNoise(seed + 4, x, y, 14) - 0.5) < 0.045 || (h <= 2 && wet < 0.24))
        return { ...c, h: 0, ground: 'lava' };
      if (roll < 0.02) tree('dead');
      else if (roll < 0.06) c.h = h + 1; // Basaltblock
      return c;
    case 'hoehle':
      c.ground = 'cave';
      if (roll < 0.04) Object.assign(c, { deco: 'crystal', solid: true, color: CRYSTALS[hash(seed, x, y, 13) % 3] });
      else if (roll < 0.08) Object.assign(c, { deco: 'stalagmite', solid: true });
      else if (roll < 0.11) c.deco = 'mushroom';
      return c;
    case 'wolken': {
      const cloud = valueNoise(seed + 3, x, y, 8);
      if (cloud < 0.42) return { ...c, h: 0, ground: 'sky' }; // Himmel zwischen den Wolken
      c.ground = 'cloud';
      c.h = cloud < 0.6 ? 1 : cloud < 0.75 ? 2 : 3;
      if (roll < 0.08) c.deco = 'cloudpuff';
      return c;
    }
    case 'pilze':
      c.ground = 'moss';
      if (roll < 0.06) Object.assign(c, { deco: 'bigshroom', solid: true, color: CAPS[hash(seed, x, y, 14) % 3] });
      else if (roll < 0.2) c.deco = 'mushroom';
      else if (roll < 0.24) c.deco = 'fern';
      return c;
  }
}

/** Gang hinter einem Tor durch den Fels: schon in seiner Welt, aber eben und frei (Wasser, Lava, Himmel werden Weg) */
function passage(seed: number, id: GateId, x: number, y: number): Cell {
  const c = biomeCell(seed, id, x, y);
  const ground: Ground =
    c.ground === 'water' ? 'sand' : c.ground === 'lava' ? 'basalt' : c.ground === 'sky' ? 'cloud' : c.ground;
  return { ...c, h: 1, ground, deco: c.solid ? null : c.deco, solid: false, tree: undefined };
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

export function createWorld(seed: number): World {
  const places = layouts(seed);
  const { map: regions, spawns } = buildStart(seed, places);
  const cache = new ChunkCache<Cell>((cx, cy) => {
    const cells: Cell[] = [];
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++)
        cells.push(dress(seed, x, y, regions.get(key(x, y)) ?? biomeCell(seed, biomeOf(seed, places, x, y), x, y)));
    return cells;
  });
  const gates = new Map<GateId, GatePlace>(
    places.map(({ id, cells, mid, out, angle }) => [id, { id, cells, mid, out, angle }]),
  );
  return { seed, cell: (x, y) => cache.get(x, y), gates, spawns, portals: portalsOf(places) };
}

/** Höhe, auf der man auf einem Feld steht – null, wenn man dort nicht stehen kann */
export function standHeight(world: World, open: readonly GateId[], x: number, y: number): number | null {
  const c = world.cell(x, y);
  if (c.gate) return open.includes(c.gate) ? 1 : null;
  if (c.solid || c.ground === 'water' || c.ground === 'lava' || c.ground === 'sky') return null;
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
