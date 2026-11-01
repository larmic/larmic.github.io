// Zustandsmaschine der Figur auf der Insel – rein, ohne DOM und ohne Timer.
// Die Web Component (larmic-island.ts) ruft in jedem Takt `step` auf und zeichnet, was `view` beschreibt.
// Wege bilden einen Baum (Insel → Bereich → Kiste); die Figur läuft immer nur bis zur Abzweigung zurück.
// Spezifikation: docs/specs/insel.md

import type { RouteNode, WorldData } from '../lib/voxel/world';

/** Was die Figur von der Insel braucht: Startfeld und Wege (vom Generator erzeugt, als JSON ins HTML geschrieben) */
export type World = Pick<WorldData, 'home' | 'routes'>;

export const FALL_TICKS = 7; // Dauer des Sturzes in Takten
export const CRUMBLE_TICKS = 3; // so lange bleibt ein bröckelnder Brückenblock sichtbar
export const BUBBLE_IDLE = 'Hi! Zeig auf einen Block.';
export const BUBBLE_404 = '404 – Kein Blog gefunden';

export type FigureState = {
  rest: string; // Block der angezeigten Seite: Dort steht die Figur, wenn sie nirgendwo anders hin will
  hover: string | null; // Block, auf den gerade gezeigt wird
  route: string; // Weg, auf dem die Figur gerade ist (benannt nach seinem Ziel)
  pos: number; // gegangene Felder auf diesem Weg; 0 = Inselmitte
  built: number; // Felder, die stehen (gesetzte Brückenblöcke eingeschlossen)
  facing: 'L' | 'R';
  tick: number;
  crumbling: { bridge: number; until: number }[];
  falling: number; // Takte im Sturz, 0 = nicht im Sturz
  respawns: number;
  respawnedAt: number; // Takt des letzten Respawns (Figur springt dann ohne Übergang)
  blogBlocked: boolean; // nach dem Sturz will sie nicht gleich wieder zum Blog
  show404: boolean;
  picks: number; // gewählte Blöcke – für die Hüpf- und Pop-Animation
  steps: number; // Schritte – für die Schritt-Animation
  placed: number; // gesetzte Blöcke – für die Arm-Animation
};

const section = (id: string) => id.split('/')[0];
const last = (route: RouteNode[]) => route[route.length - 1];

/** Figur steht auf dem Ruheblock, alle Brücken dorthin stehen. */
export function restPose(world: World, rest: string): Pick<FigureState, 'route' | 'pos' | 'built' | 'facing'> {
  const route = world.routes[rest];
  return { route: rest, pos: route.length, built: route.length, facing: last(route).f };
}

export function initialState(world: World, rest: string): FigureState {
  return {
    rest,
    hover: null,
    ...restPose(world, rest),
    tick: 0,
    crumbling: [],
    falling: 0,
    respawns: 0,
    respawnedAt: -1,
    blogBlocked: false,
    show404: false,
    picks: 0,
    steps: 0,
    placed: 0,
  };
}

/** Neuer Inhalt wird angezeigt: Sein Block wird der Ruheblock, die Figur läuft hin. */
export function select(state: FigureState, world: World, id: string): FigureState {
  if (!world.routes[id] || id === state.rest) return state;
  return { ...state, rest: id, show404: false, picks: state.picks + 1 };
}

/** Zeigen auf einen Block (Hover oder Tastaturfokus). */
export function aim(state: FigureState, id: string): FigureState {
  return { ...state, hover: id, blogBlocked: false, show404: id === 'blog' ? state.show404 : false };
}

export function leave(state: FigureState, id: string): FigureState {
  return state.hover === id ? { ...state, hover: null } : state;
}

/** Wohin die Figur will: zum gezeigten Block, sonst zum Ruheblock. Nach dem Sturz ist der Blog gesperrt. */
export function target(state: FigureState): string {
  const want = state.hover ?? state.rest;
  return want === 'blog' && state.blogBlocked ? state.rest : want;
}

/** Länge des gemeinsamen Anfangs zweier Wege: Bis dorthin muss die Figur nicht zurück. */
export function common(world: World, a: string, b: string): number {
  const ra = world.routes[a];
  const rb = world.routes[b];
  let n = 0;
  while (n < ra.length && n < rb.length && !ra[n].fall && !rb[n].fall && ra[n].x === rb[n].x && ra[n].y === rb[n].y)
    n += 1;
  return n;
}

