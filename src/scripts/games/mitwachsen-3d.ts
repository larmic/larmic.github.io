// 3D-Ansicht von Mitwachsen mit Three.js (WebGL). Wird erst beim Spielstart per import() nachgeladen; die Homepage
// lädt sie nie (geprüft vom Bundle-Gate). Liest nur Welt, Zustand und die gleitenden Positionen der Wesen – Regeln
// und Speichern bleiben unverändert. Kann der Browser kein WebGL, bleibt die 2D-Ansicht (mitwachsen-render.ts).
//
// Koordinaten: Welt-x → x, Welt-y (nach vorn/unten) → z, Höhe → y. Ein Feld ist eine Einheit.
// Die Kamera schaut schräg von oben (PITCH) aus Süden auf die Figur; ↑ läuft also vom Betrachter weg.
// Die Welt wird in Stücken zu einem Mesh gebaut: Boden, Zierde und Wasser, alles mit einer Textur-Kachel.

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
  Vector2,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
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
  GAME_COLORS,
  GATES,
  HOME,
  MOOD_LIGHT,
  REGIONS,
  SPECIES,
  THEME_COLORS,
  figureParts,
  BASKET_PARTS,
  BOOK_PARTS,
  SLEEPY_EYES,
  type GateId,
  type GateTheme,
  type Look,
} from '../../data/games/mitwachsen';
import { Geo, atlas, type Tile, type V3 } from './mitwachsen-geo';
import { grown } from './mitwachsen-growth';
import { gatehouse, parts, portalFrame, swirlCanvas, type Parts } from './mitwachsen-gatehouse';
import type { Scene } from './mitwachsen-render';
import type { State } from './mitwachsen-state';
import type { Cell, TreeKind, World } from './mitwachsen-world';

export const PITCH = (55 * Math.PI) / 180; // Neigung der Kamera: 90° wäre senkrecht von oben
/** Beeren am Busch: [x, Höhe, z] im Feld; oben auf der Kuppe und an der Vorderseite (zur Kamera) */
const BERRIES = [
  [0.3, 0.66, 0.34],
  [0.56, 0.66, 0.5],
  [0.42, 0.66, 0.62],
  [0.2, 0.3, 0.85],
  [0.5, 0.18, 0.85],
  [0.72, 0.34, 0.85],
  [0.05, 0.22, 0.5],
  [0.88, 0.26, 0.4],
] as const;
const DISTANCE = 18; // Abstand der Kamera zur Figur
const RADIUS = 2; // Stücke um die Figur, die als Mesh vorliegen (5 × 5 = 80 × 80 Felder)
const BUILD_PER_FRAME = 2; // neue Stücke je Bild, damit nichts ruckelt
const FOG_N = 128; // Nebel-Maske: 128 × 128 Felder um die Figur (8 × 8 Stücke)

/** Modell aus Teilen (wie in der 2D-Ansicht), mit Blick nach Osten (+x): vorn → x, rechts → z, oben → y */
function modelGeometry(parts: readonly Part[]): BufferGeometry {
  const g = new Geo();
  for (const [f, r, z, fl, rw, h, color, top] of parts) g.box(f, z, r, fl, h, rw, color, top ?? null, 'fur');
  return g.build();
}
const YAW: Record<Dir, number> = { e: 0, s: -Math.PI / 2, w: Math.PI, n: Math.PI / 2 };

// ---------- Die 3D-Welt ----------

const LEAF: Record<TreeKind, string> = {
  oak: '#4fa84a',
  birch: '#7cbf48',
  autumn: '#e8823a',
  red: '#c8452e',
  blossom: '#f0a8c8',
  winter: '#e3ecf1', // Krone voll Schnee
  pine: '#2f6f3a',
  snowpine: '#2f6f3a',
  palm: '#4fa84a',
  dead: '#5d3e21',
};
/** Kacheln der Böden: Oberseite, oberste Seitenkachel, Seiten darunter */
const GROUND_TILES: Record<Exclude<Cell['ground'], 'water' | 'lava' | 'sky'>, [Tile, Tile, Tile]> = {
  grass: ['grassTop', 'grassSide', 'dirt'],
  stone: ['stone', 'stone', 'stone'],
  sand: ['sand', 'sand', 'sand'],
  path: ['path', 'dirt', 'dirt'],
  snow: ['snowTop', 'snowSide', 'dirt'],
  ice: ['ice', 'ice', 'ice'],
  basalt: ['basalt', 'basalt', 'basalt'],
  cave: ['cave', 'cave', 'cave'],
  cloud: ['cloud', 'cloud', 'cloud'],
  moss: ['mossTop', 'mossSide', 'dirt'],
};
const SKY = new Color('#9fd6f0');
const NIGHT_SKY = new Color('#141a3a');
const CLOUD_SKY = new Color('#a9b4bf'); // Himmel bei Wolken und Regen
const HEMI_SKY = '#cfe9ff'; // Himmelslicht von oben

