// Karte oben rechts: zeigt mehr als das Bild, genordet wie die Kamera (oben = vom Betrachter weg).
// Erkundete Felder in ihren Farben, Unerkundetes als Nebel, die Figur als Punkt, das Bett als Häuschen.
// Liegt das Bett außerhalb der Karte, zeigt ein Pfeil am Kartenrand den Weg nach Hause.

import { GATES, HOME, THEME_COLORS } from '../../data/games/mitwachsen';
import type { State } from './mitwachsen-state';
import type { Cell, World } from './mitwachsen-world';

export const MAP_RADIUS = 28; // Felder vom Mittelpunkt bis zum Rand

const COLORS = {
  fog: '#e4edf3',
  water: '#5aa6e8',
  sand: '#e3cf95',
  path: '#c9a46e',
  stone: '#8f949b',
  grass: ['#6dbd47', '#7fca57', '#93d66a', '#a6e07e'], // je Höhe etwas heller
  tree: '#2f7e2e',
  bush: '#3f9a3c',
  gate: '#7a5432',
  ink: '#1d2838',
  player: '#ffffff',
  home: '#f3ead6',
  roof: '#c0453a',
};

/** Böden der Welten hinter den Toren */
const WORLD_GROUND: Partial<Record<Cell['ground'], string>> = {
  snow: '#f4f8fb',
  ice: '#bfe6f5',
  basalt: '#3a3b42',
  lava: '#ff7a1a',
  cave: '#3c3f47',
  cloud: '#ffffff',
  sky: '#c9e6f7',
  moss: '#8a76cc',
};

function colorOf(c: Cell): string {
  if (c.gate) return THEME_COLORS[c.gate].side;
  if (c.deco === 'gatetower' || c.deco === 'portalside') return THEME_COLORS[c.part!.id].side;
  if (c.deco === 'gate' || c.deco === 'trough' || c.deco === 'watertrough') return COLORS.gate;
  if (WORLD_GROUND[c.ground]) return WORLD_GROUND[c.ground]!;
  if (c.ground === 'water') return COLORS.water;
  if (c.deco === 'tree') return COLORS.tree;
  if (c.deco === 'bush' || c.deco === 'hedge') return COLORS.bush;
  if (c.ground === 'stone' || c.deco === 'rock' || c.deco === 'boulder') return COLORS.stone;
  if (c.ground === 'sand') return COLORS.sand;
  if (c.ground === 'path') return COLORS.path;
  return COLORS.grass[Math.max(0, Math.min(COLORS.grass.length - 1, c.h - 1))] ?? COLORS.water;
}

/**
 * Karte zeichnen. `explored(x, y)` sagt, ob ein Feld schon erkundet ist (ohne Nebel: immer true).
 * `cx, cy` ist der Mittelpunkt in Feldern (die gleitende Figur), `size` die Kantenlänge in CSS-Pixeln.
 */
export function drawMap(
  ctx: CanvasRenderingContext2D,
  world: World,
  state: State,
  cx: number,
  cy: number,
  size: number,
  explored: (x: number, y: number) => boolean,
  now: number,
) {
  const cell = size / (MAP_RADIUS * 2 + 1);
  const ox = size / 2 - (cx + 0.5) * cell,
    oy = size / 2 - (cy + 0.5) * cell;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = COLORS.fog;
  ctx.fillRect(0, 0, size, size);
  const x0 = Math.floor(cx) - MAP_RADIUS - 1,
    y0 = Math.floor(cy) - MAP_RADIUS - 1;
  for (let y = y0; y <= y0 + MAP_RADIUS * 2 + 2; y++)
    for (let x = x0; x <= x0 + MAP_RADIUS * 2 + 2; x++) {
      if (!explored(x, y)) continue;
      ctx.fillStyle = colorOf(world.cell(x, y));
      ctx.fillRect(Math.floor(ox + x * cell), Math.floor(oy + y * cell), Math.ceil(cell), Math.ceil(cell));
    }

  // Portale: am Tor, sobald erkundet; über dem Bett, sobald aktiv
  for (const g of GATES) {
    const p = world.portals.get(g.id);
    if (!p) continue;
    const color = THEME_COLORS[g.theme].portal;
    const spots = [explored(p.gate[0], p.gate[1]) ? p.gate : null, state.portals.includes(g.id) ? p.home : null];
    for (const spot of spots) {
      if (!spot) continue;
      const px = ox + (spot[0] + 0.5) * cell,
        py = oy + (spot[1] + 0.5) * cell;
      const r = Math.max(3, cell * 1.1);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(px - r - 1, py - r - 1, 2 * r + 2, 2 * r + 2);
      ctx.fillStyle = color;
      ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
    }
  }

  // Bett als Häuschen, sonst ein Pfeil am Rand dorthin
  const [bx, by] = HOME.bed;
  const hx = ox + (bx + 0.5) * cell,
    hy = oy + (by + 0.5) * cell;
  const s = Math.max(5, cell * 1.6);
  const inside = hx > s && hx < size - s && hy > s && hy < size - s;
  if (inside) {
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(hx - s / 2 - 1, hy - s / 2 - 1, s + 2, s + 2);
    ctx.fillStyle = COLORS.home;
    ctx.fillRect(hx - s / 2, hy - s / 4, s, (s * 3) / 4);
    ctx.fillStyle = COLORS.roof;
    ctx.fillRect(hx - s / 2, hy - s / 2, s, s / 3);
  } else {
    const ang = Math.atan2(hy - size / 2, hx - size / 2);
    const r = size / 2 - 9;
    ctx.save();
    ctx.translate(size / 2 + Math.cos(ang) * r, size / 2 + Math.sin(ang) * r);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fillStyle = COLORS.player;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Figur in der Mitte, sanft pulsierend
  if (!state.sleeping) {
    const pulse = 1 + 0.15 * Math.sin(now / 300);
    const r = Math.max(3, cell * 0.9) * pulse;
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
