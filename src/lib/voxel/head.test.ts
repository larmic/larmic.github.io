import { describe, expect, it } from 'vitest';
import { C, V, HEAD_FACES, headView } from './head';

const visible = (yaw: number, pitch = 0) =>
  headView(yaw, pitch).flatMap((f, i) => (f.matrix ? [HEAD_FACES[i].id] : []));

describe('headView', () => {
  it('zeigt in Ausgangslage Oberseite, Gesicht und rechte Seite – wie die starren Würfelflächen der übrigen Figur', () => {
    const [top, front, right] = headView(0, 0);
    expect(visible(0)).toEqual(['top', 'front', 'right']);
    // Matrizen der Figur in figure.ts: topM(0, −0,5, 22), leftM(0, 8,5, 22), rightM(10, 8,5, 22)
    expect(top.matrix).toEqual([C, C / 2, -C, C / 2, 0.5 * C, (-0.5 * C) / 2 - 22 * V].map((n) => expect.closeTo(n, 9)));
    expect(front.matrix).toEqual([C, C / 2, 0, V, -8.5 * C, (8.5 * C) / 2 - 22 * V].map((n) => expect.closeTo(n, 9)));
    expect(right.matrix).toEqual([C, -C / 2, 0, V, 1.5 * C, (18.5 * C) / 2 - 22 * V].map((n) => expect.closeTo(n, 9)));
  });

  it('schattiert wie die übrige Figur: oben 6 % weiß, Gesicht 5 %, rechte Seite 22 % schwarz', () => {
    expect(headView(0, 0).slice(0, 3).map((f) => f.shade)).toEqual([0.06, 0.05, 0.22].map((n) => expect.closeTo(n, 9)));
  });

  it('zeigt bei −45° genau zum Betrachter: nur Oberseite und Gesicht', () => {
    expect(visible(-45)).toEqual(['top', 'front']);
  });

  it('zeigt ganz nach rechts gedreht die linke Ohrseite statt des Hinterkopfs', () => {
    expect(visible(-90)).toEqual(['top', 'front', 'left']);
  });

  it.each([30, 15, 0, -15, -30, -45, -60, -75, -90].flatMap((yaw) => [-20, -10, 0, 10, 20, 30].map((pitch) => [yaw, pitch])))(
    'hat bei yaw %i°, pitch %i° zwei bis drei sichtbare Seiten mit Schatten im Rahmen',
    (yaw, pitch) => {
      const view = headView(yaw, pitch);
      const shown = view.filter((f) => f.matrix);
      expect(shown.length).toBeGreaterThanOrEqual(2);
      expect(shown.length).toBeLessThanOrEqual(3);
      for (const f of view) {
        expect(f.shade).toBeGreaterThanOrEqual(0.05 - 1e-9);
        expect(f.shade).toBeLessThanOrEqual(0.22 + 1e-9);
      }
    },
  );

  it('zeigt nie zwei gegenüberliegende Seiten gleichzeitig', () => {
    for (let yaw = -180; yaw <= 180; yaw += 15) {
      const v = visible(yaw);
      expect(v.includes('front') && v.includes('back')).toBe(false);
      expect(v.includes('left') && v.includes('right')).toBe(false);
    }
  });
});
