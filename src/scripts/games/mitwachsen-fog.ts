// Nebel über der Welt – rein, ohne DOM, damit testbar. Zu sehen ist nur, was die Figur schon erkundet hat.
// Je Stück (16 × 16 Felder) ein Bitfeld: 1 = erkundet. Gespeichert als Base64 je Stück, also wenige Byte.
// Die Regeln kennen den Nebel nicht; er betrifft nur, was gezeichnet wird.
// Spezifikation: docs/specs/mitwachsen.md

import { CHUNK, chunkOf } from '../../lib/games/chunks';

export const REVEAL = 4; // so weit sieht die Figur um sich herum
export const START_REVEAL = 5; // so viel ist am Anfang um das Bett zu sehen
const BYTES = (CHUNK * CHUNK) / 8;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function fromBase64(text: string): Uint8Array | null {
  try {
    const raw = atob(text);
    if (raw.length !== BYTES) return null;
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export class Fog {
  private chunks = new Map<string, Uint8Array>();

  /** Aus einem Spielstand; Kaputtes wird übergangen */
  static from(data: unknown): Fog {
    const fog = new Fog();
    if (typeof data === 'object' && data !== null && !Array.isArray(data))
      for (const [key, value] of Object.entries(data)) {
        if (!/^-?\d+,-?\d+$/.test(key) || typeof value !== 'string') continue;
        const bytes = fromBase64(value);
        if (bytes) fog.chunks.set(key, bytes);
      }
    return fog;
  }

  /** Ist das Feld erkundet? */
  has(x: number, y: number): boolean {
    const [cx, cy] = chunkOf(x, y);
    const bits = this.chunks.get(`${cx},${cy}`);
    if (!bits) return false;
    const i = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** Kreis um (x, y) erkunden; liefert die Stücke, in denen sich etwas geändert hat */
  reveal(x: number, y: number, r: number): string[] {
    const changed = new Set<string>();
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue; // runder Rand
        const px = x + dx,
          py = y + dy;
        const [cx, cy] = chunkOf(px, py);
        const key = `${cx},${cy}`;
        let bits = this.chunks.get(key);
        if (!bits) {
          bits = new Uint8Array(BYTES);
          this.chunks.set(key, bits);
        }
        const i = (py - cy * CHUNK) * CHUNK + (px - cx * CHUNK);
        if (bits[i >> 3] & (1 << (i & 7))) continue;
        bits[i >> 3] |= 1 << (i & 7);
        changed.add(key);
      }
    return [...changed];
  }

  /** Für den Spielstand: je Stück Base64 */
  serialize(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, bits] of this.chunks) if (bits.some((b) => b !== 0)) out[key] = toBase64(bits);
    return out;
  }

  /** Anzahl erkundeter Felder */
  get size(): number {
    let n = 0;
    for (const bits of this.chunks.values()) for (const b of bits) for (let v = b; v; v &= v - 1) n++;
    return n;
  }
}
