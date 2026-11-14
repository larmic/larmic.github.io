// Endlose Welten in Stücken: Ein Stück (CHUNK × CHUNK Felder) wird erst berechnet, wenn jemand ein Feld darin
// braucht, und dann zwischengespeichert. Die Welt selbst ist nie vollständig im Speicher.

export const CHUNK = 16;

/** Stück, in dem ein Feld liegt (auch für negative Koordinaten) */
export const chunkOf = (x: number, y: number): [number, number] => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];

/** Zwischenspeicher für Stücke. `make` berechnet ein Stück als Liste von CHUNK × CHUNK Feldern (zeilenweise). */
export class ChunkCache<T> {
  private readonly chunks = new Map<string, T[]>();

  constructor(
    private readonly make: (cx: number, cy: number) => T[],
    private readonly limit = 256,
  ) {}

  get(x: number, y: number): T {
    const [cx, cy] = chunkOf(x, y);
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.make(cx, cy);
      // Älteste Stücke vergessen, damit lange Wanderungen den Speicher nicht füllen (sie entstehen ja wieder gleich)
      if (this.chunks.size >= this.limit) this.chunks.delete(this.chunks.keys().next().value!);
      this.chunks.set(key, chunk);
    }
    return chunk[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)];
  }
}
