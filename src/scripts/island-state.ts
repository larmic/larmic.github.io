// Zustandsmaschine der Figur auf der Insel – rein, ohne DOM und ohne Timer.
// Die Web Component (larmic-island.ts) ruft in jedem Takt `step` auf und zeichnet, was `view` beschreibt.
// Wege bilden einen Baum (Insel → Bereich → Kiste); die Figur läuft immer nur bis zur Abzweigung zurück.
// Spezifikation: docs/specs/insel.md

import type { RouteNode, WorldData } from '../lib/voxel/world';

/**
 * Was die Figur von der Insel braucht: Startfeld, Wege und die Ziele, deren Link von der Seite wegführt (vom
 * Generator erzeugt, als JSON ins HTML geschrieben)
 */
export type World = Pick<WorldData, 'home' | 'routes' | 'outside'>;

export const CRUMBLE_TICKS = 3; // so lange bleibt ein bröckelnder Brückenblock sichtbar
export const BUBBLE_IDLE = 'Hi! Zeig auf einen Block.';

export type FigureState = {
  rest: string; // Block der angezeigten Seite: Dort steht die Figur, wenn sie nirgendwo anders hin will
  hover: string | null; // Block, auf den gerade gezeigt wird
  route: string; // Weg, auf dem die Figur gerade ist (benannt nach seinem Ziel)
  pos: number; // gegangene Felder auf diesem Weg; 0 = Inselmitte
  built: number; // Felder, die stehen (gesetzte Brückenblöcke eingeschlossen)
  facing: 'L' | 'R';
  tick: number;
  crumbling: { bridge: number; until: number }[];
  picks: number; // gewählte Blöcke – für die Hüpf- und Pop-Animation
  steps: number; // Schritte – für die Schritt-Animation
  placed: number; // gesetzte Blöcke – für die Arm-Animation
};

const section = (id: string) => id.split('/')[0] ?? id;
const last = (route: RouteNode[]) => route.at(-1);
/** Weg zu einem Block; unbekannte Blöcke haben keinen Weg, die Figur bleibt dann in der Inselmitte */
const routeOf = (world: World, id: string): RouteNode[] => world.routes[id] ?? [];

/** Figur steht auf dem Ruheblock, alle Brücken dorthin stehen. */
export function restPose(world: World, rest: string): Pick<FigureState, 'route' | 'pos' | 'built' | 'facing'> {
  const route = routeOf(world, rest);
  return { route: rest, pos: route.length, built: route.length, facing: last(route)?.f ?? 'L' };
}

export function initialState(world: World, rest: string): FigureState {
  return {
    rest,
    hover: null,
    ...restPose(world, rest),
    tick: 0,
    crumbling: [],
    picks: 0,
    steps: 0,
    placed: 0,
  };
}

/** Neuer Inhalt wird angezeigt: Sein Block wird der Ruheblock, die Figur läuft hin. Links nach außen nie. */
export function select(state: FigureState, world: World, id: string): FigureState {
  if (!world.routes[id] || world.outside.includes(id) || id === state.rest) return state;
  return { ...state, rest: id, picks: state.picks + 1 };
}

/** Zeigen auf einen Block (Hover oder Tastaturfokus). */
export function aim(state: FigureState, id: string): FigureState {
  return { ...state, hover: id };
}

export function leave(state: FigureState, id: string): FigureState {
  return state.hover === id ? { ...state, hover: null } : state;
}

/**
 * Zurück aus dem Cache des Browsers (`pageshow` mit `persisted`, z. B. nach Zurück von einer fremden Seite): Die Seite
 * war verlassen, auf nichts wird mehr gezeigt – die Figur geht wie bei `leave` zurück zu ihrem Ruheblock.
 */
export function returned(state: FigureState): FigureState {
  return state.hover === null ? state : leave(state, state.hover);
}

/** Wohin die Figur will: zum gezeigten Block, sonst zum Ruheblock. */
export function target(state: FigureState): string {
  return state.hover ?? state.rest;
}

/** Länge des gemeinsamen Anfangs zweier Wege: Bis dorthin muss die Figur nicht zurück. */
export function common(world: World, a: string, b: string): number {
  const ra = routeOf(world, a);
  const rb = routeOf(world, b);
  for (let n = 0; ; n++) {
    const p = ra[n];
    const q = rb[n];
    if (!p || !q || p.x !== q.x || p.y !== q.y) return n;
  }
}

