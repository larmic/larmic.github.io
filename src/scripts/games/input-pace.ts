// Ruhiger Takt für die Eingabe – rein, ohne DOM und ohne Timer, damit testbar.
// Tippen und Halten sind gleich schnell: höchstens ein Schritt je STEP_MS. Halten läuft ab dem ersten Schritt
// gleichmäßig weiter (ohne die Verzögerung der Tastenwiederholung des Systems). Ein Tipp während eines Schritts
// wird gemerkt und kommt im Takt dran, aber nie mehr als einer. So lohnt hektisches Drücken nicht.
// Spezifikation: docs/specs/mitwachsen.md (Eingabe)

import type { Dir } from '../../lib/games/front';

export const STEP_MS = 260; // gut 4 Schritte pro Sekunde
export const ACTION_MS = 350; // Leertaste: höchstens knapp 3 Aktionen pro Sekunde

export class InputPace {
  private down: Dir[] = []; // gehaltene Pfeile, zuletzt gedrückter hinten
  private pending: Dir | null = null;
  private lastStep = -Infinity;
  private lastAction = -Infinity;

  /** Pfeil gedrückt (keine Wiederholungen des Systems): liefert den Schritt, falls er sofort dran ist */
  press(dir: Dir, now: number): Dir | null {
    this.down = [...this.down.filter((d) => d !== dir), dir];
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
    const dir = this.pending ?? this.down.at(-1) ?? null;
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

  /** Alles vergessen, z. B. wenn das Menü aufgeht oder die Seite den Fokus verliert */
  clear() {
    this.down = [];
    this.pending = null;
  }
}
