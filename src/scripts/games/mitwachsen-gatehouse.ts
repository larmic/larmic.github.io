// Torhäuser und Portale der 3D-Ansicht: mächtige Tore im Felsring, je Welt anders geschmückt, und Portale mit
// Säulen, Sturz und Krone. Liefert nur Geometrie in eigenen Koordinaten; die 3D-Ansicht stellt sie an ihren Platz.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Koordinaten: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung bzw. zum Bett).
// Ein Torhaus ist 9 Felder breit (Tor 5, Türme je 2) und reicht 3 Felder tief in den Fels. Ein Portal ist 3 Felder
// breit (Säule, Portal, Säule).

import { Color } from 'three';
import { THEME_COLORS, type GateTheme } from '../../data/games/mitwachsen';
import { Geo, type Tile } from './mitwachsen-geo';

/** Teile, die mit verschiedenen Materialien gezeichnet werden */
export type Parts = {
  solid: Geo; // Stein, Holz, Eis … (wird vor der Figur durchsichtig, damit man sie hinter dem Tor sieht)
  lava: Geo; // glühende Lava
  bright: Geo; // leuchtet aus sich selbst: Kristalle, Zeichen, Wasserfall
  leaves: Geo; // Laub
};
export const parts = (): Parts => ({ solid: new Geo(), lava: new Geo(), bright: new Geo(), leaves: new Geo() });

/** Mauerwerk je Welt: Kachel und Tönung */
const WALL: Record<GateTheme, { tile: Tile; tint: string; top?: Tile }> = {
  eis: { tile: 'ice', tint: '#ffffff' },
  sand: { tile: 'sandstone', tint: '#ffffff' },
  wasser: { tile: 'stone', tint: '#a9c9ea' },
  lava: { tile: 'basalt', tint: '#ffffff' },
  hoehle: { tile: 'cave', tint: '#ffffff' },
  wald: { tile: 'log', tint: '#ffffff', top: 'logTop' },
  wolken: { tile: 'cloud', tint: '#ffffff' },
  pilze: { tile: 'cloud', tint: '#efe4d2' },
};

const W = 2.5; // halbe Torbreite
const TOWER_W = 2; // Turmbreite
const TOWER_H = 6.6;
const ARCH_Y = 4.7; // Unterkante des Torbogens
const DEPTH = 2.5; // so weit reicht das Torhaus nach hinten

/** Quader mit Ecke (x0, y0, z0) und Gegenecke (x1, y1, z1) – im Torhaus leichter zu lesen als Ecke und Größe */
function block(
  g: Geo,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  side: string,
  top?: string | null,
  tile?: Tile,
  topTile?: Tile,
) {
  g.box(x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, side, top ?? side, tile, topTile);
}

