import { describe, expect, it } from 'vitest';
import type { Scene } from '../lib/voxel/world';
import { CUBE_H, CUBE_W, HALF_W, LEVEL, STEP_Y } from '../lib/voxel/cube';
import { AVATAR } from './avatar';
import { buildWorld, type ChildItem } from './island-layout';

const items = (section: string, n: number): ChildItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    label: `Eintrag ${i}`,
    block: 'crate',
    href: `/${section}/e${i}/`,
  }));

// So viele Einträge, wie es Plätze gibt: Hier müssen Geometrie und Wege noch stimmen
const full = () => buildWorld({ workshops: items('workshops', 4), videos: items('videos', 4) }, AVATAR);

/** Prozentangaben der Szene zurück in Szenen-Einheiten (Würfel CUBE_W × CUBE_H) */
function units(scene: Scene) {
  const [x0, y0, w, h] = scene.sceneSvg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  return (p: { x: number; y: number }) => ({ X: x0 + (p.x / 100) * w, Y: y0 + (p.y / 100) * h });
}

describe('buildWorld', () => {
  it('ist deterministisch: zweimal gebaut, gleiches Ergebnis', () => {
    expect(JSON.stringify(full())).toBe(JSON.stringify(full()));
  });

  it('legt jede Kiste in den Baum: Ihr Weg beginnt mit dem kompletten Weg ihres Bereichs', () => {
    const { routes, nav } = full().data;
    for (const n of nav.filter((x) => x.parent)) {
      const parent = routes[n.parent!];
      expect(routes[n.id].slice(0, parent.length)).toEqual(parent);
      expect(routes[n.id].length).toBeGreaterThan(parent.length);
    }
  });

  it('geht nur auf benachbarte Felder: ein Feld seitlich (höchstens eine Stufe hoch oder runter) oder senkrecht auf einen gestapelten Block', () => {
    const scene = full();
    const at = units(scene);
    for (const [id, route] of Object.entries(scene.data.routes)) {
      let prev = at(scene.data.home);
      for (const node of route) {
        const cur = at(node);
        const dx = cur.X - prev.X;
        const dy = cur.Y - prev.Y;
        const pillar = Math.abs(dx) < 0.5 && Math.abs(dy + LEVEL) < 0.5; // Baum: Block unter sich setzen und draufsteigen
        if (!node.fall && !pillar) {
          expect(Math.abs(Math.abs(dx) - HALF_W), `${id}: Schritt seitlich`).toBeLessThan(0.5);
          // ein Feld weiter: ±20, dazu eine Stufe hoch (−44,8) oder runter (+44,8)
          const level = [-STEP_Y, STEP_Y].flatMap((s) => [s - LEVEL, s, s + LEVEL]).some((s) => Math.abs(dy - s) < 0.5);
          expect(level, `${id}: Schritt ${dx.toFixed(1)}/${dy.toFixed(1)}`).toBe(true);
          expect(cur.X > prev.X ? 'R' : 'L', `${id}: Blickrichtung`).toBe(node.f);
        }
        prev = cur;
      }
    }
  });

  it('setzt jeden Brückenblock nur einmal, auch wenn sich Wege ein Feld teilen', () => {
    const { bridges } = full().data;
    const keys = bridges.map((b) => `${b.x},${b.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lässt keine Zielblöcke einander oder die Insel überlappen', () => {
    const scene = full();
    const at = units(scene);
    const cubes = [...scene.sceneSvg.matchAll(/x="([-\d.]+)" y="([-\d.]+)"/g)].map((m) => ({
      X: Number(m[1]),
      Y: Number(m[2]),
    }));
    const boxes = scene.data.nav.map((n) => ({ id: n.id, ...at(n) }));
    const overlap = (a: { X: number; Y: number }, b: { X: number; Y: number }) =>
      a.X < b.X + CUBE_W - 10 && b.X < a.X + CUBE_W - 10 && a.Y < b.Y + CUBE_H - 10 && b.Y < a.Y + CUBE_H - 10; // 10 Einheiten Spiel für Kanten, die sich berühren
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(overlap(a, b), `${a.id} / ${b.id}`).toBe(false);
      for (const c of cubes) expect(overlap(a, c), `${a.id} / Inselblock ${c.X},${c.Y}`).toBe(false);
    }
  });

  it('bricht bei mehr Einträgen als Plätzen mit einer Meldung ab, die sagt, was zu tun ist', () => {
    expect(() => buildWorld({ workshops: items('workshops', 5), videos: [] }, AVATAR)).toThrow(
      /CHILD_SLOTS.*draft: true/,
    );
    expect(() => buildWorld({ workshops: [], videos: items('videos', 5) }, AVATAR)).toThrow(/Plätze/);
  });

  it('hat für den Baum eine Hover-Fläche und einen Weg ohne Sturz', () => {
    const scene = full();
    const egg = scene.data.eggs.find((e) => e.id === 'tree')!;
    expect(egg.w).toBeGreaterThan(0);
    expect(egg.h).toBeGreaterThan(0);
    expect(scene.data.routes.tree.at(-1)!.fall).toBeUndefined();
  });
});
