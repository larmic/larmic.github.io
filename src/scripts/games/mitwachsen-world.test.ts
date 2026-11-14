import { describe, expect, it } from 'vitest';
import { DIRS } from '../../lib/games/front';
import { GATES, HOME, REGIONS, type GateId } from '../../data/games/mitwachsen';
import { canStep, createWorld, inRect, standHeight, wildAnimals, type World } from './mitwachsen-world';

/** Alle Felder, die von `start` aus zu Fuß erreichbar sind (bis `limit` Felder) */
function reachable(world: World, open: GateId[], start: readonly [number, number], limit = 6000) {
  const seen = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: [number, number][] = [[start[0], start[1]]];
  while (queue.length && seen.size < limit) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !canStep(world, open, x, y, x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return [...seen].map((k) => k.split(',').map(Number) as [number, number]);
}
const region = (id: string) => REGIONS.find((r) => r.id === id)!;
const START = HOME.wake[0];

describe('Welt aus dem Seed', () => {
  it('entsteht aus demselben Seed immer gleich, aus einem anderen anders', () => {
    const a = createWorld(1234),
      b = createWorld(1234),
      c = createWorld(99);
    let differs = 0;
    for (let y = -60; y < 60; y += 3)
      for (let x = -60; x < 60; x += 3) {
        expect(a.cell(x, y)).toEqual(b.cell(x, y));
        if (JSON.stringify(a.cell(x, y)) !== JSON.stringify(c.cell(x, y))) differs++;
      }
    expect(differs).toBeGreaterThan(100);
  });

  it('hat die Gegenden bei jedem Seed an derselben Stelle', () => {
    for (const seed of [1, 2, 3]) {
      const w = createWorld(seed);
      for (const r of REGIONS) expect(w.cell(r.area.x0, r.area.y0).region).toBe(r.id);
      expect(w.cell(HOME.bed[0], HOME.bed[1]).deco).toBe('bed');
    }
  });

  it('Bett, Aufwachplätze und Startplätze der Tiere sind frei', () => {
    const w = createWorld(7);
    for (const [x, y] of HOME.wake) expect(standHeight(w, [], x, y), `${x},${y}`).not.toBeNull();
    for (const r of REGIONS)
      for (const a of r.animals) {
        expect(standHeight(w, [], a.at[0], a.at[1]), a.species).not.toBeNull();
        expect(w.cell(a.at[0], a.at[1]).region).toBe(r.id);
      }
  });
});

describe('Gegenden und Tore', () => {
  for (const seed of [1, 42, 2026, 7, 99, 123456]) {
    const w = createWorld(seed);

    it(`Seed ${seed}: Ohne offene Tore erreicht man nur das Zuhause und die Landschaft`, () => {
      const cells = reachable(w, [], START);
      expect(cells.some(([x, y]) => inRect(region('wiese').area, x, y))).toBe(false);
      expect(cells.some(([x, y]) => inRect(region('teich').area, x, y))).toBe(false);
      // Der Pfad hinaus ist offen: weit draußen liegt erreichbare Landschaft
      expect(cells.some(([x, y]) => w.cell(x, y).region === 'wild' && Math.abs(y) > 20)).toBe(true);
    });

    it(`Seed ${seed}: Jedes Tor öffnet genau seine nächste Gegend`, () => {
      const one = reachable(w, ['gartentor'], START);
      expect(one.some(([x, y]) => inRect(region('wiese').area, x, y))).toBe(true);
      expect(one.some(([x, y]) => inRect(region('teich').area, x, y))).toBe(false);
      const both = reachable(w, ['gartentor', 'bruecke'], START);
      expect(both.some(([x, y]) => inRect(region('teich').area, x, y))).toBe(true);
    });

    it(`Seed ${seed}: Aus der Landschaft kommt man nicht seitlich in eine Gegend`, () => {
      // Start weit draußen, alle Tore zu: kein Feld einer Gegend außer dem Zuhause (über den Pfad) erreichbar
      const outside = reachable(w, [], [0, 12]);
      expect(outside.some(([x, y]) => inRect(region('wiese').area, x, y) || inRect(region('teich').area, x, y))).toBe(
        false,
      );
    });
  }

  it('Tore sind zu, bis sie offen sind; Brücken liegen über Wasser', () => {
    const w = createWorld(5);
    for (const g of GATES) {
      expect(standHeight(w, [], g.at[0], g.at[1])).toBeNull();
      expect(standHeight(w, [g.id], g.at[0], g.at[1])).toBe(1);
      expect(w.cell(g.sign[0], g.sign[1]).sign).toBe(g.id);
    }
    const bridge = GATES.find((g) => g.kind === 'bruecke')!;
    expect(w.cell(bridge.at[0], bridge.at[1]).ground).toBe('water');
  });

  it('der Garten hat genau einen Eingang', () => {
    const w = createWorld(3);
    const inside = reachable(w, [], [HOME.garden.x0, HOME.garden.y0]).filter(([x, y]) => !w.cell(x, y).garden);
    // Von innen führt jeder Weg hinaus über den Rosenbogen
    expect(inside.some(([x, y]) => x === HOME.gardenGate[0] && y === HOME.gardenGate[1])).toBe(true);
    let openings = 0;
    for (let y = HOME.garden.y0 - 1; y <= HOME.garden.y1 + 1; y++)
      for (let x = HOME.garden.x0 - 1; x <= HOME.garden.x1 + 1; x++) if (w.cell(x, y).gardenGate) openings++;
    expect(openings).toBe(1);
  });
});

describe('Landschaft', () => {
  it('ist meist sanft: Nachbarfelder unterscheiden sich selten um mehr als eine Ebene', () => {
    const w = createWorld(11);
    let steep = 0,
      total = 0;
    for (let y = 30; y < 90; y++)
      for (let x = -40; x < 40; x++) {
        const a = w.cell(x, y),
          b = w.cell(x + 1, y);
        if (a.ground === 'water' || b.ground === 'water') continue;
        total++;
        if (Math.abs(a.h - b.h) > 1) steep++;
      }
    expect(steep / total).toBeLessThan(0.02);
  });

  it('hat Tiere, immer dieselben an derselben Stelle, auf Feldern der Landschaft', () => {
    const w = createWorld(8);
    const all = [];
    for (let cy = 2; cy < 8; cy++)
      for (let cx = -3; cx < 3; cx++) {
        const spawns = wildAnimals(w, cx, cy);
        expect(spawns).toEqual(wildAnimals(createWorld(8), cx, cy));
        for (const s of spawns) {
          expect(w.cell(s.x, s.y).region).toBe('wild');
          expect(standHeight(w, [], s.x, s.y)).not.toBeNull();
        }
        all.push(...spawns);
      }
    expect(all.length).toBeGreaterThan(5);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
  });
});
