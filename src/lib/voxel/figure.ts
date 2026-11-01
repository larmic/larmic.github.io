// Die Voxel-Figur aus sechs Quadern, eigene Projektion: X = (x − y)·C, Y = (x + y)·C/2 − z·V
import { face, overlay, f, type Matrix } from './render';
import * as T from './textures';
import { AVATAR } from '../../data/avatar';

const C = 2.0;
const V = 2.236;
const P = (x: number, y: number, z: number): [number, number] => [(x - y) * C, ((x + y) * C) / 2 - z * V];
const topM = (x0: number, y0: number, z1: number): Matrix => [C, C / 2, -C, C / 2, (x0 - y0) * C, ((x0 + y0) * C) / 2 - z1 * V];
const leftM = (x0: number, y1: number, z1: number): Matrix => [C, C / 2, 0, V, (x0 - y1) * C, ((x0 + y1) * C) / 2 - z1 * V];
const rightM = (x1: number, y1: number, z1: number): Matrix => [C, -C / 2, 0, V, (x1 - y1) * C, ((x1 + y1) * C) / 2 - z1 * V];

function headExtraL(): string {
  return overlay(T.BLINK_L, T.PAL_BLINK, 'fig-blink')
    + (AVATAR.beard ? overlay(T.BEARD_L, T.PAL_BEARD) : '')
    + (AVATAR.glasses ? overlay(T.GLASS_L, T.PAL_GLASS) : '');
}
function headExtraR(): string {
  return (AVATAR.beard ? overlay(T.BEARD_R, T.PAL_BEARD) : '') + (AVATAR.glasses ? overlay(T.GLASS_R, T.PAL_GLASS) : '');
}

type Part = { box: [number, number, number, number, number, number]; T: T.Grid; L: T.Grid; R: T.Grid; cls?: string; head?: boolean };

// Reihenfolge = Zeichenreihenfolge (hinten nach vorn)
const PARTS: Part[] = [
  { box: [2, 5, 2.5, 5.5, 0, 6], T: T.LEG_T, L: T.LEGL_L, R: T.LEG_R },
  { box: [5, 8, 2.5, 5.5, 0, 6], T: T.LEG_T, L: T.LEGR_L, R: T.LEG_R },
  { box: [0, 2, 2.5, 5.5, 7, 13], T: T.ARM_T, L: T.ARM_L, R: T.ARM_R },
  { box: [2, 8, 2, 6, 6, 13], T: T.BODY_T, L: T.BODY_L, R: T.BODY_R },
  { box: [8, 10, 2.5, 5.5, 7, 13], T: T.ARM_T, L: T.ARM_L, R: T.ARM_R, cls: 'fig-arm-r' },
  { box: [0, 10, -0.5, 8.5, 13, 22], T: T.HEAD_T, L: T.HEAD_L, R: T.HEAD_R, head: true },
];

export type FigureSvg = { svg: string; box: [number, number, number, number]; foot: [number, number] };

export function figureSvg(): FigureSvg {
  const out: string[] = [];
  const pts: [number, number][] = [];
  for (const p of PARTS) {
    const [x0, x1, y0, y1, z0, z1] = p.box;
    let g = face(topM(x0, y0, z1), p.T, T.PAL_FIG, ['#ffffff', 0.06]);
    g += face(leftM(x0, y1, z1), p.L, T.PAL_FIG, ['#000', 0.05], p.head ? headExtraL() : '');
    g += face(rightM(x1, y1, z1), p.R, T.PAL_FIG, ['#000', 0.22], p.head ? headExtraR() : '');
    out.push(p.cls ? `<g class="${p.cls}">${g}</g>` : g);
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(P(x, y, z));
  }
  const minx = Math.min(...pts.map((q) => q[0]));
  const maxx = Math.max(...pts.map((q) => q[0]));
  const miny = Math.min(...pts.map((q) => q[1]));
  const maxy = Math.max(...pts.map((q) => q[1]));
  const box: [number, number, number, number] = [minx, miny, maxx - minx, maxy - miny];
  const svg = `<svg viewBox="${box.map(f).join(' ')}" role="img" aria-label="Lars als Voxel-Figur" class="fig-svg">${out.join('')}</svg>`;
  return { svg, box, foot: P(5, 4, 0) };
}
