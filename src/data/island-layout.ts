// Die Insel von larmic.de: feste Blöcke, Startfeld, Wege zu den vier Bereichen, Plätze für die Kisten der Einträge
// und das Easter Egg am Baum. Gebaut wird sie mit der Szenen-Engine aus src/lib/voxel/world.ts.
// Rein und ohne Astro, damit sie sich testen lässt (island-layout.test.ts); das Laden der Inhalte steckt in island.ts.
import {
  buildScene,
  key,
  type Blocks,
  type Cell,
  type EggDef,
  type NavMeta,
  type RouteDef,
  type Scene,
} from '../lib/voxel/world';
import type { Avatar } from '../lib/voxel/avatar';
import { f } from '../lib/voxel/render';

// ---------- Insel ----------
function islandBlocks(): Blocks {
  const B: Blocks = new Map();
  const put = (c: Cell, kind: string) => B.set(key(c), { c, kind });
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) {
      if ((i === 0 && j === 4) || (i === 4 && j === 0)) continue;
      put([i, j, 0], 'grass');
      put([i, j, -1], 'dirt');
    }
  for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) put([i, j, -2], 'stone');
  for (const [i, j] of [
    [2, 3],
    [3, 2],
    [3, 3],
  ])
    put([i, j, -3], 'stone');
  put([3, 3, -4], 'stone');
  const [ti, tj] = [1, 0];
  put([ti, tj, 1], 'log');
  put([ti, tj, 2], 'log');
  for (const [di, dj] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    put([ti + di, tj + dj, 3], 'leaves');
  put([ti, tj, 4], 'leaves');
  return B;
}

// ---------- Die Insel ----------
const HOME: Cell = [3, 3, 0];
const ROUTES: Record<string, RouteDef> = {
  about: {
    walk: [
      [2, 3],
      [1, 3],
      [0, 3],
    ],
    bridge: [
      [-1, 3, 0],
      [-2, 3, 1],
    ],
    target: [-3, 3, 2],
    tag: 'L',
  },
  workshops: {
    walk: [
      [3, 2],
      [3, 1],
      [3, 0],
    ],
    bridge: [
      [3, -1, 0],
      [3, -2, 1],
    ],
    target: [3, -3, 2],
    tag: 'R',
  },
  videos: {
    walk: [[3, 4]],
    bridge: [
      [3, 5, 0],
      [3, 6, 0],
    ],
    target: [3, 7, -1],
    tag: 'B',
  },
  blog: { walk: [[4, 3]], bridge: [], target: [7, 3, -2], tag: 'B', fall: [5, 3, 0] },
};
const navMeta = (avatar: Avatar): Record<string, NavMeta> => ({
  about: { label: 'Über mich', sym: 'head', delay: '0s', p1: avatar.skin, p2: avatar.hair, href: '/' },
  workshops: { label: 'Workshops', sym: 'board', delay: '-1.1s', p1: '#f39a3d', p2: '#5aa6e8', href: '/workshops/' },
  videos: { label: 'Videos', sym: 'screen', delay: '-2.2s', p1: '#ee4b3e', p2: '#454b59', href: '/videos/' },
  blog: { label: 'Blog', sym: 'shelf', delay: '-0.6s', p1: '#c0453a', p2: '#3f6fb5' },
});

// Kisten der Einträge: feste Plätze rund um ihren Bereichs-Block, Weg = Brücke(n) vom Bereichs-Block aus
type Section = 'workshops' | 'videos';
const CHILD_SLOTS: Record<Section, Pick<RouteDef, 'bridge' | 'target' | 'tag'>[]> = {
  workshops: [
    { bridge: [[3, -4, 3]], target: [3, -5, 4], tag: 'R' }, // oben rechts, Treppe hoch
    { bridge: [[2, -3, 3]], target: [1, -3, 4], tag: 'L' }, // oben links, Treppe hoch
    { bridge: [[4, -3, 2]], target: [5, -3, 1], tag: 'R' }, // rechts, Stufe runter
    {
      bridge: [
        [3, -4, 2],
        [4, -4, 2],
      ],
      target: [4, -5, 2],
      tag: 'R',
    }, // rechts, zwischen erster und dritter Kiste (Reserve)
  ],
  videos: [
    { bridge: [[2, 7, -1]], target: [1, 7, 0], tag: 'L' }, // links, Stufe hoch
    { bridge: [[3, 8, -1]], target: [3, 9, -1], tag: 'L' }, // unten links
    { bridge: [[4, 7, -1]], target: [5, 7, -2], tag: 'B' }, // unten rechts, Stufe runter (unter der Steinspitze vorbei)
    {
      bridge: [
        [4, 7, -1],
        [4, 8, -2],
      ],
      target: [4, 9, -3],
      tag: 'B',
    }, // ganz unten, Treppe runter
  ],
};

export type ChildItem = { id: string; label: string; block: string; color?: string; href: string };

// Easter Egg: Hover über das Blätterdach → die Figur läuft zum Baum, stapelt zwei Blöcke und klettert in die Krone
const TREE_EGG: EggDef = {
  route: {
    walk: [
      [3, 2],
      [3, 1],
    ],
    bridge: [
      [2, 1, 1],
      [2, 1, 2],
    ],
    climb: [[2, 0, 3]],
    target: [1, 0, 4],
    tag: 'B',
  },
  area: [
    [0, 0, 3],
    [2, 0, 3],
    [1, -1, 3],
    [1, 1, 3],
    [1, 0, 4],
  ],
};

export function buildWorld(children: Record<Section, ChildItem[]>, avatar: Avatar): Scene {
  const NAV_META = navMeta(avatar);
  const routes: Record<string, RouteDef> = {};
  const meta: Record<string, NavMeta> = {};
  for (const id of Object.keys(ROUTES)) {
    routes[id] = ROUTES[id];
    meta[id] = NAV_META[id];
    if (id !== 'workshops' && id !== 'videos') continue;
    const slots = CHILD_SLOTS[id];
    if (children[id].length > slots.length)
      throw new Error(
        `Insel: Für ${id} gibt es ${slots.length} Plätze, gefunden: ${children[id].length} Einträge. Einen Platz in CHILD_SLOTS (src/data/island-layout.ts) ergänzen oder einen Eintrag auf draft: true setzen.`,
      );
    children[id].forEach((it, n) => {
      const cid = `${id}/${it.id}`;
      routes[cid] = { walk: [], via: id, ...slots[n] };
      meta[cid] = {
        label: it.label,
        sym: it.block,
        delay: `${f(-0.4 - 0.7 * n)}s`,
        p1: it.color ?? '#f0a531',
        p2: '#ffffff',
        color: it.color,
        href: it.href,
        parent: id,
      };
    });
  }
  return buildScene(
    {
      blocks: islandBlocks(),
      home: HOME,
      routes,
      meta,
      bubbles: [...Object.keys(ROUTES), 'tree'],
      eggs: { tree: TREE_EGG },
    },
    avatar,
  );
}
