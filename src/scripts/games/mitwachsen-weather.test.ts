import { describe, expect, it } from 'vitest';
import { BLOCK, FADE, RAINBOW, kindOf, raining, weatherLook, windAt } from './mitwachsen-weather';

describe('Wetter', () => {
  it('jeder Tag beginnt mit Sonne; danach gibt es Sonne, Wolken und Regen, gleich bei gleichem Seed und Tag', () => {
    const kinds = new Set<string>();
    for (let day = 0; day < 20; day++) {
      expect(kindOf(4, day, 0)).toBe('sun');
      for (let b = 1; b < 12; b++) {
        kinds.add(kindOf(4, day, b));
        expect(kindOf(4, day, b)).toBe(kindOf(4, day, b));
      }
    }
    expect([...kinds].sort()).toEqual(['clouds', 'rain', 'sun']);
  });

  it('regnet genau in Regen-Abschnitten', () => {
    for (let b = 0; b < 30; b++) expect(raining(9, 2, b * BLOCK + 10)).toBe(kindOf(9, 2, b) === 'rain');
  });

  it('wechselt weich: zu Beginn eines Abschnitts noch wie davor, nach dem Übergang wie jetzt', () => {
    for (let b = 1; b < 30; b++) {
      const before = weatherLook(9, 2, b * BLOCK - 1);
      const start = weatherLook(9, 2, b * BLOCK);
      expect(Math.abs(start.cloud - before.cloud)).toBeLessThan(0.01);
      expect(Math.abs(start.rain - before.rain)).toBeLessThan(0.01);
      const settled = weatherLook(9, 2, b * BLOCK + FADE);
      expect(settled.rain).toBe(kindOf(9, 2, b) === 'rain' ? 1 : 0);
      for (const v of Object.values(weatherLook(9, 2, b * BLOCK + 77))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('nach dem Regen steht eine Weile ein Regenbogen, sonst nie', () => {
    let seen = 0;
    for (let day = 0; day < 10; day++)
      for (let b = 1; b < 12; b++) {
        const afterRain = kindOf(3, day, b) === 'sun' && kindOf(3, day, b - 1) === 'rain';
        const mid = weatherLook(3, day, b * BLOCK + RAINBOW / 2).rainbow;
        if (afterRain) {
          expect(mid).toBe(1);
          seen++;
        } else expect(mid).toBe(0);
        expect(weatherLook(3, day, b * BLOCK + RAINBOW + 1).rainbow).toBe(0);
      }
    expect(seen).toBeGreaterThan(0);
  });

  it('Wind: überall eine leichte Brise, am stärksten Richtung Wolken, bei Regen mehr', () => {
    const calm = { cloud: 0, rain: 0, rainbow: 0 };
    expect(windAt({ id: 'eis', strength: 0 }, calm)).toBeCloseTo(0.15);
    expect(windAt({ id: 'wolken', strength: 1 }, calm)).toBeGreaterThan(windAt({ id: 'wald', strength: 1 }, calm));
    expect(windAt({ id: 'eis', strength: 0 }, { cloud: 1, rain: 1, rainbow: 0 })).toBeGreaterThan(0.5);
    expect(windAt({ id: 'wolken', strength: 1 }, { cloud: 1, rain: 1, rainbow: 0 })).toBeGreaterThan(0.9);
  });
});
