// Spielregeln von Mitwachsen als reine Zustandsmaschine – ohne DOM, ohne Timer, ohne Math.random.
// Die Web Component (larmic-mitwachsen.ts) schickt Befehle (`move`, `action`, `tick`) an `step` und reagiert auf die
// Ereignisse, die zurückkommen (Töne, Herzen, Speichern). Zufall kommt aus einer Folge im Zustand.
// Spezifikation: docs/specs/mitwachsen.md

import { chunkOf } from '../../lib/games/chunks';
import { DIRS, type Dir } from '../../lib/games/front';
import { hash, nextRandom } from '../../lib/games/rng';
import {
  GATES,
  HOME,
  REGIONS,
  regionAnimalList,
  type GateId,
  type RegionId,
  type SpeciesId,
} from '../../data/games/mitwachsen';
import { canStep, standHeight, wildAnimals, type World } from './mitwachsen-world';

export const SLEEP_LOCK = 30; // Takte nach dem Einschlafen, in denen Tasten nicht wecken (3 s)
export const WAKE_GRACE = 15; // Takte nach dem Aufwachen, in denen das Bett nur ein Hindernis ist (1,5 s)
export const BERRY_REGROW = 300; // Takte, bis an einem Busch neue Beeren hängen (30 s)
export const SWAP_WINDOW = 15; // Takte, in denen zweimal Hineinlaufen den Platz tauscht (1,5 s)
export const WILD_RADIUS = 1; // Stücke um die Figur, in denen Tiere der Landschaft unterwegs sind
export const WILD_KEEP = 2; // ab diesem Abstand verschwinden sie wieder (und tauchen später an ihrem Platz auf)

export type Home = { kind: 'region'; region: RegionId } | { kind: 'wild'; cx: number; cy: number } | { kind: 'garden' };
export type Animal = {
  id: string;
  species: SpeciesId;
  x: number;
  y: number;
  dir: Dir;
  mode: 'wander' | 'follow' | 'home';
  home: Home;
  spawn: readonly [number, number];
  rest: number; // Takte bis zum nächsten Schritt beim Umherlaufen
};
export type HomeAnimal = { id: string; species: SpeciesId };

export type State = {
  tick: number;
  rng: number;
  player: { x: number; y: number; dir: Dir };
  sleeping: boolean;
  sleptAt: number;
  wokeAt: number;
  animals: Animal[];
  followers: string[]; // Reihenfolge = Platz in der Kette hinter der Figur
  met: string[];
  garden: HomeAnimal[];
  openGates: GateId[];
  portals: GateId[]; // aktivierte Portale (je Tor eines, mit Partner über dem Bett)
  lastBump: { id: string; tick: number } | null;
  picked: Record<string, number>; // Büsche ohne Beeren: "x,y" → Takt des Pflückens (nicht gespeichert)
  basket: boolean; // Korb mit Beeren auf dem Rücken (nach dem Pflücken, bis zum Futtertrog)
};

/** Was gespeichert wird */
export type Progress = {
  met: string[];
  garden: HomeAnimal[];
  openGates: GateId[];
  portals: GateId[];
  position: [number, number];
};

export type Cmd = { type: 'move'; dir: Dir } | { type: 'action' } | { type: 'tick' };
export type GameEvent =
  | { type: 'step'; climb: number }
  | { type: 'bump' }
  | { type: 'sing'; id: string; species: SpeciesId; first: boolean }
  | { type: 'follow'; id: string }
  | { type: 'swap'; id: string }
  | { type: 'home'; id: string; species: SpeciesId } // auf der Wiese angekommen
  | { type: 'gate'; id: GateId }
  | { type: 'portal'; id: GateId } // Portal am Tor aktiviert
  | { type: 'teleport'; id: GateId; to: 'gate' | 'home' }
  | { type: 'pick'; x: number; y: number } // Beeren gepflückt
  | { type: 'regrow'; x: number; y: number } // neue Beeren am Busch
  | { type: 'feed'; ids: string[] } // Beeren in den Futtertrog: diese Tiere der Wiese freuen sich
  | { type: 'call' }
  | { type: 'sleep' }
  | { type: 'wake' };

