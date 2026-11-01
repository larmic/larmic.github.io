// Die Inselwelt: Würfel-Symbole, Insel-Szene, Brücken-Routen und Positionen der Navigationsblöcke.
// Raster: i nach rechts unten, j nach links unten, k nach oben. Bounding-Box eines Blocks:
//   X = (i − j)·40,  Y = (i + j)·20 − k·44,8   (Würfel-viewBox 0 0 80 84.8)
import { cube, overlay, f, particlesCss, tileDataUri } from './render';
import { figureSvg } from './figure';
import * as T from './textures';
import { AVATAR } from '../../data/avatar';

type Cell = [number, number, number];
const key = (c: Cell) => c.join(',');
export const pos = (i: number, j: number, k: number): [number, number] => [(i - j) * 40, (i + j) * 20 - k * 44.8];
const footpt = (i: number, j: number, k: number): [number, number] => [(i - j) * 40 + 40, (i + j) * 20 + 20 - k * 44.8];

// ---------- Würfel-Symbole ----------
export function cubeDefs(prefix = 'v'): string {
  const headL = (AVATAR.beard ? overlay(T.HB_BEARD_L, T.PAL_BEARD) : '') + (AVATAR.glasses ? overlay(T.HB_GLASS_L, T.PAL_GLASS) : '');
  const headR = (AVATAR.beard ? overlay(T.HB_BEARD_R, T.PAL_BEARD) : '') + (AVATAR.glasses ? overlay(T.HB_GLASS_R, T.PAL_GLASS) : '');
  const id = (n: string) => `${prefix}-${n}`;
  return [
    cube(id('grass'), T.GRASS_TOP, T.GRASS_SIDE, T.GRASS_SIDE, T.PAL_GRASS),
    cube(id('dirt'), T.DIRT, T.DIRT, T.DIRT, T.PAL_GRASS),
    cube(id('stone'), T.STONE, T.STONE, T.STONE, T.PAL_STONE),
    cube(id('log'), T.LOG_TOP, T.LOG_SIDE, T.LOG_SIDE, T.PAL_LOG),
    cube(id('leaves'), T.LEAVES, T.LEAVES, T.LEAVES, T.PAL_LEAVES),
    cube(id('head'), T.HB_T, T.HB_L, T.HB_R, T.PAL_FIG, headL, headR),
    cube(id('board'), T.PLANKS, T.BOARD_L, T.BOARD_R, T.PAL_BOARD),
    cube(id('screen'), T.SCREEN_T, T.SCREEN_L, T.SCREEN_R, T.PAL_SCREEN),
    cube(id('shelf'), T.PLANKS, T.SHELF_L, T.SHELF_R, T.PAL_SHELF),
    cube(id('plank'), T.PLANKS, T.PLANKS, T.PLANKS, T.PAL_BOARD),
    // getönte Blöcke: Farbe kommt per CSS `color` (currentColor)
    cube(id('crate'), T.CRATE, T.CRATE, T.CRATE, T.PAL_TINT),
    cube(id('crystal'), T.CRYSTAL, T.CRYSTAL, T.CRYSTAL, T.PAL_TINT),
    cube(id('metal'), T.METAL, T.METAL, T.METAL, T.PAL_TINT),
  ].join('');
}

// ---------- Hintergrund-Texturen als CSS-Variablen ----------
export function textureCss(): string {
  return `:root { --tex-grass: ${tileDataUri(T.GRASS_SIDE, T.PAL_GRASS)}; --tex-dirt: ${tileDataUri(T.DIRT, T.PAL_GRASS)}; --tex-stone: ${tileDataUri(T.STONE, T.PAL_STONE)}; }`;
}

