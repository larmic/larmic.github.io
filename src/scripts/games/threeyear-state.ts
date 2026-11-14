// Spielregeln von threeyear als reine Zustandsmaschine – ohne DOM, ohne Timer, ohne Math.random.
// Die Web Component (larmic-threeyear.ts) schickt Befehle (`move`, `action`, `tick`) an `step` und reagiert auf die
// Ereignisse, die zurückkommen (Töne, Herzen, Speichern). Zufall kommt aus einer Folge im Zustand.
// Spezifikation: docs/specs/threeyear.md

import { chunkOf } from '../../lib/games/chunks';
import { DIRS, type Dir } from '../../lib/games/front';
import { nextRandom } from '../../lib/games/rng';
import { GATES, HOME, REGIONS, animalId, type GateId, type RegionId, type SpeciesId } from '../../data/games/threeyear';
import { canStep, standHeight, wildAnimals, type World } from './threeyear-world';

export const SLEEP_LOCK = 30; // Takte nach dem Einschlafen, in denen Tasten nicht wecken (3 s)
export const SWAP_WINDOW = 15; // Takte, in denen zweimal Hineinlaufen den Platz tauscht (1,5 s)
export const WILD_RADIUS = 1; // Stücke um die Figur, in denen Tiere der Landschaft unterwegs sind
export const WILD_KEEP = 2; // ab diesem Abstand verschwinden sie wieder (und tauchen später an ihrem Platz auf)

export type Home = { kind: 'region'; region: RegionId } | { kind: 'wild'; cx: number; cy: number } | { kind: 'pen' };
export type Animal = {
  id: string;
  species: SpeciesId;
  x: number;
  y: number;
  dir: Dir;
  mode: 'wander' | 'follow' | 'pen';
  home: Home;
  spawn: readonly [number, number];
  rest: number; // Takte bis zum nächsten Schritt beim Umherlaufen
};
export type PenAnimal = { id: string; species: SpeciesId };

export type State = {
  tick: number;
  rng: number;
  player: { x: number; y: number; dir: Dir };
  sleeping: boolean;
  sleptAt: number;
  animals: Animal[];
  followers: string[]; // Reihenfolge = Platz in der Kette hinter der Figur
  met: string[];
  pen: PenAnimal[];
  openGates: GateId[];
  lastBump: { id: string; tick: number } | null;
};

/** Was gespeichert wird */
export type Progress = { met: string[]; pen: PenAnimal[]; openGates: GateId[]; position: [number, number] };

export type Cmd = { type: 'move'; dir: Dir } | { type: 'action' } | { type: 'tick' };
export type GameEvent =
  | { type: 'step'; climb: number }
  | { type: 'bump' }
  | { type: 'sing'; id: string; species: SpeciesId; first: boolean }
  | { type: 'follow'; id: string }
  | { type: 'swap'; id: string }
  | { type: 'pen'; id: string }
  | { type: 'gate'; id: GateId }
  | { type: 'call' }
  | { type: 'sleep' }
  | { type: 'wake' };