/** Ein mächtiges Torhaus: zwei Türme, Torbogen, geschlossene Doppeltür mit leuchtendem Zeichen, Schmuck der Welt */
export function gatehouse(p: Parts, theme: GateTheme) {
  const wall = WALL[theme];
  const glow = THEME_COLORS[theme].portal;
  const wallBlock = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    block(p.solid, x0, y0, z0, x1, y1, z1, wall.tint, wall.tint, wall.tile, wall.top);

  const towerX = [-W - TOWER_W, W]; // linke Kante der Türme
  for (const x0 of towerX) {
    if (theme === 'pilze') {
      // Pilztürme: dicke Stiele, oben ein riesiger Hut mit weißen Tupfen
      wallBlock(x0 + 0.3, 0, -DEPTH + 0.3, x0 + TOWER_W - 0.3, TOWER_H - 0.4, 0.3);
      block(
        p.solid,
        x0 - 0.5,
        TOWER_H - 0.6,
        -DEPTH - 0.2,
        x0 + TOWER_W + 0.5,
        TOWER_H + 0.5,
        0.9,
        '#c8323a',
        '#d9473a',
      );
      block(
        p.solid,
        x0 + 0.1,
        TOWER_H + 0.5,
        -DEPTH + 0.3,
        x0 + TOWER_W - 0.1,
        TOWER_H + 0.9,
        0.4,
        '#c8323a',
        '#d9473a',
      );
      for (const [dx, dz] of [
        [0.15, 0.6], // nicht bündig mit dem Rand des Hutes darunter
        [1.3, 0.2],
        [0.7, -0.9],
        [1.8, -1.6],
        [-0.2, -1.9],
      ] as const)
        block(p.solid, x0 + dx, TOWER_H + 0.5, dz - 0.25, x0 + dx + 0.35, TOWER_H + 0.56, dz + 0.1, '#ffffff');
      for (const dx of [0.2, 1.4])
        block(p.solid, x0 + dx, TOWER_H - 0.1, 0.9, x0 + dx + 0.35, TOWER_H + 0.25, 0.92, '#ffffff');
      continue;
    }
    // Sockel und Turm
    wallBlock(x0 - 0.15, 0, -DEPTH - 0.1, x0 + TOWER_W + 0.15, 0.7, 0.8);
    wallBlock(x0, 0.7, -DEPTH, x0 + TOWER_W, TOWER_H, 0.65);
    // Zinnen (außer bei Welten mit eigener Krone)
    if (theme !== 'sand' && theme !== 'wolken' && theme !== 'wald')
      for (const [dx, dz] of [
        [0, 0.05],
        [TOWER_W - 0.6, 0.05],
        [0, -DEPTH],
        [TOWER_W - 0.6, -DEPTH],
      ] as const)
        wallBlock(x0 + dx, TOWER_H, dz, x0 + dx + 0.6, TOWER_H + 0.6, dz + 0.6);
  }

  // Torbogen über der Tür
  if (theme === 'pilze')
    block(p.solid, -W - 0.2, ARCH_Y, -DEPTH + 0.4, W + 0.2, ARCH_Y + 0.9, 0.35, '#efe4d2', '#f7efe2', 'cloud');
  else wallBlock(-W, ARCH_Y, -DEPTH + 0.2, W, ARCH_Y + 1.2, 0.55);

  // Geschlossene Doppeltür aus Holz mit Eisenbändern, vorn und hinten gleich
  const wood = '#6b4423',
    woodTop = '#7d5232',
    iron = '#3a3a44';
  block(p.solid, -W + 0.05, 0, -0.75, -0.04, ARCH_Y, -0.35, wood, woodTop, 'planks');
  block(p.solid, 0.04, 0, -0.75, W - 0.05, ARCH_Y, -0.35, wood, woodTop, 'planks');
  for (const y of [0.7, 2.3, 3.9]) {
    block(p.solid, -W + 0.05, y, -0.33, W - 0.05, y + 0.2, -0.28, iron);
    block(p.solid, -W + 0.05, y, -0.82, W - 0.05, y + 0.2, -0.77, iron);
  }
  // Leuchtendes Zeichen der Welt in der Mitte der Tür (vorn und hinten)
  for (const z of [-0.3, -0.86]) {
    block(p.bright, -0.55, 2.0, z, 0.55, 3.1, z + 0.06, glow);
    block(p.bright, -0.3, 2.25, z + (z > -0.5 ? 0.05 : -0.04), 0.3, 2.85, z + (z > -0.5 ? 0.09 : 0.0), '#ffffff');
  }

  decorate(p, theme);
}