// ---------- Insel ----------
function islandBlocks(): Map<string, { c: Cell; kind: string }> {
  const B = new Map<string, { c: Cell; kind: string }>();
  const put = (c: Cell, kind: string) => B.set(key(c), { c, kind });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    if ((i === 0 && j === 4) || (i === 4 && j === 0)) continue;
    put([i, j, 0], 'grass');
    put([i, j, -1], 'dirt');
  }
  for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) put([i, j, -2], 'stone');
  for (const [i, j] of [[2, 3], [3, 2], [3, 3]]) put([i, j, -3], 'stone');
  put([3, 3, -4], 'stone');
  const [ti, tj] = [1, 0];
  put([ti, tj, 1], 'log');
  put([ti, tj, 2], 'log');
  for (const [di, dj] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) put([ti + di, tj + dj, 3], 'leaves');
  put([ti, tj, 4], 'leaves');
  return B;
}


// ---------- Szene: feste Blöcke, Startfeld der Figur, Wege zu den Navigationszielen ----------
// Die Ziele bilden einen Baum: Ein Weg mit `via` beginnt mit dem kompletten Weg seines Elternblocks
// (z. B. Insel → Workshops → Workshop-Kiste). Gleiche Felder teilen sich einen Brückenblock.
type Tag = 'L' | 'R' | 'B';
type Blocks = Map<string, { c: Cell; kind: string }>;
type RouteDef = { walk: [number, number][]; bridge: Cell[]; target: Cell; tag: Tag; fall?: Cell; via?: string };
type NavMeta = { label: string; sym: string; delay: string; p1: string; p2: string; color?: string; href?: string; parent?: string };
type SceneDef = {
  blocks: Blocks;
  home: Cell;
  routes: Record<string, RouteDef>;
  meta: Record<string, NavMeta>;
  bubbles: string[]; // Ziele mit Sprechblase – brauchen Platz darüber
};

export type RouteNode = { x: number; y: number; f: 'L' | 'R'; b: boolean; k?: number; fall?: boolean };
export type NavItem = NavMeta & { id: string; x: number; y: number; w: number; z: number; tag: Tag };
export type WorldData = {
  home: { x: number; y: number };
  routes: Record<string, RouteNode[]>;
  bridges: { x: number; y: number; w: number; z: number }[];
  nav: NavItem[];
};
export type Scene = ReturnType<typeof buildScene>;

type Step = { c: Cell; b: boolean; fall: boolean };