type Chunk = { meshes: Mesh[] };

export class World3D {
  private renderer: WebGLRenderer;
  private scene = new ThreeScene();
  private camera = new PerspectiveCamera(34, 1, 0.5, 140);
  private sun = new DirectionalLight('#fff0d4', 2.4);
  private hemi = new HemisphereLight(HEMI_SKY, '#5e7f3c', 1.35);
  private solid: MeshLambertMaterial;
  private foliage: MeshLambertMaterial;
  private water = new MeshLambertMaterial({ color: GAME_COLORS.water, transparent: true, opacity: 0.8 });
  private explored: (x: number, y: number) => boolean = () => true;
  // Nebel: weiche Maske der erkundeten Felder um die Figur; ein Zusatz im Shader mischt die Welt dort in die
  // Himmelsfarbe. Keine Blöcke: Die Welt verschwindet einfach im Dunst.
  private fogData = new Uint8Array(FOG_N * FOG_N);
  private fogTex = new DataTexture(this.fogData, FOG_N, FOG_N, RedFormat, UnsignedByteType);
  private fogUniforms = {
    mwFogMap: { value: this.fogTex },
    mwFogOrigin: { value: new Vector2(0, 0) },
    mwFogSize: { value: FOG_N },
    mwFogTint: { value: SKY.clone() },
    // Durchblick: Was zwischen Kamera und Figur steht, wird dort halb durchsichtig
    mwEye: { value: new Vector3() },
    mwTarget: { value: new Vector3() },
  };
  private fogDirty = true;
  private fogKey = '';
  private entity = new MeshLambertMaterial({ vertexColors: true });
  private dark = new MeshLambertMaterial({ color: GAME_COLORS.silhouette }); // verlorene Tiere auf den Tafeln
  private lava!: MeshLambertMaterial; // leuchtet auch nachts
  private canopy!: MeshLambertMaterial;
  private gateGroup = new Group(); // Torhäuser
  private gateSolid!: MeshLambertMaterial; // Mauerwerk der Torhäuser und Portale: vor der Figur durchsichtig
  private bright!: MeshBasicMaterial; // leuchtet aus sich selbst: Kristalle, Zeichen, Wasserfälle
  private swirl!: CanvasTexture; // Wirbel in aktiven Portalen
  private portalGroup = new Group();
  private portalParts = new Map<
    GateId,
    { gateInner: Mesh; home: Group; homeInner: Mesh; stubs: Group; sparks: Mesh[]; cell: readonly [number, number] }
  >();
  private chunks = new Map<string, Chunk>();
  private picked: Record<string, number> = {}; // Büsche ohne Beeren (aus den Regeln)
  private day = 0; // Tag der Welt: bestimmt, was nachgewachsen ist
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
    this.canopy = new MeshLambertMaterial({ map: tex, vertexColors: true }); // Laub: wird vor der Figur durchsichtig
    this.lava = new MeshLambertMaterial({
      map: tex,
      vertexColors: true,
      emissive: THEME_COLORS.lava.glow,
      emissiveMap: tex,
      emissiveIntensity: 0.7,
    });
    this.foliage = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
    this.gateSolid = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.bright = new MeshBasicMaterial({ map: tex, vertexColors: true });
    this.swirl = new CanvasTexture(swirlCanvas());
    this.swirl.center.set(0.5, 0.5);
    this.swirl.colorSpace = SRGBColorSpace;
    this.fogTex.magFilter = LinearFilter;
    this.fogTex.minFilter = LinearFilter;
    for (const m of [this.solid, this.foliage, this.water, this.lava, this.bright]) this.withFog(m, false);
    this.withFog(this.canopy, true);
    this.withFog(this.gateSolid, true);
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
    this.scene.add(this.sun, this.sun.target, this.hemi, this.signs, this.sleeper, this.gateGroup, this.portalGroup);
  }

  /**
   * Shader-Zusatz für die Welt:
   * – Nebel: Farbe nach der Beleuchtung je nach Nebel-Maske in die Himmelsfarbe mischen.
   * – Durchblick (nur Laub: Baumkronen, Büsche, Hecken): Nah an der Sichtlinie Kamera → Figur, vor der Figur und auf
   *   Körperhöhe oder darüber werden Pixel im 2 × 2-Muster weggelassen, bis zu drei von vier, zum Rand hin immer
   *   weniger. So sieht man die Figur zwischen vielen Bäumen. Boden und Felsen bleiben fest (unter ihrer Oberfläche
   *   ist nichts, ein Loch zeigte den Himmel).
   */
  private withFog(material: MeshLambertMaterial | MeshBasicMaterial, seeThrough: boolean) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.fogUniforms);
      shader.vertexShader =
        'varying vec3 vMwWorld;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vMwWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader =
        'uniform sampler2D mwFogMap;\nuniform vec2 mwFogOrigin;\nuniform float mwFogSize;\nuniform vec3 mwFogTint;\n' +
        'uniform vec3 mwEye;\nuniform vec3 mwTarget;\nvarying vec3 vMwWorld;\n' +
        shader.fragmentShader
          .replace(
            '#include <clipping_planes_fragment>',
            !seeThrough
              ? '#include <clipping_planes_fragment>'
              : '#include <clipping_planes_fragment>\n' +
                  '  vec3 mwDir = normalize(mwTarget - mwEye);\n' +
                  '  float mwLen = distance(mwTarget, mwEye);\n' +
                  '  float mwT = dot(vMwWorld - mwEye, mwDir);\n' +
                  '  float mwD = distance(vMwWorld, mwEye + mwDir * mwT);\n' +
                  '  if (mwT < mwLen - 0.8 && vMwWorld.y > mwTarget.y - 0.7) {\n' +
                  '    float mwCut = 0.75 * smoothstep(1.7, 0.9, mwD);\n' +
                  '    float mwBayer = (mod(floor(gl_FragCoord.x), 2.0) * 2.0 + mod(floor(gl_FragCoord.y), 2.0)) / 4.0;\n' +
                  '    if (mwBayer < mwCut) discard;\n' +
                  '  }',
          )
          .replace(
            '#include <tonemapping_fragment>',
            'float mwSeen = texture2D(mwFogMap, (vMwWorld.xz - mwFogOrigin) / mwFogSize).r;\n' +
              '  gl_FragColor.rgb = mix(mwFogTint, gl_FragColor.rgb, smoothstep(0.08, 0.92, mwSeen));\n' +
              '#include <tonemapping_fragment>',
          );
    };
    material.customProgramCacheKey = () => (seeThrough ? 'mw-fog-see' : 'mw-fog');
  }

  /** Nebel-Maske neu berechnen: erkundet = 1, dann zweimal weich verwischt (sanfter Übergang über 2–3 Felder) */
  private updateFog(cx: number, cy: number) {
    const [pcx, pcy] = chunkOf(Math.round(cx), Math.round(cy));
    const ox = (pcx - FOG_N / CHUNK / 2) * CHUNK,
      oy = (pcy - FOG_N / CHUNK / 2) * CHUNK;
    const key = `${ox},${oy}`;
    if (!this.fogDirty && key === this.fogKey) return;
    this.fogDirty = false;
    this.fogKey = key;
    let a = new Float32Array(FOG_N * FOG_N);
    for (let j = 0; j < FOG_N; j++)
      for (let i = 0; i < FOG_N; i++) a[j * FOG_N + i] = this.explored(ox + i, oy + j) ? 1 : 0;
    for (let pass = 0; pass < 2; pass++) {
      const b = new Float32Array(FOG_N * FOG_N);
      for (let j = 0; j < FOG_N; j++)
        for (let i = 0; i < FOG_N; i++) {
          let sum = 0,
            n = 0;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = i + di,
                jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= FOG_N || jj >= FOG_N) continue;
              sum += a[jj * FOG_N + ii];
              n++;
            }
          b[j * FOG_N + i] = sum / n;
        }
      a = b;
    }
    for (let k = 0; k < a.length; k++) this.fogData[k] = Math.round(a[k] * 255);
    this.fogTex.needsUpdate = true;
    // Texel i liegt mittig auf Feld ox + i: Ursprung so, dass (x + 0,5 − ox) / N die Texelmitte trifft
    this.fogUniforms.mwFogOrigin.value.set(ox, oy);
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
    for (const m of [this.solid, this.foliage, this.water, this.lava, this.canopy, this.entity, this.dark]) m.dispose();
    this.fogTex.dispose();
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
    this.picked = state.picked;
    if (state.day !== this.day) {
      // ein neuer Tag: Stücke neu bauen, denn es sind Blumen und Pilze nachgewachsen
      this.day = state.day;
      this.rebuild([...this.chunks.keys()]);
    }
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
    this.fogUniforms.mwEye.value.copy(this.camera.position);
    this.fogUniforms.mwTarget.value.set(tx, ty + 0.9, tz);
    // Sonne von links oben vorn; Schatten folgen der Figur
    this.sun.position.set(tx - 9, ty + 22, tz + 7);
    this.sun.target.position.set(tx, ty, tz);
    const day = 1 - sc.night * 0.75;
    const cloud = sc.weather.cloud;
    // Licht der Richtung: Farbe und Helligkeit der Sonne, je näher am Tor, desto mehr
    const light = MOOD_LIGHT[sc.mood.id];
    const m = light ? sc.mood.strength : 0;
    this.sun.color.set('#ffffff').lerp(new Color(light?.color ?? '#ffffff'), m * 0.8);
    this.hemi.color.set(HEMI_SKY).lerp(new Color(light?.color ?? HEMI_SKY), m * 0.5);
    const bright = 1 + ((light?.bright ?? 1) - 1) * m;
    this.sun.intensity = 2.4 * day * (1 - 0.5 * cloud) * bright; // Wolken dämpfen die Sonne
    this.hemi.intensity = 1.35 * (1 - sc.night * 0.6) * (1 - 0.15 * cloud);
    const sky = SKY.clone()
      .lerp(CLOUD_SKY, cloud * 0.75)
      .lerp(NIGHT_SKY, sc.night);
    (this.scene.background as Color).copy(sky);
    this.fogUniforms.mwFogTint.value.copy(sky);
    fog.color.copy(sky);

    this.updateFog(cam.x, cam.y);
    this.syncChunks(world, cam.x, cam.y);
    this.syncBodies(state, sc);
    this.syncSigns(state);
    this.syncSleeper(state);
    this.syncPortals(state, sc);
    this.renderer.render(this.scene, this.camera);
  }

  /** Der Nebel hat sich gelichtet: Maske im nächsten Bild neu berechnen (die Stücke selbst bleiben) */
  invalidate(keys: readonly string[]) {
    if (keys.length) this.fogDirty = true;
  }

  /** Stücke neu bauen (z. B. Beeren gepflückt oder nachgewachsen); sie entstehen im nächsten Bild wieder */
  rebuild(keys: readonly string[]) {
    for (const k of keys) {
      const c = this.chunks.get(k);
      if (!c) continue;
      for (const m of c.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
      this.chunks.delete(k);
    }
  }

  private reset(world: World) {
    this.world = world;
    this.fogDirty = true;
    this.buildGates(world);
    this.buildPortals(world);
    for (const c of this.chunks.values())
      for (const m of c.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
    this.chunks.clear();
    this.signKey = '';
  }

  /** Meshes aus den Teilen eines Torhauses oder Portals, mit dem passenden Material je Teil */
  private meshes(p: Parts): Mesh[] {
    const out: Mesh[] = [];
    for (const [g, mat] of [
      [p.solid, this.gateSolid],
      [p.lava, this.lava],
      [p.bright, this.bright],
      [p.leaves, this.canopy],
    ] as const) {
      if (g.empty) continue;
      const m = new Mesh(g.build(), mat);
      m.castShadow = mat !== this.bright;
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }

  /** Gruppe an der Mitte eines Feldes, gedreht so, dass ihr +z in Richtung `facing` (Welt-x, Welt-y) schaut */
  private place(group: Group, x: number, y: number, h: number, facing: readonly [number, number]) {
    group.position.set(x + 0.5, h, y + 0.5);
    group.rotation.y = Math.atan2(facing[0], facing[1]);
    return group;
  }

  private clear(group: Group) {
    group.traverse((o) => {
      if (o instanceof Mesh && o.geometry !== this.sparkGeo) o.geometry.dispose();
    });
    group.clear();
  }

  /** Die großen Tore: mächtige Torhäuser im Felsring, je Welt geschmückt, zur Lichtung schauend */
  private buildGates(world: World) {
    this.clear(this.gateGroup);
    for (const g of world.gates.values()) {
      const p = parts();
      gatehouse(p, g.id);
      const [mx, my] = g.mid;
      const group = this.place(new Group(), mx, my, world.cell(mx, my).h, [-g.out[0], -g.out[1]]);
      group.add(...this.meshes(p));
      this.gateGroup.add(group);
    }
  }

  private sparkGeo = new BoxGeometry(0.1, 0.1, 0.1);

  /**
   * Portale: Säulen, Sturz und Krone im Thema des Tors; innen dreht sich ein Wirbel, sobald es aktiv ist, und
   * Funken kreisen. Das Portal am Tor steht immer, sein Partner am Bett erscheint mit der Aktivierung (vorher zeigen
   * zwei kleine Sockel, wo es stehen wird).
   */
  private buildPortals(world: World) {
    this.clear(this.portalGroup);
    this.portalParts.clear();
    const inner = (theme: GateTheme) => {
      const m = new Mesh(
        new PlaneGeometry(1.05, 3.05),
        new MeshBasicMaterial({
          map: this.swirl,
          color: THEME_COLORS[theme].portal,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      m.position.set(0, 1.85, 0);
      return m;
    };
    for (const g of GATES) {
      const p = world.portals.get(g.id);
      if (!p) continue;
      const [gx, gy] = p.gate,
        [hx, hy] = p.home;
      const atGate = this.place(new Group(), gx, gy, world.cell(gx, gy).h, p.gateFacing);
      const frame = parts();
      portalFrame(frame, g.theme);
      const gateInner = inner(g.theme);
      atGate.add(...this.meshes(frame), gateInner);
      const home = this.place(new Group(), hx, hy, world.cell(hx, hy).h, p.homeFacing);
      const homeFrame = parts();
      portalFrame(homeFrame, g.theme);
      const homeInner = inner(g.theme);
      home.add(...this.meshes(homeFrame), homeInner);
      const stubs = this.place(new Group(), hx, hy, world.cell(hx, hy).h, p.homeFacing);
      const stubParts = parts();
      portalFrame(stubParts, g.theme, true);
      stubs.add(...this.meshes(stubParts));
      // Funken: kreisen um beide Portale, solange es aktiv ist
      const sparks: Mesh[] = [];
      for (const host of [atGate, home])
        for (let i = 0; i < 6; i++) {
          const spark = new Mesh(
            this.sparkGeo,
            new MeshBasicMaterial({ color: i % 2 ? '#ffffff' : THEME_COLORS[g.theme].portal }),
          );
          spark.userData.phase = i / 6;
          host.add(spark);
          sparks.push(spark);
        }
      this.portalGroup.add(atGate, home, stubs);
      this.portalParts.set(g.id, { gateInner, home, homeInner, stubs, sparks, cell: p.gate });
    }
  }

  private syncPortals(state: State, sc: Scene) {
    const t = sc.now / 1000;
    this.swirl.rotation = sc.reduced ? 0 : -t * 1.6;
    const glow = sc.reduced ? 0.9 : 0.8 + 0.15 * Math.sin(t * 3);
    for (const [id, part] of this.portalParts) {
      const active = state.portals.includes(id);
      part.gateInner.visible = active && this.explored(part.cell[0], part.cell[1]);
      part.home.visible = active;
      part.stubs.visible = !active;
      for (const m of [part.gateInner, part.homeInner]) (m.material as MeshBasicMaterial).opacity = glow;
      for (const spark of part.sparks) {
        spark.visible = active && !sc.reduced;
        const a = (spark.userData.phase as number) * Math.PI * 2 + t * 1.3;
        spark.position.set(Math.cos(a) * 0.8, 1.85 + Math.sin(a * 2 + t) * 1.3, Math.sin(a) * 0.35);
      }
    }
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
      canopy = new Geo(),
      water = new Geo(),
      lava = new Geo(),
      bright = new Geo();
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
        const c = grown(world.seed, this.day, x, y, world.cell(x, y)); // mit allem, was schon nachgewachsen ist
        this.terrain(solid, water, lava, world, c, x, y);
        this.decoration(solid, leaves, canopy, bright, c, x, y);
      }
    const meshes: Mesh[] = [];
    const add = (g: Geo, mat: MeshLambertMaterial | MeshBasicMaterial, shadows: boolean) => {
      if (g.empty) return;
      const m = new Mesh(g.build(), mat);
      m.castShadow = shadows;
      m.receiveShadow = true;
      this.scene.add(m);
      meshes.push(m);
    };
    add(solid, this.solid, true);
    add(canopy, this.canopy, true);
    add(leaves, this.foliage, false);
    add(water, this.water, false);
    add(lava, this.lava, false);
    add(bright, this.bright, false);
    return { meshes };
  }

  private terrain(g: Geo, water: Geo, lava: Geo, world: World, c: Cell, x: number, y: number) {
    // Unter Wolken ist nichts: Ihre Seiten reichen weit hinunter, damit sie über dem Himmel schweben
    const heightOf = (n: Cell) => (n.ground === 'sky' ? -4 : n.ground === 'water' || n.ground === 'lava' ? 0 : n.h);
    if (c.ground === 'sky') return;
    if (c.ground === 'lava') {
      g.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y], [0, 1, 0], 'basalt', new Color('#ffffff'));
      lava.quad(
        [x, 0.6, y + 1],
        [x + 1, 0.6, y + 1],
        [x + 1, 0.6, y],
        [x, 0.6, y],
        [0, 1, 0],
        'lava',
        new Color('#ffffff'),
      );
      return;
    }
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
    const [topTile, sideTop, below] = GROUND_TILES[c.ground];
    const shade = stone ? 0 : (c.shade ?? 0);
    const tint = new Color(1, 1, 1).multiplyScalar(0.93 + shade * 0.07);
    if (c.tint && c.ground === 'grass') tint.multiply(new Color(c.tint)); // Stimmung der Richtung
    g.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], topTile, tint);
    const sides: [number, number, V3][] = [
      [0, 1, [0, 0, 1]],
      [0, -1, [0, 0, -1]],
      [1, 0, [1, 0, 0]],
      [-1, 0, [-1, 0, 0]],
    ];
    for (const [dx, dy, n] of sides) {
      const nh = heightOf(world.cell(x + dx, y + dy));
      for (let k = Math.max(-4, nh); k < h; k++) {
        const tile: Tile = k === h - 1 ? sideTop : below;
        const [y0, y1] = [k, k + 1];
        if (dy === 1) g.quad([x, y0, y + 1], [x + 1, y0, y + 1], [x + 1, y1, y + 1], [x, y1, y + 1], n, tile, tint);
        else if (dy === -1) g.quad([x + 1, y0, y], [x, y0, y], [x, y1, y], [x + 1, y1, y], n, tile, tint);
        else if (dx === 1)
          g.quad([x + 1, y0, y + 1], [x + 1, y0, y], [x + 1, y1, y], [x + 1, y1, y + 1], n, tile, tint);
        else g.quad([x, y0, y], [x, y0, y + 1], [x, y1, y + 1], [x, y1, y], n, tile, tint);
      }
    }
  }

  private decoration(g: Geo, blades: Geo, canopy: Geo, bright: Geo, c: Cell, x: number, y: number) {
    const h = c.h;
    if (c.tufts) this.tufts(blades, x, y, h, c.tufts);
    if (c.roof) this.shelter(g, x, y, h);
    switch (c.deco) {
      case 'tree':
        this.tree(g, canopy, x, y, h, c.tree ?? 'oak');
        break;
      case 'bush':
        // Beerenbusch: niedrig und rund (zwei Stufen), rote Beeren oben und vorn – kein Baumwipfel
        canopy.box(x + 0.08, h, y + 0.12, 0.84, 0.5, 0.76, '#3f9a3c', '#5ab651', 'leaves');
        canopy.box(x + 0.2, h + 0.5, y + 0.22, 0.6, 0.16, 0.56, '#3f9a3c', '#5ab651', 'leaves');
        if (!(`${x},${y}` in this.picked))
          for (const [bx, by, bz] of BERRIES) g.box(x + bx, h + by, y + bz, 0.09, 0.09, 0.09, '#c8323a', '#ef5b5b');
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
      case 'cactus':
        g.box(x + 0.37, h, y + 0.37, 0.26, 1.35, 0.26, '#3f8f3a', '#5aab4a');
        g.box(x + 0.13, h + 0.55, y + 0.42, 0.24, 0.16, 0.16, '#3f8f3a', '#5aab4a');
        g.box(x + 0.13, h + 0.55, y + 0.42, 0.14, 0.55, 0.16, '#3f8f3a', '#5aab4a');
        g.box(x + 0.63, h + 0.8, y + 0.42, 0.24, 0.16, 0.16, '#3f8f3a', '#5aab4a');
        g.box(x + 0.73, h + 0.8, y + 0.42, 0.14, 0.45, 0.16, '#3f8f3a', '#5aab4a');
        g.box(x + 0.44, h + 1.35, y + 0.44, 0.12, 0.1, 0.12, '#f08cc8'); // Blüte
        break;
      case 'crystal': {
        const cc = c.color ?? '#b48cf0';
        bright.box(x + 0.36, h, y + 0.36, 0.28, 1.15, 0.28, cc);
        bright.box(x + 0.14, h, y + 0.5, 0.2, 0.7, 0.2, cc);
        bright.box(x + 0.62, h, y + 0.22, 0.18, 0.55, 0.18, cc);
        break;
      }
      case 'stalagmite':
        g.box(x + 0.22, h, y + 0.22, 0.56, 0.5, 0.56, '#ffffff', null, 'cave');
        g.box(x + 0.32, h + 0.5, y + 0.32, 0.36, 0.5, 0.36, '#ffffff', null, 'cave');
        g.box(x + 0.41, h + 1.0, y + 0.41, 0.18, 0.45, 0.18, '#ffffff', null, 'cave');
        break;
      case 'bigshroom': {
        const cap = c.color ?? '#d9473a';
        g.box(x + 0.36, h, y + 0.36, 0.28, 1.4, 0.28, '#efe4d2', '#f7efe2');
        canopy.box(x - 0.25, h + 1.4, y - 0.25, 1.5, 0.45, 1.5, cap, cap);
        canopy.box(x + 0.05, h + 1.85, y + 0.05, 0.9, 0.25, 0.9, cap, cap);
        for (const [dx, dz] of [
          [0.1, 0.2],
          [0.75, 0.55],
          [0.3, 0.85],
          [0.95, 0.05],
        ])
          canopy.box(x + dx - 0.15, h + 1.86, y + dz - 0.15, 0.2, 0.05, 0.2, '#ffffff');
        break;
      }
      case 'trough':
      case 'watertrough': {
        // Trog aus Holz auf vier Füßchen: Futter (Heu und Möhren) oder Wasser
        for (const [fx, fz] of [
          [0.1, 0.2],
          [0.8, 0.2],
          [0.1, 0.72],
          [0.8, 0.72],
        ])
          g.box(x + fx, h, y + fz, 0.1, 0.12, 0.1, '#7a5432');
        g.box(x + 0.05, h + 0.12, y + 0.15, 0.9, 0.08, 0.72, '#8a5a30', '#a0703f', 'planks');
        g.box(x + 0.05, h + 0.2, y + 0.15, 0.9, 0.28, 0.08, '#8a5a30', '#a0703f', 'planks');
        g.box(x + 0.05, h + 0.2, y + 0.79, 0.9, 0.28, 0.08, '#8a5a30', '#a0703f', 'planks');
        g.box(x + 0.05, h + 0.2, y + 0.23, 0.08, 0.28, 0.56, '#8a5a30', '#a0703f', 'planks');
        g.box(x + 0.87, h + 0.2, y + 0.23, 0.08, 0.28, 0.56, '#8a5a30', '#a0703f', 'planks');
        if (c.deco === 'watertrough') g.box(x + 0.13, h + 0.2, y + 0.23, 0.74, 0.22, 0.56, '#3f8fd8', '#7fc0f0');
        else {
          g.box(x + 0.13, h + 0.2, y + 0.23, 0.74, 0.26, 0.56, '#d9b85a', '#ecd27a'); // Heu
          for (const [fx, fz] of [
            [0.25, 0.35],
            [0.55, 0.5],
            [0.7, 0.3],
          ])
            g.box(x + fx, h + 0.46, y + fz, 0.14, 0.06, 0.06, '#f08a3c'); // Möhren
        }
        break;
      }
      case 'cloudpuff':
        g.box(x + 0.15, h, y + 0.3, 0.5, 0.25, 0.4, '#ffffff', null, 'cloud');
        g.box(x + 0.4, h, y + 0.15, 0.4, 0.35, 0.45, '#ffffff', null, 'cloud');
        break;
      case 'hedge':
        canopy.box(x + 0.08, h, y + 0.08, 0.84, 0.75, 0.84, '#3a8a35', '#4fa84a', 'leaves');
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

  private tree(g: Geo, canopy: Geo, x: number, y: number, h: number, kind: TreeKind) {
    const leaf = new Color(LEAF[kind]);
    const top = leaf.clone().lerp(new Color('#ffffff'), 0.18);
    if (kind === 'pine' || kind === 'snowpine') {
      // Tanne: drei Stufen, oben schmaler; die Schneetanne mit weißen Hauben
      g.box(x + 0.4, h, y + 0.4, 0.2, 0.7, 0.2, '#7a5432', '#93683f', 'log', 'logTop');
      const layers = [
        [-0.25, 0.5, 1.5],
        [0.0, 1.2, 1.0],
        [0.2, 1.8, 0.6],
      ] as const;
      for (const [o, yy, w] of layers) {
        canopy.box(x + o, h + yy, y + o, w, 0.6, w, leaf, top, 'leaves');
        if (kind === 'snowpine')
          canopy.box(x + o + 0.05, h + yy + 0.6, y + o + 0.05, w - 0.1, 0.12, w - 0.1, '#ffffff');
      }
      return;
    }
    if (kind === 'palm') {
      // Palme: leicht schräger Stamm aus Stücken, oben Wedel im Kreuz und Kokosnüsse
      for (let i = 0; i < 5; i++)
        g.box(x + 0.38 + i * 0.04, h + i * 0.42, y + 0.38, 0.22, 0.42, 0.22, '#a77c46', '#c9a066', 'log', 'logTop');
      const tx = x + 0.58,
        ty = h + 2.1;
      canopy.box(tx - 1.1, ty, y + 0.38, 2.4, 0.14, 0.32, leaf, top, 'leaves');
      canopy.box(tx - 0.08, ty, y - 0.62, 0.32, 0.14, 2.3, leaf, top, 'leaves');
      canopy.box(tx - 0.3, ty + 0.12, y + 0.18, 0.76, 0.2, 0.72, leaf, top, 'leaves');
      // Wedelspitzen hängen nach unten
      canopy.box(tx - 1.3, ty - 0.3, y + 0.4, 0.3, 0.32, 0.28, leaf, top, 'leaves');
      canopy.box(tx + 1.25, ty - 0.3, y + 0.4, 0.3, 0.32, 0.28, leaf, top, 'leaves');
      canopy.box(tx - 0.06, ty - 0.3, y - 0.85, 0.28, 0.32, 0.3, leaf, top, 'leaves');
      canopy.box(tx - 0.06, ty - 0.3, y + 1.65, 0.28, 0.32, 0.3, leaf, top, 'leaves');
      g.box(tx - 0.12, ty - 0.2, y + 0.42, 0.16, 0.16, 0.16, '#6b4423');
      g.box(tx + 0.12, ty - 0.2, y + 0.58, 0.16, 0.16, 0.16, '#6b4423');
      return;
    }
    if (kind === 'dead') {
      // kahler Baum in den Lavabergen
      g.box(x + 0.4, h, y + 0.4, 0.2, 1.5, 0.2, '#4a3426', '#5d3e21');
      g.box(x + 0.15, h + 0.9, y + 0.45, 0.3, 0.1, 0.1, '#4a3426');
      g.box(x + 0.6, h + 1.15, y + 0.45, 0.3, 0.1, 0.1, '#4a3426');
      g.box(x + 0.15, h + 0.9, y + 0.45, 0.1, 0.4, 0.1, '#4a3426');
      return;
    }
    if (kind === 'birch') {
      g.box(x + 0.4, h, y + 0.4, 0.2, 1.6, 0.2, '#e8e4d8', '#f3efe6');
      for (const z of [0.3, 0.75, 1.15]) g.box(x + 0.39, h + z, y + 0.53, 0.22, 0.06, 0.08, '#3a3a44');
      canopy.box(x + 0.05, h + 1.35, y + 0.05, 0.9, 0.95, 0.9, leaf, top, 'leaves');
      canopy.box(x + 0.2, h + 2.3, y + 0.2, 0.6, 0.45, 0.6, leaf, top, 'leaves');
      return;
    }
    g.box(x + 0.36, h, y + 0.36, 0.28, 1.3, 0.28, '#7a5432', '#93683f', 'log', 'logTop');
    // runde Krone: Mitte am breitesten, oben kleiner
    canopy.box(x - 0.1, h + 1.05, y - 0.1, 1.2, 0.55, 1.2, leaf, top, 'leaves');
    canopy.box(x - 0.4, h + 1.45, y - 0.4, 1.8, 0.8, 1.8, leaf, top, 'leaves');
    canopy.box(x - 0.15, h + 2.25, y - 0.15, 1.3, 0.55, 1.3, leaf, top, 'leaves');
    canopy.box(x + 0.15, h + 2.8, y + 0.15, 0.7, 0.35, 0.7, leaf, top, 'leaves');
    if (kind === 'blossom')
      for (let i = 0; i < 8; i++) {
        const r = hash(17, x, y, i);
        canopy.box(x - 0.35 + (r % 170) / 100, h + 1.5 + ((r >>> 8) % 66) / 100, y + 1.41, 0.09, 0.09, 0.02, '#ffffff');
      }
  }

  /** Großes Tor im Felsen: Holzflügel mit Eisenbändern, oben ein Steinsturz; in der Mitte das Schloss */
  /**
   * Unterstand auf der Wiese, Feld für Feld: Pfosten an den Ecken, Balken vorn und hinten, ein leicht schräges
   * Lattendach mit Lücken (hinten höher). Durch die Lücken sieht man die Tiere darunter auch von schräg oben.
   */
  private shelter(g: Geo, x: number, y: number, h: number) {
    const { x0, y0, x1, y1 } = HOME.shelter;
    const wood = '#8a5a30',
      woodTop = '#a0703f',
      straw = '#d9b85a',
      strawTop = '#ecd27a';
    const top = (yy: number) => h + 2.25 - (yy - y0) * 0.16; // Dachhöhe an der Stelle yy
    for (const [cx, cy] of [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ])
      if (x === cx && y === cy) {
        const px = x === x0 ? x + 0.05 : x + 0.77,
          pz = y === y0 ? y + 0.05 : y + 0.77;
        g.box(px, h, pz, 0.18, top(pz) - h, 0.18, wood, woodTop, 'planks');
      }
    if (y === y0) g.box(x, top(y + 0.1) - 0.18, y + 0.05, 1, 0.16, 0.16, wood, woodTop, 'planks');
    if (y === y1) g.box(x, top(y + 0.85) - 0.18, y + 0.79, 1, 0.16, 0.16, wood, woodTop, 'planks');
    for (let k = 0; k < 2; k++) {
      const sx = x + 0.1 + k * 0.5; // breite Lücken: Man sieht die Tiere darunter
      for (let j = 0; j < 4; j++) {
        const sz = y + j * 0.25;
        g.box(sx, top(sz + 0.12), sz, 0.22, 0.07, 0.25, straw, strawTop);
      }
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
      const b = sc.bodies.get(id);
      if (!b) return;
      seen.add(id);
      let m = this.bodies.get(id);
      if (!m) {
        m = new Mesh(geo, this.entity);
        m.castShadow = true;
        this.scene.add(m);
        this.bodies.set(id, m);
      }
      m.geometry = geo;
      m.scale.setScalar(scale);
      m.position.set(b.x + 0.5, b.z + b.hop, b.y + 0.5);
      m.rotation.y = YAW[dir];
    };
    if (!state.sleeping) {
      // Korb auf dem Rücken, Buch beim Lesen; beim Lesen schaut die Figur zum Betrachter
      const book = sc.pose !== 'stand';
      const doze = sc.pose === 'doze';
      const turning = sc.pose === 'read' && !sc.reduced && sc.now % 5000 < 450; // alle paar Sekunden umblättern
      const key = `player${state.basket ? '-basket' : ''}${book ? '-book' : ''}${turning ? '-turn' : ''}${doze ? '-doze' : ''}`;
      const parts = [
        ...figureParts(this.look),
        ...(state.basket ? BASKET_PARTS : []),
        ...(book ? BOOK_PARTS(this.look, turning) : []),
        ...(doze ? SLEEPY_EYES(this.look) : []),
      ];
      place('player', this.model(key, parts), 1, book ? 's' : state.player.dir);
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