/** Ein Takt. */
export function step(state: FigureState, world: World): FigureState {
  const goal = target(state);
  const tick = state.tick + 1;
  const s: FigureState = { ...state, tick, crumbling: state.crumbling.filter((c) => c.until > tick) };
  const route = world.routes[s.route];

  if (s.pos > 0 && route[s.pos - 1].fall) {
    // Sturz läuft immer bis zum Respawn auf dem Ruheblock durch
    if (s.falling < FALL_TICKS) return { ...s, falling: s.falling + 1 };
    const stillAtBlog = !s.hover || s.hover === 'blog';
    return {
      ...s,
      ...restPose(world, s.rest),
      falling: 0,
      respawns: s.respawns + 1,
      respawnedAt: tick,
      blogBlocked: true,
      show404: stillAtBlog,
    };
  }

  if (goal === s.route) {
    // Vorwärts: Block setzen (oder es versuchen, wenn dort nichts ist), dann draufsteigen
    if (s.pos >= route.length) return s;
    const next = route[s.pos];
    if ((next.b || next.fall) && s.built <= s.pos) return { ...s, built: s.pos + 1, placed: s.placed + 1 };
    return { ...s, pos: s.pos + 1, facing: next.f, steps: s.steps + 1 };
  }

  // Zurück bis zur Abzweigung: hinter der Figur bröckeln die Brückenblöcke weg
  let built = s.built;
  while (built > s.pos && !route[built - 1].b) built -= 1;
  if (built > s.pos) {
    return {
      ...s,
      built: built - 1,
      crumbling: [...s.crumbling, { bridge: route[built - 1].k!, until: tick + CRUMBLE_TICKS }],
    };
  }
  if (s.pos > common(world, s.route, goal)) {
    return { ...s, built, pos: s.pos - 1, facing: route[s.pos - 1].f === 'L' ? 'R' : 'L', steps: s.steps + 1 };
  }
  // An der Abzweigung geht der neue Weg weiter, gemeinsame Brücken bleiben stehen
  return { ...s, built: s.pos === 0 ? 0 : built, route: goal, facing: s.pos === 0 ? 'L' : s.facing };
}

/** Steht die Figur am Ziel und ist nichts mehr in Bewegung? Dann kann der Takt aufhören. */
export function isSettled(state: FigureState, world: World): boolean {
  const route = world.routes[state.route];
  return (
    target(state) === state.route && state.pos >= route.length && !last(route).fall && state.crumbling.length === 0
  );
}

export type FigureView = {
  at: { x: number; y: number };
  standingBridges: Set<number>;
  crumblingBridges: Set<number>;
  openSections: Set<string>; // Bereiche, deren Kisten sichtbar sind
  held: Set<string>; // Blöcke, über die die Figur gerade geht oder auf denen sie steht: Sie wippen nicht
  bubble: { text: string; visible: boolean; error: boolean };
};

/** Was zu zeichnen ist. `bubbles` sind die Sprüche je Bereich (src/data/site.ts). */
export function view(state: FigureState, world: World, bubbles: Record<string, string>): FigureView {
  const route = world.routes[state.route];
  const at = state.pos > 0 ? route[state.pos - 1] : world.home;
  const standingBridges = new Set(route.slice(0, state.built).flatMap((n) => (n.k === undefined ? [] : [n.k])));

  // Kisten eines Bereichs: sichtbar, solange er angezeigt wird oder die Figur noch auf seinen Brücken unterwegs ist
  const openSections = new Set([section(state.rest)]);
  if (state.route.includes('/') && state.pos > world.routes[section(state.route)].length)
    openSections.add(section(state.route));

  const held = new Set(
    Object.keys(world.routes).filter((id) => {
      const r = world.routes[id];
      return !last(r).fall && state.pos >= r.length && common(world, id, state.route) === r.length;
    }),
  );

  // Sprechblase nur, wenn die Figur auf ihrem Ruheblock steht und nirgendwo anders hin will. Auf Bereichen spricht sie
  // zum Bereich (beim ersten Aufruf der Startseite begrüßt sie), auf Kisten schweigt sie, oben im Baum hat sie einen Spruch.
  const pose = restPose(world, state.rest);
  const atRest =
    state.route === pose.route && state.pos === pose.pos && state.falling === 0 && target(state) === state.rest;
  const inTree = state.route === 'tree' && state.pos === world.routes.tree?.length && target(state) === 'tree';
  const text = inTree
    ? bubbles.tree
    : state.show404
      ? BUBBLE_404
      : state.rest.includes('/')
        ? ''
        : state.picks === 0 && state.rest === 'about'
          ? BUBBLE_IDLE
          : (bubbles[state.rest] ?? BUBBLE_IDLE);

  return {
    at,
    standingBridges,
    crumblingBridges: new Set(state.crumbling.map((c) => c.bridge)),
    openSections,
    held,
    bubble: { text, visible: (atRest || inTree) && text !== '', error: state.show404 && !inTree },
  };
}