const ALL_DIRS: Dir[] = ['n', 'e', 's', 'w'];
const dirTo = (dx: number, dy: number): Dir =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Darf ein Tier auf diesem Feld umherlaufen? (Folgende Tiere gehen überall hin, wo die Figur war) */

/** Felder an Durchgängen (Tore, Rosenbogen): Dort bleibt kein Tier stehen, sonst versperrt es den Weg */
const passageCache = new WeakMap<World, Set<string>>();
function passages(world: World): Set<string> {
  let set = passageCache.get(world);
  if (!set) {
    const portalSpots = [...world.portals.values()].flatMap((p) => [p.gate, p.gateExit, p.home, p.homeExit]);
    const spots = [...[...world.gates.values()].flatMap((g) => g.cells), ...portalSpots];
    set = new Set(
      spots.flatMap(([x, y]) =>
        [
          [x, y],
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].map(([a, b]) => `${a},${b}`),
      ),
    );
    passageCache.set(world, set);
  }
  return set;
}

function atHome(world: World, home: Home, x: number, y: number): boolean {
  const c = world.cell(x, y);
  if (home.kind === 'garden') return c.garden === true && !passages(world).has(`${x},${y}`);
  if (c.garden || passages(world).has(`${x},${y}`)) return false;
  if (home.kind === 'region') return c.region === home.region;
  const [cx, cy] = chunkOf(x, y);
  return c.region === 'wild' && cx === home.cx && cy === home.cy;
}

const occupied = (s: State, x: number, y: number, except?: string) =>
  (!s.sleeping && s.player.x === x && s.player.y === y) ||
  s.animals.some((a) => a.id !== except && a.x === x && a.y === y);

function random(s: State): number {
  const [v, next] = nextRandom(s.rng);
  s.rng = next;
  return v;
}

// ---------- Aufbau ----------

/** Freie Plätze auf der Wiese ums Bett, gut verteilt (benachbarte Plätze stehen in der Liste weit auseinander) */
const meadowCache = new WeakMap<World, [number, number][]>();
function meadowSpots(world: World): [number, number][] {
  let out = meadowCache.get(world);
  if (!out) {
    out = [];
    const r = HOME.meadow + 1;
    for (let y = HOME.bed[1] - r; y <= HOME.bed[1] + r; y++)
      for (let x = HOME.bed[0] - r; x <= HOME.bed[0] + r; x++)
        if (atHome(world, { kind: 'garden' }, x, y) && standHeight(world, [], x, y) !== null) out.push([x, y]);
    out.sort((a, b) => hash(7, a[0], a[1]) - hash(7, b[0], b[1]));
    meadowCache.set(world, out);
  }
  return out;
}

export function initialState(world: World, saved: Partial<Progress> = {}, rngSeed = 1): State {
  const garden = saved.garden ?? [];
  const atHomeIds = new Set(garden.map((p) => p.id));
  const animals: Animal[] = [];
  for (const r of REGIONS)
    for (const { id, species } of regionAnimalList(r)) {
      const at = world.spawns.get(id); // die Welt kennt den erreichbaren Wohnort
      if (at && !atHomeIds.has(id))
        animals.push({
          id,
          species,
          x: at[0],
          y: at[1],
          dir: 's',
          mode: 'wander',
          home: { kind: 'region', region: r.id },
          spawn: at,
          rest: 5,
        });
    }
  const cells = meadowSpots(world);
  garden.forEach((p, i) => {
    const [x, y] = cells[i % cells.length];
    animals.push({
      id: p.id,
      species: p.species,
      x,
      y,
      dir: 's',
      mode: 'home',
      home: { kind: 'garden' },
      spawn: [x, y],
      rest: 5,
    });
  });
  const s: State = {
    tick: 0,
    rng: rngSeed >>> 0,
    player: { x: HOME.bed[0], y: HOME.bed[1], dir: 's' },
    sleeping: true,
    sleptAt: -SLEEP_LOCK, // die erste Taste weckt sofort
    wokeAt: -WAKE_GRACE,
    animals,
    followers: [],
    met: [...(saved.met ?? [])].sort(),
    garden: [...garden],
    openGates: (saved.openGates ?? []).filter((id) => !GATES.find((g) => g.id === id)?.locked),
    portals: (saved.portals ?? []).filter((id) => world.portals.has(id)),
    lastBump: null,
    picked: {},
    basket: false,
  };
  openGates(s, []); // Tore, deren Tiere schon alle getroffen sind, stehen offen
  syncWild(s, world);
  return s;
}

