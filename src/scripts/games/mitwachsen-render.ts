// Zeichnet Mitwachsen in ein Canvas: Welt von vorn, Reihe für Reihe von hinten nach vorn, dazu Tiere, Figur,
// Herzen, Noten, Heimweg-Pfeil und Nacht. Liest nur Zustand und Welt; was sich bewegt (Kamera, gleitende Figuren,
// Hüpfer), berechnet die Web Component und reicht es als `Scene` herein.

import {
  LEVEL_H,
  TILE_D,
  TILE_W,
  box,
  drawModel,
  frontBlock,
  projection,
  type Projection,
} from '../../lib/games/front';
import {
  DIRT,
  GRASS_SIDE,
  GRASS_TOP,
  LEAVES,
  LOG_SIDE,
  PAL_GRASS,
  PAL_LEAVES,
  PAL_LOG,
  PAL_STONE,
  STONE,
  type Palette,
} from '../../lib/voxel/textures';
import {
  GAME_COLORS,
  GATES,
  REGIONS,
  SPECIES,
  THEME_COLORS,
  figureParts,
  speciesOf,
  type GateId,
  type Look,
  type SpeciesId,
} from '../../data/games/mitwachsen';
import type { State } from './mitwachsen-state';
import { hash } from '../../lib/games/rng';
import type { Cell, TreeKind, World } from './mitwachsen-world';

/** Gleitende Position eines Wesens auf dem Bildschirm (in Feldern), dazu Hüpfer und Blickrichtung */
export type Body = { x: number; y: number; z: number; hop: number };
export type Float = { kind: 'note' | 'heart' | 'zzz'; x: number; y: number; z: number; age: number; color: string };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

export type Scene = {
  width: number;
  height: number;
  zoom: number;
  cam: { x: number; y: number };
  bodies: Map<string, Body>; // Tiere nach Kennung, die Figur unter 'player'
  gates: Map<GateId, number>; // Öffnung 0…1 je Tor
  night: number; // 0 Tag … 1 Nacht
  evening: number; // 0 Tag … 1 goldener Abend (die Figur wird müde)
  floats: Float[];
  particles: Particle[];
  now: number;
  look: Look;
  reduced: boolean; // prefers-reduced-motion: nichts wippt, steigt oder funkelt
  bottomInset: number; // Platz unten für die Touch-Steuerung (die Leiste rückt darüber)
  explored: (x: number, y: number) => boolean; // Nebel: nur Erkundetes wird gezeigt
};

/** Böden der Welten hinter den Toren in der 2D-Ansicht: Seite, Oberseite */
const FLAT_GROUND: Partial<Record<Cell['ground'], [string, string]>> = {
  snow: ['#cfd8de', '#f4f8fb'],
  ice: ['#9fd6ef', '#d4f1ff'],
  basalt: ['#2a2b30', '#3a3b42'],
  cave: ['#2a2c33', '#3c3f47'],
  cloud: ['#e6eef7', '#ffffff'],
  moss: ['#6a4a3a', '#8a76cc'],
};

const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };

const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const NOTE = ['..kkkk', '..k..k', '..k..k', 'kkk.kk', 'kkk.kk'];
const ZZZ = ['zzzz', '..z.', '.z..', 'zzzz'];
const ASK = ['.qqq.', 'q...q', '...q.', '..q..', '.....', '..q..']; // Fragezeichen über verlorenen Tieren

function sprite(ctx: CanvasRenderingContext2D, grid: string[], color: string, cx: number, bottom: number, px: number) {
  ctx.fillStyle = color;
  const w = grid[0].length;
  grid.forEach((row, r) => {
    for (let c = 0; c < w; c++)
      if (row[c] !== '.')
        ctx.fillRect(
          Math.round(cx + (c - w / 2) * px),
          Math.round(bottom + (r - grid.length) * px),
          Math.ceil(px),
          Math.ceil(px),
        );
  });
}

