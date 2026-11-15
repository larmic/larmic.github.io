// Bausteine der 3D-Ansicht: Textur-Atlas aus den 8 × 8-Rastern der Seite und ein Baukasten, der Quader und Flächen
// zu einer Geometrie zusammenfügt. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Matrix4,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { hash } from '../../lib/games/rng';
import {
  DIRT,
  GRASS_SIDE,
  GRASS_TOP,
  LEAVES,
  LOG_SIDE,
  LOG_TOP,
  PAL_GRASS,
  PAL_LOG,
  PAL_SHELF,
  PAL_STONE,
  PLANKS,
  STONE,
  type Grid,
  type Palette,
} from '../../lib/voxel/textures';

// ---------- Textur-Kacheln ----------

export type Tile =
  | 'grassTop'
  | 'grassSide'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'path'
  | 'leaves'
  | 'log'
  | 'logTop'
  | 'planks'
  | 'white'
  | 'lava'
  | 'ice'
  | 'cave'
  | 'water'
  // Welten hinter den Toren
  | 'snowTop'
  | 'snowSide'
  | 'basalt'
  | 'cloud'
  | 'mossTop'
  | 'mossSide'
  | 'sandstone'
  | 'fur'; // feine helle Körnung für Tiere und Figur (die Farbe kommt aus dem Modell)
const TILES: Tile[] = [
  'grassTop',
  'grassSide',
  'dirt',
  'stone',
  'sand',
  'path',
  'leaves',
  'log',
  'logTop',
  'planks',
  'white',
  'lava',
  'ice',
  'cave',
  'water',
  'snowTop',
  'snowSide',
  'basalt',
  'cloud',
  'mossTop',
  'mossSide',
  'sandstone',
  'fur',
];
const TPX = 16; // Pixel je Kachel: 8 × 8-Raster mit feiner Körnung in 2 × 2 Unterpixeln
const COLS = 4;
const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };
// Themen-Blöcke auf den großen Toren
const PAL_LAVA: Palette = { D: [['#ff7a1a', 1]], d: [['#b8380a', 1]], e: [['#ffd34d', 1]] };
const PAL_ICE: Palette = { S: [['#bfe6f5', 1]], s: [['#a2d6ee', 1]], r: [['#f2fbff', 1]] };
const PAL_CAVE: Palette = { S: [['#3c3f47', 1]], s: [['#2a2c33', 1]], r: [['#5a5f70', 1]] };
const PAL_WATER: Palette = { D: [['#3f8fd8', 1]], d: [['#2f6fb8', 1]], e: [['#8cc6f0', 1]] };
// Böden der Welten hinter den Toren
const PAL_SNOW: Palette = {
  G: [['#f4f8fb', 1]],
  g: [['#e2ecf3', 1]],
  l: [['#ffffff', 1]],
  D: [['#9b6a43', 1]],
  d: [['#7d5232', 1]],
  e: [['#b27f53', 1]],
};
const PAL_BASALT: Palette = { S: [['#3a3b42', 1]], s: [['#2a2b30', 1]], r: [['#50525c', 1]] };
const PAL_CLOUD: Palette = { D: [['#fbfdff', 1]], d: [['#e6eef7', 1]], e: [['#ffffff', 1]] };
const PAL_MOSS: Palette = {
  G: [['#8a76cc', 1]],
  g: [['#7462b4', 1]],
  l: [['#a594e3', 1]],
  D: [['#6a4a3a', 1]],
  d: [['#56392c', 1]],
  e: [['#7f5a46', 1]],
};
const PAL_SANDSTONE: Palette = { A: [['#e2c78e', 1]], a: [['#d1b273', 1]], z: [['#b9965c', 1]] };
// Blätter in Grau: Die Baumart färbt sie über die Vertex-Farbe (grün, orange, rosa)
const PAL_LEAVES_GRAY: Palette = {
  F: [['#e6e6e6', 1]],
  f: [['#cccccc', 1]],
  k: [['#ffffff', 1]],
  q: [['#b4b4b4', 1]],
};
const SOURCES: Record<Tile, [Grid, Palette] | null> = {
  grassTop: [GRASS_TOP, PAL_GRASS],
  grassSide: [GRASS_SIDE, PAL_GRASS],
  dirt: [DIRT, PAL_GRASS],
  stone: [STONE, PAL_STONE],
  sand: [DIRT, PAL_SAND],
  path: [DIRT, PAL_PATH],
  leaves: [LEAVES, PAL_LEAVES_GRAY],
  log: [LOG_SIDE, PAL_LOG],
  logTop: [LOG_TOP, PAL_LOG],
  planks: [PLANKS, PAL_SHELF],
  white: null,
  lava: [DIRT, PAL_LAVA],
  ice: [STONE, PAL_ICE],
  cave: [STONE, PAL_CAVE],
  water: [DIRT, PAL_WATER],
  snowTop: [GRASS_TOP, PAL_SNOW],
  snowSide: [GRASS_SIDE, PAL_SNOW],
  basalt: [STONE, PAL_BASALT],
  cloud: [DIRT, PAL_CLOUD],
  mossTop: [GRASS_TOP, PAL_MOSS],
  mossSide: [GRASS_SIDE, PAL_MOSS],
  sandstone: [PLANKS, PAL_SANDSTONE],
  fur: [DIRT, { D: [['#ffffff', 1]], d: [['#ececec', 1]], e: [['#f6f6f6', 1]] }],
};

