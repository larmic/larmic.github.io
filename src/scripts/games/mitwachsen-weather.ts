// Wetter von Mitwachsen – rein, ohne DOM, damit testbar. Es wechselt alle 5 Minuten Spielzeit zwischen Sonne,
// Wolken und sanftem Regen; nach dem Regen steht manchmal ein Regenbogen am Himmel. Kein Gewitter, nichts Unheimliches.
// Gleicher Seed, gleicher Tag, gleiche Spielzeit: gleiches Wetter. Jeder Tag beginnt mit Sonne.
// Die Regeln fragen nur, ob es regnet (dann gehen die Tiere der Wiese unter den Unterstand); alles andere ist Bild.
// Spezifikation: docs/specs/mitwachsen.md

import { hash } from '../../lib/games/rng';

export type WeatherKind = 'sun' | 'clouds' | 'rain';
export const BLOCK = 3000; // Takte je Wetter (5 Minuten)
export const FADE = 200; // Takte für den Übergang (20 Sekunden)
export const RAINBOW = 900; // so lange steht der Regenbogen nach dem Regen (1,5 Minuten)

/** Wetter eines Abschnitts: der erste jedes Tages ist sonnig, danach Sonne 50 %, Wolken 25 %, Regen 25 % */
export function kindOf(seed: number, day: number, block: number): WeatherKind {
  if (block <= 0) return 'sun';
  const roll = hash(seed, day, block, 31) % 4;
  return roll < 2 ? 'sun' : roll === 2 ? 'clouds' : 'rain';
}

export const raining = (seed: number, day: number, tick: number) =>
  kindOf(seed, day, Math.floor(tick / BLOCK)) === 'rain';

export type WeatherLook = { cloud: number; rain: number; rainbow: number }; // je 0 … 1

const look = (k: WeatherKind): [number, number] => (k === 'sun' ? [0, 0] : k === 'clouds' ? [0.7, 0] : [1, 1]);

/** Wie das Wetter gerade aussieht, mit weichem Übergang am Anfang jedes Abschnitts */
export function weatherLook(seed: number, day: number, tick: number): WeatherLook {
  const block = Math.floor(tick / BLOCK);
  const into = tick - block * BLOCK;
  const now = kindOf(seed, day, block);
  const before = kindOf(seed, day, block - 1);
  const t = Math.min(1, into / FADE);
  const [c0, r0] = look(before),
    [c1, r1] = look(now);
  const rainbow =
    now === 'sun' && before === 'rain' && block > 0
      ? Math.min(1, into / FADE) * Math.min(1, Math.max(0, (RAINBOW - into) / FADE))
      : 0;
  return { cloud: c0 + (c1 - c0) * t, rain: r0 + (r1 - r0) * t, rainbow };
}
