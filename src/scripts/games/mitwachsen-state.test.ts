import { describe, expect, it } from 'vitest';
import type { Dir } from '../../lib/games/front';
import { HOME, animalId } from '../../data/games/mitwachsen';
import {
  SLEEP_LOCK,
  BERRY_REGROW,
  SWAP_WINDOW,
  WAKE_GRACE,
  initialState,
  progressOf,
  regionAnimals,
  step,
  type Animal,
  type Cmd,
  type GameEvent,
  type State,
} from './mitwachsen-state';
import { createWorld, standHeight, type Cell, type World } from './mitwachsen-world';
import { BLOCK, raining } from './mitwachsen-weather';

/** Kleine Testwelt: überall flaches Gras des Zuhauses, einzelne Felder überschreibbar */
function fakeWorld(cells: Record<string, Partial<Cell>> = {}): World {
  return {
    seed: 1,
    cell: (x, y) => ({ h: 1, ground: 'grass', deco: null, region: 'lichtung', solid: false, ...cells[`${x},${y}`] }),
    gates: new Map(),
    spawns: new Map(),
    spots: [],
    climate: () => ({ id: 'eis', strength: 0 }),
    portals: new Map(),
  };
}
const animal = (id: string, x: number, y: number, extra: Partial<Animal> = {}): Animal => ({
  id,
  species: 'hase',
  x,
  y,
  dir: 's',
  mode: 'wander',
  home: { kind: 'region', region: 'lichtung' },
  spawn: [x, y],
  rest: 99,
  ...extra,
});
/** Wacher Zustand mit Figur auf (x, y) und den angegebenen Tieren */
function awake(world: World, x: number, y: number, animals: Animal[] = []): State {
  const s = initialState(world);
  return { ...s, sleeping: false, player: { x, y, dir: 'e' }, animals };
}
function run(s: State, world: World, ...cmds: (Cmd | Dir)[]) {
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const r = step(s, world, typeof c === 'string' ? { type: 'move', dir: c } : c);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}
const ACT: Cmd = { type: 'action' };
const DIRS_TO_BED: [number, number, Dir][] = [
  [1, 0, 'e'],
  [-1, 0, 'w'],
  [0, 1, 's'],
  [0, -1, 'n'],
];
const TICK: Cmd = { type: 'tick' };
const types = (e: GameEvent[]) => e.map((x) => x.type);

describe('Aufwachen und Schlafen', () => {
  it('startet schlafend im Bett; die erste Taste weckt die Figur an einem freien Platz daneben', () => {
    const world = createWorld(1);
    const s0 = initialState(world);
    expect(s0.sleeping).toBe(true);
    expect([s0.player.x, s0.player.y]).toEqual([...HOME.bed]);
    const { s, events } = run(s0, world, 'e');
    expect(s.sleeping).toBe(false);
    expect([s.player.x, s.player.y]).toEqual([...HOME.wake[0]]);
    expect(types(events)).toEqual(['wake']);
  });

  it('legt sich mit der Aktion am Bett schlafen; Tasten wecken erst nach der Sperrzeit', () => {
    const world = createWorld(1);
    let { s } = run(initialState(world), world, 'e'); // aufwachen neben dem Bett
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
    expect(types(r.events)).toContain('sleep');
    s = r.s;
    // Wildes Drücken während der Sperrzeit weckt nicht
    for (let i = 0; i < SLEEP_LOCK - 1; i++) s = run(s, world, TICK, 'e', ACT).s;
    expect(s.sleeping).toBe(true);
    s = run(s, world, TICK, TICK).s;
    expect(run(s, world, ACT).s.sleeping).toBe(false);
  });

  it('läuft ins Bett und schläft ein, ganz ohne Aktionstaste', () => {
    const world = createWorld(1);
    const [bx, by] = HOME.bed;
    const r = run(awake(world, bx + 1, by), world, 'w');
    expect(types(r.events)).toEqual(['sleep']);
    expect(r.s.sleeping).toBe(true);
  });

  it('gleich nach dem Aufwachen ist das Bett nur ein Hindernis', () => {
    const world = createWorld(1);
    let s = run(initialState(world), world, 'e').s; // wach neben dem Bett
    expect(s.sleeping).toBe(false);
    const toBed = DIRS_TO_BED.find(
      ([dx, dy]) => s.player.x + dx === HOME.bed[0] && s.player.y + dy === HOME.bed[1],
    )![2];
    expect(types(run(s, world, toBed).events)).toEqual(['bump']);
    for (let i = 0; i < WAKE_GRACE; i++) s = run(s, world, TICK).s;
    expect(run(s, world, toBed).s.sleeping).toBe(true);
  });

  it('schickt folgende Tiere beim Schlafen heim', () => {
    const w = fakeWorld({ '0,0': { deco: 'bed', solid: true } });
    let s = awake(w, 1, 0, [animal('lichtung:hase', 2, 0, { mode: 'follow', spawn: [9, 9] })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'w' } };
    s = run(s, w, ACT).s;
    expect(s.sleeping).toBe(true);
    expect(s.followers).toEqual([]);
    expect(s.animals[0].mode).toBe('wander');
  });
});

