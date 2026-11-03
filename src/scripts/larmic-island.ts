// <larmic-island>: die schwebende Insel mit Figur und Navigationsblöcken.
// Die Figur steht immer auf dem Block dessen, was gerade angezeigt wird (`rest`): einem Bereich (Über mich,
// Workshops, Videos) oder der Kiste eines Eintrags (`workshops/event_storming`). Die Ziele bilden einen Baum:
// Insel → Bereich → Kiste. Die Kisten eines Bereichs poppen auf, sobald er offen ist.
// Hover/Fokus auf einen anderen Block → die Figur läuft zurück bis zur Abzweigung (die Brücke dahinter zerbröselt)
// und baut die neue Brücke. Maus weg → zurück auf den Ruheblock.
// Blog → die Figur fällt ins Leere und spawnt auf ihrem Ruheblock mit „404 – Kein Blog gefunden“.
// Die Blöcke sind Links. Beim Seitenwechsel bleibt die Insel erhalten (transition:persist), die Seite ruft `select()`.
// Easter Egg: Hover über das Blätterdach → die Figur stapelt zwei Blöcke und klettert in die Krone.
// Steht die Figur, schaut sie zum Cursor: Der Körper dreht sich zur Seite, der Kopf dreht und nickt in 15°/10°-Stufen.
// Fährt die Maus über den Namen, hüpft sie zweimal mit den goldenen Buchstaben mit.
// Die Logik (Wege, Brücken, Sturz, Sprechblase) steckt rein und getestet in island-state.ts; hier nur DOM, Takt und Kopfblick.

import { BUBBLES } from '../data/site';
import { headView } from '../lib/voxel/head';
import {
  aim,
  initialState,
  isSettled,
  leave,
  select,
  settle,
  step,
  view,
  type FigureState,
  type World,
} from './island-state';

const TICK_MS = 130; // Takt der Figur

