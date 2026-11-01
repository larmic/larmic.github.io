// <larmic-island>: die schwebende Insel mit Figur und Navigationsblöcken.
// Hover/Fokus auf einen Block → die Figur baut eine Brücke dorthin. Maus weg → zurück, Brücke zerbröselt.
// Blog → die Figur fällt ins Leere und spawnt mit „404 – Kein Blog gefunden“.
// Klick auf einen Block → Event `larmic:select` (die Seite wechselt den Inhaltsbereich).

type RouteNode = { x: number; y: number; f: 'L' | 'R'; b: boolean; fall?: boolean };
type World = { home: { x: number; y: number }; routes: Record<string, RouteNode[]> };

const TICK_MS = 130; // Takt der Figur
const FALL_TICKS = 7; // Dauer des Sturzes in Takten
const CRUMBLE_TICKS = 3; // so lange bleibt ein bröckelnder Block sichtbar

const BUBBLE_IDLE = 'Hi! Zeig auf einen Block.';
const BUBBLE_404 = '404 – Kein Blog gefunden';
const BUBBLES: Record<string, string> = {
  about: 'Das bin ich. Fullstack, Architektur und KI mit Leitplanken.',
  workshops: 'Lass uns gemeinsam modellieren!',
  videos: 'Popcorn bereit? Hier sind meine Talks.',
};

type State = {
  sel: string | null; n: number; goal: string | null; r: string | null; p: number; built: number;
  face: 'L' | 'R'; m: number; pl: number; t: number; crumbs: { k: string; until: number }[];
  fall: number; spawn: number; spawnT: number; msg: string | null; done404: boolean;
};

class LarmicIsland extends HTMLElement {
  private w!: World;
  private st: State = { sel: null, n: 0, goal: null, r: null, p: 0, built: 0, face: 'L', m: 0, pl: 0, t: 0, crumbs: [], fall: 0, spawn: 0, spawnT: -1, msg: null, done404: false };
  private timer: number | undefined;
  private figpos!: HTMLElement;
  private flip!: HTMLElement;
  private jump!: HTMLElement;
  private hop!: HTMLElement;
  private bubble!: HTMLElement;
  private bridges: HTMLElement[] = [];
  private blocks: HTMLButtonElement[] = [];

  connectedCallback() {
    this.w = JSON.parse(this.dataset.world || '{}');
    this.figpos = this.querySelector('.figpos')!;
    this.flip = this.querySelector('.figflip')!;
    this.jump = this.querySelector('.figw')!;
    this.hop = this.querySelector('.fighop')!;
    this.bubble = this.querySelector('.bubble')!;
    this.bridges = [...this.querySelectorAll<HTMLElement>('.brk')];
    this.blocks = [...this.querySelectorAll<HTMLButtonElement>('.blk')];
    for (const b of this.blocks) {
      const id = b.dataset.id!;
      b.addEventListener('mouseenter', () => this.aim(id));
      b.addEventListener('mouseleave', () => this.leave(id));
      b.addEventListener('focus', () => this.aim(id));
      b.addEventListener('blur', () => this.leave(id));
      b.addEventListener('click', () => this.pick(id));
    }
    this.render();
  }

  disconnectedCallback() {
    this.stop();
  }

  /** Von außen aufrufbar, z. B. wenn ein Button oder Anker einen Bereich öffnet. */
  select(id: string) {
    if (id === 'blog') return;
    this.st.sel = id;
    this.st.n += 1;
    this.st.msg = null;
    this.render();
  }

  private pick(id: string) {
    if (id === 'blog') {
      if (this.st.goal !== 'blog') this.aim('blog');
      return;
    }
    this.select(id);
    this.dispatchEvent(new CustomEvent('larmic:select', { detail: { id }, bubbles: true }));
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
    const goal = st.goal;
    st.t += 1;
    st.crumbs = st.crumbs.filter((c) => c.until > st.t);
    let route = st.r ? this.w.routes[st.r] : [];
    const blocked = (g: string | null) => g === 'blog' && st.done404;
    const inAir = st.r !== null && st.p > 0 && route[st.p - 1].fall;

    if (inAir) {
      // Sturz läuft immer bis zum Respawn durch
      if (st.fall < FALL_TICKS) st.fall += 1;
      else {
        Object.assign(st, { r: null, p: 0, built: 0, fall: 0, face: 'L', spawnT: st.t, done404: true });
        st.spawn += 1;
        st.msg = goal && goal !== 'blog' ? null : '404';
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
      // Rückweg: hinter der Figur bröckeln die Brückenblöcke weg
      while (st.built > st.p && !route[st.built - 1].b) st.built -= 1;
      if (st.built > st.p) {
        st.crumbs.push({ k: `${st.r}:${st.built - 1}`, until: st.t + CRUMBLE_TICKS });
        st.built -= 1;
      } else if (st.p > 0) {
        st.face = route[st.p - 1].f === 'L' ? 'R' : 'L';
        st.p -= 1;
        st.m += 1;
      } else {
        st.r = goal && !blocked(goal) ? goal : null;
        st.built = 0;
        st.face = 'L';
      }
    } else if (goal && !blocked(goal)) {
      st.r = goal;
      st.p = 0;
      st.built = 0;
    }

    this.render();
    route = st.r ? this.w.routes[st.r] : [];
    const idle = !st.r && (!goal || blocked(goal));
    const arrived = st.r !== null && goal === st.r && st.p >= route.length && !route[route.length - 1].fall;
    if ((idle || arrived) && st.crumbs.length === 0) this.stop();
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

    const crumbs = new Set(st.crumbs.map((c) => c.k));
    for (const el of this.bridges) {
      const r = el.dataset.route!;
      const idx = Number(el.dataset.idx);
      const on = st.r === r && idx < st.built;
      el.className = 'brk' + (on ? '' : crumbs.has(`${r}:${idx}`) ? ' gone' : ' off');
    }

    for (const b of this.blocks) {
      const id = b.dataset.id!;
      const rt = this.w.routes[id];
      const held = st.r === id && st.p === rt.length && !rt[rt.length - 1].fall;
      b.className = 'blk' + (st.sel === id ? ` on pop${ab}` : '') + (held ? ' held' : '');
      b.setAttribute('aria-pressed', st.sel === id ? 'true' : 'false');
    }

    const away = st.r !== null || (st.goal !== null && !(st.goal === 'blog' && st.done404));
    const err = st.msg === '404';
    this.bubble.textContent = err ? BUBBLE_404 : st.sel ? BUBBLES[st.sel] : BUBBLE_IDLE;
    this.bubble.className = 'bubble pxf' + (err ? ' err' : '') + (away ? ' off' : '');
  }
}

if (!customElements.get('larmic-island')) customElements.define('larmic-island', LarmicIsland);

declare global {
  interface HTMLElementTagNameMap {
    'larmic-island': LarmicIsland;
  }
}
export {};
