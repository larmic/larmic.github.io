// Töne der Kinderspiele, per WebAudio erzeugt: keine Audiodateien, keine externen Ressourcen.
// Kurz, warm und leise. Höchstens MAX_VOICES Töne gleichzeitig, damit Dauerdrücken nicht laut wird.
// Der Browser erlaubt Ton erst nach einer Geste: `unlock()` aus einem Tasten- oder Klick-Handler aufrufen.

import type { Tone } from '../../data/games/mitwachsen';

const MAX_VOICES = 6;

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private voices = 0;
  muted = false;

  /** Im Handler einer Nutzergeste aufrufen: legt den AudioContext an bzw. weckt ihn */
  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const comp = this.ctx.createDynamicsCompressor();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.6;
        this.out.connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // ohne Ton weiterspielen
    }
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
  }

  private note(freq: number, len: number, wave: OscillatorType, gain: number, slide = 1, delay = 0) {
    const ctx = this.ctx;
    // Das Limit gilt nur für sofort erklingende Töne (Dauerdrücken); Melodien sind schon eingeplant und dürfen zu Ende spielen.
    // Ein gerade fortgesetzter Context (resume läuft asynchron) spielt eingeplante Töne nach.
    if (this.muted || !ctx || !this.out || ctx.state === 'closed' || (delay === 0 && this.voices >= MAX_VOICES)) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(env).connect(this.out);
    this.voices++;
    osc.onended = () => this.voices--;
    osc.start(t);
    osc.stop(t + len + 0.03);
  }

  /** Ton eines Tiers */
  play(tone: Tone) {
    tone.notes.forEach((f, i) =>
      this.note(f, tone.len, tone.wave, tone.gain ?? 0.15, tone.slide, i * (tone.len + tone.gap)),
    );
  }

  step(climb = 0) {
    this.note(climb > 0 ? 260 : climb < 0 ? 160 : 190 + Math.random() * 25, 0.05, 'sine', 0.06);
  }
  bump() {
    this.note(300, 0.22, 'sine', 0.1, 0.5);
  }
  call() {
    this.note(659.25, 0.14, 'sine', 0.12, 1.06);
    this.note(783.99, 0.2, 'sine', 0.12, 1.06, 0.16);
  }
  friend() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.16, 'triangle', 0.1, 1, 0.25 + i * 0.08));
  }
  pen() {
    [783.99, 1046.5].forEach((f, i) => this.note(f, 0.18, 'sine', 0.1, 1, i * 0.1));
  }
  gate() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.22, 'triangle', 0.1, 1, 0.3 + i * 0.11));
  }
  wake() {
    [523.25, 659.25, 783.99].forEach((f, i) => this.note(f, 0.18, 'sine', 0.1, 1, i * 0.12));
  }
  lullaby() {
    [783.99, 659.25, 587.33, 523.25, 392].forEach((f, i) => this.note(f, 0.42, 'sine', 0.08, 1, i * 0.38));
  }
}
