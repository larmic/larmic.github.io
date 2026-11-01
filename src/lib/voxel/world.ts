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


// ---------- Szenen: feste Blöcke, Startfeld der Figur, Wege zu den Navigationszielen ----------
type Tag = 'L' | 'R' | 'B';
type Blocks = Map<string, { c: Cell; kind: string }>;
type RouteDef = { walk: [number, number][]; bridge: Cell[]; target: Cell; tag: Tag; fall?: Cell };
type NavMeta = { label: string; sym: string; delay: string; p1: string; p2: string; color?: string; href?: string };
type SceneDef = {
  blocks: Blocks;
  home: Cell;
  routes: Record<string, RouteDef>;
  meta: Record<string, NavMeta>;
  rests?: string[]; // Ziele, auf denen die Figur stehen bleiben kann – brauchen Platz für die Sprechblase
  groups?: Record<string, Blocks>; // Blockgruppe statt eines einzelnen Zielblocks (die kleine Insel auf Ebene 2)
};

export type RouteNode = { x: number; y: number; f: 'L' | 'R'; b: boolean; fall?: boolean };
export type NavItem = NavMeta & { id: string; x: number; y: number; w: number; z: number; tag: Tag; svg?: string };
export type WorldData = {
  home: { x: number; y: number };
  routes: Record<string, RouteNode[]>;
  bridges: { route: string; idx: number; x: number; y: number; w: number; z: number }[];
  nav: NavItem[];
};
export type Scene = ReturnType<typeof buildScene>;

// Sichtbare Blöcke von hinten nach vorn als <use>, dazu ihre Bounding-Box
function blockUses(B: Blocks) {
  const has = (i: number, j: number, k: number) => B.has(key([i, j, k]));
  const vis = [...B.values()].filter(({ c: [i, j, k] }) => !(has(i + 1, j, k) && has(i, j + 1, k) && has(i, j, k + 1)));
  vis.sort((a, b) => (a.c[0] + a.c[1] + a.c[2]) - (b.c[0] + b.c[1] + b.c[2]) || a.c[2] - b.c[2] || a.c[0] - b.c[0]);
  const xs: number[] = [];
  const ys: number[] = [];
  const uses = vis.map(({ c, kind }) => {
    const [X, Y] = pos(...c);
    xs.push(X, X + 80);
    ys.push(Y, Y + 84.8);
    return `<use href="#v-${kind}" x="${f(X)}" y="${f(Y)}" width="80" height="84.8"/>`;
  }).join('');
  return { uses, xs, ys };
}

