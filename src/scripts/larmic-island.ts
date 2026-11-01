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

import { BUBBLES as SITE_BUBBLES } from '../data/site';
import { headView } from '../lib/voxel/head';

type RouteNode = { x: number; y: number; f: 'L' | 'R'; b: boolean; k?: number; fall?: boolean };
type World = { home: { x: number; y: number }; routes: Record<string, RouteNode[]>; rest: string };

const TICK_MS = 130; // Takt der Figur
const FALL_TICKS = 7; // Dauer des Sturzes in Takten
const CRUMBLE_TICKS = 3; // so lange bleibt ein bröckelnder Block sichtbar

const BUBBLE_IDLE = 'Hi! Zeig auf einen Block.';
const BUBBLE_404 = '404 – Kein Blog gefunden';
const BUBBLES: Record<string, string> = SITE_BUBBLES;

const section = (id: string) => id.split('/')[0];

type State = {
  sel: string; n: number; goal: string | null; r: string | null; p: number; built: number;
  face: 'L' | 'R'; m: number; pl: number; t: number; crumbs: { k: number; until: number }[];
  fall: number; spawn: number; spawnT: number; msg: string | null; done404: boolean;
};

class LarmicIsland extends HTMLElement {
  private w!: World;
  private st!: State;
  private ready = false;
  private timer: number | undefined;
  private figpos!: HTMLElement;
  private flip!: HTMLElement;
  private jump!: HTMLElement;
  private hop!: HTMLElement;
  private bubble!: HTMLElement;
  private bridges: HTMLElement[] = [];
  private blocks: HTMLElement[] = [];
  private rest = 'about'; // Ruheblock der Figur: der Block dessen, was gerade angezeigt wird
  private faces: SVGGElement[] = []; // Kopfseiten in der Reihenfolge von HEAD_FACES
  private look: { x: number; y: number } | null = null; // letzte Cursor-Position
  private headKey = '0,0';
  private raf = 0;
  private globals: AbortController | null = null; // Listener auf document/window, leben nur, solange die Insel im DOM ist

