import { describe, expect, it } from 'vitest';
import { gridSvg } from './render';
import type { Grid, Palette } from './textures';
import * as T from './textures';

/** Welche Pixel deckt das erzeugte SVG je Farbe ab? (Grundfläche + Rechtecke, auch in <g fill>-Gruppen) */
function coverage(svg: string, W: number, H: number): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (fill: string, x: number, y: number, w: number, h: number) => {
    if (!out.has(fill)) out.set(fill, new Set());
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) out.get(fill)!.add(`${i},${j}`);
  };
  const num = (tag: string, a: string, d = 0) => Number(tag.match(new RegExp(`\\b${a}="([^"]+)"`))?.[1] ?? d);
  let group: string | null = null;
  for (const tag of svg.match(/<\/?[a-z]+[^>]*>/g) ?? []) {
    if (tag.startsWith('<g')) group = tag.match(/fill="([^"]+)"/)![1] + (tag.match(/opacity="([^"]+)"/)?.[1] ?? '');
    else if (tag === '</g>') group = null;
    else if (tag.startsWith('<rect')) {
      const fill = tag.match(/fill="([^"]+)"/)
        ? tag.match(/fill="([^"]+)"/)![1] + (tag.match(/opacity="([^"]+)"/)?.[1] ?? '')
        : group!;
      add(fill, num(tag, 'x'), num(tag, 'y'), num(tag, 'width'), num(tag, 'height'));
    }
  }
  expect(
    [...out.values()].every((s) =>
      [...s].every((c) => {
        const [x, y] = c.split(',').map(Number);
        return x < W && y < H;
      }),
    ),
  ).toBe(true);
  return out;
}

describe('gridSvg', () => {
  it('bildet jedes Pixel eines einfachen Rasters mit der richtigen Farbe ab', () => {
    const grid: Grid = ['ab', 'ba'];
    const pal: Palette = { a: [['#111111', 1]], b: [['#222222', 1]] };
    const cov = coverage(gridSvg(grid, pal), 2, 2);
    // Vollflächig: Grundfläche in der häufigsten Farbe, darüber die andere
    expect(cov.get('#222222')).toEqual(new Set(['1,0', '0,1']));
  });

  it('lässt Pixel ohne Palette durchsichtig (Überlagerungen wie Bart und Brille)', () => {
    const cov = coverage(gridSvg(['.x.', '...'], { x: [['#123456', 1]] }), 3, 2);
    expect([...cov.keys()]).toEqual(['#123456']);
    expect(cov.get('#123456')).toEqual(new Set(['1,0']));
  });

  it.each(
    Object.entries(T).filter(([k]) => !k.startsWith('PAL_') && Array.isArray((T as Record<string, unknown>)[k])) as [
      string,
      Grid,
    ][],
  )('deckt bei %s jedes Pixel mit Palette ab und malt nichts außerhalb', (_name, grid) => {
    const pal: Palette = {};
    for (const ch of new Set(grid.join('')))
      if (ch !== '.') pal[ch] = [[`#${ch.charCodeAt(0).toString(16).padStart(6, '0')}`, 1]];
    const W = grid[0].length;
    const H = grid.length;
    const cov = coverage(gridSvg(grid, pal), W, H);
    const painted = new Set([...cov.values()].flatMap((s) => [...s]));
    grid.forEach((row, y) => [...row].forEach((ch, x) => expect(painted.has(`${x},${y}`)).toBe(ch !== '.')));
  });

  it('wirft bei ungleich langen Zeilen', () => {
    expect(() => gridSvg(['ab', 'a'], { a: [['#000', 1]], b: [['#fff', 1]] })).toThrow(/falsche Länge/);
  });
});
