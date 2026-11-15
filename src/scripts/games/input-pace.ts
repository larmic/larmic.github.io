// Ruhiger Takt für die Eingabe – rein, ohne DOM und ohne Timer, damit testbar.
// Höchstens ein Schritt je STEP_MS, ob getippt oder gehalten. Ein Druck ist genau ein Schritt, auch wenn kleine
// Finger etwas länger auf dem Pfeil liegen: Erst wer HOLD_MS lang hält, läuft weiter, dann gleichmäßig im Takt.
// Ein Tipp während eines Schritts wird gemerkt und kommt im Takt dran, aber nie mehr als einer. So lohnt hektisches
// Drücken nicht (schneller als Halten ist es höchstens um den einen Schritt der Wartezeit).
// Spezifikation: docs/specs/mitwachsen.md (Eingabe)

import type { Dir } from '../../lib/games/front';

export const STEP_MS = 260; // gut 4 Schritte pro Sekunde
export const HOLD_MS = 450; // so lange halten, bis die Figur weiterläuft (erster Spieltest am Tablet)
export const ACTION_MS = 350; // Leertaste: höchstens knapp 3 Aktionen pro Sekunde

export class InputPace {
  private down: Dir[] = []; // gehaltene Pfeile, zuletzt gedrückter hinten
  private pending: Dir | null = null;
  private lastStep = -Infinity;
  private since = -Infinity; // wann der zuletzt gedrückte Pfeil gedrückt wurde
  private lastAction = -Infinity;

  /** Pfeil gedrückt (keine Wiederholungen des Systems): liefert den Schritt, falls er sofort dran ist */
  press(dir: Dir, now: number): Dir | null {
    this.down = [...this.down.filter((d) => d !== dir), dir];
    this.since = now;
    if (now - this.lastStep >= STEP_MS) {
      this.lastStep = now;
      this.pending = null;
      return dir;
    }
    this.pending = dir;
    return null;
  }

  release(dir: Dir) {
    this.down = this.down.filter((d) => d !== dir);
  }

  /** In jedem Bild aufrufen: liefert den nächsten Schritt im Takt (gemerkter Tipp, sonst gehaltener Pfeil) */
  poll(now: number): Dir | null {
    if (now - this.lastStep < STEP_MS) return null;
    const held = now - this.since >= HOLD_MS ? this.down.at(-1) : undefined; // gehalten erst nach der Wartezeit
    const dir = this.pending ?? held ?? null;
    if (dir) {
      this.pending = null;
      this.lastStep = now;
    }
    return dir;
  }

  /** Aktion (Leertaste o. a.): true, wenn sie zählt */
  action(now: number): boolean {
    if (now - this.lastAction < ACTION_MS) return false;
    this.lastAction = now;
    return true;
  }

  /**
   * Alles vergessen, z. B. wenn das Menü aufgeht oder die Seite den Fokus verliert – und bei einer Begegnung (Tier
   * gefunden, Beeren gepflückt): Die Figur bleibt stehen, bis der Pfeil neu gedrückt wird.
   */
  clear() {
    this.down = [];
    this.pending = null;
  }
}