describe('Laufen und Klettern', () => {
  it('geht ein Feld in Pfeilrichtung und schaut dorthin', () => {
    const w = fakeWorld();
    const { s, events } = run(awake(w, 0, 0), w, 'e', 's', 's', 'w');
    expect([s.player.x, s.player.y, s.player.dir]).toEqual([0, 2, 'w']);
    expect(types(events)).toEqual(['step', 'step', 'step', 'step']);
  });

  it('klettert eine Stufe hoch und runter, zwei Stufen sind eine Wand', () => {
    const w = fakeWorld({ '1,0': { h: 2 }, '2,0': { h: 4 }, '1,1': { h: 3 } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.s.player.x).toBe(1);
    expect(r.events).toEqual([{ type: 'step', climb: 1 }]);
    r = run(r.s, w, 'e'); // auf 4: zwei Stufen
    expect(r.s.player.x).toBe(1);
    expect(types(r.events)).toEqual(['bump']);
    r = run(r.s, w, 'w');
    expect(r.events).toEqual([{ type: 'step', climb: -1 }]);
    r = run(awake(w, 1, 2), w, 'n'); // von 1 auf 3: zwei Stufen hoch
    expect(types(r.events)).toEqual(['bump']);
  });

  it('fällt beliebig tief herunter, steigt aber nur eine Stufe hinauf', () => {
    const w = fakeWorld({ '0,0': { h: 4 }, '1,0': { h: 1 } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'step', climb: -3 }]);
    r = run(r.s, w, 'w'); // zurück hinauf: drei Stufen
    expect(types(r.events)).toEqual(['bump']);
  });

  it('läuft nicht durch Wasser, Bäume, Zäune oder geschlossene Tore', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '0,1': { deco: 'tree', solid: true },
      '-1,0': { deco: 'biggate', gate: 'eis' },
    });
    const { s, events } = run(awake(w, 0, 0), w, 'e', 's', 'w');
    expect([s.player.x, s.player.y]).toEqual([0, 0]);
    expect(types(events)).toEqual(['bump', 'bump', 'bump']);
  });
});