function buildScene(def: SceneDef) {
  const has = (i: number, j: number, k: number) => def.blocks.has(key([i, j, k]));
  const vis = [...def.blocks.values()].filter(({ c: [i, j, k] }) => !(has(i + 1, j, k) && has(i, j + 1, k) && has(i, j, k + 1)));
  vis.sort((a, b) => (a.c[0] + a.c[1] + a.c[2]) - (b.c[0] + b.c[1] + b.c[2]) || a.c[2] - b.c[2] || a.c[0] - b.c[0]);
  const xs: number[] = [];
  const ys: number[] = [];
  const uses = vis.map(({ c, kind }) => {
    const [X, Y] = pos(...c);
    xs.push(X, X + 80);
    ys.push(Y, Y + 84.8);
    return `<use href="#v-${kind}" x="${f(X)}" y="${f(Y)}" width="80" height="84.8"/>`;
  }).join('');

  const fig = figureSvg();
  const s = 1.9;
  const figH = (fig.foot[1] - fig.box[1]) * s;
  const figHW = (fig.box[2] * s) / 2;
  // Platz für Figur und Sprechblase, wo die Figur mit Sprechblase stehen bleibt
  const headroom = ([x, y]: [number, number]) => {
    xs.push(x - 130, x + 130);
    ys.push(y - figH - 80);
  };
  const [hx, hy] = footpt(...def.home);
  headroom([hx, hy]);

  const steps = (rid: string): Step[] => {
    const d = def.routes[rid];
    const start: Step[] = d.via ? steps(d.via) : d.walk.map(([i, j]) => ({ c: [i, j, 0] as Cell, b: false, fall: false }));
    const own: Step[] = d.fall ? [{ c: d.fall, b: false, fall: true }] : [...d.bridge.map((c) => ({ c, b: true, fall: false })), { c: d.target, b: false, fall: false }];
    return [...start, ...own];
  };

  const bridgeAt = new Map<string, number>();
  const bridgesRaw: { X: number; Y: number; d: number }[] = [];
  const nodesRaw: Record<string, { fx: number; fy: number; f: 'L' | 'R'; b: boolean; k?: number; fall?: boolean }[]> = {};
  const targets: Record<string, { X: number; Y: number; d: number; tag: Tag }> = {};
  for (const [rid, d] of Object.entries(def.routes)) {
    let prev = def.home;
    nodesRaw[rid] = steps(rid).map(({ c, b, fall }) => {
      const dx = (c[0] - prev[0]) - (c[1] - prev[1]);
      const [fx, fy] = footpt(...c);
      xs.push(fx - figHW - 8, fx + figHW + 8);
      ys.push(fy - figH - 8);
      let k: number | undefined;
      if (b) {
        k = bridgeAt.get(key(c));
        if (k === undefined) {
          const [X, Y] = pos(...c);
          k = bridgesRaw.push({ X, Y, d: c[0] + c[1] + c[2] }) - 1;
          bridgeAt.set(key(c), k);
          xs.push(X, X + 80);
          ys.push(Y, Y + 84.8);
        }
      }
      prev = c;
      return { fx, fy, f: dx > 0 ? 'R' : 'L', b, ...(k !== undefined ? { k } : {}), ...(fall ? { fall: true } : {}) } as const;
    });
    if (def.bubbles.includes(rid)) headroom(footpt(...d.target));

    const [X, Y] = pos(...d.target);
    targets[rid] = { X, Y, d: d.target[0] + d.target[1] + d.target[2], tag: d.tag };
    xs.push(X, X + 80);
    ys.push(Y, Y + 84.8);
    // Platz für das Etikett. Kisten zeigen ihres nur beim Zeigen und dürfen dann über den Rand ragen.
    if (!def.meta[rid].parent) {
      const tw = Math.max(125, def.meta[rid].label.length * 10 + 30);
      const half = Math.max(60, (tw - 5) / 2);
      if (d.tag === 'B') { ys.push(Y + 84.8 + 46); xs.push(X + 40 - half, X + 40 + half); }
      if (d.tag === 'L') xs.push(X - tw);
      if (d.tag === 'R') xs.push(X + 80 + tw);
    }
  }

  const sx0 = Math.min(...xs) - 14;
  const sy0 = Math.min(...ys) - 14;
  const sw = Math.max(...xs) + 14 - sx0;
  const sh = Math.max(...ys) + 14 - sy0;
  const px = (v: number) => Number(f(((v - sx0) / sw) * 100));
  const py = (v: number) => Number(f(((v - sy0) / sh) * 100));
  const W = Number(f((80 / sw) * 100));
  const zi = (dd: number, t = 0) => 30 + 2 * (dd + 12) + t;

  const data: WorldData = {
    home: { x: px(hx), y: py(hy) },
    routes: Object.fromEntries(Object.entries(nodesRaw).map(([rid, ns]) => [rid, ns.map(({ fx, fy, ...n }) => ({ x: px(fx), y: py(fy), ...n }))])),
    bridges: bridgesRaw.map((b) => ({ x: px(b.X), y: py(b.Y), w: W, z: zi(b.d) })),
    nav: Object.keys(def.routes).map((id) => ({
      id, ...def.meta[id], x: px(targets[id].X), y: py(targets[id].Y), w: W, z: zi(targets[id].d, 1), tag: targets[id].tag,
    })),
  };

  const [fx0, fy0, fw, fh] = fig.box;
  return {
    data,
    sceneSvg: `<svg viewBox="${[sx0, sy0, sw, sh].map(f).join(' ')}" aria-hidden="true" class="isle-svg">${uses}</svg>`,
    figureSvg: fig.svg,
    aspect: `${f(sw)} / ${f(sh)}`,
    fig: { w: f((fw * s / sw) * 100), tx: f(((fig.foot[0] - fx0) / fw) * 100), ty: f(((fig.foot[1] - fy0) / fh) * 100) },
    particles: particlesCss(1234, 'pop', '.px', 'p', 46, 64) + '\n' + particlesCss(98765, 'spawn', '.sp', 's', 50, 78),
  };
}

