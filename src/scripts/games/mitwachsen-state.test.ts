import { describe, expect, it } from 'vitest';
import type { Dir } from '../../lib/games/front';
import { HOME, animalId } from '../../data/games/mitwachsen';
import {
  SLEEP_LOCK,
  SWAP_WINDOW,
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

/** Kleine Testwelt: überall flaches Gras des Zuhauses, einzelne Felder überschreibbar */
function fakeWorld(cells: Record<string, Partial<Cell>> = {}): World {
  return {
    seed: 1,
    cell: (x, y) => ({ h: 1, ground: 'grass', deco: null, region: 'lichtung', solid: false, ...cells[`${x},${y}`] }),
    gates: new Map(),
    spawns: new Map(),
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
const TICK: Cmd = { type: 'tick' };
const types = (e: GameEvent[]) => e.map((x) => x.type);

describe('Aufwachen und Schlafen', () => {
  it('startet schlafend im Bett; die erste Taste weckt die Figur an einem freien Platz daneben', () => {
    const world = createWorld(1, { garden: true });
    const s0 = initialState(world);
    expect(s0.sleeping).toBe(true);
    expect([s0.player.x, s0.player.y]).toEqual([...HOME.bed]);
    const { s, events } = run(s0, world, 'e');
    expect(s.sleeping).toBe(false);
    expect([s.player.x, s.player.y]).toEqual([...HOME.wake[0]]);
    expect(types(events)).toEqual(['wake']);
  });

  it('legt sich mit der Aktion am Bett schlafen; Tasten wecken erst nach der Sperrzeit', () => {
    const world = createWorld(1, { garden: true });
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

  it('schickt folgende Tiere beim Schlafen heim', () => {
    const world = createWorld(1, { garden: true });
    let { s } = run(initialState(world), world, 'e');
    const hase = animalId('lichtung', 'hase');
    // Hase direkt vor die Figur setzen und mitnehmen
    s = {
      ...s,
      animals: s.animals.map((a) => (a.id === hase ? { ...a, x: s.player.x + 1, y: s.player.y } : a)),
      player: { ...s.player, dir: 'e' },
    };
    s = run(s, world, ACT).s;
    expect(s.followers).toEqual([hase]);
    s = run(s, world, 'w', 'w').s; // zurück ans Bett
    s = { ...s, player: { ...s.player, x: HOME.bed[0] + 1, y: HOME.bed[1], dir: 'w' } };
    s = run(s, world, ACT).s;
    expect(s.sleeping).toBe(true);
    expect(s.followers).toEqual([]);
    expect(s.animals.find((a) => a.id === hase)!.mode).toBe('wander');
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
      '-1,0': { deco: 'biggate', gate: 'nordtor' },
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

  it('Hineinlaufen lässt singen ohne Folgen; zweimal kurz hintereinander tauscht den Platz', () => {
    const w = fakeWorld();
    let r = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e');
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.followers).toEqual([]);
    expect(r.s.player.x).toBe(0);
    r = run(r.s, w, 'e');
    expect(types(r.events)).toEqual(['swap']);
    expect([r.s.player.x, r.s.animals[0].x]).toEqual([1, 0]);
  });

  it('tauscht nach Ablauf der Zeit nicht mehr, sondern singt wieder', () => {
    const w = fakeWorld();
    let s = run(awake(w, 0, 0, [animal('a', 1, 0)]), w, 'e').s;
    for (let i = 0; i <= SWAP_WINDOW; i++) s = run(s, w, TICK).s;
    const r = run(s, w, 'e');
    expect(types(r.events)).toEqual(['sing']);
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

describe('Garten', () => {
  it('ein folgendes Tier bleibt im Garten und verlässt es nie wieder', () => {
    const world = createWorld(1, { garden: true });
    const [gx, gy] = HOME.gardenGate;
    // Figur steht unter dem Rosenbogen, der Hase folgt; dann hindurch in den Garten
    let s = awake(world, gx, gy + 1, [animal('lichtung:hase', gx, gy + 2)]);
    s = { ...s, player: { ...s.player, dir: 's' } };
    s = run(s, world, ACT).s;
    const r = run(s, world, 'n', 'n', 'n');
    s = r.s;
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase' });
    expect(s.followers).toEqual([]);
    expect(s.garden).toEqual([{ id: 'lichtung:hase', species: 'hase' }]);
    s = run(s, world, 's', 's', 's', 's').s; // Figur geht hinaus und weg
    for (let i = 0; i < 3000; i++) {
      s = run(s, world, TICK).s;
      const a = s.animals.find((x) => x.id === 'lichtung:hase')!;
      expect(world.cell(a.x, a.y).garden, `${a.x},${a.y}`).toBe(true);
    }
  });

  it('Tiere im Garten singen bei der Aktion, folgen aber nicht', () => {
    const w = fakeWorld({ '1,0': { garden: true }, '0,0': { garden: true } });
    const r = run(awake(w, 0, 0, [animal('a', 1, 0, { mode: 'home', home: { kind: 'garden' } })]), w, ACT);
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.followers).toEqual([]);
  });
});

describe('Große Tore', () => {
  it('bleiben verschlossen, auch wenn alle Tiere der Lichtung gefunden sind', () => {
    const world = createWorld(1);
    const s = initialState(world, { met: regionAnimals('lichtung') });
    expect(s.openGates).toEqual([]);
    for (const [x, y] of [...world.gates.values()].flat()) expect(standHeight(world, s.openGates, x, y)).toBeNull();
  });

  it('übernehmen aus einem alten Spielstand kein offenes, verschlossenes Tor', () => {
    expect(initialState(createWorld(1), { openGates: ['nordtor'] }).openGates).toEqual([]);
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
    const world = createWorld(4, { garden: true });
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
    const world = createWorld(4, { garden: true });
    const s = initialState(world, { garden: [{ id: animalId('lichtung', 'hase'), species: 'hase' }] });
    expect(s.animals.filter((a) => a.id === animalId('lichtung', 'hase'))).toHaveLength(1);
  });
});

describe('Invarianten bei wildem Drücken', () => {
  const DIRS: Dir[] = ['n', 's', 'e', 'w'];
  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: Figur steht immer begehbar, nie zwei auf einem Feld, Garten-Tiere bleiben drin, alles wiederholbar`, () => {
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
    const world = createWorld(1, { garden: true });
    const [bx, by] = HOME.bed;
    let s = awake(world, bx + 1, by, [animal('lichtung:hase', bx + 1, by + 1, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'], player: { ...s.player, dir: 'n' } };
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
  });

  it('ein Tier im Garten rückt beiseite, statt den Eingang zu versperren', () => {
    const world = createWorld(1, { garden: true });
    const [gx, gy] = HOME.gardenGate;
    let s = awake(world, gx, gy, [animal('lichtung:igel', gx, gy - 1, { mode: 'home', home: { kind: 'garden' } })]);
    s = run(s, world, 'n').s; // singt
    const r = run(s, world, 'n'); // zweites Mal: Tier rückt im Garten beiseite, Figur geht hinein
    expect([r.s.player.x, r.s.player.y]).toEqual([gx, gy - 1]);
    const igel = r.s.animals[0];
    expect(world.cell(igel.x, igel.y).garden).toBe(true);
    expect([igel.x, igel.y]).not.toEqual([gx, gy - 1]);
  });

  it('ein folgendes Tier, das per Platztausch in den Garten kommt, bleibt dort', () => {
    const world = createWorld(1, { garden: true });
    const [gx, gy] = HOME.gardenGate;
    let s = awake(world, gx, gy - 1, [animal('lichtung:hase', gx, gy, { mode: 'follow' })]);
    s = { ...s, followers: ['lichtung:hase'] };
    s = run(s, world, 's').s; // singt
    const r = run(s, world, 's'); // tauscht: Hase steht jetzt im Garten
    expect(r.events).toContainEqual({ type: 'home', id: 'lichtung:hase' });
    expect(r.s.followers).toEqual([]);
    expect(r.s.garden.map((p) => p.id)).toEqual(['lichtung:hase']);
  });
});

describe('Eingang des Gartens', () => {
  it('neue Tiere rücken nach hinten, das Feld hinter dem Rosenbogen bleibt frei für das nächste', () => {
    const world = createWorld(1, { garden: true });
    const [gx, gy] = HOME.gardenGate;
    let s = awake(world, gx, gy + 1, [
      animal('lichtung:hase', gx, gy + 2, { mode: 'follow' }),
      animal('lichtung:igel', gx, gy + 3, { mode: 'follow', species: 'igel' }),
    ]);
    s = { ...s, followers: ['lichtung:hase', 'lichtung:igel'] };
    const r = run(s, world, 'n', 'n', 'n', 'n');
    expect(r.s.garden.map((p) => p.id).sort()).toEqual(['lichtung:hase', 'lichtung:igel']);
    expect(r.s.followers).toEqual([]);
    expect(r.s.animals.some((a) => a.x === gx && a.y === gy - 1)).toBe(false);
  });

  it('Tiere im Garten laufen nie auf das Feld hinter dem Rosenbogen', () => {
    const world = createWorld(2, { garden: true });
    const [gx, gy] = HOME.gardenGate;
    const garden = Array.from({ length: 6 }, (_, i) => ({ id: `wild:9:9:${i}`, species: 'hase' as const }));
    let s: State = { ...initialState(world, { garden }), sleeping: false, player: { x: 0, y: 4, dir: 's' } };
    for (let i = 0; i < 3000; i++) {
      s = step(s, world, TICK).state;
      expect(s.animals.some((a) => a.mode === 'home' && a.x === gx && a.y === gy - 1)).toBe(false);
    }
  });
});

describe('Durchgänge bleiben frei', () => {
  it('umherlaufende Tiere bleiben nie an Toren oder am Rosenbogen stehen', () => {
    const world = createWorld(5, { garden: true });
    const passages = [...[...world.gates.values()].flat(), HOME.gardenGate].flatMap(([x, y]) => [
      `${x},${y}`,
      `${x + 1},${y}`,
      `${x - 1},${y}`,
      `${x},${y + 1}`,
      `${x},${y - 1}`,
    ]);
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