describe('Tiere', () => {
  it('singt bei der Aktion, ist beim ersten Mal getroffen und folgt', () => {
    const w = fakeWorld();
    let r = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, ACT);
    expect(r.events).toEqual([
      { type: 'sing', id: 'a', species: 'hase', first: true },
      { type: 'follow', id: 'a' },
    ]);
    expect(r.s.met).toEqual(['a']);
    expect(r.s.followers).toEqual(['a']);
    r = run(r.s, w, ACT); // singt noch einmal, sonst ändert sich nichts
    expect(r.events).toEqual([{ type: 'sing', id: 'a', species: 'hase', first: false }]);
    expect(r.s.followers).toEqual(['a']);
  });

  it('nimmt mit der Aktion auch ein Tier schräg daneben, wenn vorn keines steht', () => {
    const w = fakeWorld();
    const r = run(awake(w, 10, 10, [animal('a', 11, 11)]), w, ACT); // weit weg vom Bett
    expect(types(r.events)).toEqual(['sing', 'follow']);
  });

  it('Hineinlaufen reicht: Das Tier singt, ist gefunden und folgt; die Figur bleibt stehen', () => {
    const w = fakeWorld();
    const r = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e');
    expect(r.events).toEqual([
      { type: 'sing', id: 'a', species: 'hase', first: true },
      { type: 'follow', id: 'a' },
    ]);
    expect(r.s.met).toEqual(['a']);
    expect(r.s.followers).toEqual(['a']);
    expect(r.s.player.x).toBe(0);
  });

  it('in ein folgendes Tier hineinlaufen tauscht sofort den Platz', () => {
    const w = fakeWorld();
    const s = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e').s; // folgt jetzt
    const r = run(s, w, 'e');
    expect(types(r.events)).toEqual(['swap']);
    expect([r.s.player.x, r.s.animals[0].x]).toEqual([1, 0]);
    expect(r.s.followers).toEqual(['a']);
  });

  it('ein Tier im Garten tauscht erst beim zweiten Mal kurz hintereinander, nach Ablauf der Zeit singt es wieder', () => {
    const w = fakeWorld({ '0,0': { garden: true }, '1,0': { garden: true } });
    const inGarden = () => [animal('a', 1, 0, { mode: 'home', home: { kind: 'garden' } })];
    let r = run(awake(w, 0, 0, inGarden()), w, 'e');
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.followers).toEqual([]);
    r = run(r.s, w, 'e');
    expect(types(r.events)).toEqual(['swap']);
    let s = run(awake(w, 0, 0, inGarden()), w, 'e').s;
    for (let i = 0; i <= SWAP_WINDOW; i++) s = run(s, w, TICK).s;
    expect(types(run(s, w, 'e').events)).toEqual(['sing']);
  });

  it('läuft im Gänsemarsch: Jedes Tier rückt auf den Platz seines Vordermanns', () => {
    const w = fakeWorld();
    let s = run(awake(w, 0, 0, [animal('a', 1, 0), animal('b', 0, 1)]), w, ACT).s; // a folgt
    s = { ...s, player: { ...s.player, dir: 's' } };
    s = run(s, w, ACT).s; // b folgt
    expect(s.followers).toEqual(['a', 'b']);
    s = run(s, w, 'n', 'n', 'n').s;
    const at = (id: string) => s.animals.find((a) => a.id === id)!;
    expect([s.player.x, s.player.y]).toEqual([0, -3]);
    expect([at('a').x, at('a').y]).toEqual([0, -2]);
    expect([at('b').x, at('b').y]).toEqual([0, -1]);
  });

  it('bleibt stehen und schaut, solange die Figur daneben steht', () => {
    const w = fakeWorld();
    let s = awake(w, 0, 0, [animal('a', 1, 1, { rest: 1 })]);
    for (let i = 0; i < 50; i++) s = run(s, w, TICK).s;
    expect([s.animals[0].x, s.animals[0].y, s.animals[0].dir]).toEqual([1, 1, 'w']);
  });

  it('läuft umher, aber nur in seinem Zuhause', () => {
    const cells: Record<string, Partial<Cell>> = {};
    for (let x = -10; x <= 10; x++)
      for (let y = -10; y <= 10; y++) if (Math.abs(x) > 2 || Math.abs(y) > 2) cells[`${x},${y}`] = { region: 'border' };
    const w = fakeWorld(cells);
    let s = awake(w, 8, 8, [animal('a', 0, 0, { rest: 1 })]);
    const visited = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      s = run(s, w, TICK).s;
      visited.add(`${s.animals[0].x},${s.animals[0].y}`);
    }
    expect(visited.size).toBeGreaterThan(4);
    for (const k of visited) {
      const [x, y] = k.split(',').map(Number);
      expect(Math.abs(x) <= 2 && Math.abs(y) <= 2, k).toBe(true);
    }
  });
});

describe('Beerenbüsche', () => {
  it('in einen Busch laufen pflückt die Beeren; danach ist er nur ein Hindernis, bis sie nachwachsen', () => {
    const w = fakeWorld({ '1,0': { deco: 'bush', solid: true } });
    let r = run(awake(w, 0, 0), w, 'e');
    expect(r.events).toEqual([{ type: 'pick', x: 1, y: 0 }]);
    expect(r.s.player.x).toBe(0);
    r = run(r.s, w, 'e');
    expect(types(r.events)).toEqual(['bump']);
    let s = r.s;
    const regrown: GameEvent[] = [];
    for (let i = 0; i < BERRY_REGROW; i++) {
      const t = run(s, w, TICK);
      s = t.s;
      regrown.push(...t.events);
    }
    expect(regrown).toEqual([{ type: 'regrow', x: 1, y: 0 }]);
    expect(types(run(s, w, 'e').events)).toEqual(['pick']);
  });
});

