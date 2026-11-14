// Ansicht von vorn: Jeder Block zeigt Oberseite und Vorderseite, die Gitterachsen liegen waagerecht (x) und
// senkrecht (y). Anders als die 2:1-Dimetrie der Insel (cube.ts) laufen Pfeiltasten hier in Bildschirmrichtung.
// Höhe z zählt in Ebenen; die Oberkante eines Blocks auf Ebene k liegt bei z = k + 1.

import type { Grid, Palette } from '../voxel/textures';

export const TILE_W = 64; // Breite eines Feldes
export const TILE_D = 44; // Tiefe der Oberseite (verkürzt)
export const LEVEL_H = 40; // Höhe einer Ebene (Vorderseite)

/** Bildschirmpunkt eines Weltpunkts. Kamera: Weltpunkt (camX, camY), der bei (originX, originY) erscheint. */
export type Projection = (x: number, y: number, z: number) => [number, number];
export const projection =
  (camX: number, camY: number, originX: number, originY: number, scale = 1): Projection =>
  (x, y, z) => [originX + (x - camX) * TILE_W * scale, originY + ((y - camY) * TILE_D - z * LEVEL_H) * scale];

/** Feld unter einem Bildschirmpunkt auf Höhe z (Umkehrung der Projektion) */
export const cellAt = (
  sx: number,
  sy: number,
  z: number,
  camX: number,
  camY: number,
  originX: number,
  originY: number,
  scale = 1,
): [number, number] => [
  Math.floor((sx - originX) / (TILE_W * scale) + camX),
  Math.floor(((sy - originY) / scale + z * LEVEL_H) / TILE_D + camY),
];

/** Textur-Raster auf eine Fläche malen: Jede Farbschicht [Farbe, Deckkraft] einzeln (wie render.ts) */
function paint(ctx: CanvasRenderingContext2D, grid: Grid, pal: Palette) {
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++) {
      for (const [color, alpha] of pal[grid[r][c]] ?? []) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(c, r, 1.03, 1.03); // leicht überlappen, sonst blitzen Fugen durch
      }
    }
  ctx.globalAlpha = 1;
}

/** Block als Bild: Oberseite TILE_W × TILE_D, darunter Vorderseite TILE_W × LEVEL_H, mit Hausschattierung */
export function frontBlock(top: Grid, front: Grid, pal: Palette, res = 2): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_W * res;
  canvas.height = (TILE_D + LEVEL_H) * res;
  const ctx = canvas.getContext('2d')!;
  const n = top.length;
  ctx.setTransform((res * TILE_W) / n, 0, 0, (res * TILE_D) / n, 0, 0);
  paint(ctx, top, pal);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(0, 0, n, n);
  ctx.setTransform((res * TILE_W) / n, 0, 0, (res * LEVEL_H) / n, 0, res * TILE_D);
  paint(ctx, front, pal);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(0, 0, n, n);
  return canvas;
}

// ---------- Modelle aus Quadern ----------

/** Blickrichtung: e = +x (rechts), w = −x, s = +y (zur Kamera), n = −y */
export type Dir = 'n' | 's' | 'e' | 'w';
export const DIRS: Record<Dir, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
// Rechte Hand der Figur, wenn sie in Richtung d schaut
const RIGHT: Record<Dir, [number, number]> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

/**
 * Teil eines Modells, in Zellen relativ zur Mitte des Modells: [vorn, rechts, unten, Länge, Breite, Höhe, Farbe,
 * Farbe der Oberseite?, Fläche?]. „Fläche“ markiert Augen: Sie werden nur gezeichnet, wenn ihre Fläche
 * (vorn, rechts oder links) zur Kamera zeigt – sonst schimmerten sie durch den Kopf.
 */
export type Part = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  (string | null)?,
  ('f' | 'r' | 'l')?,
];

/** Quader von vorn: Oberseite und Vorderseite */
export function box(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  d: number,
  h: number,
  color: string,
  top?: string | null,
) {
  const [ax, ay] = P(x0, y0, z0 + h);
  const [bx, by] = P(x0 + w, y0 + d, z0 + h);
  const [, cy] = P(x0, y0 + d, z0);
  ctx.fillStyle = top ?? color;
  ctx.fillRect(ax, ay, bx - ax, by - ay);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(ax, ay, bx - ax, by - ay);
  ctx.fillStyle = color;
  ctx.fillRect(ax, by, bx - ax, cy - by);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(ax, by, bx - ax, cy - by);
}

/** Modell an (cx, cy) auf Höhe z zeichnen, gedreht in Richtung dir. `mono` färbt alles ein (Umriss). */
export function drawModel(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  parts: readonly Part[],
  cx: number,
  cy: number,
  z: number,
  dir: Dir,
  scale = 1,
  mono?: string,
) {
  const [fx, fy] = DIRS[dir];
  const [rx, ry] = RIGHT[dir];
  const boxes: {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    h: number;
    c: string;
    t?: string | null;
    k: number;
  }[] = [];
  for (const [f, r, zz, fl, rw, h, color, top, face] of parts) {
    if (face) {
      const n = face === 'f' ? [fx, fy] : face === 'r' ? [rx, ry] : [-rx, -ry];
      if (n[1] !== 1) continue; // nur Flächen, die zur Kamera zeigen
    }
    const ax = cx + (fx * f + rx * r) * scale,
      ay = cy + (fy * f + ry * r) * scale;
    const bx = cx + (fx * (f + fl) + rx * (r + rw)) * scale,
      by = cy + (fy * (f + fl) + ry * (r + rw)) * scale;
    const x = Math.min(ax, bx),
      y = Math.min(ay, by),
      w = Math.abs(bx - ax),
      d = Math.abs(by - ay);
    const bz = z + zz * scale,
      bh = h * scale;
    // Von hinten nach vorn, dann von unten nach oben; Augen zuletzt
    boxes.push({
      x,
      y,
      z: bz,
      w,
      d,
      h: bh,
      c: mono ?? color,
      t: mono ?? top,
      k: (y + d / 2) * 100 + bz + bh / 2 + (face ? 50 : 0),
    });
  }
  boxes.sort((a, b) => a.k - b.k);
  for (const b of boxes) box(ctx, P, b.x, b.y, b.z, b.w, b.d, b.h, b.c, b.t);
}

/** Augenpaar für einen Kopf: vorn mittig sowie an beiden Seiten nahe der Vorderkante */
export function eyes(
  front: number,
  half: number,
  z: number,
  w: number,
  h: number,
  inset: number,
  color = '#1d2233',
): Part[] {
  return [
    [front - 0.02, inset, z, 0.03, w, h, color, null, 'f'],
    [front - 0.02, -inset - w, z, 0.03, w, h, color, null, 'f'],
    [front - 0.06 - w, half - 0.02, z, w, 0.03, h, color, null, 'r'],
    [front - 0.06 - w, -half - 0.01, z, w, 0.03, h, color, null, 'l'],
  ];
}