function buildScene(def: SceneDef) {
  const { uses, xs, ys } = blockUses(def.blocks);

  const fig = figureSvg();
  const s = 1.9;
  const figH = (fig.foot[1] - fig.box[1]) * s;
  const figHW = (fig.box[2] * s) / 2;
  // Platz für Figur und Sprechblase überall, wo die Figur stehen bleibt
  const headroom = ([hx, hy]: [number, number]) => {
    xs.push(hx - 130, hx + 130);
    ys.push(hy - figH - 80);
  };
  const [hx, hy] = footpt(...def.home);
  headroom([hx, hy]);

  const nodesRaw: Record<string, { fx: number; fy: number; f: 'L' | 'R'; b: boolean; fall?: boolean }[]> = {};
  const bridgesRaw: { route: string; idx: number; X: number; Y: number; d: number }[] = [];
  const targets: Record<string, { X: number; Y: number; d: number; tag: Tag }> = {};
  const groups: Record<string, { uses: string; x0: number; y0: number; x1: number; y1: number }> = {};
  for (const [rid, d] of Object.entries(def.routes)) {
    let prev = def.home;
    const cells: { c: Cell; b: boolean; fall: boolean }[] = d.walk.map(([i, j]) => ({ c: [i, j, 0] as Cell, b: false, fall: false }));
    if (d.fall) cells.push({ c: d.fall, b: false, fall: true });
    else {
      d.bridge.forEach((c) => cells.push({ c, b: true, fall: false }));
      cells.push({ c: d.target, b: false, fall: false });
    }
    nodesRaw[rid] = cells.map(({ c, b, fall }, idx) => {
      const dx = (c[0] - prev[0]) - (c[1] - prev[1]);
      const [fx, fy] = footpt(...c);
      xs.push(fx - figHW - 8, fx + figHW + 8);
      ys.push(fy - figH - 8);
      if (b) {
        const [X, Y] = pos(...c);
        bridgesRaw.push({ route: rid, idx, X, Y, d: c[0] + c[1] + c[2] });
        xs.push(X, X + 80);
        ys.push(Y, Y + 84.8);
      }
      prev = c;
      return { fx, fy, f: dx > 0 ? 'R' : 'L', b, ...(fall ? { fall: true } : {}) } as const;
    }) as any;
    if (def.rests?.includes(rid)) headroom(footpt(...d.target));

    const group = def.groups?.[rid];
    let [X, Y] = pos(...d.target);
    let W = 80;
    let H = 84.8;
    if (group) {
      const g = blockUses(group);
      groups[rid] = { uses: g.uses, x0: Math.min(...g.xs), y0: Math.min(...g.ys), x1: Math.max(...g.xs), y1: Math.max(...g.ys) };
      [X, Y, W, H] = [groups[rid].x0, groups[rid].y0, groups[rid].x1 - groups[rid].x0, groups[rid].y1 - groups[rid].y0];
    }
    targets[rid] = { X, Y, d: d.target[0] + d.target[1] + d.target[2], tag: d.tag };
    xs.push(X, X + W);
    ys.push(Y, Y + H);
    // Platz für das Etikett, lange Namen brechen höchstens auf zwei Zeilen um
    const tw = Math.max(125, Math.min(190, def.meta[rid].label.length * 10 + 30));
    const half = Math.max(60, (tw - 5) / 2);
    if (d.tag === 'B') { ys.push(Y + H + 46); xs.push(X + W / 2 - half, X + W / 2 + half); }
    if (d.tag === 'L') xs.push(X - tw);
    if (d.tag === 'R') xs.push(X + W + tw);
  }

  const sx0 = Math.min(...xs) - 14;
  const sy0 = Math.min(...ys) - 14;
  const sw = Math.max(...xs) + 14 - sx0;
  const sh = Math.max(...ys) + 14 - sy0;
  const px = (v: number) => Number(f(((v - sx0) / sw) * 100));
  const py = (v: number) => Number(f(((v - sy0) / sh) * 100));
  const zi = (dd: number, t = 0) => 30 + 2 * (dd + 12) + t;

  const data: WorldData = {
    home: { x: px(hx), y: py(hy) },
    routes: Object.fromEntries(Object.entries(nodesRaw).map(([rid, ns]) => [rid, ns.map((n) => ({ x: px(n.fx), y: py(n.fy), f: n.f, b: n.b, ...(n.fall ? { fall: true } : {}) }))])),
    bridges: bridgesRaw.map((b) => ({ route: b.route, idx: b.idx, x: px(b.X), y: py(b.Y), w: Number(f((80 / sw) * 100)), z: zi(b.d) })),
    nav: Object.keys(def.routes).map((id) => {
      const t = targets[id];
      const g = groups[id];
      return {
        id, ...def.meta[id], x: px(t.X), y: py(t.Y), z: zi(t.d, g ? -1 : 1), tag: t.tag,
        w: Number(f(((g ? g.x1 - g.x0 : 80) / sw) * 100)),
        ...(g ? { svg: `<svg viewBox="${[g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0].map(f).join(' ')}" aria-hidden="true">${g.uses}</svg>` } : {}),
      };
    }),
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

// ---------- Ebene 1: die Insel der Startseite ----------
const HOME: Cell = [3, 3, 0];
const ROUTES: Record<string, RouteDef> = {
  about: { walk: [[2, 3], [1, 3], [0, 3]], bridge: [[-1, 3, 0], [-2, 3, 1]], target: [-3, 3, 2], tag: 'L' },
  workshops: { walk: [[3, 2], [3, 1], [3, 0]], bridge: [[3, -1, 0], [3, -2, 1]], target: [3, -3, 2], tag: 'R' },
  videos: { walk: [[3, 4]], bridge: [[3, 5, 0], [3, 6, 0]], target: [3, 7, -1], tag: 'B' },
  blog: { walk: [[4, 3]], bridge: [], target: [7, 3, -2], tag: 'B', fall: [5, 3, 0] },
};
const NAV_META: Record<string, NavMeta> = {
  about: { label: 'Über mich', sym: 'head', delay: '0s', p1: AVATAR.skin, p2: AVATAR.hair },
  workshops: { label: 'Workshops', sym: 'board', delay: '-1.1s', p1: '#f39a3d', p2: '#5aa6e8' },
  videos: { label: 'Videos', sym: 'screen', delay: '-2.2s', p1: '#ee4b3e', p2: '#454b59' },
  blog: { label: 'Blog', sym: 'shelf', delay: '-0.6s', p1: '#c0453a', p2: '#3f6fb5' },
};

export function buildWorld(): Scene {
  return buildScene({ blocks: islandBlocks(), home: HOME, routes: ROUTES, meta: NAV_META });
}

// ---------- Ebene 2: ein Bereich (Workshops, Videos) ----------
// Der Bereichs-Block schwebt in der Mitte, die Einträge liegen als Kisten auf festen Plätzen drumherum.
// Links schwebt eine kleine Insel: der Weg zurück zur Startseite.
const LEVEL_HOME: Cell = [0, 0, 0];
const LEVEL_SLOTS: Omit<RouteDef, 'walk'>[] = [
  { bridge: [[0, -1, 0], [0, -2, 1]], target: [0, -3, 2], tag: 'R' }, // oben rechts, Treppe hoch
  { bridge: [[1, 0, 0], [1, -1, 0], [2, -1, 0], [2, -2, 0]], target: [3, -2, 0], tag: 'R' }, // rechts
  { bridge: [[1, 0, 0], [2, 0, -1]], target: [3, 0, -2], tag: 'R' }, // unten rechts, Treppe runter
  { bridge: [[0, 1, 0], [0, 2, -1]], target: [0, 3, -2], tag: 'L' }, // unten links, Treppe runter
];
export const LEVEL_BACK = 'insel';

function isletBlocks(): Blocks {
  const B: Blocks = new Map();
  const put = (c: Cell, kind: string) => B.set(key(c), { c, kind });
  for (const i of [-5, -4]) for (const j of [-1, 0]) {
    put([i, j, 0], 'grass');
    put([i, j, -1], 'dirt');
  }
  put([-4, 0, -2], 'stone');
  put([-5, -1, 1], 'log');
  put([-5, -1, 2], 'log');
  for (const [di, dj] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) put([-5 + di, -1 + dj, 3], 'leaves');
  put([-5, -1, 4], 'leaves');
  return B;
}

export type LevelItem = { id: string; label: string; block: string; color?: string; href: string };

export function buildLevel(hub: string, items: LevelItem[], back: { label: string; href: string }): Scene {
  if (items.length > LEVEL_SLOTS.length) throw new Error(`Ebene „${hub}“: höchstens ${LEVEL_SLOTS.length} Einträge möglich, gefunden: ${items.length}`);
  if (items.some((it) => it.id === LEVEL_BACK)) throw new Error(`Ebene „${hub}“: die ID „${LEVEL_BACK}“ ist für die Insel reserviert`);
  const routes: Record<string, RouteDef> = {};
  const meta: Record<string, NavMeta> = {};
  items.forEach((it, n) => {
    routes[it.id] = { walk: [], ...LEVEL_SLOTS[n] };
    meta[it.id] = { label: it.label, sym: it.block, delay: `${f(-0.3 - 0.9 * n)}s`, p1: it.color ?? '#f0a531', p2: '#ffffff', color: it.color, href: it.href };
  });
  routes[LEVEL_BACK] = { walk: [], bridge: [[-1, 0, 0], [-2, 0, 0], [-3, 0, 0]], target: [-4, 0, 0], tag: 'B' };
  meta[LEVEL_BACK] = { label: back.label, sym: 'grass', delay: '0s', p1: '#6dbd47', p2: '#9b6a43', href: back.href };
  const blocks: Blocks = new Map([[key(LEVEL_HOME), { c: LEVEL_HOME, kind: hub }]]);
  return buildScene({ blocks, home: LEVEL_HOME, routes, meta, rests: items.map((it) => it.id), groups: { [LEVEL_BACK]: isletBlocks() } });
}