/** Testwelt: links vom Bett (x ≤ 0) die Wiese, rechts davon gewöhnliche Lichtung */
const meadowWorld = () => {
  const cells: Record<string, Partial<Cell>> = {};
  for (let y = -3; y <= 3; y++) for (let x = -6; x <= 0; x++) cells[`${x},${y}`] = { garden: true };
  return fakeWorld(cells);
};

describe('Tage', () => {
  it('jedes Schlafen zählt einen Tag; der Tag kommt mit dem Spielstand wieder', () => {
    const world = createWorld(1);
    let s = initialState(world, { day: 4 });
    expect(s.day).toBe(4);
    s = run(s, world, 'e').s;
    s = { ...s, player: { ...s.player, x: HOME.bed[0] + 1, y: HOME.bed[1], dir: 'w' } };
    s = run(s, world, ACT).s;
    expect(s.day).toBe(5);
    expect(progressOf(s).day).toBe(5);
  });
});

describe('Tiere an wechselnden Stellen', () => {
  const world = createWorld(3);
  const where = (s: State) =>
    s.animals
      .filter((a) => a.home.kind === 'region')
      .map((a) => `${a.id}@${a.x},${a.y}`)
      .sort();

  it('bei jedem Besuch wohnen die Tiere woanders, beim gleichen Besuch gleich', () => {
    expect(where(initialState(world, {}, 11))).toEqual(where(initialState(world, {}, 11)));
    expect(where(initialState(world, {}, 11))).not.toEqual(where(initialState(world, {}, 12)));
  });

  it('immer auf erreichbaren Feldern der Lichtung, mit Abstand zum Bett und zueinander', () => {
    const spots = new Set(world.spots.map(([x, y]) => `${x},${y}`));
    for (const seed of [1, 2, 3]) {
      const s = initialState(world, {}, seed);
      const region = s.animals.filter((a) => a.home.kind === 'region');
      expect(region).toHaveLength(40);
      for (const a of region) {
        expect(spots.has(`${a.x},${a.y}`), a.id).toBe(true);
        expect(Math.max(Math.abs(a.x - HOME.bed[0]), Math.abs(a.y - HOME.bed[1]))).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('an einem neuen Morgen sind die verlorenen Tiere woanders unterwegs, Tiere der Wiese bleiben', () => {
    const garden = [{ id: 'lichtung:hase', species: 'hase' as const }];
    let s = initialState(world, { garden }, 5);
    s = run(s, world, 'e').s; // aufwachen
    const hase = s.animals.find((a) => a.id === 'lichtung:hase')!;
    const before = where(s);
    s = { ...s, player: { ...s.player, x: HOME.bed[0] + 1, y: HOME.bed[1] } };
    s = run(s, world, ACT).s; // schlafen
    for (let i = 0; i < SLEEP_LOCK; i++) s = run(s, world, TICK).s;
    s = run(s, world, 'e').s; // neuer Morgen
    expect(where(s)).not.toEqual(before);
    const later = s.animals.find((a) => a.id === 'lichtung:hase')!;
    expect(later.mode).toBe('home');
    expect(world.cell(later.x, later.y).garden).toBe(hase.mode === 'home' ? true : undefined);
  });
});

describe('Unterstand bei Regen', () => {
  it('regnet es, gehen die Tiere der Wiese unter den Unterstand; danach zurück an ihre Plätze', () => {
    const world = createWorld(1);
    const garden = Array.from({ length: 6 }, (_, i) => ({ id: `wild:7:7:${i}`, species: 'hase' as const }));
    let s: State = { ...initialState(world, { garden }), sleeping: false, player: { x: 0, y: 3, dir: 's' } };
    let rain = 1;
    while (!raining(world.seed, s.day, rain * BLOCK)) rain++;
    s = { ...s, tick: rain * BLOCK };
    for (let i = 0; i < 400; i++) s = run(s, world, TICK).s;
    const home = () => s.animals.filter((a) => a.mode === 'home');
    for (const a of home()) expect(world.cell(a.x, a.y).roof, `${a.id} ${a.x},${a.y}`).toBe(true);
    let sun = rain + 1;
    while (raining(world.seed, s.day, sun * BLOCK)) sun++;
    s = { ...s, tick: sun * BLOCK };
    for (let i = 0; i < 600; i++) s = run(s, world, TICK).s;
    for (const a of home())
      expect(Math.abs(a.x - a.spawn[0]) + Math.abs(a.y - a.spawn[1]), a.id).toBeLessThanOrEqual(4);
    for (const a of home()) expect(world.cell(a.x, a.y).garden).toBe(true);
  });
});

describe('Korb mit Beeren', () => {
  it('Pflücken füllt den Korb; am Futtertrog kommen die Beeren hinein und alle Tiere der Wiese freuen sich', () => {
    const w = fakeWorld({
      '1,0': { deco: 'bush', solid: true },
      '-1,0': { deco: 'trough', solid: true, garden: true },
      '0,2': { garden: true },
    });
    let s = awake(w, 0, 0, [
      animal('lichtung:hase', 0, 2, { mode: 'home', home: { kind: 'garden' } }),
      animal('lichtung:igel', 5, 5),
    ]);
    expect(types(run(s, w, 'w').events)).toEqual(['bump']); // ohne Korb ist der Trog nur ein Hindernis
    s = run(s, w, 'e').s;
    expect(s.basket).toBe(true);
    const r = run(s, w, 'w');
    expect(r.events).toEqual([{ type: 'feed', ids: ['lichtung:hase'] }]);
    expect(r.s.basket).toBe(false);
    expect([r.s.player.x, r.s.player.y]).toEqual([0, 0]);
  });
});

describe('Wiese ums Bett', () => {
  it('ein folgendes Tier, das die Wiese betritt, ist zu Hause: es singt, läuft zu seinem Platz und bleibt dort', () => {
    const w = meadowWorld();
    let s = awake(w, 2, 0, [animal('lichtung:hase', 3, 0, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'w' } };
    const r = run(s, w, 'w', 'w', 'w');
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase', species: 'hase' });
    expect(r.s.followers).toEqual([]);
    expect(r.s.garden).toEqual([{ id: 'lichtung:hase', species: 'hase' }]);
    const hase = () => s.animals.find((a) => a.id === 'lichtung:hase')!;
    s = { ...r.s, player: { ...r.s.player, x: 12, y: 0 } }; // Figur geht weg
    expect(w.cell(hase().spawn[0], hase().spawn[1]).garden).toBe(true);
    for (let i = 0; i < 300; i++) s = run(s, w, TICK).s;
    expect(Math.abs(hase().x - hase().spawn[0]) + Math.abs(hase().y - hase().spawn[1])).toBeLessThanOrEqual(2);
    for (let i = 0; i < 2000; i++) {
      s = run(s, w, TICK).s;
      expect(w.cell(hase().x, hase().y).garden, `${hase().x},${hase().y}`).toBe(true);
    }
  });

  it('jedes Tier bekommt einen eigenen Platz auf der Wiese', () => {
    const w = meadowWorld();
    const ids = ['lichtung:hase', 'lichtung:igel', 'lichtung:fuchs'];
    let s = awake(
      w,
      2,
      0,
      ids.map((id, i) => animal(id, 3 + i, 0, { mode: 'follow' })),
    );
    s = { ...s, followers: ids, player: { ...s.player, dir: 'w' } };
    s = run(s, w, 'w', 'w', 'w', 'w', 'w').s;
    expect(s.garden.map((p) => p.id).sort()).toEqual([...ids].sort());
    const spots = s.animals.map((a) => a.spawn.join(','));
    expect(new Set(spots).size).toBe(3);
  });

  it('ein folgendes Tier, das per Platztausch auf die Wiese kommt, bleibt dort', () => {
    const w = meadowWorld();
    let s = awake(w, 0, 0, [animal('lichtung:hase', 1, 0, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'] };
    const r = run(s, w, 'e'); // tauscht sofort: Hase steht jetzt auf der Wiese
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase', species: 'hase' });
    expect(r.s.followers).toEqual([]);
  });

  it('Tiere auf der Wiese singen beim Hineinlaufen, folgen aber nicht', () => {
    const w = fakeWorld({ '1,0': { garden: true }, '0,0': { garden: true } });
    const r = run(awake(w, 0, 0, [animal('a', 1, 0, { mode: 'home', home: { kind: 'garden' } })]), w, 'e');
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.followers).toEqual([]);
  });

  it('Tiere auf der Wiese kommen mit dem Spielstand wieder, verteilt auf der Wiese', () => {
    const world = createWorld(2);
    const garden = Array.from({ length: 8 }, (_, i) => ({ id: `wild:9:9:${i}`, species: 'hase' as const }));
    const s = initialState(world, { garden });
    const home = s.animals.filter((a) => a.mode === 'home');
    expect(home).toHaveLength(8);
    for (const a of home) expect(world.cell(a.x, a.y).garden).toBe(true);
    expect(new Set(home.map((a) => `${a.x},${a.y}`)).size).toBe(8);
  });
});

describe('Große Tore', () => {
  it('bleiben verschlossen, auch wenn alle Tiere der Lichtung gefunden sind', () => {
    const world = createWorld(1);
    const s = initialState(world, { met: regionAnimals('lichtung') });
    expect(s.openGates).toEqual([]);
    for (const [x, y] of [...world.gates.values()].flatMap((g) => g.cells))
      expect(standHeight(world, s.openGates, x, y)).toBeNull();
  });

  it('übernehmen aus einem alten Spielstand kein offenes, verschlossenes Tor', () => {
    expect(initialState(createWorld(1), { openGates: ['eis'] }).openGates).toEqual([]);
  });

  it('das letzte gefundene Tier öffnet kein verschlossenes Tor (kein Ereignis)', () => {
    const world = createWorld(1);
    const others = regionAnimals('lichtung').filter((id) => id !== animalId('lichtung', 'hase'));
    let s = initialState(world, { met: others });
    s = {
      ...s,
      sleeping: false,
      player: { x: 0, y: 1, dir: 'e' },
      animals: [animal(animalId('lichtung', 'hase'), 1, 1)],
    };
    const r = run(s, world, ACT);
    expect(types(r.events)).not.toContain('gate');
  });
});

describe('Rufen', () => {
  it('ruft, wenn weder Tier noch Bett in der Nähe sind', () => {
    const w = fakeWorld();
    expect(types(run(awake(w, 10, 10), w, ACT).events)).toEqual(['call']);
  });
});

describe('Spielstand', () => {
  it('stellt Gefundene und Tiere im Garten wieder her', () => {
    const world = createWorld(4);
    const met = regionAnimals('lichtung');
    const s = initialState(world, { met, garden: [{ id: 'wild:0:2:0', species: 'fuchs' }] });
    expect(s.met).toEqual([...met].sort());
    const fox = s.animals.find((a) => a.id === 'wild:0:2:0')!;
    expect(fox.mode).toBe('home');
    expect(world.cell(fox.x, fox.y).garden).toBe(true);
    const p = progressOf(s);
    expect(p.met).toEqual(s.met);
    expect(p.garden).toEqual([{ id: 'wild:0:2:0', species: 'fuchs' }]);
  });

  it('ein Tier im Garten taucht nicht zusätzlich in seiner Gegend auf', () => {
    const world = createWorld(4);
    const s = initialState(world, { garden: [{ id: animalId('lichtung', 'hase'), species: 'hase' }] });
    expect(s.animals.filter((a) => a.id === animalId('lichtung', 'hase'))).toHaveLength(1);
  });
});

describe('Invarianten bei wildem Drücken', () => {
  const DIRS: Dir[] = ['n', 's', 'e', 'w'];
  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: Figur steht immer begehbar, nie zwei auf einem Feld, Tiere der Wiese bleiben drauf, alles wiederholbar`, () => {
      const world = createWorld(seed);
      const play = () => {
        let s = initialState(world, {}, seed);
        let r = seed * 7919;
        for (let i = 0; i < 4000; i++) {
          r = (Math.imul(r, 1103515245) + 12345) >>> 0;
          const pick = r % 10;
          const cmd: Cmd = pick < 6 ? { type: 'move', dir: DIRS[(r >>> 8) % 4] } : pick < 8 ? ACT : TICK;
          s = step(s, world, cmd).state;
          if (!s.sleeping) expect(standHeight(world, s.openGates, s.player.x, s.player.y)).not.toBeNull();
          const spots = s.animals.map((a) => `${a.x},${a.y}`);
          if (!s.sleeping) spots.push(`${s.player.x},${s.player.y}`);
          expect(new Set(spots).size).toBe(spots.length);
          for (const a of s.animals) if (a.mode === 'home') expect(world.cell(a.x, a.y).garden).toBe(true);
          expect(new Set(s.followers).size).toBe(s.followers.length);
        }
        return s;
      };
      expect(play()).toEqual(play());
    });
  }
});

describe('Randfälle aus der Prüfung', () => {
  it('schläft am Bett, auch wenn ein folgendes Tier direkt hinter der Figur steht', () => {
    const world = createWorld(1);
    const [bx, by] = HOME.bed;
    let s = awake(world, bx + 1, by, [animal('lichtung:hase', bx + 1, by + 1, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'n' } };
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
  });
});

describe('Durchgänge bleiben frei', () => {
  it('umherlaufende Tiere bleiben nie an Toren oder am Rosenbogen stehen', () => {
    const world = createWorld(5);
    const passages = [...world.gates.values()]
      .flatMap((g) => g.cells)
      .flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]);
    // Alle Tore offen, Figur weit weg: Die Tiere laufen lange frei umher
    let s: State = {
      ...initialState(world),
      sleeping: false,
      player: { x: 0, y: 30, dir: 's' },
    };
    for (let i = 0; i < 4000; i++) {
      s = step(s, world, TICK).state;
      for (const a of s.animals)
        if (a.mode === 'wander' && a.home.kind === 'region')
          expect(passages, `${a.id} ${a.x},${a.y}`).not.toContain(`${a.x},${a.y}`);
    }
  });
});

/** Richtung von einem Feld zum Nachbarfeld */
const toward = (from: readonly number[], to: readonly number[]): Dir =>
  to[0] > from[0] ? 'e' : to[0] < from[0] ? 'w' : to[1] > from[1] ? 's' : 'n';

describe('Portale', () => {
  const world = createWorld(1);
  const west = world.portals.get('lava')!;
  /** Figur wach vor dem Portal am Westtor, Blick darauf */
  function beforeGatePortal(extra: Animal[] = [], followers: string[] = []) {
    const [ex, ey] = west.gateExit;
    const dir = (
      west.gate[0] - ex === 1 ? 'e' : west.gate[0] - ex === -1 ? 'w' : west.gate[1] - ey === 1 ? 's' : 'n'
    ) as Dir;
    const s: State = {
      ...initialState(world),
      sleeping: false,
      player: { x: ex, y: ey, dir },
      animals: extra,
      followers,
    };
    return { s, dir };
  }

  it('aktiviert das Portal am Tor beim Hineinlaufen, ohne gleich zu reisen', () => {
    const { s, dir } = beforeGatePortal();
    const r = run(s, world, dir);
    expect(r.events).toEqual([{ type: 'portal', id: 'lava' }]);
    expect(r.s.portals).toEqual(['lava']);
    expect([r.s.player.x, r.s.player.y]).toEqual([...west.gateExit]);
  });

  it('bringt die Figur durch das aktive Portal zum Bett und zurück; folgende Tiere reisen mit', () => {
    const { s, dir } = beforeGatePortal(
      [animal('lichtung:hase', west.gateExit[0], west.gateExit[1] + 1, { mode: 'follow' })],
      ['lichtung:hase'],
    );
    let r = run({ ...s, portals: ['lava'] }, world, dir);
    expect(r.events).toEqual([{ type: 'teleport', id: 'lava', to: 'home' }]);
    expect([r.s.player.x, r.s.player.y]).toEqual([...west.homeExit]);
    const hase = r.s.animals.find((a) => a.id === 'lichtung:hase')!;
    expect(Math.max(Math.abs(hase.x - r.s.player.x), Math.abs(hase.y - r.s.player.y))).toBeLessThanOrEqual(2);
    // zurück: vom Ausgang am Bett ins Portal
    const back = toward(west.homeExit, west.home);
    r = run({ ...r.s, player: { ...r.s.player, dir: back } }, world, back);
    expect(r.events).toEqual([{ type: 'teleport', id: 'lava', to: 'gate' }]);
    expect([r.s.player.x, r.s.player.y]).toEqual([...west.gateExit]);
  });

  it('ein noch nicht erschienenes Portal am Bett ist einfach Wiese', () => {
    const [hx, hy] = west.home;
    const [ex, ey] = west.homeExit;
    const dir = toward(west.homeExit, west.home);
    const s: State = { ...initialState(world), sleeping: false, player: { x: ex, y: ey, dir }, animals: [] };
    const r = run(s, world, dir);
    expect(types(r.events)).toEqual(['step']);
    expect([r.s.player.x, r.s.player.y]).toEqual([hx, hy]);
  });

  it('aktive Portale kommen mit dem Spielstand wieder; Unbekanntes fällt weg', () => {
    const s = initialState(world, { portals: ['lava', 'westtor' as never] });
    expect(s.portals).toEqual(['lava']);
    expect(progressOf(s).portals).toEqual(['lava']);
  });
});
