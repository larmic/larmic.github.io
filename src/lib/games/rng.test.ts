import { describe, expect, it } from 'vitest';
import { CHUNK, ChunkCache, chunkOf } from './chunks';
import { hash, nextRandom, rand01, valueNoise } from './rng';

describe('Zufall aus dem Seed', () => {
  it('liefert für dieselben Eingaben immer dieselbe Zahl, für andere eine andere', () => {
    expect(hash(42, 1, 2)).toBe(hash(42, 1, 2));
    expect(hash(42, 1, 2)).not.toBe(hash(42, 2, 1));
    expect(hash(42, 1, 2)).not.toBe(hash(43, 1, 2));
  });

  it('bleibt in [0, 1) und ist ungefähr gleich verteilt', () => {
    const values = Array.from({ length: 4000 }, (_, i) => rand01(7, i, -i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const low = values.filter((v) => v < 0.5).length;
    expect(low).toBeGreaterThan(1800);
    expect(low).toBeLessThan(2200);
  });

  it('erzeugt eine wiederholbare Zufallsfolge', () => {
    const run = (s: number) => {
      const out: number[] = [];
      for (let i = 0; i < 5; i++) {
        const [v, next] = nextRandom(s);
        out.push(v);
        s = next;
      }
      return out;
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
    expect(run(1).every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('rauscht weich: Nachbarfelder unterscheiden sich nur wenig', () => {
    for (let x = -20; x < 20; x++) {
      const a = valueNoise(3, x, 5, 8);
      const b = valueNoise(3, x + 1, 5, 8);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
      expect(Math.abs(a - b)).toBeLessThan(0.35);
    }
  });
});

describe('Stücke der Welt', () => {
  it('ordnet auch negative Koordinaten dem richtigen Stück zu', () => {
    expect(chunkOf(0, 0)).toEqual([0, 0]);
    expect(chunkOf(CHUNK - 1, CHUNK)).toEqual([0, 1]);
    expect(chunkOf(-1, -CHUNK)).toEqual([-1, -1]);
    expect(chunkOf(-CHUNK - 1, 0)).toEqual([-2, 0]);
  });

  it('berechnet jedes Stück nur einmal und liefert das richtige Feld', () => {
    let made = 0;
    const cache = new ChunkCache<string>((cx, cy) => {
      made++;
      return Array.from(
        { length: CHUNK * CHUNK },
        (_, i) => `${cx * CHUNK + (i % CHUNK)},${cy * CHUNK + Math.floor(i / CHUNK)}`,
      );
    });
    expect(cache.get(-3, 20)).toBe('-3,20');
    expect(cache.get(-4, 21)).toBe('-4,21');
    expect(made).toBe(1);
  });

  it('vergisst alte Stücke über dem Limit und berechnet sie bei Bedarf gleich neu', () => {
    const cache = new ChunkCache<number>((cx) => new Array<number>(CHUNK * CHUNK).fill(cx), 2);
    cache.get(0, 0);
    cache.get(CHUNK, 0);
    cache.get(2 * CHUNK, 0);
    expect(cache.get(0, 0)).toBe(0);
  });
});
