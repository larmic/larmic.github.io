// Zeichnet threeyear in ein Canvas: Welt von vorn, Reihe für Reihe von hinten nach vorn, dazu Tiere, Figur,
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
  HOME,
  REGIONS,
  SPECIES,
  figureParts,
  type GateId,
  type Look,
} from '../../data/games/threeyear';
import type { State } from './threeyear-state';
import type { Cell, World } from './threeyear-world';

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
  floats: Float[];
  particles: Particle[];
  now: number;
  look: Look;
};

const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };

const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const NOTE = ['..kkkk', '..k..k', '..k..k', 'kkk.kk', 'kkk.kk'];
const ZZZ = ['zzzz', '..z.', '.z..', 'zzzz'];

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
    const followers = new Set(state.followers);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.ground(P, world, x, y);
      for (let x = x0; x <= x1; x++) this.deco(P, world, state, sc, x, y);
      const ids = (rows.get(y) ?? []).sort((a, b) => sc.bodies.get(a)!.x - sc.bodies.get(b)!.x);
      for (const id of ids) {
        const b = sc.bodies.get(id)!;
        if (id === 'player') {
          drawModel(ctx, P, figureParts(sc.look), b.x + 0.5, b.y + 0.5, b.z + b.hop, state.player.dir, 1);
          continue;
        }
        const a = byId.get(id);
        if (!a) continue;
        const sp = SPECIES[a.species];
        drawModel(ctx, P, sp.parts, b.x + 0.5, b.y + 0.5, b.z + b.hop, a.dir, sp.scale);
        if (followers.has(id)) {
          const [hx, hy] = P(b.x + 0.5, b.y + 0.5, b.z + b.hop + 1.05);
          sprite(ctx, HEART, GAME_COLORS.heart, hx, hy, 2.5 * z);
        }
      }
    }

    // Die Figur noch einmal halb durchsichtig obenauf: Steht sie hinter einem Hügel oder Baum, bleibt sie sichtbar
    const me = sc.bodies.get('player');
    if (me && !state.sleeping) {
      ctx.globalAlpha = 0.35;
      drawModel(ctx, P, figureParts(sc.look), me.x + 0.5, me.y + 0.5, me.z + me.hop, state.player.dir, 1);
      ctx.globalAlpha = 1;
    }

    this.effects(P, sc);
    this.homeArrow(P, state, sc);
    if (sc.night > 0) this.nightSky(sc);
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
  private ground(P: Projection, world: World, x: number, y: number) {
    const c = world.cell(x, y);
    if (c.ground === 'water') return this.water(P, x, y);
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
  }

  private water(P: Projection, x: number, y: number) {
    const [ax, ay] = P(x, y, 0.8);
    const [bx, by] = P(x + 1, y + 1, 0.8);
    this.ctx.fillStyle = GAME_COLORS.water;
    this.ctx.fillRect(ax, ay, bx - ax + 0.5, by - ay + 0.5);
    this.ctx.fillStyle = GAME_COLORS.waterLight;
    const w = bx - ax;
    this.ctx.fillRect(ax + w * 0.15, ay + (by - ay) * 0.3, w * 0.3, 2);
    this.ctx.fillRect(ax + w * 0.55, ay + (by - ay) * 0.7, w * 0.25, 2);
  }

  private deco(P: Projection, world: World, state: State, sc: Scene, x: number, y: number) {
    const c = world.cell(x, y);
    const { ctx } = this;
    const h = c.h;
    switch (c.deco) {
      case 'tree':
        box(ctx, P, x + 0.36, y + 0.36, h, 0.28, 0.28, 1.1, '#7a5432', '#93683f');
        this.img(P, this.blocks.leaves, x, y, h + 2.1);
        break;
      case 'bush':
        this.img(P, this.blocks.leaves, x, y, h + 1);
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
      case 'fence':
        this.fence(P, world, x, y, h, 1);
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
      const lift = t * 40 * sc.zoom;
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

  /** Pfeil am Bildschirmrand zum Bett, sobald es nicht mehr zu sehen ist */
  private homeArrow(P: Projection, state: State, sc: Scene) {
    if (state.sleeping) return;
    const [bx, by] = P(HOME.bed[0] + 0.5, HOME.bed[1] + 0.5, 1);
    const m = 40 * sc.zoom;
    const top = 70 + 20 * sc.zoom; // unter Zurück, Name und Menü sieht man das Bett nicht
    if (bx > m && bx < sc.width - m && by > top && by < sc.height - m) return;
    const cx = sc.width / 2,
      cy = sc.height / 2;
    const ang = Math.atan2(by - cy, bx - cx);
    // Auf den Rand der Fläche projizieren
    const sx = (sc.width / 2 - m) / Math.abs(Math.cos(ang) || 1e-6);
    const sy = (Math.sin(ang) < 0 ? cy - top : sc.height - m - cy) / Math.abs(Math.sin(ang) || 1e-6);
    const r = Math.min(sx, sy);
    const bob = Math.sin(sc.now / 250) * 4 * sc.zoom;
    const ax = cx + Math.cos(ang) * (r + bob),
      ay = cy + Math.sin(ang) * (r + bob);
    const { ctx } = this;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    const s = 18 * sc.zoom;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.6, -s * 0.8);
    ctx.lineTo(-s * 0.2, 0);
    ctx.lineTo(-s * 0.6, s * 0.8);
    ctx.closePath();
    ctx.fillStyle = GAME_COLORS.arrow;
    ctx.strokeStyle = GAME_COLORS.ink;
    ctx.lineWidth = 3 * sc.zoom;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
      const twinkle = 0.5 + 0.5 * Math.sin(sc.now / 600 + i);
      const s = (i % 3 === 0 ? 4 : 2) * sc.zoom;
      ctx.globalAlpha = sc.night * (0.4 + 0.6 * twinkle);
      ctx.fillRect(Math.round(x * sc.width), Math.round(y * sc.height * 0.7), s, s);
    }
    // Mond
    ctx.globalAlpha = sc.night;
    ctx.fillStyle = GAME_COLORS.star;
    const mx = sc.width * 0.82,
      my = sc.height * 0.16,
      r = 22 * sc.zoom;
    ctx.fillRect(mx - r, my - r, 2 * r, 2 * r);
    ctx.fillStyle = GAME_COLORS.night;
    ctx.fillRect(mx - r * 0.2, my - r, r * 1.2, r * 1.4);
    ctx.globalAlpha = 1;
  }
}
