import { describe, expect, it } from 'vitest';
import {
  BED_AGAIN,
  BED_AT,
  DOZE_AFTER,
  READ_AFTER,
  idlePose,
  BREAK,
  TIRED_KEY,
  YAWN_AT,
  advance,
  evening,
  freshDay,
  loadTired,
  saveTired,
  type Tired,
  type TiredEvent,
} from './mitwachsen-tired';

const MIN = 60_000;

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

/** `ms` lang im Takt von 100 ms spielen (oder pausieren); sammelt die Hinweise mit ihrer Spielzeit */
function play(t: Tired, ms: number, active = true) {
  const events: [TiredEvent, number][] = [];
  for (let at = 100; at <= ms; at += 100) {
    const r = advance(t, t.seen + 100, active);
    t = r.tired;
    if (r.event) events.push([r.event, Math.round(t.played / MIN)]);
  }
  return { t, events };
}

describe('Müde werden', () => {
  it('gähnt nach 15 und 20 Minuten, will nach 25 Minuten ins Bett und sagt es alle 3 Minuten wieder', () => {
    const { events } = play(freshDay(0), 32 * MIN);
    expect(YAWN_AT).toEqual([15 * MIN, 20 * MIN]);
    expect([BED_AT, BED_AGAIN]).toEqual([25 * MIN, 3 * MIN]);
    expect(events).toEqual([
      ['yawn', 15],
      ['yawn', 20],
      ['bed', 25],
      ['bed', 28],
      ['bed', 31],
    ]);
  });

  it('zählt nur echte Spielzeit: Pausen (Menü, Schlafen, Tab im Hintergrund) zählen nicht', () => {
    let { t } = play(freshDay(0), 10 * MIN);
    t = play(t, 20 * MIN, false).t; // Menü offen oder Figur schläft
    expect(t.played).toBe(10 * MIN);
    const back = advance(t, t.seen + 40 * MIN, true).tired; // Rechner schlief: Die Lücke zählt nicht
    expect(back.played).toBeLessThanOrEqual(10 * MIN + 5_000);
  });

  it('nach einer langen Pause beginnt ein neuer Tag', () => {
    const { t } = play(freshDay(0), 22 * MIN);
    const next = advance(t, t.seen + BREAK + 1, true);
    expect(next.tired.played).toBe(0);
    expect(next.tired.told).toBe(0);
    expect(next.event).toBeNull();
  });

  it('meldet verpasste Hinweise nur einmal', () => {
    const t: Tired = { played: 26 * MIN - 1000, seen: 0, told: 0 };
    const r = advance(t, 2000, true);
    expect(r.event).toBe('bed');
    expect(r.tired.told).toBe(3);
    expect(advance(r.tired, 2100, true).event).toBeNull();
  });

  it('der Himmel wird ab 20 Minuten abendlich, ab 35 Minuten ganz', () => {
    const at = (m: number) => evening({ played: m * MIN, seen: 0, told: 0 });
    expect(at(0)).toBe(0);
    expect(at(20)).toBe(0);
    expect(at(22.5)).toBeCloseTo(0.3);
    expect(at(25)).toBeCloseTo(0.6);
    expect(at(35)).toBe(1);
    expect(at(90)).toBe(1);
  });

  it('übersteht Speichern und Laden; Kaputtes ergibt einen neuen Tag', () => {
    const store = memoryStore();
    const t: Tired = { played: 12 * MIN, seen: 5000, told: 0 };
    saveTired(store, t);
    expect(loadTired(store, 6000)).toEqual(t);
    for (const bad of ['{kaputt', '42', '{"played":-1,"seen":0,"told":0}', '{"played":1,"seen":9e15,"told":0}']) {
      store.setItem(TIRED_KEY, bad);
      expect(loadTired(store, 6000), bad).toEqual(freshDay(6000));
    }
    expect(loadTired(memoryStore(), 7)).toEqual(freshDay(7));
  });

  it('ohne Eingabe setzt sich die Figur nach 20 Sekunden und liest, nach 2 Minuten nickt sie ein', () => {
    expect([READ_AFTER, DOZE_AFTER]).toEqual([20_000, 120_000]);
    expect(idlePose(0)).toBe('stand');
    expect(idlePose(19_999)).toBe('stand');
    expect(idlePose(20_000)).toBe('read');
    expect(idlePose(119_999)).toBe('read');
    expect(idlePose(120_000)).toBe('doze');
  });
});