/** Schmuck je Welt: Krone der Türme, Dinge am Torbogen */
function decorate(p: Parts, theme: GateTheme) {
  const towerMid = [-W - TOWER_W / 2, W + TOWER_W / 2];
  switch (theme) {
    case 'eis':
      for (const cx of towerMid) {
        block(p.solid, cx - 1.05, TOWER_H + 0.6, -DEPTH - 0.05, cx + 1.05, TOWER_H + 0.85, 0.7, '#ffffff'); // Schneehaube
        for (const [dx, h] of [
          [-0.6, 1.4],
          [0, 2.1],
          [0.55, 1.2],
        ] as const)
          block(
            p.bright,
            cx + dx - 0.18,
            TOWER_H + 0.85,
            -0.9,
            cx + dx + 0.18,
            TOWER_H + 0.85 + h,
            -0.55,
            '#bfeaff',
            '#e8f8ff',
          );
      }
      for (let x = -W + 0.3; x < W; x += 0.55)
        // Eiszapfen am Bogen
        block(p.bright, x, ARCH_Y - 0.25 - (((x * 7) % 3) + 3) * 0.08, 0.35, x + 0.14, ARCH_Y, 0.5, '#d4f1ff');
      break;
    case 'sand':
      for (const cx of towerMid) {
        // Stufenkrone wie bei einer kleinen Pyramide
        block(p.solid, cx - 1.1, TOWER_H, -DEPTH, cx + 1.1, TOWER_H + 0.5, 0.75, '#ffffff', null, 'sandstone');
        block(
          p.solid,
          cx - 0.75,
          TOWER_H + 0.5,
          -DEPTH + 0.35,
          cx + 0.75,
          TOWER_H + 1.0,
          0.4,
          '#ffffff',
          null,
          'sandstone',
        );
        block(
          p.solid,
          cx - 0.4,
          TOWER_H + 1.0,
          -DEPTH + 0.7,
          cx + 0.4,
          TOWER_H + 1.5,
          0.05,
          '#ffffff',
          null,
          'sandstone',
        );
        block(p.bright, cx - 0.2, TOWER_H + 1.5, -DEPTH + 0.9, cx + 0.2, TOWER_H + 1.8, -0.15, '#ffd98a');
      }
      block(p.solid, -W, ARCH_Y + 0.25, 0.56, W, ARCH_Y + 0.4, 0.6, '#2f6fb8'); // Bänder am Bogen
      block(p.solid, -W, ARCH_Y + 0.75, 0.56, W, ARCH_Y + 0.9, 0.6, '#e0a03a');
      break;
    case 'wasser':
      for (const cx of towerMid) {
        block(p.bright, cx - 0.45, 0.7, 0.66, cx + 0.45, TOWER_H, 0.72, '#7fc8ff', '#b8e2ff'); // Wasserfall
        block(p.bright, cx - 0.7, 0.7, 0.68, cx + 0.7, 0.9, 1.1, '#b8e2ff'); // Gischt unten (vor dem Wasserfall, nicht in seiner Ebene)
        for (const [dx, c] of [
          [-0.6, '#f4a7b9'],
          [0.1, '#ffd7a8'],
          [0.6, '#f4a7b9'],
        ] as const)
          block(p.solid, cx + dx - 0.2, TOWER_H + 0.6, -0.4, cx + dx + 0.2, TOWER_H + 0.95, -0.1, c); // Muscheln
      }
      for (let x = -W; x < W; x += 1)
        block(p.bright, x + 0.1, ARCH_Y + 0.5, 0.56, x + 0.8, ARCH_Y + 0.65, 0.6, '#7fc8ff'); // Wellen
      break;
    case 'lava':
      for (const cx of towerMid) {
        block(p.lava, cx - 0.5, 1.2, 0.66, cx - 0.25, TOWER_H - 0.4, 0.7, '#ffffff', null, 'lava'); // Lava-Adern
        block(p.lava, cx + 0.3, 0.7, 0.66, cx + 0.55, TOWER_H - 1.6, 0.7, '#ffffff', null, 'lava');
        block(p.lava, cx - 0.9, TOWER_H + 0.6, -DEPTH + 0.6, cx + 0.9, TOWER_H + 1.0, 0.1, '#ffffff', null, 'lava'); // glühende Krone
      }
      for (const x of [-1.8, -0.6, 0.7, 1.7])
        block(p.lava, x, ARCH_Y - 0.35, 0.36, x + 0.2, ARCH_Y, 0.52, '#ffffff', null, 'lava'); // Tropfen
      break;
    case 'hoehle':
      for (const cx of towerMid) {
        for (const [dx, dz, h, c] of [
          [-0.55, -0.5, 1.6, '#b48cf0'],
          [0.1, -1.2, 2.2, '#6fd6f0'],
          [0.6, -0.3, 1.2, '#f08cc8'],
          [-0.2, -1.8, 1.0, '#b48cf0'],
        ] as const)
          block(p.bright, cx + dx - 0.2, TOWER_H + 0.6, dz - 0.2, cx + dx + 0.2, TOWER_H + 0.6 + h, dz + 0.2, c);
        block(p.bright, cx - 1.3, 0, 0.7, cx - 0.9, 1.2, 1.1, '#b48cf0'); // Kristalle am Fuß
        block(p.bright, cx + 0.95, 0, 0.75, cx + 1.25, 0.8, 1.05, '#6fd6f0');
      }
      break;
    case 'wald':
      for (const cx of towerMid) {
        block(
          p.leaves,
          cx - 1.5,
          TOWER_H - 0.4,
          -DEPTH - 0.4,
          cx + 1.5,
          TOWER_H + 1.0,
          1.0,
          '#3f9a3c',
          '#5ab651',
          'leaves',
        );
        block(
          p.leaves,
          cx - 0.9,
          TOWER_H + 1.0,
          -DEPTH + 0.2,
          cx + 0.9,
          TOWER_H + 1.7,
          0.4,
          '#3f9a3c',
          '#5ab651',
          'leaves',
        );
      }
      block(
        p.leaves,
        -W - 0.2,
        ARCH_Y + 1.1,
        -DEPTH + 0.1,
        W + 0.2,
        ARCH_Y + 1.7,
        0.75,
        '#4fa84a',
        '#5ab651',
        'leaves',
      );
      for (let x = -W + 0.4; x < W; x += 0.7)
        // Ranken
        block(p.solid, x, ARCH_Y - 0.4 - (((x * 5) % 2) + 2) * 0.15, 0.57, x + 0.1, ARCH_Y, 0.62, '#3c8a34');
      break;
    case 'wolken': {
      for (const cx of towerMid) {
        block(p.solid, cx - 1.3, TOWER_H - 0.2, -DEPTH - 0.2, cx + 1.3, TOWER_H + 0.6, 0.95, '#ffffff', null, 'cloud');
        block(p.solid, cx - 0.8, TOWER_H + 0.6, -DEPTH + 0.3, cx + 0.8, TOWER_H + 1.2, 0.5, '#ffffff', null, 'cloud');
        block(p.bright, cx - 0.15, TOWER_H + 1.2, -1.1, cx + 0.15, TOWER_H + 1.6, -0.8, '#ffe27a'); // goldener Knauf
      }
      // Regenbogen über dem Tor: sechs Bänder in Stufen. Sie überlappen sich in der Höhe; jedes innere Band liegt
      // ein Stück weiter vorn, sonst lägen ihre Flächen in einer Ebene und flackerten (Z-Fighting)
      const bands = ['#e8504a', '#f39a3d', '#f2d14b', '#6dbd47', '#5aa6e8', '#8a6bd6'];
      bands.forEach((c, i) => {
        const r = 4.4 - i * 0.28;
        for (let k = 0; k < 9; k++) {
          const a0 = (k / 9) * Math.PI,
            a1 = ((k + 1) / 9) * Math.PI;
          const x0 = -Math.cos(a0) * r,
            x1 = -Math.cos(a1) * r;
          const y = ARCH_Y + 1.2 + Math.sin((a0 + a1) / 2) * r * 0.55;
          block(p.bright, Math.min(x0, x1), y, -0.4 + i * 0.03, Math.max(x0, x1), y + 0.28, -0.1 + i * 0.03, c);
        }
      });
      break;
    }
    case 'pilze':
      for (const [x, s, c] of [
        [-4.9, 0.5, '#d9473a'],
        [4.3, 0.4, '#4f7fd9'],
        [-2.9, 0.3, '#e0a03a'],
        [2.8, 0.35, '#d9473a'],
      ] as const) {
        block(p.solid, x + s * 0.4, 0, 0.9, x + s * 0.8, s * 1.4, 1.2, '#efe4d2');
        block(p.solid, x, s * 1.4, 0.75, x + s * 1.2, s * 1.9, 1.35, c);
      }
      break;
  }
}

