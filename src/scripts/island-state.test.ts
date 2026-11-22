import { describe, expect, it } from 'vitest';
import { AVATAR } from '../data/avatar';
import { buildWorld } from '../data/island-layout';
import {
  BUBBLE_IDLE,
  aim,
  initialState,
  isSettled,
  leave,
  returned,
  select,
  settle as settleAtOnce,
  step,
  view,
  type FigureState,
  type World,
} from './island-state';

const entries = (section: string, ids: string[]) =>
  ids.map((id) => ({ id, label: id, block: 'crate', href: `/${section}/${id}/` }));
const world: World = buildWorld(
  {
    workshops: entries('workshops', ['ddd', 'es', 'ms']),
    videos: entries('videos', ['tc', 'hex', 'es', 'unit']),
    blog: entries('blog', ['mitwachsen']),
  },
  AVATAR,
).data;
const BUBBLES = { about: 'A', workshops: 'W', videos: 'V', blog: 'B', tree: 'T' };

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
const endOf = (id: string) => world.routes[id]!.at(-1)!;
const standsOn = (s: FigureState, id: string) => expect(view(s, world, BUBBLES).at).toEqual(endOf(id));
const passes = (trail: { x: number; y: number }[], p: { x: number; y: number }) =>
  trail.some((t) => t.x === p.x && t.y === p.y);

