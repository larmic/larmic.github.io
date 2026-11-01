import { describe, expect, it } from 'vitest';
import { buildWorld } from '../lib/voxel/world';
import {
  BUBBLE_404,
  BUBBLE_IDLE,
  FALL_TICKS,
  aim,
  initialState,
  isSettled,
  leave,
  select,
  step,
  view,
  type FigureState,
  type World,
} from './island-state';

const entries = (section: string, ids: string[]) =>
  ids.map((id) => ({ id, label: id, block: 'crate', href: `/${section}/${id}/` }));
const world: World = buildWorld({
  workshops: entries('workshops', ['ddd', 'es', 'ms']),
  videos: entries('videos', ['tc', 'hex', 'es', 'unit']),
}).data;
const BUBBLES = { about: 'A', workshops: 'W', videos: 'V', tree: 'T' };

/** Takte bis zur Ruhe; liefert den Endzustand und alle Orte, an denen die Figur dabei stand. */
function settle(state: FigureState, max = 400) {
  const trail: { x: number; y: number }[] = [];
  let s = state;
  for (let i = 0; i < max && !isSettled(s, world); i++) {
    s = step(s, world);
    trail.push(view(s, world, BUBBLES).at);
  }
  expect(isSettled(s, world), 'kommt zur Ruhe').toBe(true);
  return { s, trail };
}
const endOf = (id: string) => world.routes[id].at(-1)!;
const standsOn = (s: FigureState, id: string) => expect(view(s, world, BUBBLES).at).toEqual(endOf(id));
const passes = (trail: { x: number; y: number }[], p: { x: number; y: number }) =>
  trail.some((t) => t.x === p.x && t.y === p.y);