  connectedCallback() {
    this.listenGlobally();
    // Beim Seitenwechsel wird die Insel in die neue Seite umgehängt: Zustand behalten, nur weiterlaufen
    if (this.ready) {
      this.start();
      return;
    }
    this.ready = true;
    this.w = JSON.parse(this.dataset.world || '{}');
    this.rest = this.w.rest;
    this.figpos = this.querySelector('.figpos')!;
    this.flip = this.querySelector('.figflip')!;
    this.jump = this.querySelector('.figw')!;
    this.hop = this.querySelector('.fighop')!;
    this.bubble = this.querySelector('.bubble')!;
    this.bridges = [...this.querySelectorAll<HTMLElement>('.brk')];
    this.blocks = [...this.querySelectorAll<HTMLElement>('.blk')];
    for (const b of this.blocks) {
      const id = b.dataset.id!;
      b.addEventListener('mouseenter', () => this.aim(id));
      b.addEventListener('mouseleave', () => this.leave(id));
      b.addEventListener('focus', () => this.aim(id));
      b.addEventListener('blur', () => this.leave(id));
      // Links navigieren selbst, nur der Blog-Button löst den Sturz aus
      if (b instanceof HTMLButtonElement) b.addEventListener('click', () => this.aim(id));
    }
    for (const e of this.querySelectorAll<HTMLElement>('.egg')) {
      e.addEventListener('mouseenter', () => this.aim(e.dataset.egg!));
      e.addEventListener('mouseleave', () => this.leave(e.dataset.egg!));
    }
    this.faces = [...this.querySelectorAll<SVGGElement>('.fig-head .fh')];
    this.st = { sel: this.rest, n: 0, goal: null, ...this.restPose(), m: 0, pl: 0, t: 0, crumbs: [], fall: 0, spawn: 0, spawnT: -1, msg: null, done404: false };
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

  /** Blick zum Cursor: nur mit Maus und ohne Wunsch nach reduzierter Bewegung. */
  private listenGlobally() {
    if (this.globals) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.globals = new AbortController();
    const opts = { passive: true, signal: this.globals.signal };
    const follow = () => {
      if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.aimHead(); });
    };
    document.addEventListener('pointermove', (e) => { this.look = { x: e.clientX, y: e.clientY }; follow(); }, opts);
    window.addEventListener('scroll', follow, opts);
  }

  /** Neuer Inhalt wird angezeigt: Sein Block wird gewählt und zum Ruheblock, die Figur läuft hin. */
  select(id: string) {
    if (!this.w.routes[id] || id === this.rest) return;
    const st = this.st;
    st.sel = id;
    st.msg = null;
    st.n += 1;
    this.rest = id;
    this.render();
    this.start();
  }

  private aim(id: string) {
    this.st.goal = id;
    this.st.done404 = false;
    if (id !== 'blog') this.st.msg = null;
    this.start();
  }

  private leave(id: string) {
    if (this.st.goal === id) {
      this.st.goal = null;
      this.start();
    }
  }

  /** Figur steht auf dem Ruheblock, die Brücken dorthin stehen. */
  private restPose(): Pick<State, 'r' | 'p' | 'built' | 'face'> {
    const route = this.w.routes[this.rest];
    return { r: this.rest, p: route.length, built: route.length, face: route[route.length - 1].f };
  }

  /** Wohin die Figur gerade will: zum gezeigten Block, sonst zum Ruheblock. Nach dem Sturz ist der Blog gesperrt. */
  private target(): string {
    const want = this.st.goal ?? this.rest;
    return want === 'blog' && this.st.done404 ? this.rest : want;
  }

  /** Länge des gemeinsamen Anfangs zweier Wege: bis dorthin muss die Figur nicht zurück. */
  private common(a: string | null, b: string | null): number {
    if (!a || !b) return 0;
    const ra = this.w.routes[a];
    const rb = this.w.routes[b];
    let n = 0;
    while (n < ra.length && n < rb.length && !ra[n].fall && !rb[n].fall && ra[n].x === rb[n].x && ra[n].y === rb[n].y) n += 1;
    return n;
  }

  private start() {
    if (this.timer === undefined) this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stop() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private tick() {
    const st = this.st;
    const goal = this.target();
    st.t += 1;
    st.crumbs = st.crumbs.filter((c) => c.until > st.t);
    let route = st.r ? this.w.routes[st.r] : [];
    const inAir = st.r !== null && st.p > 0 && route[st.p - 1].fall;

    if (inAir) {
      // Sturz läuft immer bis zum Respawn auf dem Ruheblock durch
      if (st.fall < FALL_TICKS) st.fall += 1;
      else {
        Object.assign(st, this.restPose(), { fall: 0, spawnT: st.t, done404: true });
        st.spawn += 1;
        st.msg = st.goal && st.goal !== 'blog' ? null : '404';
      }
    } else if (st.r && goal === st.r) {
      // Vorwärts: Block setzen (oder es versuchen), dann draufsteigen
      if (st.p < route.length) {
        const next = route[st.p];
        if ((next.b || next.fall) && st.built <= st.p) {
          st.built = st.p + 1;
          st.pl += 1;
        } else {
          st.p += 1;
          st.face = next.f;
          st.m += 1;
        }
      }
    } else if (st.r) {
      // Zurück bis zur Abzweigung: hinter der Figur bröckeln die Brückenblöcke weg
      const keep = this.common(st.r, goal);
      while (st.built > st.p && !route[st.built - 1].b) st.built -= 1;
      if (st.built > st.p) {
        st.crumbs.push({ k: route[st.built - 1].k!, until: st.t + CRUMBLE_TICKS });
        st.built -= 1;
      } else if (st.p > keep) {
        st.face = route[st.p - 1].f === 'L' ? 'R' : 'L';
        st.p -= 1;
        st.m += 1;
      } else {
        // An der Abzweigung: Ab hier geht der neue Weg weiter, gemeinsame Brücken bleiben stehen
        st.r = goal;
        if (st.p === 0) {
          st.built = 0;
          st.face = 'L';
        }
      }
    } else {
      st.r = goal;
      st.p = 0;
      st.built = 0;
    }

    this.render();
    route = st.r ? this.w.routes[st.r] : [];
    const arrived = st.r !== null && this.target() === st.r && st.p >= route.length && !route[route.length - 1].fall;
    if (arrived && st.crumbs.length === 0) {
      this.stop();
      this.aimHead();
    }
  }

  /** Kopf zum Cursor drehen, solange die Figur steht. Beim Laufen schaut sie geradeaus in Laufrichtung. */
  private aimHead() {
    if (!this.look || this.timer !== undefined || this.st.fall) return this.setHead(0, 0);
    const box = this.figpos.getBoundingClientRect();
    const dx = this.look.x - (box.left + box.width / 2);
    const dy = this.look.y - (box.top + box.height * 0.2);
    // Deutlich auf der anderen Seite: ganze Figur dreht sich um
    if (Math.abs(dx) > 48) {
      const face = dx > 0 ? 'R' : 'L';
      if (face !== this.st.face) {
        this.st.face = face;
        this.flip.className = 'figflip' + (face === 'R' ? ' flip' : '');
      }
    }
    // In Blickrichtung der Figur gerechnet: −1 weit zur Seite, 0 genau darunter oder darüber (schaut dich an)
    const h = Math.max(-1, Math.min(1, (this.st.face === 'R' ? -dx : dx) / 260));
    const yaw = h < 0 ? -45 - 75 * h : -45 - 45 * h;
    const v = Math.max(-1, Math.min(1, dy / 320));
    this.setHead(Math.round(yaw / 15) * 15, Math.round((v * (v < 0 ? 20 : 25)) / 10) * 10);
  }

  private setHead(yaw: number, pitch: number) {
    const key = `${yaw},${pitch}`;
    if (key === this.headKey || this.faces.length === 0) return;
    this.headKey = key;
    headView(yaw, pitch).forEach((view, i) => {
      const g = this.faces[i];
      if (view.matrix) {
        g.setAttribute('transform', `matrix(${view.matrix.map((n) => n.toFixed(3)).join(',')})`);
        g.style.display = '';
      } else g.style.display = 'none';
      g.querySelector('.fhs')?.setAttribute('opacity', view.shade.toFixed(3));
    });
  }

  private render() {
    const st = this.st;
    const ab = st.n % 2 ? 'A' : 'B';
    const route = st.r ? this.w.routes[st.r] : [];
    const at = st.p > 0 ? route[st.p - 1] : this.w.home;

    // Klasse zuerst setzen: beim Respawn ("tp") ohne Übergang springen
    this.figpos.className = 'figpos' + (st.spawnT === st.t ? ' tp' : '') + (st.spawn ? (st.spawn % 2 ? ' spawnA' : ' spawnB') : '');
    this.figpos.style.left = `${at.x}%`;
    this.figpos.style.top = `${at.y}%`;
    this.flip.className = 'figflip' + (st.face === 'R' ? ' flip' : '');
    this.jump.className = 'figw' + (st.fall > 0 ? ' falling' : st.n ? ` jump${ab}` : '');
    this.hop.className = 'fighop' + (st.m ? (st.m % 2 ? ' stepA' : ' stepB') : '') + (st.pl ? (st.pl % 2 ? ' placeA' : ' placeB') : '');
    if (this.timer !== undefined) this.setHead(0, 0);

    const standing = new Set(route.slice(0, st.built).flatMap((n) => (n.k === undefined ? [] : [n.k])));
    const crumbs = new Set(st.crumbs.map((c) => c.k));
    this.bridges.forEach((el, k) => {
      el.className = 'brk' + (standing.has(k) ? '' : crumbs.has(k) ? ' gone' : ' off');
    });

    // Kisten eines Bereichs sind sichtbar, solange er offen ist oder die Figur noch auf seinen Brücken unterwegs ist
    const open = new Set([section(this.rest)]);
    if (st.r && st.r.includes('/') && st.p > this.w.routes[section(st.r)].length) open.add(section(st.r));
    for (const b of this.blocks) {
      const id = b.dataset.id!;
      const parent = b.dataset.parent;
      const rt = this.w.routes[id];
      const held = !rt[rt.length - 1].fall && st.p >= rt.length && this.common(id, st.r) === rt.length;
      const on = st.sel === id || st.sel.startsWith(`${id}/`);
      b.className = 'blk' + (parent ? ' child' : '') + (on ? ' on' : '') + (st.sel === id && st.n ? ` pop${ab}` : '')
        + (held ? ' held' : '') + (parent && !open.has(parent) ? ' closed' : '');
      if (b instanceof HTMLAnchorElement) {
        if (id === this.rest) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      }
    }

    // Sprechblase nur, wenn die Figur auf ihrem Ruheblock steht und nirgendwo anders hin will.
    // Auf Bereichen spricht sie zum Bereich (beim ersten Aufruf der Startseite begrüßt sie), auf Kisten schweigt sie.
    // Oben im Baum: eigener Spruch.
    const pose = this.restPose();
    const atRest = st.r === pose.r && st.p === pose.p && st.fall === 0 && this.target() === this.rest;
    const inTree = st.r === 'tree' && st.p === this.w.routes.tree?.length && this.target() === 'tree';
    const err = st.msg === '404';
    const text = inTree ? BUBBLES.tree
      : err ? BUBBLE_404 : this.rest.includes('/') ? '' : st.n === 0 && this.rest === 'about' ? BUBBLE_IDLE : BUBBLES[this.rest] ?? BUBBLE_IDLE;
    this.bubble.textContent = text;
    this.bubble.className = 'bubble pxf' + (err && !inTree ? ' err' : '') + ((atRest || inTree) && text ? '' : ' off');
  }
}

if (!customElements.get('larmic-island')) customElements.define('larmic-island', LarmicIsland);

declare global {
  interface HTMLElementTagNameMap {
    'larmic-island': LarmicIsland;
  }
}
export {};