export const progressOf = (s: State): Progress => ({
  met: [...s.met],
  garden: [...s.garden],
  openGates: [...s.openGates],
  portals: [...s.portals],
  position: [s.player.x, s.player.y],
});

/** Tiere einer Gegend (Kennungen) – ein Tor öffnet, wenn alle davon getroffen sind */
export const regionAnimals = (region: RegionId): string[] =>
  regionAnimalList(REGIONS.find((r) => r.id === region)!).map((a) => a.id);

// ---------- Ein Schritt ----------

export function step(state: State, world: World, cmd: Cmd): { state: State; events: GameEvent[] } {
  // Flache Kopie: Tiere werden beim Ändern ersetzt, nie verändert – alte Zustände bleiben gültig
  const s: State = {
    ...state,
    player: { ...state.player },
    animals: state.animals.map((a) => ({ ...a })),
    followers: [...state.followers],
    met: [...state.met],
    garden: [...state.garden],
    openGates: [...state.openGates],
    portals: [...state.portals],
    picked: { ...state.picked },
  };
  const events: GameEvent[] = [];
  if (cmd.type === 'tick') tick(s, world, events);
  else if (s.sleeping) wake(s, world, events);
  else if (cmd.type === 'move') move(s, world, cmd.dir, events);
  else action(s, world, events);
  return { state: s, events };
}

function tick(s: State, world: World, events: GameEvent[]) {
  s.tick++;
  // Beeren wachsen nach, auch nachts
  for (const [k, at] of Object.entries(s.picked))
    if (s.tick - at >= BERRY_REGROW) {
      delete s.picked[k];
      const [x, y] = k.split(',').map(Number);
      events.push({ type: 'regrow', x, y });
    }
  if (s.sleeping) return; // nachts ist es still
  syncWild(s, world);
  for (const a of s.animals) {
    if (a.mode === 'follow') continue;
    // Gerade heimgekommen: Es läuft zu seinem Platz auf der Wiese
    const arriving = a.mode === 'home' && Math.abs(a.x - a.spawn[0]) + Math.abs(a.y - a.spawn[1]) > 2;
    // Steht die Figur daneben, bleibt das Tier stehen und schaut sie an
    if (!arriving && cheb(a.x, a.y, s.player.x, s.player.y) <= 1) {
      a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
      a.rest = Math.max(a.rest, 5);
      continue;
    }
    if (--a.rest > 0) continue;
    a.rest = arriving ? 3 : 8 + Math.floor(random(s) * 18);
    if (!arriving && random(s) < 0.3) {
      a.dir = ALL_DIRS[Math.floor(random(s) * 4)];
      continue;
    }
    // Außerhalb des Zuhauses (nach einem Platztausch) zieht es heim, sonst läuft es zufällig
    const away = !atHome(world, a.home, a.x, a.y) || arriving;
    const order = away ? [...ALL_DIRS].sort((p, q) => dist(a, p) - dist(a, q)) : [ALL_DIRS[Math.floor(random(s) * 4)]];
    for (const d of order) {
      const [dx, dy] = DIRS[d];
      const tx = a.x + dx,
        ty = a.y + dy;
      a.dir = d;
      if (
        (away || atHome(world, a.home, tx, ty)) &&
        canStep(world, s.openGates, a.x, a.y, tx, ty) &&
        !occupied(s, tx, ty)
      ) {
        a.x = tx;
        a.y = ty;
        break;
      }
    }
  }
}

const dist = (a: Animal, d: Dir) => Math.abs(a.x + DIRS[d][0] - a.spawn[0]) + Math.abs(a.y + DIRS[d][1] - a.spawn[1]);

