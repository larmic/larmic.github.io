// <larmic-threeyear>: das Spiel für drei Jahre. Verbindet die reinen Teile (Welt, Regeln, Speichern) mit dem
// Browser: Tastatur, Takt, Kamera, Töne, Menü und Canvas. Alle Regeln stecken getestet in threeyear-state.ts.
// Listener auf document/window hängen an einem AbortController und verschwinden mit der Komponente; so stört das
// Spiel nach einem Seitenwechsel (View Transitions) niemanden.
// Konzept: docs/games/threeyear.md · Spec: docs/specs/threeyear.md

import type { Dir } from '../../lib/games/front';
import { GAME_COLORS, LOOK, SPECIES } from '../../data/games/threeyear';
import { Renderer, type Body, type Float, type Particle, type Scene } from './threeyear-render';
import { Sfx } from './sfx';
import {
  DEFAULT_FIGURE,
  cleanName,
  loadIndex,
  loadWorld,
  newWorld,
  progressFrom,
  saveWorld,
  withProgress,
  worldCode,
  type SavedWorld,
  type Store,
} from './threeyear-save';
import { InputPace, STEP_MS } from './input-pace';
import { initialState, progressOf, step, type Cmd, type GameEvent, type State } from './threeyear-state';
import { createWorld, standHeight, type World } from './threeyear-world';

const TICK_MS = 100; // Takt der Regeln
const SAVE_EVERY_MS = 10_000; // Position regelmäßig sichern
const SPEED = (1000 / STEP_MS) * 1.1; // Felder pro Sekunde beim Gleiten: etwas schneller als der Takt, also weich
const KEYS: Record<string, Dir> = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e' };
const FREE_KEYS = new Set([
  'Tab',
  'Escape',
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'OS',
  'CapsLock',
  'ContextMenu',
]);

