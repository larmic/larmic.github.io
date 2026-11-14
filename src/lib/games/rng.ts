// Zufall aus einem Seed: Dieselben Eingaben ergeben immer dieselben Zahlen. So entsteht aus einem Seed immer
// dieselbe Welt, und Spielregeln mit Zufall bleiben testbar.

/** Ganzzahl-Hash (32 Bit, ohne Vorzeichen) aus Seed und beliebig vielen ganzen Zahlen, z. B. Koordinaten */
export function hash(seed: number, ...ns: number[]): number {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  for (const n of ns) {
    h ^= Math.imul(n | 0, 0xcc9e2d51);
    h = Math.imul((h << 13) | (h >>> 19), 5) + 0xe6546b64;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Zahl in [0, 1) aus Seed und Koordinaten */
export const rand01 = (seed: number, ...ns: number[]): number => hash(seed, ...ns) / 4294967296;

/** Nächste Zahl einer Zufallsfolge (mulberry32): liefert [Zahl in [0, 1), neuer Zustand] */
export function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s >>> 0];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Weiches Rauschen in [0, 1): Zufallswerte auf einem Gitter im Abstand `scale`, dazwischen weich überblendet */
export function valueNoise(seed: number, x: number, y: number, scale: number): number {
  const gx = x / scale,
    gy = y / scale;
  const x0 = Math.floor(gx),
    y0 = Math.floor(gy);
  const tx = smooth(gx - x0),
    ty = smooth(gy - y0);
  const v = (i: number, j: number) => rand01(seed, x0 + i, y0 + j);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * tx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * tx;
  return top + (bottom - top) * ty;
}
