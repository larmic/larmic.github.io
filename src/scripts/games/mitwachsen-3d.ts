// 3D-Ansicht von Mitwachsen mit Three.js (WebGL). Wird erst beim Spielstart per import() nachgeladen; die Homepage
// lädt sie nie (geprüft vom Bundle-Gate). Liest nur Welt, Zustand und die gleitenden Positionen der Wesen – Regeln
// und Speichern bleiben unverändert. Kann der Browser kein WebGL, bleibt die 2D-Ansicht (mitwachsen-render.ts).
//
// Koordinaten: Welt-x → x, Welt-y (nach vorn/unten) → z, Höhe → y. Ein Feld ist eine Einheit.
// Die Kamera schaut schräg von oben (PITCH) aus Süden auf die Figur; ↑ läuft also vom Betrachter weg.
// Die Welt wird in Stücken zu einem Mesh gebaut: Boden, Zierde und Wasser, alles mit einer Textur-Kachel.

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  GreaterDepth,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene as ThreeScene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CHUNK, chunkOf } from '../../lib/games/chunks';
import type { Dir, Part, Projection } from '../../lib/games/front';
import { hash } from '../../lib/games/rng';
import {
  DIRT,
  GRASS_SIDE,
  GRASS_TOP,
  LEAVES,
  LOG_SIDE,
  LOG_TOP,
  PAL_GRASS,
  PAL_LOG,
  PAL_SHELF,
  PAL_STONE,
  PLANKS,
  STONE,
  type Grid,
  type Palette,
} from '../../lib/voxel/textures';
import { GAME_COLORS, GATES, HOME, REGIONS, SPECIES, figureParts, type Look } from '../../data/games/mitwachsen';
import type { Scene } from './mitwachsen-render';
import type { State } from './mitwachsen-state';
import type { Cell, TreeKind, World } from './mitwachsen-world';

export const PITCH = (55 * Math.PI) / 180; // Neigung der Kamera: 90° wäre senkrecht von oben
const DISTANCE = 18; // Abstand der Kamera zur Figur
const RADIUS = 2; // Stücke um die Figur, die als Mesh vorliegen (5 × 5 = 80 × 80 Felder)
const BUILD_PER_FRAME = 2; // neue Stücke je Bild, damit nichts ruckelt

// ---------- Textur-Kacheln ----------

type Tile =
  'grassTop' | 'grassSide' | 'dirt' | 'stone' | 'sand' | 'path' | 'leaves' | 'log' | 'logTop' | 'planks' | 'white';
const TILES: Tile[] = [
  'grassTop',
  'grassSide',
  'dirt',
  'stone',
  'sand',
  'path',
  'leaves',
  'log',
  'logTop',
  'planks',
  'white',
];
const TPX = 16; // Pixel je Kachel: 8 × 8-Raster mit feiner Körnung in 2 × 2 Unterpixeln
const COLS = 4;
const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };
// Blätter in Grau: Die Baumart färbt sie über die Vertex-Farbe (grün, orange, rosa)
const PAL_LEAVES_GRAY: Palette = {
  F: [['#e6e6e6', 1]],
  f: [['#cccccc', 1]],
  k: [['#ffffff', 1]],
  q: [['#b4b4b4', 1]],
};
const SOURCES: Record<Tile, [Grid, Palette] | null> = {
  grassTop: [GRASS_TOP, PAL_GRASS],
  grassSide: [GRASS_SIDE, PAL_GRASS],
  dirt: [DIRT, PAL_GRASS],
  stone: [STONE, PAL_STONE],
  sand: [DIRT, PAL_SAND],
  path: [DIRT, PAL_PATH],
  leaves: [LEAVES, PAL_LEAVES_GRAY],
  log: [LOG_SIDE, PAL_LOG],
  logTop: [LOG_TOP, PAL_LOG],
  planks: [PLANKS, PAL_SHELF],
  white: null,
};