function move(s: State, world: World, dir: Dir, events: GameEvent[]) {
  const p = s.player;
  p.dir = dir;
  const [dx, dy] = DIRS[dir];
  const tx = p.x + dx,
    ty = p.y + dy;
  if (portal(s, world, tx, ty, events)) return;
  const animal = s.animals.find((a) => a.x === tx && a.y === ty);
  if (animal?.mode === 'wander') {
    // Hineinlaufen reicht: Das Tier singt, freut sich und folgt (die Aktionstaste braucht es dafür nicht)
    s.lastBump = null;
    return sing(s, animal, true, events);
  }
  if (animal) {
    const again = s.lastBump?.id === animal.id && s.tick - s.lastBump.tick <= SWAP_WINDOW;
    const climbable = canStep(world, s.openGates, p.x, p.y, tx, ty);
    if (climbable && (animal.mode === 'follow' || (again && world.cell(p.x, p.y).garden === true))) {
      // Ein folgendes Tier tauscht sofort den Platz (umdrehen geht immer), eines auf der Wiese erst beim zweiten Mal
      animal.x = p.x;
      animal.y = p.y;
      animal.dir = dirTo(-dx, -dy);
      p.x = tx;
      p.y = ty;
      s.lastBump = null;
      events.push({ type: 'swap', id: animal.id });
      bringHome(s, world, events);
      return;
    }
    if (s.animals.some((a) => a.x === tx && a.y === ty)) {
      s.lastBump = { id: animal.id, tick: s.tick };
      sing(s, animal, false, events);
      return;
    }
  }
  // In einen Busch laufen: Die Figur pflückt die Beeren (sie wachsen nach); ohne Beeren ist er nur ein Hindernis
  if (world.cell(tx, ty).deco === 'bush' && !(`${tx},${ty}` in s.picked)) {
    s.picked[`${tx},${ty}`] = s.tick;
    s.basket = true;
    events.push({ type: 'pick', x: tx, y: ty });
    return;
  }
  // Mit vollem Korb in den Futtertrog laufen: Die Beeren kommen hinein, alle Tiere der Wiese freuen sich
  if (s.basket && world.cell(tx, ty).deco === 'trough') {
    s.basket = false;
    events.push({ type: 'feed', ids: s.animals.filter((a) => a.mode === 'home').map((a) => a.id) });
    return;
  }
  // Ins Bett laufen: Die Figur legt sich schlafen (nicht gleich nach dem Aufwachen, sonst schläft sie aus Versehen ein)
  if (world.cell(tx, ty).deco === 'bed' && s.tick - s.wokeAt >= WAKE_GRACE) return sleep(s, world, events);
  if (!canStep(world, s.openGates, p.x, p.y, tx, ty)) {
    events.push({ type: 'bump' });
    return;
  }
  const climb = standHeight(world, s.openGates, tx, ty)! - standHeight(world, s.openGates, p.x, p.y)!;
  const from: [number, number] = [p.x, p.y];
  p.x = tx;
  p.y = ty;
  events.push({ type: 'step', climb });
  // Gänsemarsch: Jedes folgende Tier rückt auf den Platz seines Vordermanns
  let prev = from;
  for (const id of s.followers) {
    const a = s.animals.find((x) => x.id === id)!;
    const old: [number, number] = [a.x, a.y];
    if (old[0] !== prev[0] || old[1] !== prev[1]) a.dir = dirTo(prev[0] - a.x, prev[1] - a.y);
    a.x = prev[0];
    a.y = prev[1];
    prev = old;
  }
  bringHome(s, world, events);
}

/**
 * Wer als folgendes Tier die Wiese ums Bett betritt, ist zu Hause: Es löst sich aus der Kette, singt, bekommt einen
 * eigenen Platz auf der Wiese (dorthin läuft es von selbst) und bleibt für immer dort.
 */
