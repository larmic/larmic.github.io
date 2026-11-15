// Blumen und Pilze wachsen nach – rein, ohne DOM, damit testbar. Mit jedem Tag (jedes Schlafen zählt einen Tag)
// blühen auf der Lichtung mehr Blumen, und es sprießen Pilze. Was einmal gewachsen ist, bleibt an späteren Tagen.
// Nur Zierde: Die Regeln kennen das Nachwachsen nicht (Blumen und Pilze versperren nichts).
// Spezifikation: docs/specs/mitwachsen.md

import { hash, rand01 } from '../../lib/games/rng';
import { GAME_COLORS } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-world';

export const FLOWERS_PER_DAY = 0.012; // Anteil freier Wiese, der je Tag dazu blüht
export const MAX_FLOWERS = 0.12; // mehr wird es nicht, damit die Wiese frei bleibt
export const MUSHROOMS_PER_DAY = 0.003;
export const MAX_MUSHROOMS = 0.03;

/** Ein Feld mit allem, was bis zum Tag `day` darauf gewachsen ist (nur freie Wiese der Lichtung) */
export function grown(seed: number, day: number, x: number, y: number, c: Cell): Cell {
  if (day <= 0 || c.region !== 'lichtung' || c.ground !== 'grass' || c.deco || c.solid) return c;
  if (rand01(seed, x, y, 21) < Math.min(MAX_FLOWERS, day * FLOWERS_PER_DAY))
    return { ...c, deco: 'flower', color: GAME_COLORS.flowers[hash(seed, x, y, 23) % GAME_COLORS.flowers.length] };
  if (rand01(seed, x, y, 22) < Math.min(MAX_MUSHROOMS, day * MUSHROOMS_PER_DAY)) return { ...c, deco: 'mushroom' };
  return c;
}