/** Ein Takt. */
export function step(state: FigureState, world: World): FigureState {
  const goal = target(state);
  const tick = state.tick + 1;
  const s: FigureState = { ...state, tick, crumbling: state.crumbling.filter((c) => c.until > tick) };
  const route = routeOf(world, s.route);

  if (goal === s.route) {
    // Vorwärts: Block setzen, dann draufsteigen
    const next = route[s.pos];
    if (!next) return s;
    if (next.b && s.built <= s.pos) return { ...s, built: s.pos + 1, placed: s.placed + 1 };
    return { ...s, pos: s.pos + 1, facing: next.f, steps: s.steps + 1 };
  }

  return stepBack(s, world, goal, route);
}

/** Zurück bis zur Abzweigung: hinter der Figur bröckeln die Brückenblöcke weg */
function stepBack(s: FigureState, world: World, goal: string, route: RouteNode[]): FigureState {
  let built = s.built;
  while (built > s.pos && !route[built - 1]?.b) built -= 1;
  const bridge = built > s.pos ? route[built - 1]?.k : undefined;
  if (bridge !== undefined) {
    return { ...s, built: built - 1, crumbling: [...s.crumbling, { bridge, until: s.tick + CRUMBLE_TICKS }] };
  }
  if (s.pos > common(world, s.route, goal)) {
    return { ...s, built, pos: s.pos - 1, facing: route[s.pos - 1]?.f === 'L' ? 'R' : 'L', steps: s.steps + 1 };
  }
  // An der Abzweigung geht der neue Weg weiter, gemeinsame Brücken bleiben stehen
  return { ...s, built: s.pos === 0 ? 0 : built, route: goal, facing: s.pos === 0 ? 'L' : s.facing };
}

/** Steht die Figur am Ziel und ist nichts mehr in Bewegung? Dann kann der Takt aufhören. */
export function isSettled(state: FigureState, world: World): boolean {
  const route = routeOf(world, state.route);
  return target(state) === state.route && state.pos >= route.length && state.crumbling.length === 0;
}

/** Alle Takte auf einmal bis zur Ruhe – für die schmale Ansicht, in der die Figur nicht läuft. */
export function settle(state: FigureState, world: World, maxTicks = 1000): FigureState {
  let s = state;
  for (let i = 0; i < maxTicks && !isSettled(s, world); i++) s = step(s, world);
  return s;
}

export type FigureView = {
  at: { x: number; y: number };
  standingBridges: Set<number>;
  crumblingBridges: Set<number>;
  openSections: Set<string>; // Bereiche, deren Kisten sichtbar sind
  held: Set<string>; // Blöcke, über die die Figur gerade geht oder auf denen sie steht: Sie wippen nicht
  bubble: { text: string; visible: boolean };
};

/** Was zu zeichnen ist. `bubbles` sind die Sprüche je Bereich (src/data/site.ts). */
export function view(state: FigureState, world: World, bubbles: Record<string, string>): FigureView {
  const route = routeOf(world, state.route);
  const at = route[state.pos - 1] ?? world.home; // pos 0 (Index −1): Inselmitte
  const standingBridges = new Set(route.slice(0, state.built).flatMap((n) => (n.k === undefined ? [] : [n.k])));

  // Kisten eines Bereichs: sichtbar, solange er angezeigt wird oder die Figur noch auf seinen Brücken unterwegs ist
  const openSections = new Set([section(state.rest)]);
  if (state.route.includes('/') && state.pos > routeOf(world, section(state.route)).length)
    openSections.add(section(state.route));

  const held = new Set(
    Object.keys(world.routes).filter((id) => {
      const r = routeOf(world, id);
      return state.pos >= r.length && common(world, id, state.route) === r.length;
    }),
  );

  // Sprechblase nur, wenn die Figur auf ihrem Ruheblock steht und nirgendwo anders hin will. Auf Bereichen spricht sie
  // zum Bereich (beim ersten Aufruf der Startseite begrüßt sie), auf Kisten schweigt sie, oben im Baum hat sie einen Spruch.
  const pose = restPose(world, state.rest);
  const atRest = state.route === pose.route && state.pos === pose.pos && target(state) === state.rest;
  const inTree = state.route === 'tree' && state.pos === world.routes.tree?.length && target(state) === 'tree';
  const text = inTree
    ? (bubbles.tree ?? '')
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
    bubble: { text, visible: (atRest || inTree) && text !== '' },
  };
}