function bringHome(s: State, world: World, events: GameEvent[]) {
  for (const id of [...s.followers]) {
    const a = s.animals.find((x) => x.id === id)!;
    if (!world.cell(a.x, a.y).garden) continue;
    a.mode = 'home';
    a.home = { kind: 'garden' };
    a.rest = 2;
    s.followers = s.followers.filter((f) => f !== id);
    if (!s.garden.some((x) => x.id === id)) s.garden.push({ id, species: a.species });
    // Eigener Platz: ein Platz der Wiese, den noch kein anderes Tier als Platz hat
    const spots = meadowSpots(world);
    const taken = new Set(
      s.animals.filter((o) => o.mode === 'home' && o !== a).map((o) => `${o.spawn[0]},${o.spawn[1]}`),
    );
    const start = Math.floor(random(s) * spots.length);
    for (let k = 0; k < spots.length; k++) {
      const spot = spots[(start + k) % spots.length];
      if (taken.has(`${spot[0]},${spot[1]}`)) continue;
      a.spawn = spot;
      break;
    }
    events.push({ type: 'home', id, species: a.species });
  }
}

/**
 * Portale: In ein inaktives Portal am Tor laufen aktiviert es (auch sein Partner über dem Bett erscheint).
 * In ein aktives Portal laufen bringt die Figur zum Partner; folgende Tiere kommen mit.
 * Ein noch nicht erschienenes Portal über dem Bett ist einfach Wiese. Liefert true, wenn ein Portal gehandelt hat.
 */
function portal(s: State, world: World, x: number, y: number, events: GameEvent[]): boolean {
  const here = world.cell(x, y).portal;
  if (!here) return false;
  const active = s.portals.includes(here.id);
  if (!active) {
    if (here.side === 'home') return false;
    s.portals.push(here.id);
    events.push({ type: 'portal', id: here.id });
    return true;
  }
  const pair = world.portals.get(here.id)!;
  const to = here.side === 'gate' ? 'home' : 'gate';
  const exit = to === 'home' ? pair.homeExit : pair.gateExit;
  const spot = freeNear(s, world, exit, (fx, fy) => !world.cell(fx, fy).portal);
  if (!spot) return false;
  s.player.x = spot[0];
  s.player.y = spot[1];
  s.player.dir = 's';
  s.lastBump = null;
  // Folgende Tiere reisen mit und stellen sich nah hinter die Figur
  for (const id of s.followers) {
    const a = s.animals.find((t) => t.id === id)!;
    const place = freeNear(s, world, spot, (fx, fy) => !world.cell(fx, fy).portal, id);
    if (place) [a.x, a.y] = place;
  }
  events.push({ type: 'teleport', id: here.id, to });
  return true;
}

function action(s: State, world: World, events: GameEvent[]) {
  const p = s.player;
  const [dx, dy] = DIRS[p.dir];
  const fx = p.x + dx,
    fy = p.y + dy;
  const isBed = (x: number, y: number) => x === HOME.bed[0] && y === HOME.bed[1];
  const near = s.animals
    .filter((a) => cheb(a.x, a.y, p.x, p.y) <= 1)
    .sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
  const front = s.animals.find((a) => a.x === fx && a.y === fy);
  if (front) return sing(s, front, true, events);
  if (isBed(fx, fy)) return sleep(s, world, events);
  // Bett daneben: schlafen, außer ein Tier steht näher als das Bett
  const man = (x: number, y: number) => Math.abs(x - p.x) + Math.abs(y - p.y);
  const bedNear = cheb(p.x, p.y, HOME.bed[0], HOME.bed[1]) <= 1;
  if (bedNear && (!near.length || man(near[0].x, near[0].y) >= man(HOME.bed[0], HOME.bed[1])))
    return sleep(s, world, events);
  if (near.length) return sing(s, near[0], true, events);
  events.push({ type: 'call' });
}

/** Tier singt. Beim ersten Mal ist es getroffen; mit `follow` folgt es der Figur, wenn es frei umherläuft. */
function sing(s: State, a: Animal, follow: boolean, events: GameEvent[]) {
  const first = !s.met.includes(a.id);
  a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
  events.push({ type: 'sing', id: a.id, species: a.species, first });
  if (first) {
    s.met = [...s.met, a.id].sort();
    openGates(s, events);
  }
  if (follow && a.mode === 'wander') {
    a.mode = 'follow';
    s.followers.push(a.id);
    events.push({ type: 'follow', id: a.id });
  }
}