describe('Figur auf der Insel', () => {
  it('steht beim Start auf dem Block der Seite, alle Brücken dorthin stehen, sie begrüßt', () => {
    const s = initialState(world, 'about');
    standsOn(s, 'about');
    const v = view(s, world, BUBBLES);
    expect(v.standingBridges.size).toBe(world.routes.about!.filter((n) => n.b).length);
    expect(v.bubble).toEqual({ text: BUBBLE_IDLE, visible: true });
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
      new Set(world.routes.about!.flatMap((n) => (n.k === undefined ? [] : [n.k]))),
    );
  });

  it('lässt beim Rückweg die Brücken bröckeln und setzt auf dem Hinweg jeden Block, bevor sie ihn betritt', () => {
    let s = aim(initialState(world, 'about'), 'workshops');
    let sawCrumble = false;
    for (let i = 0; i < 200 && !isSettled(s, world); i++) {
      const next = step(s, world);
      if (next.crumbling.length > s.crumbling.length) sawCrumble = true;
      if (next.pos > s.pos && next.route === s.route) {
        const node = world.routes[next.route]![next.pos - 1]!;
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
        if (world.routes[pair.b]!.some((n) => n.k === c.bridge) && before.has(c.bridge)) neverCrumbledShared = false;
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

  it('baut die Brücke zum Blog und bleibt am Regal stehen, dort erinnert sie sich an den Sturz', () => {
    const { s: there, trail } = settle(aim(initialState(world, 'workshops/es'), 'blog'));
    standsOn(there, 'blog');
    expect(passes(trail, world.home)).toBe(true);
    const bridges = world.routes.blog!.flatMap((n) => (n.k === undefined ? [] : [n.k]));
    expect(bridges).toHaveLength(2);
    expect(view(there, world, BUBBLES).standingBridges).toEqual(new Set(bridges));
    const s = settle(select(leave(there, 'blog'), world, 'blog')).s;
    standsOn(s, 'blog');
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: 'B', visible: true });
    expect(view(s, world, BUBBLES).openSections).toEqual(new Set(['blog']));
  });

  it('steht bei jedem Teil einer Serie auf deren Kiste, schweigt dort und hüpft zwischen den Teilen nicht', () => {
    const s = settle(select(initialState(world, 'about'), world, 'blog/mitwachsen')).s;
    standsOn(s, 'blog/mitwachsen');
    const v = view(s, world, BUBBLES);
    expect(v.bubble.visible).toBe(false);
    expect(v.openSections).toEqual(new Set(['blog']));
    expect(v.held).toEqual(new Set(['blog', 'blog/mitwachsen']));
    expect(select(s, world, 'blog/mitwachsen'), 'nächster Teil, gleiche Kiste').toBe(s);
  });

  it('klettert beim Baum über zwei gestapelte Blöcke in die Krone und sagt ihren Spruch', () => {
    const { s } = settle(aim(initialState(world, 'about'), 'tree'));
    standsOn(s, 'tree');
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: 'T', visible: true });
    expect(world.routes.tree!.filter((n) => n.b)).toHaveLength(2);
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

  it('kommt in der schmalen Ansicht mit settle in einem Schritt dort an, wo sie Takt für Takt ankäme', () => {
    const cases: [string, string][] = [
      ['about', 'videos/tc'],
      ['workshops/ddd', 'workshops/ms'],
      ['videos/hex', 'about'],
      ['about', 'blog/mitwachsen'],
      ['blog/mitwachsen', 'blog'],
    ];
    for (const [rest, next] of cases) {
      const start = select(initialState(world, rest), world, next);
      const atOnce = settleAtOnce(start, world);
      expect(isSettled(atOnce, world)).toBe(true);
      expect(view(atOnce, world, BUBBLES).at).toEqual(view(settle(start).s, world, BUBBLES).at);
    }
  });

  it('ignoriert select auf den aktuellen oder einen unbekannten Block, auch auf eine fremde Adresse', () => {
    const s = initialState(world, 'about');
    expect(select(s, world, 'about')).toBe(s);
    expect(select(s, world, 'gibt-es-nicht')).toBe(s);
    expect(select(s, world, 'https://www.mitwachsen-spiele.de/')).toBe(s);
  });

  it('bleibt bei einem unbekannten Ruheblock in der Inselmitte und begrüßt, statt zu scheitern', () => {
    const s = initialState(world, 'gibt-es-nicht');
    expect(isSettled(s, world)).toBe(true);
    expect(s.facing).toBe('L');
    const v = view(s, world, BUBBLES);
    expect(v.at).toEqual(world.home);
    expect(v.standingBridges.size).toBe(0);
    expect(v.bubble).toEqual({ text: BUBBLE_IDLE, visible: true });
  });

  it('ignoriert das Verlassen eines Blocks, auf den nicht mehr gezeigt wird, und schweigt ohne Spruch im Baum', () => {
    const s = aim(initialState(world, 'about'), 'tree');
    expect(leave(s, 'videos')).toBe(s);
    const up = settle(s).s;
    expect(view(up, world, {}).bubble).toEqual({ text: '', visible: false });
  });

  it('macht den Pilz-Ausgang nie zum Ruheblock: Er führt nach außen, die Figur läuft nur beim Zeigen hin', () => {
    expect(world.outside).toEqual(['mitwachsen']);
    const s = initialState(world, 'workshops/ddd');
    expect(select(s, world, 'mitwachsen')).toBe(s);
    const there = settle(aim(s, 'mitwachsen')).s;
    standsOn(there, 'mitwachsen');
    expect(view(there, world, BUBBLES).bubble.visible, 'nicht auf ihrem Ruheblock').toBe(false);
    standsOn(settle(returned(there)).s, 'workshops/ddd');
  });

  it('geht nach Zurück aus dem Cache von dem Block, auf den zuletzt gezeigt wurde, zu ihrem Ruheblock', () => {
    // Mit der Maus zum Block gelaufen, dann per Klick die Seite verlassen: Ein mouseleave kommt nie
    const away = settle(aim(initialState(world, 'about'), 'videos')).s;
    standsOn(away, 'videos');
    const back = returned(away);
    expect(back.hover).toBeNull();
    expect(back.rest).toBe('about');
    standsOn(settle(back).s, 'about');
    // Zeigte nichts, ändert sich nichts
    const still = initialState(world, 'about');
    expect(returned(still)).toBe(still);
  });

  it('spricht nach einer Auswahl zum Bereich statt zu begrüßen', () => {
    const s = settle(select(initialState(world, 'workshops/ddd'), world, 'workshops')).s;
    expect(view(s, world, BUBBLES).bubble).toEqual({ text: 'W', visible: true });
  });

  it('kommt aus jeder Kombination von Ruheblock und Ziel zur Ruhe', () => {
    const ids = Object.keys(world.routes).filter((id) => id !== 'tree' && id !== 'mitwachsen');
    expect(ids).toEqual(expect.arrayContaining(['blog', 'blog/mitwachsen']));
    for (const rest of ids) {
      for (const goal of [...ids, 'mitwachsen', 'tree']) {
        const { s } = settle(aim(initialState(world, rest), goal));
        standsOn(s, goal);
        standsOn(settle(leave(s, goal)).s, rest);
      }
    }
  });
});