export function atlas(): CanvasTexture {
  const rows = Math.ceil(TILES.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TPX;
  canvas.height = rows * TPX;
  const ctx = canvas.getContext('2d')!;
  TILES.forEach((t, i) => {
    const ox = (i % COLS) * TPX,
      oy = Math.floor(i / COLS) * TPX;
    const src = SOURCES[t];
    if (!src) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, oy, TPX, TPX);
      return;
    }
    const [grid, pal] = src;
    const px = TPX / grid.length;
    grid.forEach((row, r) => {
      for (const [c, ch] of [...row].entries())
        for (const [color, alpha] of pal[ch] ?? []) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(ox + c * px, oy + r * px, px, px);
        }
    });
    ctx.globalAlpha = 1;
    // feine Körnung wie in der 2D-Ansicht
    for (let r = 0; r < TPX; r++)
      for (let c = 0; c < TPX; c++) {
        const v = hash(i + 1, c, r) / 4294967296 - 0.5;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${(v * 0.14).toFixed(3)})` : `rgba(0,0,0,${(-v * 0.14).toFixed(3)})`;
        ctx.fillRect(ox + c, oy + r, 1, 1);
      }
  });
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function tileUV(t: Tile): [number, number, number, number] {
  const i = TILES.indexOf(t);
  const rows = Math.ceil(TILES.length / COLS);
  const w = COLS * TPX,
    h = rows * TPX;
  const e = 0.02; // etwas nach innen, damit Nachbarkacheln nicht durchblitzen
  const x = (i % COLS) * TPX,
    y = Math.floor(i / COLS) * TPX;
  return [(x + e) / w, 1 - (y + TPX - e) / h, (x + TPX - e) / w, 1 - (y + e) / h];
}

// ---------- Geometrie aus Quadern und Flächen ----------

export type V3 = [number, number, number];
/** Farbe ohne Alphakanal: rgba(…) wird zu rgb(…), Three.js kennt in Vertex-Farben keine Deckkraft */
export const col = (c: string | Color) =>
  typeof c === 'string' ? new Color(c.replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, 'rgb($1,$2,$3)')) : c;

export class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private rgb: number[] = [];
  private idx: number[] = [];

  /** Viereck a-b-c-d gegen den Uhrzeigersinn von außen gesehen; a-b unten, c-d oben */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, tile: Tile, color: Color) {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = tileUV(tile);
    for (const p of [a, b, c, d]) this.pos.push(...p);
    for (let i = 0; i < 4; i++) {
      this.nor.push(...n);
      this.rgb.push(color.r, color.g, color.b);
    }
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Quader (x, y = Höhe, z) mit Größe (w, h, d); Seiten und Oberseite einzeln einfärb- und texturierbar */
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    side: string | Color,
    top?: string | Color | null,
    tile: Tile = 'white',
    topTile?: Tile,
  ) {
    const s = col(side),
      t = col(top ?? side);
    const [x0, y0, z0, x1, y1, z1] = [x, y, z, x + w, y + h, z + d];
    const tt = topTile ?? tile;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], tt, t);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], tile, s);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], tile, s);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], tile, s);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], tile, s);
  }

  get empty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.rgb), 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Licht ----------

/**
 * Ziel der Sonne auf das Raster der Schattenkarte legen. Folgt die Schattenkamera der Figur stufenlos, verschiebt sich
 * ihr Raster in jedem Bild um Bruchteile eines Pixels, und Schattenkanten flimmern beim Laufen. Eingerastet bewegt sie
 * sich nur in ganzen Pixeln: Quer zum Licht wird gerundet, entlang des Lichts nicht (das ändert das Bild nicht).
 * `offset`: wo die Sonne vom Ziel aus steht; `texel`: Breite eines Pixels der Schattenkarte in Feldern.
 */
export function snapToShadowTexel(target: Vector3, offset: Vector3, texel: number): Vector3 {
  const basis = new Matrix4().lookAt(offset, new Vector3(), new Vector3(0, 1, 0));
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  const along = new Vector3().setFromMatrixColumn(basis, 2);
  const snap = (v: number) => Math.round(v / texel) * texel;
  return right
    .multiplyScalar(snap(target.dot(right)))
    .add(up.multiplyScalar(snap(target.dot(up))))
    .add(along.multiplyScalar(target.dot(along)));
}