// ---------- Die Insel ----------
const HOME: Cell = [3, 3, 0];
const ROUTES: Record<string, RouteDef> = {
  about: { walk: [[2, 3], [1, 3], [0, 3]], bridge: [[-1, 3, 0], [-2, 3, 1]], target: [-3, 3, 2], tag: 'L' },
  workshops: { walk: [[3, 2], [3, 1], [3, 0]], bridge: [[3, -1, 0], [3, -2, 1]], target: [3, -3, 2], tag: 'R' },
  videos: { walk: [[3, 4]], bridge: [[3, 5, 0], [3, 6, 0]], target: [3, 7, -1], tag: 'B' },
  blog: { walk: [[4, 3]], bridge: [], target: [7, 3, -2], tag: 'B', fall: [5, 3, 0] },
};
const NAV_META: Record<string, NavMeta> = {
  about: { label: 'Über mich', sym: 'head', delay: '0s', p1: AVATAR.skin, p2: AVATAR.hair, href: '/' },
  workshops: { label: 'Workshops', sym: 'board', delay: '-1.1s', p1: '#f39a3d', p2: '#5aa6e8', href: '/workshops/' },
  videos: { label: 'Videos', sym: 'screen', delay: '-2.2s', p1: '#ee4b3e', p2: '#454b59', href: '/videos/' },
  blog: { label: 'Blog', sym: 'shelf', delay: '-0.6s', p1: '#c0453a', p2: '#3f6fb5' },
};

// Kisten der Einträge: feste Plätze rund um ihren Bereichs-Block, Weg = Brücke(n) vom Bereichs-Block aus
type Section = 'workshops' | 'videos';
const CHILD_SLOTS: Record<Section, Pick<RouteDef, 'bridge' | 'target' | 'tag'>[]> = {
  workshops: [
    { bridge: [[3, -4, 3]], target: [3, -5, 4], tag: 'R' }, // oben rechts, Treppe hoch
    { bridge: [[2, -3, 3]], target: [1, -3, 4], tag: 'L' }, // oben links, Treppe hoch
    { bridge: [[4, -3, 2]], target: [5, -3, 1], tag: 'R' }, // rechts, Stufe runter
  ],
  videos: [
    { bridge: [[2, 7, -1]], target: [1, 7, 0], tag: 'L' }, // links, Stufe hoch
    { bridge: [[3, 8, -1]], target: [3, 9, -1], tag: 'L' }, // unten links
    { bridge: [[4, 7, -1]], target: [5, 7, -2], tag: 'B' }, // unten rechts, Stufe runter (unter der Steinspitze vorbei)
    { bridge: [[4, 7, -1], [4, 8, -2]], target: [4, 9, -3], tag: 'B' }, // ganz unten, Treppe runter
  ],
};

export type ChildItem = { id: string; label: string; block: string; color?: string; href: string };

export function buildWorld(children: Record<Section, ChildItem[]>): Scene {
  const routes: Record<string, RouteDef> = {};
  const meta: Record<string, NavMeta> = {};
  for (const id of Object.keys(ROUTES)) {
    routes[id] = ROUTES[id];
    meta[id] = NAV_META[id];
    if (id !== 'workshops' && id !== 'videos') continue;
    const slots = CHILD_SLOTS[id];
    if (children[id].length > slots.length) throw new Error(`Insel: Für ${id} gibt es ${slots.length} Plätze, gefunden: ${children[id].length} Einträge`);
    children[id].forEach((it, n) => {
      const cid = `${id}/${it.id}`;
      routes[cid] = { walk: [], via: id, ...slots[n] };
      meta[cid] = { label: it.label, sym: it.block, delay: `${f(-0.4 - 0.7 * n)}s`, p1: it.color ?? '#f0a531', p2: '#ffffff', color: it.color, href: it.href, parent: id };
    });
  }
  return buildScene({ blocks: islandBlocks(), home: HOME, routes, meta, bubbles: Object.keys(ROUTES) });
}
