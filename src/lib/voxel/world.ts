// Szenen-Engine der Voxel-Welt: Würfel-Symbole, Hintergrund-Texturen und `buildScene`, das aus festen Blöcken,
// Startfeld und Wegen die Szene samt Navigationszielen berechnet. Welche Insel gebaut wird, steht in
// src/data/island-layout.ts. Raster und Würfelmaße: cube.ts.
import { cube, overlay, f, particlesCss, tileDataUri } from './render';
import { figureSvg } from './figure';
import { dress, type Avatar } from './avatar';
import * as T from './textures';
import { CUBE_H, CUBE_W, HALF_W, footpt, pos } from './cube';
export { pos };

export type Cell = [number, number, number];
export const key = (c: Cell) => c.join(',');

// Platz über einer Figur mit Sprechblase und unter einem Block mit Etikett darunter (in Szenen-Einheiten)
const BUBBLE_ROOM = 80;
const TAG_ROOM = 46;

// ---------- Würfel-Symbole ----------
export function cubeDefs(avatar: Avatar, prefix = 'v'): string {
  const beard = dress(T.PAL_BEARD, avatar);
  const headL =
    (avatar.beard ? overlay(T.HB_BEARD_L, beard) : '') + (avatar.glasses ? overlay(T.HB_GLASS_L, T.PAL_GLASS) : '');
  const headR =
    (avatar.beard ? overlay(T.HB_BEARD_R, beard) : '') + (avatar.glasses ? overlay(T.HB_GLASS_R, T.PAL_GLASS) : '');
  const id = (n: string) => `${prefix}-${n}`;
  return [
    cube(id('grass'), T.GRASS_TOP, T.GRASS_SIDE, T.GRASS_SIDE, T.PAL_GRASS),
    cube(id('dirt'), T.DIRT, T.DIRT, T.DIRT, T.PAL_GRASS),
    cube(id('stone'), T.STONE, T.STONE, T.STONE, T.PAL_STONE),
    cube(id('log'), T.LOG_TOP, T.LOG_SIDE, T.LOG_SIDE, T.PAL_LOG),
    cube(id('leaves'), T.LEAVES, T.LEAVES, T.LEAVES, T.PAL_LEAVES),
    cube(id('head'), T.HB_T, T.HB_L, T.HB_R, dress(T.PAL_FIG, avatar), headL, headR),
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

// ---------- Partikel: Flugbahnen für Block-Pop und Respawn (fester Seed, gehört in den <head>) ----------
export function particleCss(): string {
  return particlesCss(1234, 'pop', '.px', 'p', 46, 64) + '\n' + particlesCss(98765, 'spawn', '.sp', 's', 50, 78);
}

// ---------- Hintergrund-Texturen als CSS-Variablen ----------
export function textureCss(): string {
  return `:root { --tex-grass: ${tileDataUri(T.GRASS_SIDE, T.PAL_GRASS)}; --tex-dirt: ${tileDataUri(T.DIRT, T.PAL_GRASS)}; --tex-stone: ${tileDataUri(T.STONE, T.PAL_STONE)}; }`;
}

// ---------- Szene: feste Blöcke, Startfeld der Figur, Wege zu den Navigationszielen ----------
// Die Ziele bilden einen Baum: Ein Weg mit `via` beginnt mit dem kompletten Weg seines Elternblocks
// (z. B. Insel → Workshops → Workshop-Kiste). Gleiche Felder teilen sich einen Brückenblock.
export type Tag = 'L' | 'R' | 'B';
export type Blocks = Map<string, { c: Cell; kind: string }>;
// walk: Felder auf der Insel · bridge: Blöcke, die die Figur setzt · climb: vorhandene Blöcke, auf die sie steigt
export type RouteDef = {
  walk: [number, number][];
  bridge: Cell[];
  climb?: Cell[];
  target: Cell;
  tag: Tag;
  fall?: Cell;
  via?: string;
};
export type NavMeta = {
  label: string;
  sym: string;
  delay: string;
  p1: string;
  p2: string;
  color?: string;
  href?: string;
  parent?: string;
};
// Easter Egg: Weg ohne Block und Link, ausgelöst durch Hover über eine Fläche aus vorhandenen Blöcken
export type EggDef = { route: RouteDef; area: Cell[] };
export type SceneDef = {
  blocks: Blocks;
  home: Cell;
  routes: Record<string, RouteDef>;
  meta: Record<string, NavMeta>;
  bubbles: string[]; // Ziele mit Sprechblase – brauchen Platz darüber
  eggs?: Record<string, EggDef>;
};

export type RouteNode = { x: number; y: number; f: 'L' | 'R'; b: boolean; k?: number; fall?: boolean };
export type NavItem = NavMeta & { id: string; x: number; y: number; w: number; z: number; tag: Tag };
export type WorldData = {
  home: { x: number; y: number };
  routes: Record<string, RouteNode[]>;
  bridges: { x: number; y: number; w: number; z: number }[];
  nav: NavItem[];
  // Inselblöcke, die vor einer Brücke oder einem Zielblock stehen: noch einmal darüber gezeichnet, damit sie verdecken
  front: { kind: string; x: number; y: number; w: number; z: number }[];
  eggs: { id: string; x: number; y: number; w: number; h: number }[];
};
export type Scene = ReturnType<typeof buildScene>;

type Step = { c: Cell; b: boolean; fall: boolean };

// Zeichenreihenfolge von hinten nach vorn: erst nach i + j + k, dann nach Höhe, dann nach i
const depthOrder = (a: Cell, b: Cell) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2] || a[0] - b[0];

export function buildScene(def: SceneDef, avatar: Avatar) {
  const has = (i: number, j: number, k: number) => def.blocks.has(key([i, j, k]));
  const vis = [...def.blocks.values()].filter(
    ({ c: [i, j, k] }) => !(has(i + 1, j, k) && has(i, j + 1, k) && has(i, j, k + 1)),
  );
  vis.sort((a, b) => depthOrder(a.c, b.c));
  const xs: number[] = [];
  const ys: number[] = [];
  const uses = vis
    .map(({ c, kind }) => {
      const [X, Y] = pos(...c);
      xs.push(X, X + CUBE_W);
      ys.push(Y, Y + CUBE_H);
      return `<use href="#v-${kind}" x="${f(X)}" y="${f(Y)}" width="${CUBE_W}" height="${CUBE_H}"/>`;
    })
    .join('');

  const fig = figureSvg(avatar);
  const s = 1.9;
  const figH = (fig.foot[1] - fig.box[1]) * s;
  const figHW = (fig.box[2] * s) / 2;
  // Platz für Figur und Sprechblase, wo die Figur mit Sprechblase stehen bleibt
  const headroom = ([x, y]: [number, number]) => {
    xs.push(x - 130, x + 130);
    ys.push(y - figH - BUBBLE_ROOM);
  };
  const [hx, hy] = footpt(...def.home);
  headroom([hx, hy]);

  const allRoutes: Record<string, RouteDef> = {
    ...def.routes,
    ...Object.fromEntries(Object.entries(def.eggs ?? {}).map(([id, e]) => [id, e.route])),
  };
  const steps = (rid: string): Step[] => {
    const d = allRoutes[rid];
    const start: Step[] = d.via
      ? steps(d.via)
      : d.walk.map(([i, j]) => ({ c: [i, j, 0] as Cell, b: false, fall: false }));
    const own: Step[] = d.fall
      ? [{ c: d.fall, b: false, fall: true }]
      : [
          ...d.bridge.map((c) => ({ c, b: true, fall: false })),
          ...(d.climb ?? []).map((c) => ({ c, b: false, fall: false })),
          { c: d.target, b: false, fall: false },
        ];
    return [...start, ...own];
  };

  const bridgeAt = new Map<string, number>();
  const bridgesRaw: { X: number; Y: number; c: Cell }[] = [];
  const nodesRaw: Record<string, { fx: number; fy: number; f: 'L' | 'R'; b: boolean; k?: number; fall?: boolean }[]> =
    {};
  const targets: Record<string, { X: number; Y: number; c: Cell; tag: Tag }> = {};
  for (const [rid, d] of Object.entries(allRoutes)) {
    let prev = def.home;
    nodesRaw[rid] = steps(rid).map(({ c, b, fall }) => {
      const dx = c[0] - prev[0] - (c[1] - prev[1]);
      const [fx, fy] = footpt(...c);
      xs.push(fx - figHW - 8, fx + figHW + 8);
      ys.push(fy - figH - 8);
      let k: number | undefined;
      if (b) {
        k = bridgeAt.get(key(c));
        if (k === undefined) {
          const [X, Y] = pos(...c);
          k = bridgesRaw.push({ X, Y, c }) - 1;
          bridgeAt.set(key(c), k);
          xs.push(X, X + CUBE_W);
          ys.push(Y, Y + CUBE_H);
        }
      }
      prev = c;
      return {
        fx,
        fy,
        f: dx > 0 ? 'R' : 'L',
        b,
        ...(k !== undefined ? { k } : {}),
        ...(fall ? { fall: true } : {}),
      } as const;
    });
    if (def.bubbles.includes(rid)) headroom(footpt(...d.target));
    if (!def.routes[rid]) continue; // Easter Egg: kein Zielblock, kein Etikett

    const [X, Y] = pos(...d.target);
    targets[rid] = { X, Y, c: d.target, tag: d.tag };
    xs.push(X, X + CUBE_W);
    ys.push(Y, Y + CUBE_H);
    // Platz für das Etikett. Kisten zeigen ihres nur beim Zeigen und dürfen dann über den Rand ragen.
    if (!def.meta[rid].parent) {
      const tw = Math.max(125, def.meta[rid].label.length * 10 + 30);
      const half = Math.max(60, (tw - 5) / 2);
      if (d.tag === 'B') {
        ys.push(Y + CUBE_H + TAG_ROOM);
        xs.push(X + HALF_W - half, X + HALF_W + half);
      }
      if (d.tag === 'L') xs.push(X - tw);
      if (d.tag === 'R') xs.push(X + CUBE_W + tw);
    }
  }

  const sx0 = Math.min(...xs) - 14;
  const sy0 = Math.min(...ys) - 14;
  const sw = Math.max(...xs) + 14 - sx0;
  const sh = Math.max(...ys) + 14 - sy0;
  const px = (v: number) => Number(f(((v - sx0) / sw) * 100));
  const py = (v: number) => Number(f(((v - sy0) / sh) * 100));
  const W = Number(f((CUBE_W / sw) * 100));
  // Ebenen über dem Insel-SVG (Brücken, Zielblöcke, Vordergrund) bekommen ihren z-index aus der Zeichenreihenfolge.
  // Inselblöcke, die vor einer dieser Ebenen stehen und sich mit ihr überschneiden, kommen als Vordergrund dazu.
  const dynamic = [...bridgesRaw.map((b) => b.c), ...Object.values(targets).map((t) => t.c)];
  const overlaps = (a: Cell, b: Cell) => {
    const [ax, ay] = pos(...a);
    const [bx, by] = pos(...b);
    return Math.abs(ax - bx) < CUBE_W && Math.abs(ay - by) < CUBE_H;
  };
  // Mit dazu kommen alle Inselblöcke, die wiederum vor einem Vordergrund-Block stehen – sonst zeigte er Seiten,
  // die im Insel-SVG von Nachbarn verdeckt sind.
  const inFront = (c: Cell, of: Cell[]) => of.some((d) => depthOrder(c, d) > 0 && overlaps(c, d));
  const front = vis.filter(({ c }) => inFront(c, dynamic));
  for (let grown = true; grown;) {
    const more = vis.filter(
      (b) =>
        !front.includes(b) &&
        inFront(
          b.c,
          front.map((f) => f.c),
        ),
    );
    front.push(...more);
    grown = more.length > 0;
  }
  const layered = [...dynamic, ...front.map((b) => b.c)].sort(depthOrder).map(key);
  const zi = (c: Cell, t = 0) => 30 + 2 * layered.indexOf(key(c)) + t; // unter der Figur (z-index 200)

  const data: WorldData = {
    home: { x: px(hx), y: py(hy) },
    routes: Object.fromEntries(
      Object.entries(nodesRaw).map(([rid, ns]) => [
        rid,
        ns.map(({ fx, fy, ...n }) => ({ x: px(fx), y: py(fy), ...n })),
      ]),
    ),
    bridges: bridgesRaw.map((b) => ({ x: px(b.X), y: py(b.Y), w: W, z: zi(b.c) })),
    nav: Object.keys(def.routes).map((id) => ({
      id,
      ...def.meta[id],
      x: px(targets[id].X),
      y: py(targets[id].Y),
      w: W,
      z: zi(targets[id].c, 1),
      tag: targets[id].tag,
    })),
    front: front.map(({ c, kind }) => {
      const [X, Y] = pos(...c);
      return { kind, x: px(X), y: py(Y), w: W, z: zi(c) };
    }),
    // Hover-Fläche des Easter Eggs: Umriss der Blöcke, die es auslösen (oben ohne die schrägen Ecken)
    eggs: Object.entries(def.eggs ?? {}).map(([id, e]) => {
      const bx = e.area.map((c) => pos(...c));
      const [ax0, ay0] = [Math.min(...bx.map((b) => b[0])), Math.min(...bx.map((b) => b[1]))];
      const [ax1, ay1] = [Math.max(...bx.map((b) => b[0])) + CUBE_W, Math.max(...bx.map((b) => b[1])) + CUBE_H];
      return {
        id,
        x: px(ax0),
        y: py(ay0 + 10),
        w: Number(f(((ax1 - ax0) / sw) * 100)),
        h: Number(f(((ay1 - ay0 - 20) / sh) * 100)),
      };
    }),
  };

  const [fx0, fy0, fw, fh] = fig.box;
  return {
    data,
    sceneSvg: `<svg viewBox="${[sx0, sy0, sw, sh].map(f).join(' ')}" aria-hidden="true" class="isle-svg">${uses}</svg>`,
    figureSvg: fig.svg,
    aspect: `${f(sw)} / ${f(sh)}`,
    fig: {
      w: f(((fw * s) / sw) * 100),
      tx: f(((fig.foot[0] - fx0) / fw) * 100),
      ty: f(((fig.foot[1] - fy0) / fh) * 100),
    },
  };
}
