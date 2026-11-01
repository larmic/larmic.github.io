// Voxel-Renderer: macht aus Pixel-Rastern (siehe textures.ts) statisches SVG.
// Läuft nur beim Build. Ergebnis wird per set:html in die Seiten eingesetzt.
import type { Grid, Palette } from './textures';

export type Matrix = [number, number, number, number, number, number];

export function f(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  if (Math.abs(r) < 1e-9) return '0';
  return r.toFixed(3).replace(/\.?0+$/, '');
}

function resolve(fill: string): string {
  if (fill.startsWith('$')) throw new Error(`Palette mit Avatar-Platzhalter ${fill}: vorher mit dress() einkleiden`);
  return fill;
}

function attr(fill: string, op = 1): string {
  return ` fill="${resolve(fill)}"` + (op !== 1 ? ` opacity="${f(op)}"` : '');
}

function rect(x: number, y: number, w: number, h: number, extra = ''): string {
  return `<rect${x ? ` x="${f(x)}"` : ''}${y ? ` y="${f(y)}"` : ''} width="${f(w)}" height="${f(h)}"${extra}/>`;
}

// Zellen einer Farbe zu möglichst wenigen Rechtecken zusammenfassen
function cellsToRects(cells: Set<string>): number[][] {
  const rows = new Map<number, number[]>();
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push(x);
  }
  const runs: number[][] = [];
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (const x of [...xs.slice(1), NaN]) {
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      runs.push([start, y, prev - start + 1]);
      start = prev = x;
    }
  }
  runs.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  const out: number[][] = [];
  for (const [x, y, w] of runs) {
    const last = out[out.length - 1];
    if (last && last[0] === x && last[2] === w && last[1] + last[3] === y) last[3] += 1;
    else out.push([x, y, w, 1]);
  }
  return out;
}

export function gridSvg(grid: Grid, pal: Palette): string {
  const H = grid.length;
  const W = grid[0].length;
  const cells = new Map<string, Set<string>>();
  let full = true;
  grid.forEach((row, y) => {
    if (row.length !== W) throw new Error(`Rasterzeile hat falsche Länge: ${row}`);
    [...row].forEach((ch, x) => {
      const layers = pal[ch];
      if (!layers) {
        full = false;
        return;
      }
      layers.forEach(([fill, op], li) => {
        const key = `${li}|${fill}|${op}`;
        if (!cells.has(key)) cells.set(key, new Set());
        cells.get(key)!.add(`${x},${y}`);
      });
    });
  });
  const out: string[] = [];
  let baseKey: string | null = null;
  if (full) {
    baseKey = [...cells.keys()]
      .filter((k) => k.startsWith('0|'))
      .sort((a, b) => cells.get(b)!.size - cells.get(a)!.size)[0];
    const [, fill, op] = baseKey.split('|');
    out.push(rect(0, 0, W, H, attr(fill, Number(op))));
  }
  const keys = [...cells.keys()].sort((a, b) => {
    const la = Number(a.split('|')[0]);
    const lb = Number(b.split('|')[0]);
    return la - lb || cells.get(b)!.size - cells.get(a)!.size || a.localeCompare(b);
  });
  for (const key of keys) {
    if (key === baseKey) continue;
    const [, fill, op] = key.split('|');
    const rs = cellsToRects(cells.get(key)!);
    if (rs.length === 1) out.push(rect(rs[0][0], rs[0][1], rs[0][2], rs[0][3], attr(fill, Number(op))));
    else out.push(`<g${attr(fill, Number(op))}>` + rs.map((r) => rect(r[0], r[1], r[2], r[3])).join('') + '</g>');
  }
  return out.join('');
}

export function face(m: Matrix, grid: Grid, pal: Palette, shade?: [string, number], extra = ''): string {
  const W = grid[0].length;
  const H = grid.length;
  let s = `<g transform="matrix(${m.map(f).join(',')})">` + gridSvg(grid, pal) + extra;
  if (shade) s += rect(0, 0, W, H, attr(shade[0], shade[1]));
  return s + '</g>';
}

export function overlay(grid: Grid, pal: Palette, cls?: string): string {
  return `<g${cls ? ` class="${cls}"` : ''}>${gridSvg(grid, pal)}</g>`;
}

// Würfel in 2:1-Dimetrie: viewBox 0 0 80 84.8, Texturen 8×8
const CT: Matrix = [5, 2.5, -5, 2.5, 40, 0];
const CL: Matrix = [5, 2.5, 0, 5.6, 0, 20];
const CR: Matrix = [5, -2.5, 0, 5.6, 40, 40];

export function cube(id: string, T: Grid, L: Grid, R: Grid, pal: Palette, exL = '', exR = ''): string {
  return (
    `<symbol id="${id}" viewBox="0 0 80 84.8">` +
    face(CT, T, pal, ['#ffffff', 0.05]) +
    face(CL, L, pal, ['#000', 0.08], exL) +
    face(CR, R, pal, ['#000', 0.26], exR) +
    '</symbol>'
  );
}

// Kachel als eigenständiges SVG (für CSS-Hintergründe)
export function tileDataUri(grid: Grid, pal: Palette, px = 6): string {
  const W = grid[0].length * px;
  const H = grid.length * px;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${grid[0].length} ${grid.length}" shape-rendering="crispEdges">${gridSvg(grid, pal)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Partikel-Flugbahnen für Block-Pop und Respawn
export function particlesCss(seed: number, pre: string, sel: string, kf: string, r0: number, r1: number): string {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const angles = [-160, -115, -65, -20, 30, 150];
  const css: string[] = [];
  angles.forEach((a, i) => {
    const r = r0 + rnd() * (r1 - r0);
    const dx = Math.cos((a * Math.PI) / 180) * r;
    const dy = Math.sin((a * Math.PI) / 180) * r;
    for (const v of ['A', 'B']) {
      css.push(`.${pre}${v} ${sel}:nth-of-type(${i + 1}) { animation: ${kf}${v}${i + 1} 0.6s steps(6) forwards; }`);
      css.push(
        `@keyframes ${kf}${v}${i + 1} { 0% { opacity: 1; transform: translate(0, 0); } 55% { opacity: 1; transform: translate(${f(dx * 0.75)}px, ${f(dy * 0.75 - 14)}px); } 100% { opacity: 0; transform: translate(${f(dx)}px, ${f(dy + 18)}px); } }`,
      );
    }
  });
  return css.join('\n');
}