/**
 * Portal: zwei Säulen und ein Sturz im Thema der Welt, oben eine Krone mit leuchtendem Stein. Ist es aktiv, dreht
 * sich innen ein Wirbel (eigenes Mesh in der 3D-Ansicht). `stubs`: noch nicht erschienenes Portal am Bett – nur zwei
 * kleine Sockel zeigen, wo es einmal stehen wird.
 */
export function portalFrame(p: Parts, theme: GateTheme, stubs = false) {
  const wall = WALL[theme];
  const glow = THEME_COLORS[theme].portal;
  const wallBlock = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, g = p.solid) =>
    block(g, x0, y0, z0, x1, y1, z1, wall.tint, wall.tint, wall.tile, wall.top);
  if (stubs) {
    for (const x of [-1.35, 0.65]) {
      wallBlock(x, 0, -0.35, x + 0.7, 0.5, 0.35);
      block(p.solid, x + 0.2, 0.5, -0.15, x + 0.5, 0.75, 0.15, '#6b6f78'); // ruhender Stein
    }
    return;
  }
  const pillar = theme === 'lava' ? p.lava : p.solid;
  for (const x of [-1.45, 0.55]) {
    wallBlock(x - 0.05, 0, -0.45, x + 0.95, 0.4, 0.45);
    wallBlock(x + 0.1, 0.4, -0.35, x + 0.8, 3.3, 0.35, pillar);
    wallBlock(x - 0.05, 3.3, -0.45, x + 0.95, 3.55, 0.45);
  }
  wallBlock(-1.6, 3.55, -0.4, 1.6, 4.05, 0.4);
  wallBlock(-0.9, 4.05, -0.3, 0.9, 4.45, 0.3);
  // Krone: leuchtender Stein in der Farbe der Welt, Schmuck an den Ecken
  block(p.bright, -0.3, 4.45, -0.2, 0.3, 5.0, 0.2, glow);
  block(p.bright, -0.15, 3.65, 0.4, 0.15, 3.95, 0.46, glow);
  for (const x of [-1.6, 1.25]) block(p.bright, x, 4.05, -0.18, x + 0.35, 4.4, 0.18, glow);
  if (theme === 'wald') block(p.leaves, -1.8, 3.9, -0.6, 1.8, 4.5, 0.6, '#3f9a3c', '#5ab651', 'leaves');
  if (theme === 'eis') block(p.solid, -1.65, 4.05, -0.42, 1.65, 4.2, 0.42, '#ffffff');
  if (theme === 'pilze') block(p.solid, -1.9, 4.05, -0.7, 1.9, 4.5, 0.7, '#c8323a', '#d9473a');
}

/** Wirbel im Portal: Ringe in Weiß, die Farbe kommt vom Material (Leinwand für eine Textur) */
export function swirlCanvas(): HTMLCanvasElement {
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (x - n / 2 + 0.5) / (n / 2),
        dy = (y - n / 2 + 0.5) / (n / 2);
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const v = 0.5 + 0.5 * Math.sin(a * 3 + r * 14); // Spirale mit drei Armen
      const alpha = Math.max(0, Math.min(1, (1.05 - r) * 3)) * (0.45 + 0.55 * v);
      const c = new Color(1, 1, 1).lerp(new Color(0.75, 0.75, 0.75), 1 - v);
      ctx.fillStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  return canvas;
}