/** localStorage, falls erlaubt – sonst ein Speicher, der nur bis zum Neuladen hält */
function browserStore(): Store {
  try {
    const s = window.localStorage;
    const probe = 'larmic.games.probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const randomId = () => randomSeed().toString(36) + Date.now().toString(36);

class LarmicThreeyear extends HTMLElement {
  private store!: Store;
  private saved!: SavedWorld;
  private world!: World;
  private state!: State;
  private renderer!: Renderer;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private menu!: HTMLDialogElement;
  private sfx = new Sfx();
  private globals: AbortController | null = null;
  private timer: number | undefined;
  private raf = 0;
  private lastFrame = 0;
  private lastSave = 0;
  private pace = new InputPace(); // ruhiger Takt: Tippen ist nicht schneller als Halten
  private size = { w: 0, h: 0, zoom: 1, dpr: 1 };
  private bodies = new Map<string, Body>();
  private hops = new Map<string, number>(); // Zeitpunkt des letzten Sing-Hüpfers je Wesen
  private gates = new Map<string, number>(); // Zeitpunkt, an dem ein Tor aufging (0 = schon offen)
  private floats: (Float & { born: number; who?: string })[] = [];
  private particles: Particle[] = [];
  private nightSince = 0;
  private dayAt = 0;
  private resize: ResizeObserver | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.canvas = this.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.menu = this.querySelector('dialog')!;
    this.renderer = new Renderer(this.ctx);
    this.store = browserStore();
    this.sfx.muted = this.store.getItem('larmic.games.muted') === '1';
    this.openWorld(loadIndex(this.store).current);
    this.listen();
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.canvas);
    this.measure();
    this.classList.add('ready');
    this.start();
  }

  disconnectedCallback() {
    this.save();
    this.stop();
    this.globals?.abort();
    this.globals = null;
    this.resize?.disconnect();
    this.sfx.close();
  }

  // ---------- Welten ----------

  /** Welt laden (oder eine neue anlegen) und das Spiel darauf starten */
  private openWorld(id: string | null) {
    const loaded = id ? loadWorld(this.store, id) : null;
    // Fehlt eine Welt aus dem Index (gelöscht, kaputt), entsteht sie neu unter derselben Kennung und mit ihren Namen
    const entry = id ? loadIndex(this.store).worlds.find((w) => w.id === id) : undefined;
    this.saved =
      loaded ??
      newWorld(id ?? randomId(), randomSeed(), entry?.worldName ?? 'Meine Welt', entry?.figureName ?? DEFAULT_FIGURE);
    this.saved = { ...this.saved, visits: this.saved.visits + 1 };
    saveWorld(this.store, this.saved);
    this.world = createWorld(this.saved.seed);
    this.state = initialState(this.world, progressFrom(this.saved), this.saved.seed ^ this.saved.visits);
    this.bodies.clear();
    this.floats = [];
    this.particles = [];
    this.gates = new Map(this.state.openGates.map((g) => [g, 0]));
    this.nightSince = 0;
    this.dayAt = 0;
    this.renderName();
    this.renderMenu();
  }

  private save() {
    if (!this.saved) return;
    this.saved = withProgress(this.saved, progressOf(this.state));
    saveWorld(this.store, this.saved);
    this.lastSave = performance.now();
  }

  // ---------- Takt und Eingabe ----------

  private start() {
    if (this.timer === undefined && !this.menu.open && document.visibilityState === 'visible')
      this.timer = window.setInterval(() => this.apply({ type: 'tick' }), TICK_MS);
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private stop() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private apply(cmd: Cmd) {
    const { state, events } = step(this.state, this.world, cmd);
    this.state = state;
    if (events.length) this.react(events);
    if (performance.now() - this.lastSave > SAVE_EVERY_MS) this.save();
  }

  private listen() {
    this.globals = new AbortController();
    const signal = this.globals.signal;
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.menu.open || e.metaKey || e.ctrlKey || e.altKey || FREE_KEYS.has(e.key) || /^F\d+$/.test(e.key))
          return;
        const t = e.target as HTMLElement | null;
        if (t?.closest('input, textarea, select')) return;
        // Buttons bleiben bedienbar (Enter, im Menü auch die Leertaste). Zurück und Zahnrad oben: Die Leertaste gehört
        // dem Spiel, sonst öffnet das Kind nach einem Mausklick von Papa das Menü statt zu singen.
        if (t?.closest('button, a') && (e.key === 'Enter' || (e.key === ' ' && !t.closest('.ty-top')))) return;
        e.preventDefault();
        if (e.repeat) return; // gehaltene Pfeile laufen über den eigenen Takt (poll im Bild), nicht über das System
        const dir = KEYS[e.key];
        const now = performance.now();
        this.sfx.unlock();
        if (dir) {
          const go = this.pace.press(dir, now);
          if (go) this.apply({ type: 'move', dir: go });
        } else if (this.pace.action(now)) this.apply({ type: 'action' });
      },
      { signal },
    );
    document.addEventListener(
      'keyup',
      (e) => {
        const dir = KEYS[e.key];
        if (dir) this.pace.release(dir);
      },
      { signal },
    );
    // Losgelassene Tasten kommen nicht an, wenn das Fenster den Fokus verliert: dann nichts weiterlaufen lassen
    window.addEventListener('blur', () => this.pace.clear(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          this.pace.clear();
          this.save();
          this.stop();
          this.sfx.suspend();
        } else this.start();
      },
      { signal },
    );
    window.addEventListener('pagehide', () => this.save(), { signal });

    this.querySelector('.ty-gear')!.addEventListener('click', () => this.openMenu(), { signal });
    // Beim Schließen gibt der Dialog den Fokus ans Zahnrad zurück; die Leertaste öffnete dann sofort wieder das Menü
    this.menu.addEventListener(
      'close',
      () => {
        (document.activeElement as HTMLElement | null)?.blur();
        this.start();
      },
      { signal },
    );
    this.menu.addEventListener('click', (e) => this.menuClick(e), { signal });
    this.menu.addEventListener('change', (e) => this.menuChange(e), { signal });
  }

  /** Ereignisse der Regeln: Töne, Herzen, Noten, Tore, Nacht – und sofort speichern, was zählt */
  private react(events: GameEvent[]) {
    const now = performance.now();
    let persist = false;
    for (const e of events) {
      switch (e.type) {
        case 'step':
          this.sfx.step(e.climb);
          break;
        case 'bump':
          this.sfx.bump();
          this.hops.set('bump', now);
          break;
        case 'sing':
          this.sfx.play(SPECIES[e.species].tone);
          this.hops.set(e.id, now);
          this.float('note', e.id, GAME_COLORS.note, now);
          if (e.first) {
            this.sfx.friend();
            this.float('heart', e.id, GAME_COLORS.heart, now + 250);
            this.burst(e.id, [GAME_COLORS.heart, '#ffffff', '#e77fb3'], 16);
            persist = true;
          }
          break;
        case 'follow':
          this.float('heart', e.id, GAME_COLORS.heart, now + 150);
          break;
        case 'swap':
          this.sfx.step();
          break;
        case 'pen':
          this.sfx.pen();
          this.burst(e.id, ['#ffd47e', '#ffffff', '#6cc46f'], 14);
          persist = true;
          break;
        case 'gate':
          this.sfx.gate();
          this.gates.set(e.id, now);
          persist = true;
          break;
        case 'call':
          this.sfx.call();
          this.hops.set('player', now);
          this.float('note', 'player', GAME_COLORS.note, now);
          break;
        case 'sleep':
          this.sfx.lullaby();
          this.nightSince = now;
          persist = true;
          break;
        case 'wake':
          this.sfx.wake();
          this.dayAt = now;
          this.hops.set('player', now);
          break;
      }
    }
    if (persist) this.save();
  }

  private float(kind: Float['kind'], who: string, color: string, born: number) {
    if (this.reduced.matches && kind !== 'heart') return;
    this.floats.push({ kind, who, color, born, x: 0, y: 0, z: 0, age: 0 });
  }

  private burst(who: string, colors: string[], n: number) {
    if (this.reduced.matches) return;
    const b = this.bodies.get(who);
    if (!b) return;
    const { zoom } = this.size;
    const sx = this.size.w / 2 + (b.x - this.camera().x) * 64 * zoom;
    const sy = this.size.h / 2 + 30 * zoom + ((b.y - this.camera().y) * 44 - (b.z + 0.8) * 40) * zoom;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = 1 + (i % 4) * 0.8;
      this.particles.push({
        x: sx,
        y: sy,
        vx: Math.cos(a) * v,
        vy: -Math.abs(Math.sin(a)) * v * 1.4 - 1,
        life: 40 + (i % 5) * 6,
        color: colors[i % colors.length],
        size: (3 + (i % 3) * 2) * zoom,
      });
    }
  }

  // ---------- Bild ----------

  private measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // Etwa 18 Felder breit, auf großen Schirmen nicht riesig, auf kleinen nicht winzig
    this.size = { w, h, dpr, zoom: Math.min(1.25, Math.max(0.5, w / (18 * 64))) };
  }

  private camera() {
    return this.bodies.get('player') ?? { x: this.state.player.x, y: this.state.player.y };
  }

  /** Wesen gleiten zu ihrem Feld; große Sprünge (Aufwachen, Heimkehr) springen direkt */
  private glide(dt: number, now: number) {
    const snap = this.reduced.matches;
    const targets = new Map<string, { x: number; y: number }>();
    targets.set('player', this.state.player);
    for (const a of this.state.animals) targets.set(a.id, a);
    for (const id of this.bodies.keys()) if (!targets.has(id)) this.bodies.delete(id);
    for (const [id, t] of targets) {
      const z = standHeight(this.world, this.state.openGates, t.x, t.y) ?? this.world.cell(t.x, t.y).h;
      let b = this.bodies.get(id);
      if (!b || snap || Math.abs(b.x - t.x) + Math.abs(b.y - t.y) > 2.5) b = { x: t.x, y: t.y, z, hop: 0 };
      const dx = t.x - b.x,
        dy = t.y - b.y,
        d = Math.hypot(dx, dy);
      const stepLen = SPEED * dt;
      if (d <= stepLen) {
        b.x = t.x;
        b.y = t.y;
      } else {
        b.x += (dx / d) * stepLen;
        b.y += (dy / d) * stepLen;
      }
      b.z += (z - b.z) * Math.min(1, dt * 14);
      const moving = Math.min(1, Math.hypot(t.x - b.x, t.y - b.y));
      const sung = now - (this.hops.get(id) ?? -1e9);
      b.hop = snap ? 0 : Math.sin(moving * Math.PI) * 0.14 + (sung < 320 ? Math.sin((sung / 320) * Math.PI) * 0.3 : 0);
      this.bodies.set(id, b);
    }
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min(0.05, (t - (this.lastFrame || t)) / 1000);
    this.lastFrame = t;
    if (!this.size.w) this.measure();
    if (!this.size.w) return;
    // Gehaltener Pfeil oder gemerkter Tipp: im ruhigen Takt weiterlaufen
    const next = this.menu.open ? null : this.pace.poll(t);
    if (next) this.apply({ type: 'move', dir: next });
    this.glide(dt, t);

    const bump = t - (this.hops.get('bump') ?? -1e9);
    const shake = !this.reduced.matches && bump < 200 ? Math.sin(bump / 18) * 0.06 * (1 - bump / 200) : 0;
    const player = this.bodies.get('player')!;
    const cam = { x: player.x + shake, y: player.y };

    // Nacht blendet ein und aus (ohne Überblendung bei reduzierter Bewegung)
    const fade = (since: number, ms: number) => (this.reduced.matches ? 1 : Math.min(1, (t - since) / ms));
    const night = this.state.sleeping ? fade(this.nightSince, 1500) : 1 - fade(this.dayAt, 900);

    if (this.state.sleeping && !this.floats.some((f) => f.kind === 'zzz' && t - f.born < 1000) && !this.reduced.matches)
      this.floats.push({ kind: 'zzz', who: 'bed', color: GAME_COLORS.star, born: t, x: 0, y: 0, z: 0, age: 0 });

    // Schwebende Herzen und Noten folgen ihrem Wesen
    this.floats = this.floats.filter((f) => t - f.born < 1300);
    const floats: Float[] = [];
    for (const f of this.floats) {
      if (t < f.born) continue;
      const b = f.who === 'bed' ? { x: -3, y: -3, z: 1.3, hop: 0 } : this.bodies.get(f.who!);
      if (!b) continue;
      floats.push({ ...f, x: b.x, y: b.y, z: b.z + (f.who === 'player' ? 1.5 : 0.9), age: t - f.born });
    }
    const k = dt * 60; // Partikel laufen in Zeit, nicht in Bildern (120-Hz-Schirme)
    for (const p of this.particles) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.22 * k;
      p.life -= k;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    const gates = new Map<string, number>();
    for (const [id, since] of this.gates) gates.set(id, since === 0 ? 1 : fade(since, 900));

    const { dpr, w, h, zoom } = this.size;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    const scene: Scene = {
      width: w,
      height: h,
      zoom,
      cam,
      bodies: this.bodies,
      gates: gates as Scene['gates'],
      night,
      floats,
      particles: this.particles,
      now: t,
      look: LOOK,
      reduced: this.reduced.matches,
    };
    this.renderer.draw(this.world, this.state, scene);
  }

  // ---------- Kopf und Menü ----------

  private renderName() {
    const tag = this.querySelector('.ty-name');
    if (!tag) return;
    tag.replaceChildren(
      ...[...this.saved.figureName.toUpperCase()]
        .filter((ch) => ch.trim())
        .map((ch) => {
          const s = document.createElement('span');
          s.textContent = ch;
          return s;
        }),
    );
    tag.setAttribute('aria-label', this.saved.figureName);
  }

  private openMenu() {
    this.pace.clear();
    this.save();
    this.renderMenu();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    // Ohne Fokus auf dem Zahnrad gibt der Dialog beim Schließen keinen Fokus dorthin zurück
    (document.activeElement as HTMLElement | null)?.blur();
    this.menu.showModal();
  }

  private renderMenu() {
    const list = this.menu.querySelector('.ty-worlds')!;
    list.replaceChildren(
      ...loadIndex(this.store).worlds.map((w) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ty-world';
        b.dataset.world = w.id;
        if (w.id === this.saved.id) b.setAttribute('aria-current', 'true');
        const name = document.createElement('strong');
        name.textContent = w.worldName;
        const fig = document.createElement('span');
        fig.textContent = w.figureName;
        b.append(name, fig);
        li.append(b);
        return li;
      }),
    );
    (this.menu.querySelector('#ty-world-name') as HTMLInputElement).value = this.saved.worldName;
    (this.menu.querySelector('#ty-figure-name') as HTMLInputElement).value = this.saved.figureName;
    this.menu.querySelector('.ty-code')!.textContent = worldCode(this.saved.seed);
    const sound = this.menu.querySelector('[data-act="sound"]')!;
    sound.setAttribute('aria-pressed', String(!this.sfx.muted));
    sound.textContent = this.sfx.muted ? 'Ton ist aus' : 'Ton ist an';
  }

  private menuClick(e: Event) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-world], [data-act]');
    if (!t) return;
    if (t.dataset.world && t.dataset.world !== this.saved.id) {
      this.save();
      this.openWorld(t.dataset.world);
      return;
    }
    switch (t.dataset.act) {
      case 'new':
        this.save();
        this.saved = newWorld(
          randomId(),
          randomSeed(),
          `Welt ${loadIndex(this.store).worlds.length + 1}`,
          this.saved.figureName,
        );
        saveWorld(this.store, this.saved);
        this.openWorld(this.saved.id);
        break;
      case 'copy':
        void this.copyCode(t);
        break;
      case 'sound':
        this.sfx.muted = !this.sfx.muted;
        try {
          this.store.setItem('larmic.games.muted', this.sfx.muted ? '1' : '0');
        } catch {
          /* egal */
        }
        if (this.sfx.muted) this.sfx.suspend();
        else this.sfx.unlock();
        this.renderMenu();
        break;
      case 'fullscreen':
        this.menu.close();
        this.requestFullscreen?.().catch(() => {});
        break;
      case 'close':
        this.menu.close();
        break;
    }
  }

  private menuChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.id === 'ty-world-name') this.saved = { ...this.saved, worldName: cleanName(input.value, 'Meine Welt') };
    else if (input.id === 'ty-figure-name')
      this.saved = { ...this.saved, figureName: cleanName(input.value, DEFAULT_FIGURE) };
    else return;
    this.save();
    this.renderName();
    this.renderMenu();
  }

  private async copyCode(button: HTMLElement) {
    const code = worldCode(this.saved.seed);
    const done = (text: string) => {
      button.textContent = text;
      setTimeout(() => (button.textContent = 'Kopieren'), 1600);
    };
    try {
      await navigator.clipboard.writeText(code);
      done('Kopiert');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(this.menu.querySelector('.ty-code')!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      done('Markiert');
    }
  }
}

if (!customElements.get('larmic-threeyear')) customElements.define('larmic-threeyear', LarmicThreeyear);
