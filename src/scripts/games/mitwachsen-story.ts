// Klangsteine: Form von Stein und Note (für die 2D- und 3D-Ansicht), wie die Note schwebt, und das Abspielen der
// Geschichte – erst die Melodie des Ortes, dann, sobald es sie gibt, die eingesprochene Aufnahme.
// Spezifikation: docs/specs/mitwachsen.md

import { box, type Projection } from '../../lib/games/front';
import { STORIES, melodyLength, type StoryId } from '../../data/games/mitwachsen-stories';
import type { Sfx } from './sfx';

/** Quader [x, y, z, Breite, Tiefe, Höhe] relativ zur Ecke des Feldes, z ab seiner Oberkante */
export type Block = readonly [number, number, number, number, number, number];

export const STONE_COLORS = { side: '#8b8780', top: '#aaa69f' } as const;
export const NOTE_COLORS = { side: '#d4861a', top: '#f0a531' } as const; // Gold: hier kann man etwas tun

/** Der Stein: breiter Sockel, darauf eine kleinere Platte */
export const STONE: readonly Block[] = [
  [0.14, 0.2, 0, 0.72, 0.6, 0.34],
  [0.24, 0.28, 0.34, 0.52, 0.44, 0.12],
];

/** Achtelnote ♪ von vorn, flach: [x, z, Breite, Höhe] um die Mitte, unten bei z = 0; gut zu erkennen, fast ein Feld hoch */
export const NOTE: readonly (readonly [number, number, number, number])[] = [
  [-0.27, 0, 0.36, 0.26], // Kopf
  [0.01, 0.12, 0.09, 0.72], // Hals
  [0.1, 0.74, 0.2, 0.1], // Fähnchen
  [0.21, 0.56, 0.09, 0.2],
];

/**
 * Wie die Note über ihrem Stein schwebt: Höhe über der Oberkante und Größe. Eine noch nie gehörte Geschichte ist
 * größer und pulsiert sanft (so sieht man ohne Text, wo es etwas Neues gibt); bei reduzierter Bewegung steht alles still.
 */
export function noteFloat(now: number, phase: number, heard: boolean, reduced: boolean): { z: number; scale: number } {
  if (reduced) return { z: 0.7, scale: heard ? 1 : 1.15 };
  const pulse = heard ? 0 : 0.08 + 0.08 * Math.sin(now / 280 + phase);
  return { z: 0.7 + Math.sin(now / 650 + phase) * 0.1, scale: 1 + pulse };
}

/** Klangstein in der 2D-Ansicht von vorn */
export function drawStone(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  x: number,
  y: number,
  h: number,
  heard: boolean,
  now: number,
  reduced: boolean,
) {
  for (const [bx, by, bz, w, d, hh] of STONE)
    box(ctx, P, x + bx, y + by, h + bz, w, d, hh, STONE_COLORS.side, STONE_COLORS.top);
  const { z, scale } = noteFloat(now, x + y, heard, reduced);
  for (const [nx, nz, w, hh] of NOTE)
    box(
      ctx,
      P,
      x + 0.5 + nx * scale,
      y + 0.45,
      h + z + nz * scale,
      w * scale,
      0.1,
      hh * scale,
      NOTE_COLORS.side,
      NOTE_COLORS.top,
    );
}

/**
 * Spielt die Geschichten der Klangsteine: Hineinlaufen startet, noch einmal Hineinlaufen hält an, ein anderer Stein
 * löst den vorigen ab. Erst die Melodie, danach die Aufnahme (wird erst jetzt geladen); ohne Aufnahme nur die Melodie.
 */
export class StoryPlayer {
  playing: StoryId | null = null;
  private stopMelody: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private voice: HTMLAudioElement | null = null;

  constructor(private readonly sfx: Sfx) {}

  toggle(id: StoryId) {
    const again = this.playing === id;
    this.stop();
    if (!again) this.start(id);
  }

  private start(id: StoryId) {
    const story = STORIES[id];
    this.playing = id;
    this.stopMelody = this.sfx.melody(story.melody);
    this.timer = setTimeout(
      () => {
        if (!story.voice || this.sfx.muted) return this.stop();
        const audio = new Audio(story.voice);
        this.voice = audio;
        audio.onended = audio.onerror = () => this.stop();
        audio.play().catch(() => this.stop());
      },
      melodyLength(story.melody) * 1000,
    );
  }

  stop() {
    clearTimeout(this.timer);
    this.stopMelody?.();
    this.stopMelody = null;
    this.voice?.pause();
    this.voice = null;
    this.playing = null;
  }
}