export class Renderer {
  private blocks: Record<'grass' | 'dirt' | 'stone' | 'sand' | 'path' | 'leaves' | 'log', HTMLCanvasElement>;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.blocks = {
      grass: frontBlock(GRASS_TOP, GRASS_SIDE, PAL_GRASS),
      dirt: frontBlock(DIRT, DIRT, PAL_GRASS),
      stone: frontBlock(STONE, STONE, PAL_STONE),
      sand: frontBlock(DIRT, DIRT, PAL_SAND),
      path: frontBlock(DIRT, DIRT, PAL_PATH),
      leaves: frontBlock(LEAVES, LEAVES, PAL_LEAVES),
      log: frontBlock(LOG_SIDE, LOG_SIDE, PAL_LOG),
    };
  }

  draw(world: World, state: State, sc: Scene) {
    const { ctx } = this;
    const z = sc.zoom;
    const P = projection(sc.cam.x + 0.5, sc.cam.y + 0.5, sc.width / 2, sc.height / 2 + 30 * z, z);
    this.sky(sc);

    const cols = Math.ceil(sc.width / 2 / (TILE_W * z)) + 1;
    const x0 = Math.floor(sc.cam.x) - cols,
      x1 = Math.ceil(sc.cam.x) + cols;
    const y0 = Math.floor(sc.cam.y - sc.height / 2 / (TILE_D * z)) - 2;
    const y1 = Math.ceil(sc.cam.y + (sc.height / 2 + 4 * LEVEL_H * z) / (TILE_D * z)) + 2;

    // Wesen nach der Reihe, in der sie gezeichnet werden: beim Gehen nach vorn schon in der Zielreihe
    const rows = new Map<number, string[]>();
    for (const [id, b] of sc.bodies) {
      if (id === 'player' && state.sleeping) continue;
      const row = Math.ceil(b.y - 1e-6);
      rows.set(row, [...(rows.get(row) ?? []), id]);
    }
    const byId = new Map(state.animals.map((a) => [a.id, a]));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.ground(P, world, x, y, sc);
      for (let x = x0; x <= x1; x++) this.deco(P, world, state, sc, x, y);
      const ids = (rows.get(y) ?? []).sort((a, b) => sc.bodies.get(a)!.x - sc.bodies.get(b)!.x);
      for (const id of ids) {
        const b = sc.bodies.get(id)!;
        if (id === 'player') {
          this.shadow(P, b.x + 0.5, b.y + 0.5, b.z, 0.32);
          drawModel(ctx, P, figureParts(sc.look), b.x + 0.5, b.y + 0.5, b.z + b.hop, state.player.dir, 1);
          continue;
        }
        const a = byId.get(id);
        if (!a || !sc.explored(Math.round(b.x), Math.round(b.y))) continue; // Tiere im Nebel bleiben verborgen
        const sp = SPECIES[a.species];
        this.shadow(P, b.x + 0.5, b.y + 0.5, b.z, 0.26 * sp.scale);
        drawModel(ctx, P, sp.parts, b.x + 0.5, b.y + 0.5, b.z + b.hop, a.dir, sp.scale);
      }
    }

    // Die Figur noch einmal halb durchsichtig obenauf: Steht sie hinter einem Hügel oder Baum, bleibt sie sichtbar
    const me = sc.bodies.get('player');
    if (me && !state.sleeping) {
      ctx.globalAlpha = 0.35;
      drawModel(ctx, P, figureParts(sc.look), me.x + 0.5, me.y + 0.5, me.z + me.hop, state.player.dir, 1);
      ctx.globalAlpha = 1;
    }

    this.atmosphere(sc);
    this.overlay(state, sc, P);
  }

  /**
   * Alles, was über der Welt schwebt: Zeichen über den Tieren, Herzen und Noten, Heimweg-Pfeil, Nacht, Leben in der
   * Luft und die Leiste. Gleich für beide Ansichten; die 3D-Ansicht reicht ihre eigene Projektion herein und zeichnet
   * diese Ebene auf ein durchsichtiges Canvas über der 3D-Welt.
   */
  overlay(state: State, sc: Scene, P: Projection) {
    const { ctx } = this;
    const z = sc.zoom;
    const followers = new Set(state.followers);
    if (sc.evening > 0) this.eveningGlow(sc);
    for (const a of state.animals) {
      const b = sc.bodies.get(a.id);
      if (!b || !sc.explored(Math.round(b.x), Math.round(b.y))) continue; // im Nebel nichts verraten
      const [hx, hy] = P(b.x + 0.5, b.y + 0.5, b.z + b.hop + 1.05 * SPECIES[a.species].scale * 0.75);
      if (followers.has(a.id)) sprite(ctx, HEART, GAME_COLORS.heart, hx, hy, 2.5 * z);
      else if (!state.met.includes(a.id)) {
        // Verloren: ein Fragezeichen schwebt über dem Kopf
        const bob = sc.reduced ? 0 : Math.sin(sc.now / 400 + b.x) * 2 * z;
        sprite(ctx, ASK, GAME_COLORS.lost, hx, hy + bob, 2.5 * z);
      } else if (a.mode === 'home' && !sc.reduced) {
        // Zu Hause im Garten glücklich: ab und zu steigt ein kleines Herz auf
        const phase = (sc.now / 1000 + ((a.id.length * 7.3) % 5)) % 5;
        if (phase < 1.2) {
          ctx.globalAlpha = 1 - phase / 1.2;
          sprite(ctx, HEART, GAME_COLORS.heart, hx + 6 * z, hy - phase * 18 * z, 2 * z);
          ctx.globalAlpha = 1;
        }
      }
    }
    this.effects(P, sc);
    if (sc.night > 0) this.nightSky(sc);
    this.life(sc);
    this.album(state, sc);
  }

  /**
   * Leiste unten: ein Platz je Tier, nach Gegenden gruppiert, dahinter Tiere der Landschaft, die im Garten wohnen.
   * Umriss mit Fragezeichen = noch verloren, in Farbe = gefunden, grüner Grund = zu Hause im Garten, Herz = folgt gerade.
   */
  private album(state: State, sc: Scene) {
    const { ctx } = this;
    // Je Gegend ein Platz pro Art (es gibt mehrere Tiere je Art: eines gefunden heißt die Art gefunden),
    // dahinter Tiere der Landschaft im Garten einzeln
    const of = (ids: readonly string[], region: string, species: string) =>
      ids.some((id) => id.startsWith(`${region}:`) && speciesOf(id) === species);
    const garden = state.garden.map((p) => p.id);
    type Slot = { species: SpeciesId; met: boolean; home: boolean; follows: boolean };
    const groups: Slot[][] = REGIONS.map((r) =>
      r.animals.map(({ species }) => ({
        species,
        met: of(state.met, r.id, species) || of(garden, r.id, species),
        home: of(garden, r.id, species),
        follows: of(state.followers, r.id, species),
      })),
    );
    const wild = state.garden.filter((p) => p.id.startsWith('wild:')).slice(0, 10);
    if (wild.length)
      groups.push(
        wild.map((p) => ({ species: p.species, met: true, home: true, follows: state.followers.includes(p.id) })),
      );
    const count = groups.reduce((n, g) => n + g.length, 0);
    const gap = 6,
      groupGap = 18;
    const room = sc.width - 24 - (count - 1) * gap - (groups.length - 1) * (groupGap - gap);
    const size = Math.floor(Math.max(26, Math.min(52, 44 * sc.zoom, room / count)));
    const total = count * size + (count - 1) * gap + (groups.length - 1) * (groupGap - gap);
    let x = Math.round((sc.width - total) / 2);
    const y = Math.round(sc.height - size - 14 - sc.bottomInset);
    for (const group of groups) {
      for (const a of group) {
        const met = a.met;
        ctx.fillStyle = a.home ? GAME_COLORS.slotHome : met ? GAME_COLORS.slotMet : GAME_COLORS.slotEmpty;
        ctx.fillRect(x, y, size, size);
        // Pixel-Rahmen ohne Eckpixel wie auf der Seite
        ctx.fillStyle = GAME_COLORS.ink;
        ctx.fillRect(x, y - 3, size, 3);
        ctx.fillRect(x, y + size, size, 3);
        ctx.fillRect(x - 3, y, 3, size);
        ctx.fillRect(x + size, y, 3, size);
        const sp = SPECIES[a.species];
        const s = (size * 1.15) / (0.9 * TILE_W * sp.scale); // Tier füllt den Platz gut zu drei Vierteln
        const P = projection(0.5, 0.5, x + size / 2, y + size * 0.86, s);
        drawModel(ctx, P, sp.parts, 0.5, 0.5, 0, 'e', sp.scale, met ? undefined : GAME_COLORS.silhouette);
        if (!met) sprite(ctx, ASK, GAME_COLORS.lost, x + size - 7, y + 13, Math.max(1.5, size / 26));
        if (a.follows) sprite(ctx, HEART, GAME_COLORS.heart, x + size - 6, y + 12, Math.max(1.5, size / 22));
        x += size + gap;
      }
      x += groupGap - gap;
    }
  }

  private sky(sc: Scene) {
    const { ctx } = this;
    const bands = ['#79c7ea', '#8dd0ee', '#a6dbf2'];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (sc.height * i) / 3, sc.width, sc.height / 3 + 1);
    });
  }

  private img(P: Projection, image: HTMLCanvasElement, x: number, y: number, top: number) {
    const [sx, sy] = P(x, y, top);
    const [ex] = P(x + 1, y, top);
    const w = ex - sx;
    this.ctx.drawImage(image, sx, sy, w, (w * (TILE_D + LEVEL_H)) / TILE_W);
  }

  /** Säule eines Feldes: nur die Blöcke, deren Vorderseite nicht vom Feld davor verdeckt wird */
  private ground(P: Projection, world: World, x: number, y: number, sc: Scene) {
    const c = world.cell(x, y);
    if (!sc.explored(x, y)) return; // im Nebel: nichts, der Himmel scheint durch
    if (c.ground === 'water') return this.water(P, world, x, y, sc);
    if (c.ground === 'sky') return; // zwischen den Wolken: nur Himmel
    if (c.ground === 'lava') {
      box(this.ctx, P, x, y, 0, 1, 1, 0.6, '#b8380a', '#ff7a1a');
      return;
    }
    const flat = FLAT_GROUND[c.ground];
    if (flat) {
      // Böden der Welten hinter den Toren: einfache Blöcke in ihren Farben
      const frontH = world.cell(x, y + 1).h;
      for (let k = Math.max(0, Math.min(c.h - 1, frontH)); k < c.h; k++) box(this.ctx, P, x, y, k, 1, 1, 1, ...flat);
      this.edges(P, world, x, y, c.h);
      this.haze(P, x, y, c.h, sc);
      return;
    }
    const front = world.cell(x, y + 1);
    const frontH = front.ground === 'water' ? 0 : front.h;
    const low = Math.max(0, Math.min(c.h - 1, frontH));
    for (let k = low; k < c.h; k++) {
      const top = k === c.h - 1;
      const image =
        c.ground === 'stone'
          ? this.blocks.stone
          : !top
            ? this.blocks.dirt
            : c.ground === 'sand'
              ? this.blocks.sand
              : c.ground === 'path'
                ? this.blocks.path
                : this.blocks.grass;
      this.img(P, image, x, y, k + 1);
    }
    this.edges(P, world, x, y, c.h);
    this.haze(P, x, y, c.h, sc);
    if (c.shade && c.ground !== 'stone') {
      const [ax, ay] = P(x, y, c.h);
      const [bx, by] = P(x + 1, y + 1, c.h);
      this.ctx.fillStyle =
        c.shade > 0
          ? `rgba(255,240,170,${(0.05 * c.shade).toFixed(3)})`
          : `rgba(20,60,20,${(-0.14 * c.shade).toFixed(3)})`;
      this.ctx.fillRect(ax, ay, bx - ax, by - ay);
    }
  }

  /** Höhen sichtbar machen: höhere Flächen heller, Kanten an Abhängen, Schatten am Fuß höherer Nachbarn */
  private edges(P: Projection, world: World, x: number, y: number, h: number) {
    const { ctx } = this;
    const height = (nx: number, ny: number) => {
      const n = world.cell(nx, ny);
      return n.ground === 'water' ? 0 : n.h;
    };
    const [ax, ay] = P(x, y, h);
    const [bx, by] = P(x + 1, y + 1, h);
    const w = bx - ax,
      d = by - ay;
    const line = Math.max(2, w / 28);
    if (h >= 2) {
      ctx.fillStyle = `rgba(255,255,255,${0.045 * (h - 1)})`;
      ctx.fillRect(ax, ay, w, d);
    }
    const sides: [number, number, (t: number) => void][] = [
      [x - 1, y, (t) => ctx.fillRect(ax, ay, t, d)],
      [x + 1, y, (t) => ctx.fillRect(bx - t, ay, t, d)],
      [x, y - 1, (t) => ctx.fillRect(ax, ay, w, t)],
    ];
    for (const [nx, ny, rect] of sides) {
      const nh = height(nx, ny);
      if (nh > h) {
        ctx.fillStyle = GAME_COLORS.shade;
        rect(w * 0.14);
      } else if (nh < h) {
        ctx.fillStyle = GAME_COLORS.ledge;
        rect(line);
      }
    }
    if (height(x, y + 1) < h) {
      ctx.fillStyle = GAME_COLORS.highlight;
      ctx.fillRect(ax, by - line, w, line);
      // dunkle Unterkante der Stufe, damit sie sich vom Boden davor abhebt
      const [, fy] = P(x, y + 1, height(x, y + 1));
      ctx.fillStyle = GAME_COLORS.ledge;
      ctx.fillRect(ax, fy - line, w, line);
    }
  }

  private water(P: Projection, world: World, x: number, y: number, sc: Scene) {
    const { ctx } = this;
    const [ax, ay] = P(x, y, 0.8);
    const [bx, by] = P(x + 1, y + 1, 0.8);
    const w = bx - ax,
      d = by - ay;
    ctx.fillStyle = GAME_COLORS.water;
    ctx.fillRect(ax, ay, w + 0.5, d + 0.5);
    // Tiefer in der Mitte, heller am Ufer
    const shore = ['n', 'w', 'e'].filter((k) => {
      const [dx, dy] = k === 'n' ? [0, -1] : k === 'w' ? [-1, 0] : [1, 0];
      return world.cell(x + dx, y + dy).ground !== 'water';
    });
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    if (shore.includes('n')) ctx.fillRect(ax, ay, w, Math.max(2, d * 0.08));
    if (shore.includes('w')) ctx.fillRect(ax, ay, Math.max(2, w * 0.06), d);
    if (shore.includes('e')) ctx.fillRect(bx - Math.max(2, w * 0.06), ay, Math.max(2, w * 0.06), d);
    // Glitzern, das langsam wandert
    const t = sc.reduced ? 0 : sc.now / 1600;
    ctx.fillStyle = GAME_COLORS.waterLight;
    for (let i = 0; i < 2; i++) {
      const seed = hash(7, x, y, i);
      const fx = ((seed % 100) / 100 + t * (0.15 + i * 0.1)) % 1;
      const fy = 0.25 + i * 0.4 + ((seed >>> 8) % 20) / 100;
      ctx.fillRect(ax + fx * w * 0.7, ay + fy * d, w * 0.28, Math.max(2, d * 0.05));
    }
  }

  /** Weicher Schatten auf dem Boden unter einem Wesen oder Gegenstand */
  private shadow(P: Projection, cx: number, cy: number, z: number, r: number) {
    const [sx, sy] = P(cx, cy, z);
    const [ex] = P(cx + r, cy, z);
    const rx = ex - sx;
    this.ctx.fillStyle = 'rgba(20,30,20,.22)';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy, rx, rx * 0.42, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** Grasbüschel: je drei schmale Halme in verschiedenen Grüntönen */
  private tufts(P: Projection, x: number, y: number, h: number, n: number) {
    const greens = ['#3a7f2c', '#4f9a3c', '#6dbd47', '#2f6f28'];
    for (let i = 0; i < n; i++) {
      const r = hash(3, x, y, i);
      const tx = x + 0.12 + (r % 70) / 100,
        ty = y + 0.15 + ((r >>> 8) % 65) / 100;
      for (let b = 0; b < 3; b++) {
        const bh = 0.2 + ((r >>> (12 + b * 3)) % 7) / 36;
        box(this.ctx, P, tx + b * 0.055, ty + (b === 1 ? -0.02 : 0), h, 0.045, 0.02, bh, greens[(r + b) % 4]);
      }
    }
  }

  /** Blätterklumpen mit Sprenkeln in hell und dunkel, damit er nicht flach wirkt */
  private leafy(
    P: Projection,
    x0: number,
    y0: number,
    z0: number,
    w: number,
    d: number,
    hgt: number,
    color: string,
    top: string,
    sx: number,
    sy: number,
  ) {
    const { ctx } = this;
    box(ctx, P, x0, y0, z0, w, d, hgt, color, top);
    for (let i = 0; i < 16; i++) {
      const r = hash(11, sx, sy, i);
      const fx = x0 + ((r % 85) / 100) * w,
        fz = z0 + (((r >>> 8) % 80) / 100) * hgt;
      const [px, py] = P(fx, y0 + d, fz);
      const s = Math.max(2, P(fx + 0.07, y0, 0)[0] - P(fx, y0, 0)[0]);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.28)' : 'rgba(0,40,0,.32)';
      ctx.fillRect(px, py - s, s, s);
      const [qx, qy] = P(x0 + (((r >>> 16) % 85) / 100) * w, y0 + (((r >>> 4) % 80) / 100) * d, z0 + hgt);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(0,40,0,.18)';
      ctx.fillRect(qx, qy, s, s * 0.7);
    }
  }

  /** Baum mit großer, runder Krone aus mehreren Klumpen; vier Arten mit eigenen Farben */
  private tree(P: Projection, x: number, y: number, h: number, kind: TreeKind) {
    const { ctx } = this;
    const leaves: Record<TreeKind, [string, string]> = {
      oak: ['#3f9a3c', '#5ab651'],
      birch: ['#6aab3a', '#8fcf5a'],
      autumn: ['#d9732e', '#f0a04a'],
      blossom: ['#e595bd', '#f6c3dc'],
      pine: ['#2f6f3a', '#3f8a48'],
      snowpine: ['#2f6f3a', '#ffffff'],
      palm: ['#3f9a3c', '#5ab651'],
      dead: ['#4a3426', '#5d3e21'],
    };
    const [leaf, top] = leaves[kind];
    this.shadow(P, x + 0.5, y + 0.6, h, 0.7);
    if (kind === 'pine' || kind === 'snowpine') {
      box(ctx, P, x + 0.4, y + 0.42, h, 0.2, 0.2, 0.7, '#7a5432', '#93683f');
      box(ctx, P, x - 0.25, y - 0.1, h + 0.5, 1.5, 1.2, 0.6, leaf, top);
      box(ctx, P, x, y + 0.1, h + 1.2, 1.0, 0.8, 0.6, leaf, top);
      box(ctx, P, x + 0.2, y + 0.25, h + 1.8, 0.6, 0.5, 0.6, leaf, top);
      return;
    }
    if (kind === 'palm') {
      box(ctx, P, x + 0.4, y + 0.42, h, 0.22, 0.2, 2.1, '#a77c46', '#c9a066');
      box(ctx, P, x - 0.6, y + 0.3, h + 2.1, 2.4, 0.4, 0.14, leaf, top);
      box(ctx, P, x + 0.35, y - 0.6, h + 2.1, 0.32, 2.2, 0.14, leaf, top);
      return;
    }
    if (kind === 'dead') {
      box(ctx, P, x + 0.4, y + 0.42, h, 0.2, 0.2, 1.5, leaf, top);
      box(ctx, P, x + 0.15, y + 0.45, h + 0.9, 0.3, 0.1, 0.1, leaf);
      return;
    }
    if (kind === 'birch') {
      box(ctx, P, x + 0.4, y + 0.42, h, 0.2, 0.2, 1.5, '#e8e4d8', '#f3efe6');
      for (const z of [0.3, 0.75, 1.15]) box(ctx, P, x + 0.4, y + 0.6, h + z, 0.12, 0.02, 0.06, '#3a3a44');
      this.leafy(P, x + 0.05, y + 0.12, h + 1.3, 0.9, 0.8, 0.9, leaf, top, x, y);
      this.leafy(P, x + 0.2, y + 0.25, h + 2.2, 0.6, 0.5, 0.45, leaf, top, x + 1, y);
      return;
    }
    box(ctx, P, x + 0.36, y + 0.38, h, 0.28, 0.28, 1.2, '#7a5432', '#93683f');
    // Runde, buschige Krone: Mitte am breitesten, darüber kleinere Klumpen leicht versetzt
    this.leafy(P, x - 0.1, y + 0.1, h + 1.05, 1.2, 0.85, 0.55, leaf, top, x, y);
    this.leafy(P, x - 0.38, y + 0.02, h + 1.45, 1.76, 1.0, 0.75, leaf, top, x + 1, y);
    this.leafy(P, x - 0.2, y + 0.12, h + 2.2, 0.85, 0.75, 0.5, leaf, top, x + 2, y);
    this.leafy(P, x + 0.45, y + 0.2, h + 2.1, 0.6, 0.6, 0.45, leaf, top, x + 3, y);
    if (kind === 'blossom')
      for (let i = 0; i < 6; i++) {
        const r = hash(17, x, y, i);
        box(ctx, P, x - 0.15 + (r % 120) / 100, y + 1, h + 1.15 + ((r >>> 8) % 70) / 100, 0.08, 0.02, 0.08, '#ffffff');
      }
  }

  /** Warmes Licht von oben links, Dunst in der Ferne (oben im Bild) und dunklere Ränder */
  private atmosphere(sc: Scene) {
    const { ctx } = this;
    const sun = ctx.createRadialGradient(
      sc.width * 0.15,
      -sc.height * 0.1,
      0,
      sc.width * 0.15,
      -sc.height * 0.1,
      sc.height * 1.1,
    );
    sun.addColorStop(0, 'rgba(255,236,190,.16)');
    sun.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, sc.width, sc.height);
    const haze = ctx.createLinearGradient(0, 0, 0, sc.height * 0.25);
    haze.addColorStop(0, 'rgba(190,225,245,.2)');
    haze.addColorStop(1, 'rgba(190,225,245,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, sc.width, sc.height * 0.25);
    const edge = ctx.createRadialGradient(
      sc.width / 2,
      sc.height / 2,
      sc.height * 0.45,
      sc.width / 2,
      sc.height / 2,
      sc.width * 0.75,
    );
    edge.addColorStop(0, 'rgba(20,30,40,0)');
    edge.addColorStop(1, 'rgba(20,30,40,.22)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, sc.width, sc.height);
  }

  /** Leben in der Luft: tagsüber Schmetterlinge und Pollen, nachts Glühwürmchen (nicht bei reduzierter Bewegung) */
  private life(sc: Scene) {
    if (sc.reduced) return;
    const { ctx } = this;
    const t = sc.now / 1000;
    if (sc.night < 0.5) {
      const wings = ['#ffffff', '#f2c94c', '#e77fb3', '#8cc6f0'];
      for (let i = 0; i < 5; i++) {
        const x = (((Math.sin(t * 0.13 + i * 2.1) + 1) / 2) * 0.9 + 0.05) * sc.width;
        const y = (((Math.sin(t * 0.17 + i * 1.3) + 1) / 2) * 0.6 + 0.15) * sc.height + Math.sin(t * 3 + i) * 6;
        const flap = Math.sin(t * 14 + i) > 0 ? 1 : 0.4;
        const s = 3 * sc.zoom;
        ctx.fillStyle = wings[i % 4];
        ctx.fillRect(x - s * 2 * flap, y - s, s * 2 * flap, s * 1.6);
        ctx.fillRect(x, y - s, s * 2 * flap, s * 1.6);
        ctx.fillStyle = '#1d2838';
        ctx.fillRect(x - s * 0.3, y - s, s * 0.6, s * 1.8);
      }
      ctx.fillStyle = 'rgba(255,250,220,.7)';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 137.5 + t * (8 + (i % 5) * 3)) % (sc.width + 40)) - 20;
        const y = (((i * 89.3 + Math.sin(t * 0.5 + i) * 30) % sc.height) + sc.height) % sc.height;
        ctx.fillRect(x, y, 2, 2);
      }
    } else {
      for (let i = 0; i < 16; i++) {
        const x = ((Math.sin(t * 0.21 + i * 1.7) + 1) / 2) * sc.width;
        const y = (((Math.sin(t * 0.18 + i * 2.3) + 1) / 2) * 0.7 + 0.25) * sc.height;
        const glow = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.9));
        ctx.fillStyle = `rgba(255,236,120,${(glow * sc.night).toFixed(2)})`;
        ctx.fillRect(x, y, 3 * sc.zoom, 3 * sc.zoom);
        ctx.fillStyle = `rgba(255,236,120,${(glow * 0.25 * sc.night).toFixed(2)})`;
        ctx.fillRect(x - 3 * sc.zoom, y - 3 * sc.zoom, 9 * sc.zoom, 9 * sc.zoom);
      }
    }
  }

  /** Weicher Dunst am Rand des Erkundeten: je mehr Nebel ringsum, desto heller */
  private haze(P: Projection, x: number, y: number, h: number, sc: Scene) {
    let fog = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!sc.explored(x + dx, y + dy)) fog++;
    if (!fog) return;
    const [ax, ay] = P(x, y, h);
    const [bx, by] = P(x + 1, y + 1, h);
    const [, cy] = P(x, y + 1, Math.max(0, h - 2));
    this.ctx.fillStyle = `rgba(214,234,246,${Math.min(0.85, fog / 14).toFixed(2)})`;
    this.ctx.fillRect(ax, ay, bx - ax, Math.max(by, cy) - ay);
  }

  private deco(P: Projection, world: World, state: State, sc: Scene, x: number, y: number) {
    if (!sc.explored(x, y)) return;
    const c = world.cell(x, y);
    const { ctx } = this;
    const h = c.h;
    if (c.tufts) this.tufts(P, x, y, h, c.tufts);
    switch (c.deco) {
      case 'tree':
        this.tree(P, x, y, h, c.tree ?? 'oak');
        break;
      case 'bush':
        this.shadow(P, x + 0.5, y + 0.55, h, 0.42);
        this.leafy(P, x + 0.08, y + 0.12, h, 0.84, 0.76, 0.5, '#3f9a3c', '#5ab651', x, y);
        this.leafy(P, x + 0.2, y + 0.22, h + 0.5, 0.6, 0.56, 0.16, '#3f9a3c', '#5ab651', x, y);
        // rote Beeren vorn und oben, damit man den Busch erkennt (gepflückt: keine, bis sie nachwachsen)
        if (!(`${x},${y}` in state.picked))
          for (const [bx, bz, bh] of [
            [0.2, 0.86, 0.3],
            [0.5, 0.86, 0.18],
            [0.72, 0.86, 0.34],
            [0.3, 0.34, 0.66],
            [0.56, 0.5, 0.66],
          ] as const)
            box(ctx, P, x + bx, y + bz, h + bh, 0.09, 0.06, 0.09, '#c8323a', '#ef5b5b');
        break;
      case 'fern':
        for (const [fx, fy, fh] of [
          [0.3, 0.45, 0.32],
          [0.48, 0.38, 0.4],
          [0.62, 0.5, 0.3],
          [0.42, 0.58, 0.26],
        ] as const)
          box(ctx, P, x + fx - 0.05, y + fy, h, 0.1, 0.06, fh, '#3c8a34', '#58a73a');
        box(ctx, P, x + 0.28, y + 0.42, h + 0.2, 0.44, 0.14, 0.04, '#4f9a3c', '#6dbd47');
        break;
      case 'boulder':
        this.shadow(P, x + 0.5, y + 0.55, h, 0.4);
        box(ctx, P, x + 0.14, y + 0.2, h, 0.72, 0.6, 0.42, '#878c93', '#9aa0a7');
        box(ctx, P, x + 0.26, y + 0.28, h + 0.42, 0.46, 0.38, 0.16, '#8f949b', '#a8adb3');
        box(ctx, P, x + 0.3, y + 0.3, h + 0.58, 0.3, 0.2, 0.03, '#5f9a3c', '#6dbd47');
        break;
      case 'mushroom':
        box(ctx, P, x + 0.44, y + 0.46, h, 0.1, 0.1, 0.16, '#f3efe6');
        box(ctx, P, x + 0.34, y + 0.36, h + 0.16, 0.3, 0.3, 0.1, '#d9473a', '#e0574a');
        box(ctx, P, x + 0.42, y + 0.42, h + 0.26, 0.05, 0.05, 0.01, '#ffffff');
        box(ctx, P, x + 0.54, y + 0.5, h + 0.26, 0.05, 0.05, 0.01, '#ffffff');
        break;
      case 'flower':
        box(ctx, P, x + 0.47, y + 0.47, h, 0.06, 0.06, 0.16, '#3f9a3c');
        box(ctx, P, x + 0.41, y + 0.41, h + 0.16, 0.18, 0.18, 0.1, c.color ?? '#ffffff', '#f2d14b');
        break;
      case 'reed':
        box(ctx, P, x + 0.3, y + 0.5, h, 0.06, 0.06, 0.5, '#5f8f3a');
        box(ctx, P, x + 0.6, y + 0.3, h, 0.06, 0.06, 0.62, '#5f8f3a');
        box(ctx, P, x + 0.59, y + 0.29, h + 0.62, 0.08, 0.08, 0.14, '#7a5432');
        break;
      case 'lily':
        box(ctx, P, x + 0.25, y + 0.3, 0.8, 0.5, 0.4, 0.03, '#4f9a3c', '#6dbd47');
        box(ctx, P, x + 0.45, y + 0.42, 0.83, 0.12, 0.12, 0.06, '#e77fb3');
        break;
      case 'hedge':
      case 'arch':
        this.hedge(P, world, x, y, h, c.deco);
        break;
      case 'fence':
        this.fence(P, world, x, y, h, 1);
        break;
      case 'biggate': {
        // Großes Tor (zu): Holztür mit Eisenbändern, darüber der Torbogen in den Farben seiner Welt
        const theme = THEME_COLORS[c.gate!];
        box(ctx, P, x, y + 0.35, h, 1, 0.3, 4.7, '#6b4423', '#7d5232');
        for (const z of [0.7, 2.3, 3.9]) box(ctx, P, x, y + 0.3, h + z, 1, 0.4, 0.18, '#3a3a44');
        box(ctx, P, x, y + 0.1, h + 4.7, 1, 0.8, 1.2, theme.side, theme.top);
        const [mx, my] = world.gates.get(c.gate!)!.mid;
        if (x === mx && y === my) box(ctx, P, x + 0.3, y + 0.28, h + 2.2, 0.4, 0.04, 0.6, theme.portal); // Zeichen in der Mitte
        break;
      }
      case 'gatetower': {
        const theme = THEME_COLORS[c.part!.id];
        box(ctx, P, x, y, h, 1, 1, 6.6, theme.side, theme.top);
        box(ctx, P, x + 0.3, y + 0.3, h + 6.6, 0.4, 0.4, 0.6, theme.portal);
        break;
      }
      case 'portal': {
        // Portal: Sturz über drei Felder und innen leuchtend, wenn aktiv; am Bett erst nach der Aktivierung
        const id = c.portal!.id;
        const active = state.portals.includes(id);
        if (c.portal!.side === 'home' && !active) break;
        const theme = THEME_COLORS[id];
        const p = world.portals.get(id)!;
        const [fx] = c.portal!.side === 'gate' ? p.gateFacing : p.homeFacing;
        if (active) box(ctx, P, x + 0.1, y + 0.45, h + 0.1, 0.8, 0.1, 3.1, theme.portal);
        if (fx === 0) box(ctx, P, x - 1, y + 0.3, h + 3.4, 3, 0.4, 0.6, theme.side, theme.top);
        else box(ctx, P, x + 0.3, y - 1, h + 3.4, 0.4, 3, 0.6, theme.side, theme.top);
        box(ctx, P, x + 0.35, y + 0.35, h + 4.0, 0.3, 0.3, 0.4, theme.portal);
        break;
      }
      case 'portalside': {
        const { id, side } = c.part!;
        const theme = THEME_COLORS[id];
        if (side === 'home' && !state.portals.includes(id))
          box(ctx, P, x + 0.2, y + 0.2, h, 0.6, 0.6, 0.5, theme.side, theme.top);
        else box(ctx, P, x + 0.15, y + 0.15, h, 0.7, 0.7, 3.4, theme.side, theme.top);
        break;
      }
      case 'cactus':
        box(ctx, P, x + 0.37, y + 0.42, h, 0.26, 0.2, 1.35, '#3f8f3a', '#5aab4a');
        box(ctx, P, x + 0.13, y + 0.45, h + 0.55, 0.14, 0.14, 0.55, '#3f8f3a', '#5aab4a');
        box(ctx, P, x + 0.73, y + 0.45, h + 0.8, 0.14, 0.14, 0.45, '#3f8f3a', '#5aab4a');
        break;
      case 'crystal':
        box(ctx, P, x + 0.36, y + 0.4, h, 0.28, 0.24, 1.15, c.color ?? '#b48cf0');
        box(ctx, P, x + 0.14, y + 0.55, h, 0.2, 0.16, 0.7, c.color ?? '#b48cf0');
        break;
      case 'stalagmite':
        box(ctx, P, x + 0.22, y + 0.3, h, 0.56, 0.5, 0.5, '#2a2c33', '#3c3f47');
        box(ctx, P, x + 0.32, y + 0.38, h + 0.5, 0.36, 0.32, 0.5, '#2a2c33', '#3c3f47');
        box(ctx, P, x + 0.41, y + 0.45, h + 1.0, 0.18, 0.16, 0.45, '#2a2c33', '#3c3f47');
        break;
      case 'bigshroom':
        box(ctx, P, x + 0.36, y + 0.42, h, 0.28, 0.24, 1.4, '#efe4d2', '#f7efe2');
        box(ctx, P, x - 0.25, y - 0.1, h + 1.4, 1.5, 1.2, 0.45, c.color ?? '#d9473a');
        break;
      case 'trough':
      case 'watertrough':
        box(ctx, P, x + 0.05, y + 0.15, h, 0.9, 0.72, 0.48, '#8a5a30', '#a0703f');
        box(
          ctx,
          P,
          x + 0.13,
          y + 0.23,
          h + 0.4,
          0.74,
          0.56,
          0.08,
          c.deco === 'trough' ? '#d9b85a' : '#3f8fd8',
          c.deco === 'trough' ? '#ecd27a' : '#7fc0f0',
        );
        break;
      case 'cloudpuff':
        box(ctx, P, x + 0.15, y + 0.3, h, 0.6, 0.4, 0.3, '#e6eef7', '#ffffff');
        break;
      case 'gate':
        this.fence(P, world, x, y, h, 1 - (sc.gates.get(c.gate!) ?? 0));
        break;
      case 'bridge': {
        const t = sc.gates.get(c.gate!) ?? 0;
        if (t > 0) box(ctx, P, x, y + 0.5 - t / 2, 0.82, 1, t, 0.18, '#a0703f', '#c0915b');
        break;
      }
      case 'bed':
        box(ctx, P, x + 0.06, y + 0.05, h, 0.88, 0.9, 0.28, GAME_COLORS.bed.frame);
        box(ctx, P, x + 0.1, y + 0.08, h + 0.28, 0.8, 0.26, 0.12, GAME_COLORS.bed.pillow);
        if (state.sleeping) {
          box(ctx, P, x + 0.32, y + 0.1, h + 0.4, 0.36, 0.22, 0.3, sc.look.skin);
          box(ctx, P, x + 0.31, y + 0.09, h + 0.62, 0.38, 0.24, 0.1, sc.look.hair);
        }
        box(ctx, P, x + 0.08, y + 0.34, h + 0.28, 0.84, 0.6, state.sleeping ? 0.22 : 0.1, GAME_COLORS.bed.blanket);
        break;
      case 'sign':
        this.sign(P, state, x, y, h, c);
        break;
    }
  }

  /** Hecke um den Garten: Blätterbüsche, die zu Nachbarn mit Hecke verbunden sind; der Rosenbogen ist der Eingang */
  private hedge(P: Projection, world: World, x: number, y: number, h: number, kind: 'hedge' | 'arch') {
    const { ctx } = this;
    const joins = (dx: number, dy: number) => {
      const d = world.cell(x + dx, y + dy).deco;
      return d === 'hedge' || d === 'arch';
    };
    const leaf = '#3f9a3c',
      light = '#5ab651';
    if (kind === 'arch') {
      const vertical = joins(0, -1) || joins(0, 1);
      const posts: [number, number][] = vertical
        ? [
            [0.38, 0.02],
            [0.38, 0.8],
          ]
        : [
            [0.02, 0.38],
            [0.8, 0.38],
          ];
      for (const [px, py] of posts)
        box(ctx, P, x + px, y + py, h, 0.18, 0.18, 1.25, GAME_COLORS.fenceDark, GAME_COLORS.fence);
      if (vertical) box(ctx, P, x + 0.36, y, h + 1.25, 0.22, 1, 0.18, leaf, light);
      else box(ctx, P, x, y + 0.36, h + 1.25, 1, 0.22, 0.18, leaf, light);
      for (let i = 0; i < 4; i++) {
        const t = 0.15 + i * 0.23;
        const [rx, ry] = vertical ? [x + 0.44, y + t] : [x + t, y + 0.44];
        box(ctx, P, rx, ry, h + 1.43, 0.1, 0.1, 0.06, i % 2 ? '#e77fb3' : '#ffffff');
      }
      return;
    }
    if (joins(0, -1)) box(ctx, P, x + 0.2, y, h, 0.6, 0.5, 0.6, leaf, light);
    if (joins(-1, 0)) box(ctx, P, x, y + 0.2, h, 0.5, 0.6, 0.6, leaf, light);
    if (joins(1, 0)) box(ctx, P, x + 0.5, y + 0.2, h, 0.5, 0.6, 0.6, leaf, light);
    if (joins(0, 1)) box(ctx, P, x + 0.2, y + 0.5, h, 0.6, 0.5, 0.6, leaf, light);
    box(ctx, P, x + 0.15, y + 0.15, h, 0.7, 0.7, 0.7, leaf, light);
    if ((x * 31 + y * 17) % 3 === 0) box(ctx, P, x + 0.45, y + 0.5, h + 0.7, 0.1, 0.1, 0.05, '#f2d14b');
  }

  /** Zaun: Pfosten in der Mitte, Latten zu jedem Nachbarn mit Zaun oder Tor. `closed` < 1 öffnet ein Tor. */
  private fence(P: Projection, world: World, x: number, y: number, h: number, closed: number) {
    const { ctx } = this;
    const joins = (dx: number, dy: number) => {
      const n = world.cell(x + dx, y + dy);
      return n.deco === 'fence' || n.deco === 'gate';
    };
    const gate = world.cell(x, y).deco === 'gate';
    const color = GAME_COLORS.fence,
      dark = GAME_COLORS.fenceDark;
    if (gate) {
      // Torflügel: offen klappt er zur Seite weg (wird schmaler)
      const vertical = joins(0, -1) || joins(0, 1);
      if (closed > 0) {
        if (vertical) box(ctx, P, x + 0.42, y + 0.5 - 0.5 * closed, h, 0.16, closed, 0.8, color, dark);
        else box(ctx, P, x + 0.5 - 0.5 * closed, y + 0.42, h, closed, 0.16, 0.8, color, dark);
      }
      return;
    }
    if (joins(0, -1)) box(ctx, P, x + 0.45, y, h + 0.3, 0.1, 0.5, 0.12, color, dark);
    if (joins(-1, 0)) box(ctx, P, x, y + 0.45, h + 0.3, 0.5, 0.1, 0.12, color, dark);
    if (joins(1, 0)) box(ctx, P, x + 0.5, y + 0.45, h + 0.3, 0.5, 0.1, 0.12, color, dark);
    if (joins(0, 1)) box(ctx, P, x + 0.45, y + 0.5, h + 0.3, 0.1, 0.5, 0.12, color, dark);
    box(ctx, P, x + 0.4, y + 0.4, h, 0.2, 0.2, 0.75, color, dark);
  }

  /** Tafel am Tor: Holzbrett, darauf die Tiere der Gegend – getroffene in Farbe, fehlende als Umriss */
  private sign(P: Projection, state: State, x: number, y: number, h: number, c: Cell) {
    const { ctx } = this;
    const gate = GATES.find((g) => g.id === c.sign)!;
    const region = REGIONS.find((r) => r.id === gate.region)!;
    box(ctx, P, x + 0.44, y + 0.44, h, 0.12, 0.12, 0.6, GAME_COLORS.fenceDark);
    const n = region.animals.length;
    const width = Math.max(1, n * 0.55);
    box(ctx, P, x + 0.5 - width / 2, y + 0.38, h + 0.6, width, 0.2, 0.5, GAME_COLORS.board, '#d4a874');
    region.animals.forEach((a, i) => {
      const met = state.met.includes(`${region.id}:${a.species}`);
      const sp = SPECIES[a.species];
      const cx = x + 0.5 - width / 2 + 0.275 + i * 0.55;
      if (!met) ctx.globalAlpha = 0.55;
      drawModel(ctx, P, sp.parts, cx, y + 0.48, h + 1.1, 's', sp.scale * 0.5, met ? undefined : GAME_COLORS.ink);
      ctx.globalAlpha = 1;
    });
  }

  private effects(P: Projection, sc: Scene) {
    const { ctx } = this;
    for (const f of sc.floats) {
      const t = f.age / 1300;
      if (t >= 1) continue;
      const [x, y] = P(f.x + 0.5, f.y + 0.5, f.z);
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      const lift = sc.reduced ? 0 : t * 40 * sc.zoom;
      if (f.kind === 'heart') sprite(ctx, HEART, f.color, x + 14 * sc.zoom, y - lift, 4 * sc.zoom);
      else if (f.kind === 'note') sprite(ctx, NOTE, f.color, x - 14 * sc.zoom, y - lift, 4 * sc.zoom);
      else sprite(ctx, ZZZ, f.color, x + (10 + t * 14) * sc.zoom, y - lift, 4 * sc.zoom);
      ctx.globalAlpha = 1;
    }
    for (const p of sc.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  /** Goldener Abend: warmes Licht von oben, unten schwächer; Zeichen und Leiste liegen darüber und bleiben hell */
  private eveningGlow(sc: Scene) {
    const { ctx } = this;
    const [r, g, b] = GAME_COLORS.evening;
    const glow = ctx.createLinearGradient(0, 0, 0, sc.height);
    glow.addColorStop(0, `rgba(${r},${g},${b},${(0.46 * sc.evening).toFixed(3)})`);
    glow.addColorStop(1, `rgba(${r},${g},${b},${(0.2 * sc.evening).toFixed(3)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, sc.width, sc.height);
  }

  private nightSky(sc: Scene) {
    const { ctx } = this;
    ctx.globalAlpha = sc.night;
    ctx.fillStyle = GAME_COLORS.night;
    ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.fillStyle = GAME_COLORS.star;
    for (let i = 0; i < 46; i++) {
      const x = ((i * 7919) % 1000) / 1000,
        y = ((i * 104729) % 1000) / 1000;
      const twinkle = sc.reduced ? 1 : 0.5 + 0.5 * Math.sin(sc.now / 600 + i);
      const s = (i % 3 === 0 ? 4 : 2) * sc.zoom;
      ctx.globalAlpha = sc.night * (0.4 + 0.6 * twinkle);
      ctx.fillRect(Math.round(x * sc.width), Math.round(y * sc.height * 0.7), s, s);
    }
    // Mondsichel aus zwei Rechtecken
    ctx.globalAlpha = sc.night;
    ctx.fillStyle = GAME_COLORS.star;
    const mx = sc.width * 0.82,
      my = sc.height * 0.16,
      r = 22 * sc.zoom;
    ctx.fillRect(mx - r, my - r, 0.8 * r, 2 * r);
    ctx.fillRect(mx - 0.2 * r, my + 0.4 * r, 1.2 * r, 0.6 * r);
    ctx.globalAlpha = 1;
  }
}
