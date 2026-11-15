import { describe, expect, it } from 'vitest';
import { DIRS } from '../../lib/games/front';
import { GATES, HOME, REGIONS, type GateId } from '../../data/games/mitwachsen';
import { canStep, createWorld, standHeight, wildAnimals, type World } from './mitwachsen-world';

/** Alle Felder, die von `start` aus zu Fuß erreichbar sind (bis `limit` Felder) */
function reachable(world: World, open: GateId[], start: readonly [number, number], limit = 30000) {
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
const lichtung = REGIONS[0];
const START = HOME.wake[0];
const SEEDS = [1, 42, 2026, 7, 99, 123456];

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
});

describe('Start auf der Lichtung', () => {
  for (const seed of SEEDS) {
    const w = createWorld(seed);

    it(`Seed ${seed}: In der Mitte steht nur das Bett, ringsum ist es frei`, () => {
      expect(w.cell(HOME.bed[0], HOME.bed[1]).deco).toBe('bed');
      for (let y = -HOME.clear; y <= HOME.clear; y++)
        for (let x = -HOME.clear; x <= HOME.clear; x++) {
          if (x === HOME.bed[0] && y === HOME.bed[1]) continue;
          expect(standHeight(w, [], x, y), `${x},${y}`).toBe(1);
        }
      for (const [x, y] of HOME.wake) expect(standHeight(w, [], x, y)).not.toBeNull();
    });

    it(`Seed ${seed}: Alle zehn Tiere wohnen erreichbar auf der Lichtung, die Landschaft bleibt draußen`, () => {
      const cells = reachable(w, [], START);
      const set = new Set(cells.map(([x, y]) => `${x},${y}`));
      expect(w.spawns.size).toBe(lichtung.animals.length);
      for (const [species, [x, y]] of w.spawns) {
        expect(w.cell(x, y).region, species).toBe('lichtung');
        expect(set.has(`${x},${y}`), species).toBe(true);
      }
      expect(cells.some(([x, y]) => w.cell(x, y).region === 'wild')).toBe(false);
      expect(cells.length).toBeGreaterThan(3000); // groß genug zum Erkunden
    });

    it(`Seed ${seed}: Man klettert eine Stufe hinauf und fällt beliebig tief herunter`, () => {
      let up = 0,
        down = 0;
      for (let y = -40; y < 40; y++)
        for (let x = -50; x < 50; x++) {
          const a = standHeight(w, [], x, y),
            b = standHeight(w, [], x + 1, y);
          if (a === null || b === null) continue;
          expect(canStep(w, [], x, y, x + 1, y)).toBe(b - a <= 1);
          if (b - a >= 2) up++;
          if (a - b >= 2) down++;
        }
      expect(up + down).toBeGreaterThan(0); // es gibt Stellen mit großem Höhenunterschied
    });

    it(`Seed ${seed}: Vier große Tore zu je drei Feldern, alle verschlossen`, () => {
      expect([...w.gates.keys()].sort()).toEqual(GATES.map((g) => g.id).sort());
      for (const g of GATES) {
        const cells = w.gates.get(g.id)!;
        expect(cells).toHaveLength(3);
        for (const [x, y] of cells) {
          expect(w.cell(x, y).deco).toBe('biggate');
          expect(w.cell(x, y).gate).toBe(g.id);
          expect(standHeight(w, [], x, y)).toBeNull();
        }
        expect(g.locked).toBe(true);
      }
    });
  }

  it('Die drei Felder jedes großen Tores liegen in einer geraden Reihe (viele Seeds)', () => {
    for (let seed = 1; seed < 400; seed += 7) {
      const w = createWorld(seed * 4513);
      for (const cells of w.gates.values()) {
        const xs = new Set(cells.map(([x]) => x)),
          ys = new Set(cells.map(([, y]) => y));
        expect(xs.size === 1 || ys.size === 1, `Seed ${seed * 4513}`).toBe(true);
      }
    }
  });

  it('Ohne Garten gibt es keine Gartenfelder; mit Garten genau einen Eingang', () => {
    const plain = createWorld(3);
    for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) expect(plain.cell(x, y).garden).toBeUndefined();
    const w = createWorld(3, { garden: true });
    let openings = 0;
    for (let y = HOME.garden.y0 - 1; y <= HOME.garden.y1 + 1; y++)
      for (let x = HOME.garden.x0 - 1; x <= HOME.garden.x1 + 1; x++) if (w.cell(x, y).gardenGate) openings++;
    expect(openings).toBe(1);
    const inside = reachable(w, [], [HOME.garden.x0, HOME.garden.y0]).filter(([x, y]) => !w.cell(x, y).garden);
    expect(inside.some(([x, y]) => x === HOME.gardenGate[0] && y === HOME.gardenGate[1])).toBe(true);
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
        if (a.ground !== 'grass' || b.ground !== 'grass') continue; // Wasser und Klettersteine zählen nicht
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

describe('Portale', () => {
  for (const seed of [1, 42, 2026]) {
    it(`Seed ${seed}: neben jedem Tor ein erreichbares Portal, sein Partner über dem Bett`, () => {
      const w = createWorld(seed);
      const cells = new Set(reachable(w, [], START).map(([x, y]) => `${x},${y}`));
      for (const g of GATES) {
        const p = w.portals.get(g.id)!;
        expect(w.cell(p.gate[0], p.gate[1]).portal).toEqual({ id: g.id, side: 'gate' });
        expect(w.cell(p.home[0], p.home[1]).portal).toEqual({ id: g.id, side: 'home' });
        expect(cells.has(`${p.gateExit[0]},${p.gateExit[1]}`), `${g.id} Ausgang am Tor`).toBe(true);
        expect(cells.has(`${p.homeExit[0]},${p.homeExit[1]}`), `${g.id} Ausgang am Bett`).toBe(true);
        expect(Math.max(Math.abs(p.home[0] - HOME.bed[0]), Math.abs(p.home[1] - HOME.bed[1]))).toBeLessThanOrEqual(4);
      }
    });
  }
});