const ALL_DIRS: Dir[] = ['n', 'e', 's', 'w'];
const dirTo = (dx: number, dy: number): Dir =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Darf ein Tier auf diesem Feld umherlaufen? (Folgende Tiere gehen überall hin, wo die Figur war) */
function atHome(world: World, home: Home, x: number, y: number): boolean {
  const c = world.cell(x, y);
  if (home.kind === 'pen') return c.pen === true;
  if (c.pen || c.penGate) return false;
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

const penCells = () => {
  const out: [number, number][] = [];
  for (let y = HOME.pen.y0; y <= HOME.pen.y1; y++) for (let x = HOME.pen.x0; x <= HOME.pen.x1; x++) out.push([x, y]);
  return out;
};

export function initialState(world: World, saved: Partial<Progress> = {}, rngSeed = 1): State {
  const pen = saved.pen ?? [];
  const inPen = new Set(pen.map((p) => p.id));
  const animals: Animal[] = [];
  for (const r of REGIONS)
    for (const { species, at } of r.animals) {
      const id = animalId(r.id, species);
      if (!inPen.has(id))
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
  const cells = penCells();
  pen.forEach((p, i) => {
    const [x, y] = cells[i % cells.length];
    animals.push({
      id: p.id,
      species: p.species,
      x,
      y,
      dir: 's',
      mode: 'pen',
      home: { kind: 'pen' },
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
    animals,
    followers: [],
    met: [...(saved.met ?? [])].sort(),
    pen: [...pen],
    openGates: [...(saved.openGates ?? [])],
    lastBump: null,
  };
  openGates(s, []); // Tore, deren Tiere schon alle getroffen sind, stehen offen
  syncWild(s, world);
  return s;
}

export const progressOf = (s: State): Progress => ({
  met: [...s.met],
  pen: [...s.pen],
  openGates: [...s.openGates],
  position: [s.player.x, s.player.y],
});

/** Tiere einer Gegend (Kennungen) – ein Tor öffnet, wenn alle davon getroffen sind */
export const regionAnimals = (region: RegionId): string[] =>
  REGIONS.find((r) => r.id === region)!.animals.map((a) => animalId(region, a.species));

// ---------- Ein Schritt ----------

export function step(state: State, world: World, cmd: Cmd): { state: State; events: GameEvent[] } {
  // Flache Kopie: Tiere werden beim Ändern ersetzt, nie verändert – alte Zustände bleiben gültig
  const s: State = {
    ...state,
    player: { ...state.player },
    animals: state.animals.map((a) => ({ ...a })),
    followers: [...state.followers],
    met: [...state.met],
    pen: [...state.pen],
    openGates: [...state.openGates],
  };
  const events: GameEvent[] = [];
  if (cmd.type === 'tick') tick(s, world);
  else if (s.sleeping) wake(s, world, events);
  else if (cmd.type === 'move') move(s, world, cmd.dir, events);
  else action(s, world, events);
  return { state: s, events };
}

function tick(s: State, world: World) {
  s.tick++;
  if (s.sleeping) return; // nachts ist es still
  syncWild(s, world);
  for (const a of s.animals) {
    if (a.mode === 'follow') continue;
    // Steht die Figur daneben, bleibt das Tier stehen und schaut sie an
    if (cheb(a.x, a.y, s.player.x, s.player.y) <= 1) {
      a.dir = dirTo(s.player.x - a.x, s.player.y - a.y);
      a.rest = Math.max(a.rest, 5);
      continue;
    }
    if (--a.rest > 0) continue;
    a.rest = 8 + Math.floor(random(s) * 18);
    if (random(s) < 0.3) {
      a.dir = ALL_DIRS[Math.floor(random(s) * 4)];
      continue;
    }
    // Außerhalb des Zuhauses (nach einem Platztausch) zieht es heim, sonst läuft es zufällig
    const away = !atHome(world, a.home, a.x, a.y);
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
  const animal = s.animals.find((a) => a.x === tx && a.y === ty);
  if (animal) {
    const again = s.lastBump?.id === animal.id && s.tick - s.lastBump.tick <= SWAP_WINDOW;
    const fits =
      (animal.mode !== 'pen' || world.cell(p.x, p.y).pen === true) && canStep(world, s.openGates, p.x, p.y, tx, ty);
    if (again && fits) {
      // Zweimal hineingelaufen: Platz tauschen, so bleibt die Figur nie stecken
      animal.x = p.x;
      animal.y = p.y;
      animal.dir = dirTo(-dx, -dy);
      p.x = tx;
      p.y = ty;
      s.lastBump = null;
      events.push({ type: 'swap', id: animal.id });
      return;
    }
    s.lastBump = { id: animal.id, tick: s.tick };
    sing(s, animal, false, events);
    return;
  }
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
  // Wer im Gehege ankommt, bleibt dort
  for (const id of [...s.followers]) {
    const a = s.animals.find((x) => x.id === id)!;
    if (!world.cell(a.x, a.y).pen) continue;
    a.mode = 'pen';
    a.home = { kind: 'pen' };
    a.rest = 10;
    s.followers = s.followers.filter((f) => f !== id);
    if (!s.pen.some((x) => x.id === id)) s.pen.push({ id, species: a.species });
    events.push({ type: 'pen', id });
  }
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
  if (near.length) return sing(s, near[0], true, events);
  if (cheb(p.x, p.y, HOME.bed[0], HOME.bed[1]) <= 1) return sleep(s, world, events);
  events.push({ type: 'call' });
}

/** Tier singt. Beim ersten Mal ist es getroffen; mit der Aktion folgt es der Figur. */
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
    if (s.openGates.includes(g.id)) continue;
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
    freeNear(s, world, HOME.bed, (x, y) => world.cell(x, y).region === 'zuhause' && !world.cell(x, y).pen);
  if (!spot) return;
  s.sleeping = false;
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
  const present = new Set([...s.animals.map((a) => a.id), ...s.pen.map((p) => p.id)]);
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
