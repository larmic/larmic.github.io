import { describe, expect, it } from 'vitest';
import { grown, MAX_FLOWERS } from './mitwachsen-growth';
import { createWorld } from './mitwachsen-world';

const world = createWorld(7);
/** Felder der Lichtung rund ums Bett */
const area: [number, number][] = [];
for (let y = -40; y < 40; y++) for (let x = -50; x < 50; x++) area.push([x, y]);
const count = (day: number) => {
  let flowers = 0,
    mushrooms = 0;
  for (const [x, y] of area) {
    const before = world.cell(x, y);
    const c = grown(world.seed, day, x, y, before);
    if (c === before) continue;
    if (c.deco === 'flower') flowers++;
    if (c.deco === 'mushroom') mushrooms++;
  }
  return { flowers, mushrooms };
};

describe('Blumen und Pilze wachsen nach', () => {
  it('am ersten Tag wächst nichts dazu, danach jeden Tag mehr, bis zu einer Grenze', () => {
    expect(count(0)).toEqual({ flowers: 0, mushrooms: 0 });
    const days = [1, 3, 6, 10].map(count);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.flowers).toBeGreaterThan(days[i - 1]!.flowers);
      expect(days[i]!.mushrooms).toBeGreaterThanOrEqual(days[i - 1]!.mushrooms);
    }
    expect(days[3]!.mushrooms).toBeGreaterThan(0);
    expect(count(100).flowers).toBe(count(MAX_FLOWERS / 0.012 + 5).flowers);
  });

  it('was gewachsen ist, bleibt an späteren Tagen', () => {
    for (const [x, y] of area) {
      const c = world.cell(x, y);
      if (grown(world.seed, 3, x, y, c).deco === 'flower') expect(grown(world.seed, 8, x, y, c).deco).toBe('flower');
    }
  });

  it('nur auf freier Wiese der Lichtung: Bäume, Wasser, Steine und die Landschaft bleiben, wie sie sind', () => {
    for (const [x, y] of area) {
      const c = world.cell(x, y);
      const g = grown(world.seed, 20, x, y, c);
      if (g !== c) {
        expect(c.region).toBe('lichtung');
        expect(c.ground).toBe('grass');
        expect(c.deco).toBeNull();
        expect(g.solid).toBe(false);
      }
    }
    const far = world.cell(0, 200);
    expect(grown(world.seed, 20, 0, 200, far)).toBe(far);
  });
});
