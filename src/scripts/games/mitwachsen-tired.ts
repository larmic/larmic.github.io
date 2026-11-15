// Müde werden: Die Figur zeigt dem Kind sanft, dass es langsam genug ist – rein, ohne DOM und ohne Uhr, damit testbar.
// Gezählt wird nur echte Spielzeit (die Komponente sagt, ob gerade gespielt wird). Nach 15 und 20 Minuten gähnt die
// Figur, nach 25 Minuten möchte sie ins Bett und sagt das danach alle 3 Minuten wieder. Gesperrt wird nichts.
// Schlafen im Bett beendet den Tag; nach einer langen Pause beginnt die Zeit ebenfalls neu.
// Die Uhr gehört zum Kind, nicht zur Welt: ein Wert je Browser, nicht je Spielstand.
// Spezifikation: docs/specs/mitwachsen.md

import type { Store } from './mitwachsen-save';

const MIN = 60_000;
export const YAWN_AT = [15 * MIN, 20 * MIN]; // die Figur setzt sich kurz hin und gähnt
export const BED_AT = 25 * MIN; // die Figur möchte ins Bett
export const BED_AGAIN = 3 * MIN; // danach sagt sie es in diesem Abstand wieder
export const BREAK = 60 * MIN; // so lange Pause, und der Tag beginnt neu
const MAX_STEP = 5_000; // längere Lücken (Tab im Hintergrund, Rechner schläft) zählen nicht als Spielzeit
export const TIRED_KEY = 'larmic.games.mitwachsen.tired';

export type Tired = {
  played: number; // gespielte Zeit heute in ms
  seen: number; // Zeitpunkt (ms seit 1970) der letzten Messung
  told: number; // wie viele Hinweise schon kamen
};
export type TiredEvent = 'yawn' | 'bed';

export const freshDay = (now: number): Tired => ({ played: 0, seen: now, told: 0 });

/** Ab wann der n-te Hinweis kommt (0, 1: gähnen; ab 2: ins Bett, danach alle 3 Minuten) */
const hintAt = (n: number) => (n < YAWN_AT.length ? YAWN_AT[n] : BED_AT + (n - YAWN_AT.length) * BED_AGAIN);

/**
 * Zeit fortschreiben. `active`: Gerade wird gespielt (Seite sichtbar, Menü zu, Figur wach).
 * Liefert höchstens einen Hinweis je Aufruf; fällig gewordene, verpasste Hinweise werden zusammengefasst.
 */
export function advance(t: Tired, now: number, active: boolean): { tired: Tired; event: TiredEvent | null } {
  if (now - t.seen > BREAK) t = freshDay(now);
  const played = t.played + (active ? Math.max(0, Math.min(MAX_STEP, now - t.seen)) : 0);
  let told = t.told;
  while (played >= hintAt(told)) told++;
  const tired = { played, seen: now, told };
  if (told === t.told) return { tired, event: null };
  return { tired, event: told > YAWN_AT.length ? 'bed' : 'yawn' };
}

/** Wie abendlich der Himmel ist: 0 bis 20 Minuten Tag, bis 25 Minuten gut zur Hälfte golden, bis 35 Minuten ganz */
export function evening(t: Tired): number {
  const m = t.played / MIN;
  if (m <= 20) return 0;
  if (m <= 25) return ((m - 20) / 5) * 0.6;
  return Math.min(1, 0.6 + ((m - 25) / 10) * 0.4);
}

/** Aus dem Speicher; Kaputtes oder Fehlendes ergibt einen neuen Tag */
export function loadTired(store: Store, now: number): Tired {
  try {
    const raw: unknown = JSON.parse(store.getItem(TIRED_KEY) ?? 'null');
    if (typeof raw === 'object' && raw !== null) {
      const { played, seen, told } = raw as Record<string, unknown>;
      const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
      if (ok(played) && ok(seen) && ok(told) && seen <= now) return { played, seen, told: Math.floor(told) };
    }
  } catch {
    /* kaputt: neuer Tag */
  }
  return freshDay(now);
}

export function saveTired(store: Store, t: Tired) {
  try {
    store.setItem(TIRED_KEY, JSON.stringify(t));
  } catch {
    /* ohne Speicher zählt die Zeit nur bis zum Neuladen */
  }
}