describe('Figur auf der Insel', () => {
  it('steht beim Start auf dem Block der Seite, alle Brücken dorthin stehen, sie begrüßt', () => {
    const s = initialState(world, 'about');
    standsOn(s, 'about');
    const v = view(s, world, BUBBLES);
    expect(v.standingBridges.size).toBe(world.routes.about.filter((n) => n.b).length);
    expect(v.bubble).toEqual({ text: BUBBLE_IDLE, visible: true, error: false });
    expect(isSettled(s, world)).toBe(true);
  });

  it('läuft bei Hover über die Inselmitte zum anderen Bereich und bei Maus weg zurück', () => {
    const there = settle(aim(initialState(world, 'about'), 'videos'));
    let s = there.s;
    standsOn(s, 'videos');
    expect(passes(there.trail, world.home)).toBe(true);
    expect(view(s, world, BUBBLES).bubble.visible).toBe(false); // nicht auf ihrem Ruheblock
    ({ s } = settle(leave(s, 'videos')));
    standsOn(s, 'about');
    expect(view(s, world, BUBBLES).standingBridges).toEqual(
      new Set(world.routes.about.flatMap((n) => (n.k === undefined ? [] : [n.k]))),
    );
  });

  it('lässt beim Rückweg die Brücken bröckeln und setzt auf dem Hinweg jeden Block, bevor sie ihn betritt', () => {
    let s = aim(initialState(world, 'about'), 'workshops');
    let sawCrumble = false;
    for (let i = 0; i < 200 && !isSettled(s, world); i++) {
      const next = step(s, world);
      if (next.crumbling.length > s.crumbling.length) sawCrumble = true;
      if (next.pos > s.pos && next.route === s.route) {
        const node = world.routes[next.route][next.pos - 1];
        if (node.b) expect(next.built, 'Block steht, bevor sie draufsteigt').toBeGreaterThanOrEqual(next.pos);
      }
      s = next;
    }
    expect(sawCrumble).toBe(true);
    standsOn(s, 'workshops');
  });

  it('geht von Kiste zu Kiste nur bis zum Bereichs-Block zurück, nicht bis zur Inselmitte', () => {
    let s = initialState(world, 'workshops/ddd');
    const { s: at, trail } = settle(aim(s, 'workshops/ms'));
    standsOn(at, 'workshops/ms');
    expect(passes(trail, endOf('workshops'))).toBe(true);
    expect(passes(trail, world.home)).toBe(false);
    s = settle(leave(at, 'workshops/ms')).s;
    standsOn(s, 'workshops/ddd');
  });

  it('lässt gemeinsame Brückenblöcke stehen, wenn sich zwei Wege ein Feld teilen', () => {
    const routes = Object.entries(world.routes).filter(([id]) => id.startsWith('videos/'));
    const pair = routes
      .flatMap(([a, ra]) =>
        routes
          .filter(([b]) => b !== a)
          .map(([b, rb]) => ({ a, b, shared: ra.filter((n, i) => n.b && rb[i]?.k === n.k).length })),
      )
      .find((p) => p.shared > 0)!;
    expect(pair, 'es gibt Video-Kisten mit gemeinsamer Brücke').toBeDefined();
    const before = view(initialState(world, pair.a), world, BUBBLES).standingBridges;
    let s = aim(initialState(world, pair.a), pair.b);
    let neverCrumbledShared = true;
    for (let i = 0; i < 200 && !isSettled(s, world); i++) {
      s = step(s, world);
      for (const c of s.crumbling)
        if (world.routes[pair.b].some((n) => n.k === c.bridge) && before.has(c.bridge)) neverCrumbledShared = false;
    }
    standsOn(s, pair.b);
    expect(neverCrumbledShared).toBe(true);
  });

  it('wechselt mitten auf dem Weg das Ziel und kommt beim neuen an', () => {
    let s = aim(initialState(world, 'about'), 'workshops');
    for (let i = 0; i < 4; i++) s = step(s, world);
    s = aim(leave(s, 'workshops'), 'videos');
    s = settle(s).s;
    standsOn(s, 'videos');
  });

  it('stürzt am Blog, spawnt auf ihrem Ruheblock mit 404 und will nicht gleich wieder zum Blog', () => {
    let s = aim(initialState(world, 'workshops/es'), 'blog');
    let fell = 0;
    for (let i = 0; i < 200 && !isSettled(s, world); i++) {
      s = step(s, world);
      fell = Math.max(fell, s.falling);
    }
    expect(fell).toBe(FALL_TICKS);
    standsOn(s, 'workshops/es');
    expect(s.blogBlocked).toBe(true);
    expect(s.hover).toBe('blog'); // Maus ist noch über dem Blog, die Figur bleibt trotzdem stehen
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: BUBBLE_404, visible: true, error: true });
    // 404 bleibt, bis man auf einen anderen Block zeigt
    s = settle(leave(s, 'blog')).s;
    expect(view(s, world, BUBBLES).bubble.text).toBe(BUBBLE_404);
    s = aim(s, 'about');
    expect(view(s, world, BUBBLES).bubble.error).toBe(false);
  });

  it('klettert beim Baum über zwei gestapelte Blöcke in die Krone und sagt ihren Spruch', () => {
    const { s } = settle(aim(initialState(world, 'about'), 'tree'));
    standsOn(s, 'tree');
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: 'T', visible: true, error: false });
    expect(world.routes.tree.filter((n) => n.b)).toHaveLength(2);
  });

  it('läuft nach select zum neuen Ruheblock, öffnet dessen Bereich und schließt den alten, sobald sie ihn verlassen hat', () => {
    let s = initialState(world, 'workshops/ddd');
    expect(view(s, world, BUBBLES).openSections).toEqual(new Set(['workshops']));
    s = select(s, world, 'videos/tc');
    expect(s.picks).toBe(1);
    s = step(s, world);
    expect(view(s, world, BUBBLES).openSections.has('workshops'), 'noch auf den Workshop-Brücken').toBe(true);
    s = settle(s).s;
    standsOn(s, 'videos/tc');
    expect(view(s, world, BUBBLES).openSections).toEqual(new Set(['videos']));
    expect(view(s, world, BUBBLES).bubble.visible, 'auf Kisten schweigt sie').toBe(false);
    expect(view(s, world, BUBBLES).held).toEqual(new Set(['videos', 'videos/tc']));
  });

  it('ignoriert select auf den aktuellen oder einen unbekannten Block', () => {
    const s = initialState(world, 'about');
    expect(select(s, world, 'about')).toBe(s);
    expect(select(s, world, 'gibt-es-nicht')).toBe(s);
  });

  it('spricht nach einer Auswahl zum Bereich statt zu begrüßen', () => {
    const s = settle(select(initialState(world, 'workshops/ddd'), world, 'workshops')).s;
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: 'W', visible: true, error: false });
  });

  it('kommt aus jeder Kombination von Ruheblock und Ziel zur Ruhe', () => {
    const ids = Object.keys(world.routes).filter((id) => id !== 'blog' && id !== 'tree');
    for (const rest of ids) {
      for (const goal of [...ids, 'blog', 'tree']) {
        const { s } = settle(aim(initialState(world, rest), goal));
        standsOn(s, goal === 'blog' ? rest : goal);
        standsOn(settle(leave(s, goal)).s, rest);
      }
    }
  });
});