function atlas(): CanvasTexture {
  const rows = Math.ceil(TILES.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TPX;
  canvas.height = rows * TPX;
  const ctx = canvas.getContext('2d')!;
  TILES.forEach((t, i) => {
    const ox = (i % COLS) * TPX,
      oy = Math.floor(i / COLS) * TPX;
    const src = SOURCES[t];
    if (!src) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, oy, TPX, TPX);
      return;
    }
    const [grid, pal] = src;
    const px = TPX / grid.length;
    grid.forEach((row, r) => {
      for (let c = 0; c < row.length; c++)
        for (const [color, alpha] of pal[row[c]] ?? []) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(ox + c * px, oy + r * px, px, px);
        }
    });
    ctx.globalAlpha = 1;
    // feine Körnung wie in der 2D-Ansicht
    for (let r = 0; r < TPX; r++)
      for (let c = 0; c < TPX; c++) {
        const v = hash(i + 1, c, r) / 4294967296 - 0.5;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${(v * 0.14).toFixed(3)})` : `rgba(0,0,0,${(-v * 0.14).toFixed(3)})`;
        ctx.fillRect(ox + c, oy + r, 1, 1);
      }
  });
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function tileUV(t: Tile): [number, number, number, number] {
  const i = TILES.indexOf(t);
  const rows = Math.ceil(TILES.length / COLS);
  const w = COLS * TPX,
    h = rows * TPX;
  const e = 0.02; // etwas nach innen, damit Nachbarkacheln nicht durchblitzen
  const x = (i % COLS) * TPX,
    y = Math.floor(i / COLS) * TPX;
  return [(x + e) / w, 1 - (y + TPX - e) / h, (x + TPX - e) / w, 1 - (y + e) / h];
}

// ---------- Geometrie aus Quadern und Flächen ----------

type V3 = [number, number, number];
/** Farbe ohne Alphakanal: rgba(…) wird zu rgb(…), Three.js kennt in Vertex-Farben keine Deckkraft */
const col = (c: string | Color) =>
  typeof c === 'string' ? new Color(c.replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, 'rgb($1,$2,$3)')) : c;

class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private rgb: number[] = [];
  private idx: number[] = [];

  /** Viereck a-b-c-d gegen den Uhrzeigersinn von außen gesehen; a-b unten, c-d oben */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, tile: Tile, color: Color) {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = tileUV(tile);
    for (const p of [a, b, c, d]) this.pos.push(...p);
    for (let i = 0; i < 4; i++) {
      this.nor.push(...n);
      this.rgb.push(color.r, color.g, color.b);
    }
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Quader (x, y = Höhe, z) mit Größe (w, h, d); Seiten und Oberseite einzeln einfärb- und texturierbar */
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    side: string | Color,
    top?: string | Color | null,
    tile: Tile = 'white',
    topTile?: Tile,
  ) {
    const s = col(side),
      t = col(top ?? side);
    const [x0, y0, z0, x1, y1, z1] = [x, y, z, x + w, y + h, z + d];
    const tt = topTile ?? tile;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], tt, t);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], tile, s);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], tile, s);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], tile, s);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], tile, s);
  }

  get empty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.rgb), 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Modell aus Teilen (wie in der 2D-Ansicht), mit Blick nach Osten (+x): vorn → x, rechts → z, oben → y */
function modelGeometry(parts: readonly Part[]): BufferGeometry {
  const g = new Geo();
  for (const [f, r, z, fl, rw, h, color, top] of parts) g.box(f, z, r, fl, h, rw, color, top ?? null);
  return g.build();
}
const YAW: Record<Dir, number> = { e: 0, s: -Math.PI / 2, w: Math.PI, n: Math.PI / 2 };

// ---------- Die 3D-Welt ----------

const LEAF: Record<TreeKind, string> = { oak: '#4fa84a', birch: '#7cbf48', autumn: '#e8823a', blossom: '#f0a8c8' };
const SKY = new Color('#9fd6f0');
const NIGHT_SKY = new Color('#141a3a');

type Chunk = { meshes: Mesh[] };

export class World3D {
  private renderer: WebGLRenderer;
  private scene = new ThreeScene();
  private camera = new PerspectiveCamera(34, 1, 0.5, 140);
  private sun = new DirectionalLight('#fff0d4', 2.4);
  private hemi = new HemisphereLight('#cfe9ff', '#5e7f3c', 1.35);
  private solid: MeshLambertMaterial;
  private foliage: MeshLambertMaterial;
  private water = new MeshLambertMaterial({ color: GAME_COLORS.water, transparent: true, opacity: 0.8 });
  private mist = new MeshLambertMaterial({ vertexColors: true }); // Nebel über Unerkundetem
  private explored: (x: number, y: number) => boolean = () => true;
  private dirty = new Set<string>();
  private entity = new MeshLambertMaterial({ vertexColors: true });
  // Umriss der Figur, nur wo sie verdeckt ist (hinter Bäumen, Hecken, Hügeln): Tiefentest umgekehrt
  private xray = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.45,
    depthFunc: GreaterDepth,
    depthWrite: false,
  });
  private ghost: Mesh | null = null;
  private dark = new MeshLambertMaterial({ color: GAME_COLORS.silhouette }); // verlorene Tiere auf den Tafeln
  // Die Figur selbst wird nach ihrem Umriss gezeichnet (beides im durchsichtigen Durchgang): Der Umriss sieht so nur
  // die Welt, nicht die eigenen Körperteile, und die Figur deckt ihn ab, wo sie sichtbar ist
  private hero = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 1 });
  private chunks = new Map<string, Chunk>();
  private models = new Map<string, BufferGeometry>();
  private bodies = new Map<string, Mesh>();
  private signs = new Group();
  private signKey = '';
  private sleeper = new Group();
  private size = { w: 1, h: 1 };
  private world: World | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly look: Look,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    const tex = atlas();
    this.solid = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.foliage = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
    this.scene.background = SKY.clone();
    this.scene.fog = new Fog(SKY.clone(), 26, 58);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.signs, this.sleeper);
  }

  resize(w: number, h: number, dpr: number) {
    this.size = { w, h };
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Alles freigeben, auch den WebGL-Kontext sofort (ältere iPads erlauben nur wenige gleichzeitig) */
  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose(); // Stücke, Tore, Schläfer, Tafeln, Wesen; doppeltes dispose schadet nicht
    });
    for (const g of this.models.values()) g.dispose();
    this.models.clear();
    this.solid.map?.dispose();
    for (const m of [this.solid, this.foliage, this.water, this.mist, this.entity, this.xray, this.hero, this.dark])
      m.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /** Bildschirmpunkt eines Weltpunkts (x, y in Feldern, z = Höhe) – für die 2D-Ebene darüber */
  readonly project: Projection = (x, y, z) => {
    const v = new Vector3(x, z, y).applyMatrix4(this.camera.matrixWorldInverse);
    // Die Kamera schaut entlang −z: Punkte hinter ihr (Bett weit hinter der Figur) auf die Nahebene legen,
    // sonst kippt die Projektion und der Heimweg-Pfeil zeigt in die falsche Richtung
    if (v.z > -this.camera.near) v.z = -this.camera.near;
    v.applyMatrix4(this.camera.projectionMatrix);
    return [((v.x + 1) / 2) * this.size.w, ((1 - v.y) / 2) * this.size.h];
  };

  render(world: World, state: State, sc: Scene) {
    if (this.world !== world) this.reset(world);
    this.explored = sc.explored;
    const cam = sc.cam;
    const tx = cam.x + 0.5,
      tz = cam.y + 0.5;
    const me = sc.bodies.get('player');
    const ty = me ? me.z : 1;
    // Im Hochformat (Handy) weiter weg, damit links und rechts genug Welt zu sehen ist; der Nebel rückt mit
    const dist = DISTANCE * Math.min(1.8, Math.max(1, 0.95 / this.camera.aspect));
    const fog = this.scene.fog as Fog;
    fog.near = dist + 8;
    fog.far = dist + 40;
    this.camera.position.set(tx, ty + dist * Math.sin(PITCH), tz + dist * Math.cos(PITCH));
    this.camera.lookAt(tx, ty, tz);
    // Sonne von links oben vorn; Schatten folgen der Figur
    this.sun.position.set(tx - 9, ty + 22, tz + 7);
    this.sun.target.position.set(tx, ty, tz);
    const day = 1 - sc.night * 0.75;
    this.sun.intensity = 2.4 * day;
    this.hemi.intensity = 1.35 * (1 - sc.night * 0.6);
    const sky = SKY.clone().lerp(NIGHT_SKY, sc.night);
    (this.scene.background as Color).copy(sky);
    fog.color.copy(sky);

    this.syncChunks(world, cam.x, cam.y);
    this.syncBodies(state, sc);
    this.syncSigns(state);
    this.syncSleeper(state);
    this.renderer.render(this.scene, this.camera);
  }

  /** Der Nebel hat sich in diesen Stücken gelichtet: im nächsten Bild neu bauen */
  invalidate(keys: readonly string[]) {
    for (const k of keys) if (this.chunks.has(k)) this.dirty.add(k);
  }

  private reset(world: World) {
    this.world = world;
    for (const c of this.chunks.values())
      for (const m of c.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
    this.chunks.clear();
    this.signKey = '';
  }

  // ---------- Stücke der Welt ----------

  private syncChunks(world: World, x: number, y: number) {
    const [pcx, pcy] = chunkOf(Math.round(x), Math.round(y));
    const want = new Set<string>();
    const missing: [number, number][] = [];
    for (let cy = pcy - RADIUS; cy <= pcy + RADIUS; cy++)
      for (let cx = pcx - RADIUS; cx <= pcx + RADIUS; cx++) {
        const k = `${cx},${cy}`;
        want.add(k);
        if (!this.chunks.has(k)) missing.push([cx, cy]);
      }
    // nächste Stücke zuerst
    missing.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcy) - Math.hypot(b[0] - pcx, b[1] - pcy));
    for (const [cx, cy] of missing.slice(0, BUILD_PER_FRAME))
      this.chunks.set(`${cx},${cy}`, this.buildChunk(world, cx, cy));
    // Gelichteter Nebel: Stück sofort ersetzen, ohne Lücke dazwischen
    for (const k of this.dirty) {
      const old = this.chunks.get(k);
      if (!old) continue;
      const [cx, cy] = k.split(',').map(Number);
      this.chunks.set(k, this.buildChunk(world, cx, cy));
      for (const m of old.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
    }
    this.dirty.clear();
    for (const [k, c] of this.chunks)
      if (!want.has(k)) {
        for (const m of c.meshes) {
          this.scene.remove(m);
          m.geometry.dispose();
        }
        this.chunks.delete(k);
      }
  }

  private buildChunk(world: World, cx: number, cy: number): Chunk {
    const solid = new Geo(),
      leaves = new Geo(),
      water = new Geo(),
      mist = new Geo();
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
        if (!this.explored(x, y)) {
          // Nebel: weiche, helle Wolkenbank mit leicht unruhiger Oberkante
          const r = hash(5, x, y);
          const top = 2.1 + (r % 5) / 10;
          const tint = new Color('#f4f8fb').multiplyScalar(0.94 + ((r >>> 8) % 6) / 100);
          mist.box(x, 0, y, 1, top, 1, tint, tint.clone().multiplyScalar(1.03));
          continue;
        }
        const c = world.cell(x, y);
        this.terrain(solid, water, world, c, x, y);
        this.decoration(solid, leaves, c, x, y);
      }
    const meshes: Mesh[] = [];
    const add = (g: Geo, mat: MeshLambertMaterial, shadows: boolean) => {
      if (g.empty) return;
      const m = new Mesh(g.build(), mat);
      m.castShadow = shadows;
      m.receiveShadow = true;
      this.scene.add(m);
      meshes.push(m);
    };
    add(solid, this.solid, true);
    add(leaves, this.foliage, false);
    add(water, this.water, false);
    if (!mist.empty) {
      const m = new Mesh(mist.build(), this.mist);
      this.scene.add(m);
      meshes.push(m);
    }
    return { meshes };
  }

  private terrain(g: Geo, water: Geo, world: World, c: Cell, x: number, y: number) {
    const heightOf = (n: Cell) => (n.ground === 'water' ? 0 : n.h);
    if (c.ground === 'water') {
      g.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y], [0, 1, 0], 'sand', new Color('#9db0a0'));
      water.quad(
        [x, 0.82, y + 1],
        [x + 1, 0.82, y + 1],
        [x + 1, 0.82, y],
        [x, 0.82, y],
        [0, 1, 0],
        'white',
        new Color('#ffffff'),
      );
      if (c.deco === 'lily') {
        g.box(x + 0.25, 0.83, y + 0.3, 0.5, 0.03, 0.4, '#4f9a3c', '#6dbd47');
        g.box(x + 0.45, 0.86, y + 0.42, 0.12, 0.06, 0.12, '#e77fb3');
      }
      return;
    }
    const h = c.h;
    const stone = c.ground === 'stone';
    const topTile: Tile = stone ? 'stone' : c.ground === 'sand' ? 'sand' : c.ground === 'path' ? 'path' : 'grassTop';
    const sideTop: Tile = stone ? 'stone' : c.ground === 'sand' ? 'sand' : c.ground === 'path' ? 'dirt' : 'grassSide';
    const shade = stone ? 0 : (c.shade ?? 0);
    const tint = new Color(1, 1, 1).multiplyScalar(0.93 + shade * 0.07);
    g.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], topTile, tint);
    const sides: [number, number, V3][] = [
      [0, 1, [0, 0, 1]],
      [0, -1, [0, 0, -1]],
      [1, 0, [1, 0, 0]],
      [-1, 0, [-1, 0, 0]],
    ];
    for (const [dx, dy, n] of sides) {
      const nh = heightOf(world.cell(x + dx, y + dy));
      for (let k = Math.max(0, nh); k < h; k++) {
        const tile: Tile = k === h - 1 ? sideTop : stone ? 'stone' : 'dirt';
        const [y0, y1] = [k, k + 1];
        if (dy === 1) g.quad([x, y0, y + 1], [x + 1, y0, y + 1], [x + 1, y1, y + 1], [x, y1, y + 1], n, tile, tint);
        else if (dy === -1) g.quad([x + 1, y0, y], [x, y0, y], [x, y1, y], [x + 1, y1, y], n, tile, tint);
        else if (dx === 1)
          g.quad([x + 1, y0, y + 1], [x + 1, y0, y], [x + 1, y1, y], [x + 1, y1, y + 1], n, tile, tint);
        else g.quad([x, y0, y], [x, y0, y + 1], [x, y1, y + 1], [x, y1, y], n, tile, tint);
      }
    }
  }

  private decoration(g: Geo, blades: Geo, c: Cell, x: number, y: number) {
    const h = c.h;
    if (c.tufts) this.tufts(blades, x, y, h, c.tufts);
    switch (c.deco) {
      case 'tree':
        this.tree(g, x, y, h, c.tree ?? 'oak');
        break;
      case 'bush':
        g.box(x + 0.08, h, y + 0.12, 0.84, 0.72, 0.76, '#3f9a3c', '#5ab651', 'leaves');
        break;
      case 'flower':
        g.box(x + 0.47, h, y + 0.47, 0.06, 0.18, 0.06, '#3f9a3c');
        g.box(x + 0.4, h + 0.18, y + 0.4, 0.2, 0.1, 0.2, c.color ?? '#ffffff', '#f2d14b');
        break;
      case 'fern':
        for (const [fx, fz, fh] of [
          [0.3, 0.45, 0.34],
          [0.5, 0.36, 0.42],
          [0.62, 0.52, 0.3],
          [0.42, 0.6, 0.28],
        ] as const)
          g.box(x + fx - 0.05, h, y + fz, 0.1, fh, 0.08, '#3c8a34', '#58a73a');
        break;
      case 'boulder':
        g.box(x + 0.14, h, y + 0.2, 0.72, 0.42, 0.6, '#8a8f96', '#9aa0a7', 'stone');
        g.box(x + 0.26, h + 0.42, y + 0.28, 0.46, 0.16, 0.38, '#8f949b', '#6dbd47', 'stone');
        break;
      case 'mushroom':
        g.box(x + 0.44, h, y + 0.46, 0.1, 0.16, 0.1, '#f3efe6');
        g.box(x + 0.33, h + 0.16, y + 0.35, 0.32, 0.12, 0.32, '#d9473a', '#e0574a');
        break;
      case 'reed':
        g.box(x + 0.3, h, y + 0.5, 0.06, 0.55, 0.06, '#5f8f3a');
        g.box(x + 0.6, h, y + 0.3, 0.06, 0.66, 0.06, '#5f8f3a');
        g.box(x + 0.59, h + 0.66, y + 0.29, 0.08, 0.16, 0.08, '#7a5432');
        break;
      case 'fence':
        this.fence(g, x, y, h);
        break;
      case 'biggate':
        this.bigGate(g, x, y, h);
        break;
      case 'hedge':
        g.box(x + 0.08, h, y + 0.08, 0.84, 0.75, 0.84, '#3a8a35', '#4fa84a', 'leaves');
        break;
      case 'arch':
        g.box(x + 0.02, h, y + 0.38, 0.16, 1.3, 0.2, GAME_COLORS.fenceDark, GAME_COLORS.fence);
        g.box(x + 0.82, h, y + 0.38, 0.16, 1.3, 0.2, GAME_COLORS.fenceDark, GAME_COLORS.fence);
        g.box(x, h + 1.3, y + 0.34, 1, 0.2, 0.28, '#3a8a35', '#4fa84a', 'leaves');
        for (let i = 0; i < 4; i++)
          g.box(x + 0.12 + i * 0.22, h + 1.5, y + 0.43, 0.1, 0.07, 0.1, i % 2 ? '#e77fb3' : '#ffffff');
        break;
      case 'bed':
        g.box(x + 0.06, h, y + 0.05, 0.88, 0.28, 0.9, GAME_COLORS.bed.frame, null, 'planks');
        g.box(x + 0.1, h + 0.28, y + 0.08, 0.8, 0.12, 0.26, GAME_COLORS.bed.pillow);
        g.box(x + 0.08, h + 0.28, y + 0.34, 0.84, 0.1, 0.6, GAME_COLORS.bed.blanket);
        break;
      case 'sign':
        g.box(x + 0.44, h, y + 0.44, 0.12, 0.6, 0.12, GAME_COLORS.fenceDark);
        g.box(x - 0.1, h + 0.6, y + 0.4, 1.2, 0.5, 0.18, GAME_COLORS.board, '#d4a874', 'planks');
        break;
    }
  }

  private tufts(blades: Geo, x: number, y: number, h: number, n: number) {
    // Normale nach oben: Halme sind von beiden Seiten gleich hell und nicht schwarz von hinten
    const greens = ['#4f9a3c', '#5fae45', '#6dbd47', '#468f37'].map((c) => new Color(c));
    for (let i = 0; i < n; i++) {
      const r = hash(3, x, y, i);
      const cx = x + 0.15 + (r % 70) / 100,
        cz = y + 0.15 + ((r >>> 8) % 70) / 100;
      const bh = 0.22 + ((r >>> 16) % 8) / 40;
      const s = 0.09;
      const c = greens[r % 4];
      // zwei gekreuzte Halm-Flächen, von beiden Seiten sichtbar
      blades.quad(
        [cx - s, h, cz - s],
        [cx + s, h, cz + s],
        [cx + s, h + bh, cz + s],
        [cx - s, h + bh, cz - s],
        [0, 1, 0],
        'white',
        c,
      );
      blades.quad(
        [cx - s, h, cz + s],
        [cx + s, h, cz - s],
        [cx + s, h + bh * 0.85, cz - s],
        [cx - s, h + bh * 0.85, cz + s],
        [0, 1, 0],
        'white',
        c,
      );
    }
  }

  private tree(g: Geo, x: number, y: number, h: number, kind: TreeKind) {
    const leaf = new Color(LEAF[kind]);
    const top = leaf.clone().lerp(new Color('#ffffff'), 0.18);
    if (kind === 'birch') {
      g.box(x + 0.4, h, y + 0.4, 0.2, 1.6, 0.2, '#e8e4d8', '#f3efe6');
      for (const z of [0.3, 0.75, 1.15]) g.box(x + 0.39, h + z, y + 0.53, 0.22, 0.06, 0.08, '#3a3a44');
      g.box(x + 0.05, h + 1.35, y + 0.05, 0.9, 0.95, 0.9, leaf, top, 'leaves');
      g.box(x + 0.2, h + 2.3, y + 0.2, 0.6, 0.45, 0.6, leaf, top, 'leaves');
      return;
    }
    g.box(x + 0.36, h, y + 0.36, 0.28, 1.3, 0.28, '#7a5432', '#93683f', 'log', 'logTop');
    // runde Krone: Mitte am breitesten, oben kleiner
    g.box(x - 0.1, h + 1.05, y - 0.1, 1.2, 0.55, 1.2, leaf, top, 'leaves');
    g.box(x - 0.4, h + 1.45, y - 0.4, 1.8, 0.8, 1.8, leaf, top, 'leaves');
    g.box(x - 0.15, h + 2.25, y - 0.15, 1.3, 0.55, 1.3, leaf, top, 'leaves');
    g.box(x + 0.15, h + 2.8, y + 0.15, 0.7, 0.35, 0.7, leaf, top, 'leaves');
    if (kind === 'blossom')
      for (let i = 0; i < 8; i++) {
        const r = hash(17, x, y, i);
        g.box(x - 0.35 + (r % 170) / 100, h + 1.5 + ((r >>> 8) % 66) / 100, y + 1.41, 0.09, 0.09, 0.02, '#ffffff');
      }
  }

  /** Großes Tor im Felsen: Holzflügel mit Eisenbändern, oben ein Steinsturz; in der Mitte das Schloss */
  private bigGate(g: Geo, x: number, y: number, h: number) {
    const w = this.world!;
    const isGate = (dx: number, dy: number) => w.cell(x + dx, y + dy).deco === 'biggate';
    const across = isGate(1, 0) || isGate(-1, 0); // Tor liegt quer (Norden, Süden)
    const middle = across ? isGate(1, 0) && isGate(-1, 0) : isGate(0, 1) && isGate(0, -1);
    const iron = '#3a3a44';
    if (across) {
      g.box(x, h, y + 0.35, 1, 2.4, 0.3, '#8a5a30', '#a0703f', 'planks');
      for (const z of [0.5, 1.7]) g.box(x, h + z, y + 0.3, 1, 0.12, 0.4, iron);
      g.box(x - 0.02, h + 2.4, y + 0.2, 1.04, 0.45, 0.6, '#8f949b', '#a8adb3', 'stone');
      if (middle) g.box(x + 0.38, h + 1.0, y + 0.25, 0.24, 0.3, 0.12, iron);
    } else {
      g.box(x + 0.35, h, y, 0.3, 2.4, 1, '#8a5a30', '#a0703f', 'planks');
      for (const z of [0.5, 1.7]) g.box(x + 0.3, h + z, y, 0.4, 0.12, 1, iron);
      g.box(x + 0.2, h + 2.4, y - 0.02, 0.6, 0.45, 1.04, '#8f949b', '#a8adb3', 'stone');
      if (middle) g.box(x + 0.25, h + 1.0, y + 0.38, 0.12, 0.3, 0.24, iron);
    }
  }

  private fence(g: Geo, x: number, y: number, h: number) {
    const w = this.world!;
    const joins = (dx: number, dy: number) => {
      const d = w.cell(x + dx, y + dy).deco;
      return d === 'fence' || d === 'gate';
    };
    const [c, top] = [GAME_COLORS.fence, GAME_COLORS.fenceDark];
    g.box(x + 0.4, h, y + 0.4, 0.2, 0.8, 0.2, c, top, 'planks');
    if (joins(0, -1)) g.box(x + 0.45, h + 0.3, y, 0.1, 0.12, 0.5, c, top, 'planks');
    if (joins(0, 1)) g.box(x + 0.45, h + 0.3, y + 0.5, 0.1, 0.12, 0.5, c, top, 'planks');
    if (joins(-1, 0)) g.box(x, h + 0.3, y + 0.45, 0.5, 0.12, 0.1, c, top, 'planks');
    if (joins(1, 0)) g.box(x + 0.5, h + 0.3, y + 0.45, 0.5, 0.12, 0.1, c, top, 'planks');
  }

  // ---------- Bewegliches: Wesen, Tore, Tafeln, Schläfer ----------

  private model(key: string, parts: readonly Part[]) {
    let g = this.models.get(key);
    if (!g) {
      g = modelGeometry(parts);
      this.models.set(key, g);
    }
    return g;
  }

  private syncBodies(state: State, sc: Scene) {
    const seen = new Set<string>();
    const place = (id: string, geo: BufferGeometry, scale: number, dir: Dir) => {
      const material = id === 'player' ? this.hero : this.entity;
      const b = sc.bodies.get(id);
      if (!b) return;
      seen.add(id);
      let m = this.bodies.get(id);
      if (!m) {
        m = new Mesh(geo, material);
        m.castShadow = true;
        if (id === 'player') m.renderOrder = 11;
        this.scene.add(m);
        this.bodies.set(id, m);
      }
      m.geometry = geo;
      m.scale.setScalar(scale);
      m.position.set(b.x + 0.5, b.z + b.hop, b.y + 0.5);
      m.rotation.y = YAW[dir];
    };
    if (!state.sleeping) place('player', this.model('player', figureParts(this.look)), 1, state.player.dir);
    const me = this.bodies.get('player');
    if (!this.ghost) {
      this.ghost = new Mesh(this.model('player', figureParts(this.look)), this.xray);
      this.ghost.renderOrder = 10;
      this.scene.add(this.ghost);
    }
    this.ghost.visible = !!me && !state.sleeping;
    if (me) {
      this.ghost.position.copy(me.position);
      this.ghost.rotation.copy(me.rotation);
    }
    for (const a of state.animals) {
      const b = sc.bodies.get(a.id);
      if (b && !this.explored(Math.round(b.x), Math.round(b.y))) continue; // Tiere im Nebel bleiben verborgen
      place(a.id, this.model(a.species, SPECIES[a.species].parts), SPECIES[a.species].scale, a.dir);
    }
    for (const [id, m] of this.bodies)
      if (!seen.has(id)) {
        this.scene.remove(m);
        this.bodies.delete(id);
      }
  }

  /** Tiere auf den Tafeln: gefundene in Farbe, verlorene als dunkle Umrisse (neu gebaut, wenn sich etwas ändert) */
  private syncSigns(state: State) {
    const key = state.met.join(',');
    if (key === this.signKey) return;
    this.signKey = key;
    for (const child of [...this.signs.children]) this.signs.remove(child);
    for (const g of GATES) {
      if (!g.sign) continue;
      const sign = g.sign;
      const region = REGIONS.find((r) => r.id === g.region)!;
      const n = region.animals.length;
      region.animals.forEach((a, i) => {
        const met = state.met.includes(`${region.id}:${a.species}`);
        const sp = SPECIES[a.species];
        const m = new Mesh(this.model(a.species, sp.parts), met ? this.entity : this.dark);
        m.scale.setScalar(sp.scale * 0.45);
        m.rotation.y = YAW.s;
        m.position.set(sign[0] + 0.5 + (i - (n - 1) / 2) * 0.42, 2.1, sign[1] + 0.5);
        this.signs.add(m);
      });
    }
  }

  private syncSleeper(state: State) {
    if (!this.sleeper.children.length) {
      const g = new Geo();
      const [x, y] = HOME.bed;
      g.box(x + 0.32, 1.38, y + 0.1, 0.36, 0.3, 0.24, this.look.skin);
      g.box(x + 0.31, 1.62, y + 0.09, 0.38, 0.1, 0.26, this.look.hair);
      g.box(x + 0.1, 1.38, y + 0.36, 0.8, 0.14, 0.56, GAME_COLORS.bed.blanket);
      this.sleeper.add(new Mesh(g.build(), this.entity));
    }
    this.sleeper.visible = state.sleeping;
  }
}
