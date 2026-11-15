// Klangsteine in der 3D-Ansicht: die goldenen Noten, die über den Steinen schweben (der Stein selbst gehört zum Stück).
// Wird nur mit der 3D-Ansicht nachgeladen.

import { Group, Mesh, MeshBasicMaterial } from 'three';
import { Geo } from './mitwachsen-geo';
import { NOTE, NOTE_COLORS, STONE, STONE_COLORS, noteFloat } from './mitwachsen-story';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { World } from './mitwachsen-world';

/** Stein eines Klangsteins in die Geometrie eines Stücks bauen */
export function stoneInto(g: Geo, x: number, y: number, h: number) {
  for (const [bx, by, bz, w, d, hh] of STONE)
    g.box(x + bx, h + bz, y + by, w, hh, d, STONE_COLORS.side, STONE_COLORS.top);
}

/** Je Klangstein eine Note in vollem Gold, unabhängig von Sonne und Schatten; `update` lässt sie in jedem Bild schweben */
export class StoneNotes {
  readonly group = new Group();
  private readonly material = new MeshBasicMaterial({ vertexColors: true });
  private notes: { id: StoryId; mesh: Mesh; x: number; y: number; h: number }[] = [];

  build(world: World) {
    for (const { mesh } of this.notes) mesh.geometry.dispose();
    this.group.clear();
    const g = new Geo();
    for (const [nx, nz, w, hh] of NOTE) g.box(nx, nz, -0.05, w, hh, 0.1, NOTE_COLORS.side, NOTE_COLORS.top);
    const geometry = g.build();
    this.notes = [...world.stones].map(([id, [x, y]]) => {
      const mesh = new Mesh(geometry, this.material);
      mesh.castShadow = true;
      this.group.add(mesh);
      return { id, mesh, x, y, h: world.cell(x, y).h };
    });
  }

  update(heard: readonly StoryId[], now: number, reduced: boolean) {
    for (const n of this.notes) {
      const { z, scale } = noteFloat(now, n.x + n.y, heard.includes(n.id), reduced);
      n.mesh.position.set(n.x + 0.5, n.h + z, n.y + 0.5);
      n.mesh.scale.setScalar(scale);
      n.mesh.rotation.y = reduced ? 0 : Math.sin(now / 900 + n.x) * 0.35; // dreht sich ein wenig hin und her
    }
  }
}
