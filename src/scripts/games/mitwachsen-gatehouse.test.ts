import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { GATES } from '../../data/games/mitwachsen';
import { gatehouse, parts, portalFrame, type Parts } from './mitwachsen-gatehouse';

type Face = { axis: number; dir: number; at: number; min: [number, number]; max: [number, number]; part: string };

/** Achsenparallele Flächen einer Geometrie (je vier Ecken hintereinander, wie Geo sie anlegt) */
function faces(g: BufferGeometry, part: string): Face[] {
  const pos = g.getAttribute('position').array;
  const nor = g.getAttribute('normal').array;
  const out: Face[] = [];
  for (let v = 0; v < pos.length / 3; v += 4) {
    const n = [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!];
    const axis = n.findIndex((c) => Math.abs(c) > 0.5);
    const [u, w] = [0, 1, 2].filter((k) => k !== axis) as [number, number];
    const pts = [0, 1, 2, 3].map((k) => [pos[(v + k) * 3]!, pos[(v + k) * 3 + 1]!, pos[(v + k) * 3 + 2]!]);
    out.push({
      axis,
      dir: Math.sign(n[axis]!),
      at: pts[0]![axis]!,
      min: [Math.min(...pts.map((p) => p[u]!)), Math.min(...pts.map((p) => p[w]!))],
      max: [Math.max(...pts.map((p) => p[u]!)), Math.max(...pts.map((p) => p[w]!))],
      part,
    });
  }
  return out;
}

/** Paare von Flächen, die in derselben Ebene in dieselbe Richtung schauen und sich überdecken: Sie flackern (Z-Fighting) */
function fighting(p: Parts): string[] {
  const all = Object.entries(p).flatMap(([name, geo]) => (geo.empty ? [] : faces(geo.build(), name)));
  const found: string[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!,
        b = all[j]!;
      if (a.axis !== b.axis || a.dir !== b.dir || Math.abs(a.at - b.at) > 1e-4) continue;
      const du = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
      const dw = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
      if (du > 1e-3 && dw > 1e-3) found.push(`${a.part}/${b.part} Achse ${'xyz'[a.axis]} bei ${a.at.toFixed(2)}`);
    }
  return found;
}

describe('Torhäuser und Portale flackern nicht', () => {
  for (const g of GATES) {
    it(`${g.id}: keine zwei Flächen liegen deckungsgleich in einer Ebene`, () => {
      const p = parts();
      gatehouse(p, g.id);
      expect(fighting(p)).toEqual([]);
    });
    it(`${g.id}: Portal und Sockel ebenso`, () => {
      for (const stubs of [false, true]) {
        const p = parts();
        portalFrame(p, g.id, stubs);
        expect(fighting(p)).toEqual([]);
      }
    });
  }
});