class LarmicIsland extends HTMLElement {
  private world!: World;
  private state!: FigureState;
  private ready = false;
  private timer: number | undefined;
  private figpos!: HTMLElement;
  private flip!: HTMLElement;
  private jump!: HTMLElement;
  private hop!: HTMLElement;
  private bubble!: HTMLElement;
  private bridges: HTMLElement[] = [];
  private blocks: HTMLElement[] = [];
  private faces: SVGGElement[] = []; // Kopfseiten in der Reihenfolge von HEAD_FACES
  private look: { x: number; y: number } | null = null; // letzte Cursor-Position
  private headKey = '0,0';
  private raf = 0;
  private globals: AbortController | null = null; // Listener auf document/window, leben nur, solange die Insel im DOM ist
  // Reduzierte Bewegung: keine Vorschau-Wege beim Zeigen, die Figur steht nach einem Seitenwechsel sofort am Ziel
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.listenGlobally();
    // Beim Seitenwechsel wird die Insel in die neue Seite umgehängt: Zustand behalten, nur weiterlaufen
    if (this.ready) {
      this.start();
      return;
    }
    this.ready = true;
    const data: World & { rest: string } = JSON.parse(this.dataset.world || '{}');
    this.world = data;
    this.figpos = this.querySelector('.figpos')!;
    this.flip = this.querySelector('.figflip')!;
    this.jump = this.querySelector('.figw')!;
    this.hop = this.querySelector('.fighop')!;
    this.bubble = this.querySelector('.bubble')!;
    this.bridges = [...this.querySelectorAll<HTMLElement>('.brk')];
    this.blocks = [...this.querySelectorAll<HTMLElement>('.blk')];
    for (const b of this.blocks) {
      const id = b.dataset.id!;
      b.addEventListener('mouseenter', () => this.preview(id));
      b.addEventListener('mouseleave', () => this.update(leave(this.state, id)));
      // Nur Tastatur-Fokus: Fokus durch Mausklick oder beim Zurückkehren in den Tab soll die Figur nicht losschicken.
      // Den Blog nur per Klick oder Enter – beim Durchtabben soll niemand stürzen.
      b.addEventListener('focus', () => {
        if (id !== 'blog' && b.matches(':focus-visible')) this.preview(id);
      });
      b.addEventListener('blur', () => this.update(leave(this.state, id)));
      // Links navigieren selbst, nur der Blog-Button löst den Sturz aus
      if (b instanceof HTMLButtonElement) b.addEventListener('click', () => this.update(aim(this.state, id)));
    }
    for (const e of this.querySelectorAll<HTMLElement>('.egg')) {
      e.addEventListener('mouseenter', () => this.preview(e.dataset.egg!));
      e.addEventListener('mouseleave', () => this.update(leave(this.state, e.dataset.egg!)));
    }
    this.faces = [...this.querySelectorAll<SVGGElement>('.fig-head .fh')];
    this.state = initialState(this.world, data.rest);
    this.render();
  }

  disconnectedCallback() {
    this.stop();
    // Ohne das bliebe jede verlassene Insel über ihre document-/window-Listener im Speicher
    this.globals?.abort();
    this.globals = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Neuer Inhalt wird angezeigt (nach dem Seitenwechsel): Die Figur läuft zu seinem Block. */
  select(id: string) {
    const next = select(this.state, this.world, id);
    if (next === this.state) return;
    this.state = next;
    this.render();
    this.start();
  }

  /** Eingabe übernehmen und den Takt starten. */
  private update(next: FigureState) {
    this.state = next;
    this.start();
  }

  /** Blick zum Cursor: nur mit Maus und ohne Wunsch nach reduzierter Bewegung. */
  private listenGlobally() {
    if (this.globals) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || this.reducedMotion.matches) return;
    this.globals = new AbortController();
    const opts = { passive: true, signal: this.globals.signal };
    const follow = () => {
      if (!this.raf)
        this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          this.aimHead();
        });
    };
    document.addEventListener(
      'pointermove',
      (e) => {
        this.look = { x: e.clientX, y: e.clientY };
        follow();
      },
      opts,
    );
    window.addEventListener('scroll', follow, opts);
    // Über document: Der Name liegt außerhalb der Insel und bleibt wie sie beim Seitenwechsel stehen
    document.addEventListener(
      'pointerover',
      (e) => {
        const into = (e.target as Element).closest?.('.name');
        if (into && !into.contains(e.relatedTarget as Node | null)) this.cheer();
      },
      opts,
    );
  }

  /** Freudenhüpfer: nur wenn die Figur steht, sonst würde er den Schritt- oder Sturz-Sprung überdecken. */
  private cheer() {
    if (this.timer !== undefined || this.state.falling) return;
    this.jump.classList.remove('cheer');
    void this.jump.offsetWidth; // Animation neu starten, auch wenn sie gerade noch läuft
    this.jump.classList.add('cheer');
  }

  /** Zeigen auf einen Block schickt die Figur los – außer bei reduzierter Bewegung. */
  private preview(id: string) {
    if (!this.reducedMotion.matches) this.update(aim(this.state, id));
  }

  private start() {
    // Schmale Ansicht (Blöcke als Reihen, Figur steht fest) oder reduzierte Bewegung: gleich ans Ziel, ohne Takt
    if (this.compact() || this.reducedMotion.matches) {
      this.stop();
      this.state = settle(this.state, this.world);
      this.render();
      return;
    }
    if (this.timer === undefined) this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  /** Schmale Ansicht? Dort blendet das CSS (Container-Query) die Brücken aus – die Grenze steht nur im CSS. */
  private compact(): boolean {
    const bridges = this.querySelector<HTMLElement>('.bridges');
    return !!bridges && getComputedStyle(bridges).display === 'none';
  }

  private stop() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private tick() {
    this.state = step(this.state, this.world);
    this.render();
    if (isSettled(this.state, this.world)) {
      this.stop();
      this.aimHead();
    }
  }

  /** Kopf zum Cursor drehen, solange die Figur steht. Beim Laufen schaut sie geradeaus in Laufrichtung. */
  private aimHead() {
    if (!this.look || this.timer !== undefined || this.state.falling) return this.setHead(0, 0);
    const box = this.figpos.getBoundingClientRect();
    const dx = this.look.x - (box.left + box.width / 2);
    const dy = this.look.y - (box.top + box.height * 0.2);
    // Deutlich auf der anderen Seite: ganze Figur dreht sich um
    if (Math.abs(dx) > 48) {
      const facing = dx > 0 ? 'R' : 'L';
      if (facing !== this.state.facing) {
        this.state = { ...this.state, facing };
        this.flip.className = 'figflip' + (facing === 'R' ? ' flip' : '');
      }
    }
    // In Blickrichtung der Figur gerechnet: −1 weit zur Seite, 0 genau darunter oder darüber (schaut dich an)
    const h = Math.max(-1, Math.min(1, (this.state.facing === 'R' ? -dx : dx) / 260));
    const yaw = h < 0 ? -45 - 75 * h : -45 - 45 * h;
    const v = Math.max(-1, Math.min(1, dy / 320));
    this.setHead(Math.round(yaw / 15) * 15, Math.round((v * (v < 0 ? 20 : 25)) / 10) * 10);
  }

  private setHead(yaw: number, pitch: number) {
    const key = `${yaw},${pitch}`;
    if (key === this.headKey || this.faces.length === 0) return;
    this.headKey = key;
    headView(yaw, pitch).forEach((face, i) => {
      const g = this.faces[i];
      if (face.matrix) {
        g.setAttribute('transform', `matrix(${face.matrix.map((n) => n.toFixed(3)).join(',')})`);
        g.style.display = '';
      } else g.style.display = 'none';
      g.querySelector('.fhs')?.setAttribute('opacity', face.shade.toFixed(3));
    });
  }

  private render() {
    const s = this.state;
    const v = view(s, this.world, BUBBLES);
    const ab = s.picks % 2 ? 'A' : 'B';

    // Klasse zuerst setzen: beim Respawn ("tp") ohne Übergang springen
    this.figpos.className =
      'figpos' + (s.respawnedAt === s.tick ? ' tp' : '') + (s.respawns ? (s.respawns % 2 ? ' spawnA' : ' spawnB') : '');
    this.figpos.style.left = `${v.at.x}%`;
    this.figpos.style.top = `${v.at.y}%`;
    this.flip.className = 'figflip' + (s.facing === 'R' ? ' flip' : '');
    this.jump.className = 'figw' + (s.falling > 0 ? ' falling' : s.picks ? ` jump${ab}` : '');
    this.hop.className =
      'fighop' +
      (s.steps ? (s.steps % 2 ? ' stepA' : ' stepB') : '') +
      (s.placed ? (s.placed % 2 ? ' placeA' : ' placeB') : '');
    if (this.timer !== undefined) this.setHead(0, 0);

    this.bridges.forEach((el, k) => {
      el.className = 'brk' + (v.standingBridges.has(k) ? '' : v.crumblingBridges.has(k) ? ' gone' : ' off');
    });

    for (const b of this.blocks) {
      const id = b.dataset.id!;
      const parent = b.dataset.parent;
      const on = s.rest === id || s.rest.startsWith(`${id}/`);
      b.className =
        'blk' +
        (parent ? ' child' : '') +
        (on ? ' on' : '') +
        (s.rest === id && s.picks ? ` pop${ab}` : '') +
        (v.held.has(id) ? ' held' : '') +
        (parent && !v.openSections.has(parent) ? ' closed' : '');
      if (b instanceof HTMLAnchorElement) {
        if (id === s.rest) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      }
    }

    this.bubble.textContent = v.bubble.text;
    this.bubble.className = 'bubble pxf' + (v.bubble.error ? ' err' : '') + (v.bubble.visible ? '' : ' off');
  }
}

if (!customElements.get('larmic-island')) customElements.define('larmic-island', LarmicIsland);

declare global {
  interface HTMLElementTagNameMap {
    'larmic-island': LarmicIsland;
  }
}
export {};
