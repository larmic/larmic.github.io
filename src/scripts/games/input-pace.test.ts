import { describe, expect, it } from 'vitest';
import type { Dir } from '../../lib/games/front';
import { ACTION_MS, HOLD_MS, InputPace, STEP_MS } from './input-pace';

/** Simuliert `ms` Millisekunden mit einem Bild alle 16 ms und zählt die Schritte */
function steps(pace: InputPace, from: number, ms: number, taps: number[] = [], dir: Dir = 'e') {
  const out: number[] = [];
  for (let t = from; t < from + ms; t += 16) {
    if (taps.some((tap) => tap >= t && tap < t + 16)) {
      if (pace.press(dir, t)) out.push(t);
      pace.release(dir);
    }
    if (pace.poll(t)) out.push(t);
  }
  return out;
}

describe('Ruhiger Takt der Eingabe', () => {
  it('der erste Druck läuft sofort', () => {
    expect(new InputPace().press('e', 0)).toBe('e');
  });

  it('ein Druck ist genau ein Schritt, auch wenn der Finger etwas länger liegt', () => {
    const pace = new InputPace();
    expect(pace.press('e', 0)).toBe('e');
    expect(steps(pace, 0, HOLD_MS - 20)).toEqual([]);
    pace.release('e');
    expect(steps(pace, HOLD_MS - 20, 2000)).toEqual([]);
  });

  it('wer hält, läuft nach der Wartezeit gleichmäßig im Takt weiter', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    const times = steps(pace, 0, 2000);
    expect(times[0]).toBeGreaterThanOrEqual(HOLD_MS);
    expect(times[0]).toBeLessThanOrEqual(HOLD_MS + 16);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeLessThan(STEP_MS + 17);
  });

  it('wildes Tippen ist nicht schneller als Halten', () => {
    const held = new InputPace();
    held.press('e', 0);
    const holding = steps(held, 0, 3000).length + 1;
    const tapper = new InputPace();
    const taps = Array.from({ length: 60 }, (_, i) => i * 50); // 20 Tipps pro Sekunde
    const tapping = steps(tapper, 0, 3000, taps).length;
    expect(tapping).toBeLessThanOrEqual(holding + 1); // höchstens der eine Schritt der Wartezeit
  });

  it('merkt sich einen Tipp während eines Schritts, aber nur einen', () => {
    const pace = new InputPace();
    expect(pace.press('e', 0)).toBe('e');
    pace.release('e');
    expect(pace.press('n', 50)).toBeNull();
    pace.release('n');
    expect(pace.press('s', 100)).toBeNull(); // ersetzt den gemerkten
    pace.release('s');
    expect(pace.poll(STEP_MS - 1)).toBeNull();
    expect(pace.poll(STEP_MS)).toBe('s');
    expect(pace.poll(2 * STEP_MS)).toBeNull(); // nichts gehalten, nichts gemerkt
  });

  it('beim Halten zweier Pfeile gilt der zuletzt gedrückte, nach dem Loslassen wieder der andere', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    pace.press('n', 10);
    expect(pace.poll(10 + HOLD_MS)).toBe('n');
    pace.release('n');
    expect(pace.poll(10 + HOLD_MS + STEP_MS)).toBe('e');
  });

  it('nach clear läuft nichts weiter', () => {
    const pace = new InputPace();
    pace.press('e', 0);
    pace.clear();
    expect(pace.poll(STEP_MS * 3)).toBeNull();
  });

  it('Aktionen zählen höchstens im eigenen Takt', () => {
    const pace = new InputPace();
    expect(pace.action(0)).toBe(true);
    expect(pace.action(ACTION_MS - 1)).toBe(false);
    expect(pace.action(ACTION_MS)).toBe(true);
  });
});
