import { describe, expect, it } from 'vitest';
import { DIRS, LEVEL_H, TILE_D, TILE_W, cellAt, eyes, projection } from './front';

describe('Ansicht von vorn', () => {
  it('bildet den Kamerapunkt auf den Ursprung ab und rückt je Feld um eine Kachel weiter', () => {
    const p = projection(5, 7, 100, 200);
    expect(p(5, 7, 0)).toEqual([100, 200]);
    expect(p(6, 7, 0)).toEqual([100 + TILE_W, 200]);
    expect(p(5, 8, 0)).toEqual([100, 200 + TILE_D]);
    expect(p(5, 7, 1)).toEqual([100, 200 - LEVEL_H]); // eine Ebene höher liegt weiter oben
    expect(projection(0, 0, 0, 0, 2)(1, 1, 0)).toEqual([2 * TILE_W, 2 * TILE_D]);
  });

  it('findet unter einem Bildschirmpunkt das Feld wieder, auch gezoomt und auf Höhe', () => {
    for (const scale of [1, 0.75, 1.5])
      for (const z of [0, 1, 2])
        for (const [x, y] of [
          [0, 0],
          [3, -2],
          [-4, 5],
        ] as const) {
          const [sx, sy] = projection(1, 2, 320, 240, scale)(x + 0.5, y + 0.5, z);
          expect(cellAt(sx, sy, z, 1, 2, 320, 240, scale)).toEqual([x, y]);
        }
  });

  it('kennt vier Blickrichtungen mit je einem Schritt', () => {
    for (const [dx, dy] of Object.values(DIRS)) expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
  });

  it('setzt Augen spiegelgleich auf alle drei sichtbaren Seiten, mit Glanzpunkt', () => {
    const parts = eyes(0.5, 0.3, 1, 0.1, 0.12, 0.08);
    expect(parts).toHaveLength(8);
    expect(parts.filter((p) => p[6] === '#ffffff')).toHaveLength(4);
    expect(new Set(parts.map((p) => p[8]))).toEqual(new Set(['f', 'r', 'l']));
  });
});