/** Tore öffnen, sobald alle Tiere ihrer Gegend getroffen sind; offen bleibt offen */
function openGates(s: State, events: GameEvent[]) {
  for (const g of GATES) {
    if (g.locked || s.openGates.includes(g.id)) continue; // verschlossene Tore öffnen (noch) nicht
    if (regionAnimals(g.region).every((id) => s.met.includes(id))) {
      s.openGates.push(g.id);
      events.push({ type: 'gate', id: g.id });
    }
  }
}

function sleep(s: State, world: World, events: GameEvent[]) {
  s.sleeping = true;
  s.sleptAt = s.tick;
  s.lastBump = null;
  // Folgende Tiere gehen heim: Tiere der Gegenden an ihren Platz, Tiere der Landschaft tauchen dort später wieder auf
  for (const id of s.followers) {
    const a = s.animals.find((x) => x.id === id)!;
    a.mode = 'wander';
    if (a.home.kind === 'wild') {
      s.animals = s.animals.filter((x) => x.id !== id);
      continue;
    }
    const spot = freeNear(s, world, a.spawn, (x, y) => atHome(world, a.home, x, y), id);
    if (spot) [a.x, a.y] = spot;
  }
  s.followers = [];
  s.player.x = HOME.bed[0];
  s.player.y = HOME.bed[1];
  s.player.dir = 's';
  events.push({ type: 'sleep' });
}

function wake(s: State, world: World, events: GameEvent[]) {
  if (s.tick - s.sleptAt < SLEEP_LOCK) return; // wildes Drücken direkt nach dem Einschlafen weckt nicht
  const spot =
    HOME.wake.find(([x, y]) => standHeight(world, s.openGates, x, y) !== null && !occupied(s, x, y)) ??
    freeNear(s, world, HOME.bed, (x, y) => world.cell(x, y).region === 'lichtung');
  if (!spot) return;
  s.sleeping = false;
  s.wokeAt = s.tick;
  s.player.x = spot[0];
  s.player.y = spot[1];
  s.player.dir = 's';
  events.push({ type: 'wake' });
}

/** Nächstes freies Feld (Breitensuche), auf dem man stehen kann und das `ok` erfüllt */
function freeNear(
  s: State,
  world: World,
  from: readonly [number, number],
  ok: (x: number, y: number) => boolean,
  except?: string,
): [number, number] | null {
  const seen = new Set<string>();
  const queue: [number, number][] = [[from[0], from[1]]];
  while (queue.length && seen.size < 600) {
    const [x, y] = queue.shift()!;
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (ok(x, y) && standHeight(world, s.openGates, x, y) !== null && !occupied(s, x, y, except)) return [x, y];
    for (const [dx, dy] of Object.values(DIRS)) queue.push([x + dx, y + dy]);
  }
  return null;
}

/** Tiere der Landschaft in der Nähe der Figur auftauchen lassen, weit entfernte (umherlaufende) vergessen */
function syncWild(s: State, world: World) {
  const [pcx, pcy] = chunkOf(s.player.x, s.player.y);
  s.animals = s.animals.filter((a) => {
    if (a.home.kind !== 'wild' || a.mode !== 'wander') return true;
    return Math.max(Math.abs(a.home.cx - pcx), Math.abs(a.home.cy - pcy)) <= WILD_KEEP;
  });
  const present = new Set([...s.animals.map((a) => a.id), ...s.garden.map((p) => p.id)]);
  for (let cy = pcy - WILD_RADIUS; cy <= pcy + WILD_RADIUS; cy++)
    for (let cx = pcx - WILD_RADIUS; cx <= pcx + WILD_RADIUS; cx++)
      for (const w of wildAnimals(world, cx, cy)) {
        if (present.has(w.id) || occupied(s, w.x, w.y)) continue;
        s.animals.push({
          id: w.id,
          species: w.species,
          x: w.x,
          y: w.y,
          dir: 's',
          mode: 'wander',
          home: { kind: 'wild', cx, cy },
          spawn: [w.x, w.y],
          rest: 5,
        });
      }
}
