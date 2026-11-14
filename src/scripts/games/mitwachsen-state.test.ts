import { describe, expect, it } from 'vitest';
import type { Dir } from '../../lib/games/front';
import { GATES, HOME, animalId } from '../../data/games/mitwachsen';
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
    cell: (x, y) => ({ h: 1, ground: 'grass', deco: null, region: 'zuhause', solid: false, ...cells[`${x},${y}`] }),
  };
}
const animal = (id: string, x: number, y: number, extra: Partial<Animal> = {}): Animal => ({
  id,
  species: 'hase',
  x,
  y,
  dir: 's',
  mode: 'wander',
  home: { kind: 'region', region: 'zuhause' },
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

  it('schickt folgende Tiere beim Schlafen heim', () => {
    const world = createWorld(1);
    let { s } = run(initialState(world), world, 'e');
    const hase = animalId('zuhause', 'hase');
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

  it('läuft nicht durch Wasser, Bäume, Zäune oder geschlossene Tore', () => {
    const w = fakeWorld({
      '1,0': { ground: 'water', h: 0 },
      '0,1': { deco: 'tree', solid: true },
      '-1,0': { deco: 'gate', gate: 'gartentor' },
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
    const r = run(awake(w, 0, 0, [animal('a', 1, 1)]), w, ACT);
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
      for (let y = -10; y <= 10; y++) if (Math.abs(x) > 2 || Math.abs(y) > 2) cells[`${x},${y}`] = { region: 'wiese' };
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

describe('Gehege', () => {
  it('ein folgendes Tier bleibt im Gehege und verlässt es nie wieder', () => {
    const world = createWorld(1);
    const [gx, gy] = HOME.penGate;
    // Figur steht unter der Öffnung, der Hase folgt; dann durch die Öffnung hinein
    let s = awake(world, gx, gy + 1, [animal('zuhause:hase', gx, gy + 2)]);
    s = { ...s, player: { ...s.player, dir: 's' } };
    s = run(s, world, ACT).s;
    const r = run(s, world, 'n', 'n', 'n');
    s = r.s;
    expect(r.events).toContainEqual({ type: 'pen', id: 'zuhause:hase' });
    expect(s.followers).toEqual([]);
    expect(s.pen).toEqual([{ id: 'zuhause:hase', species: 'hase' }]);
    s = run(s, world, 's', 's', 's', 's').s; // Figur geht hinaus und weg
    for (let i = 0; i < 3000; i++) {
      s = run(s, world, TICK).s;
      const a = s.animals.find((x) => x.id === 'zuhause:hase')!;
      expect(world.cell(a.x, a.y).pen, `${a.x},${a.y}`).toBe(true);
    }
  });

  it('Tiere im Gehege singen bei der Aktion, folgen aber nicht', () => {
    const w = fakeWorld({ '1,0': { pen: true }, '0,0': { pen: true } });
    const r = run(awake(w, 0, 0, [animal('a', 1, 0, { mode: 'pen', home: { kind: 'pen' } })]), w, ACT);
    expect(types(r.events)).toEqual(['sing']);
    expect(r.s.followers).toEqual([]);
  });
});

describe('Tore', () => {
  it('öffnen genau dann, wenn alle Tiere ihrer Gegend getroffen sind', () => {
    const world = createWorld(1);
    const s0 = initialState(world);
    for (const g of GATES) {
      const ids = regionAnimals(g.region);
      const most = initialState(world, { met: ids.slice(0, -1) });
      expect(most.openGates).not.toContain(g.id);
      expect(initialState(world, { met: ids }).openGates).toContain(g.id);
    }
    expect(s0.openGates).toEqual([]);
  });

  it('das letzte getroffene Tier öffnet das Tor sofort (mit Ereignis)', () => {
    const world = createWorld(1);
    let s = initialState(world, { met: [animalId('zuhause', 'igel')] });
    s = {
      ...s,
      sleeping: false,
      player: { x: 0, y: 0, dir: 'e' },
      animals: [animal(animalId('zuhause', 'hase'), 1, 0)],
    };
    const r = run(s, world, ACT);
    expect(r.events).toContainEqual({ type: 'gate', id: 'gartentor' });
    const gate = GATES.find((g) => g.id === 'gartentor')!;
    expect(standHeight(world, r.s.openGates, gate.at[0], gate.at[1])).toBe(1);
  });
});

describe('Rufen', () => {
  it('ruft, wenn weder Tier noch Bett in der Nähe sind', () => {
    const w = fakeWorld();
    expect(types(run(awake(w, 10, 10), w, ACT).events)).toEqual(['call']);
  });
});

describe('Spielstand', () => {
  it('stellt Getroffene, offene Tore und Tiere im Gehege wieder her', () => {
    const world = createWorld(4);
    const met = regionAnimals('zuhause');
    const s = initialState(world, { met, pen: [{ id: 'wild:0:2:0', species: 'fuchs' }] });
    expect(s.met).toEqual([...met].sort());
    expect(s.openGates).toEqual(['gartentor']);
    const fox = s.animals.find((a) => a.id === 'wild:0:2:0')!;
    expect(fox.mode).toBe('pen');
    expect(world.cell(fox.x, fox.y).pen).toBe(true);
    const p = progressOf(s);
    expect(p.met).toEqual(s.met);
    expect(p.pen).toEqual([{ id: 'wild:0:2:0', species: 'fuchs' }]);
  });

  it('ein Tier im Gehege taucht nicht zusätzlich in seiner Gegend auf', () => {
    const world = createWorld(4);
    const s = initialState(world, { pen: [{ id: animalId('zuhause', 'hase'), species: 'hase' }] });
    expect(s.animals.filter((a) => a.id === animalId('zuhause', 'hase'))).toHaveLength(1);
  });
});

describe('Invarianten bei wildem Drücken', () => {
  const DIRS: Dir[] = ['n', 's', 'e', 'w'];
  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: Figur steht immer begehbar, nie zwei auf einem Feld, Gehege-Tiere bleiben drin, alles wiederholbar`, () => {
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
          for (const a of s.animals) if (a.mode === 'pen') expect(world.cell(a.x, a.y).pen).toBe(true);
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
    let s = awake(world, bx + 1, by, [animal('zuhause:hase', bx + 1, by + 1, { mode: 'follow' })]);
    s = { ...s, followers: ['zuhause:hase'], player: { ...s.player, dir: 'n' } };
    const r = run(s, world, ACT);
    expect(r.s.sleeping).toBe(true);
  });

  it('ein Tier im Gehege rückt beiseite, statt den Eingang zu versperren', () => {
    const world = createWorld(1);
    const [gx, gy] = HOME.penGate;
    let s = awake(world, gx, gy, [animal('zuhause:igel', gx, gy - 1, { mode: 'pen', home: { kind: 'pen' } })]);
    s = run(s, world, 'n').s; // singt
    const r = run(s, world, 'n'); // zweites Mal: Tier rückt im Gehege beiseite, Figur geht hinein
    expect([r.s.player.x, r.s.player.y]).toEqual([gx, gy - 1]);
    const igel = r.s.animals[0];
    expect(world.cell(igel.x, igel.y).pen).toBe(true);
    expect([igel.x, igel.y]).not.toEqual([gx, gy - 1]);
  });

  it('ein folgendes Tier, das per Platztausch ins Gehege kommt, bleibt dort', () => {
    const world = createWorld(1);
    const [gx, gy] = HOME.penGate;
    let s = awake(world, gx, gy - 1, [animal('zuhause:hase', gx, gy, { mode: 'follow' })]);
    s = { ...s, followers: ['zuhause:hase'] };
    s = run(s, world, 's').s; // singt
    const r = run(s, world, 's'); // tauscht: Hase steht jetzt im Gehege
    expect(r.events).toContainEqual({ type: 'pen', id: 'zuhause:hase' });
    expect(r.s.followers).toEqual([]);
    expect(r.s.pen.map((p) => p.id)).toEqual(['zuhause:hase']);
  });
});

describe('Eingang des Geheges', () => {
  it('neue Tiere rücken nach hinten, das Feld hinter der Öffnung bleibt frei für das nächste', () => {
    const world = createWorld(1);
    const [gx, gy] = HOME.penGate;
    let s = awake(world, gx, gy + 1, [
      animal('zuhause:hase', gx, gy + 2, { mode: 'follow' }),
      animal('zuhause:igel', gx, gy + 3, { mode: 'follow', species: 'igel' }),
    ]);
    s = { ...s, followers: ['zuhause:hase', 'zuhause:igel'] };
    const r = run(s, world, 'n', 'n', 'n', 'n');
    expect(r.s.pen.map((p) => p.id).sort()).toEqual(['zuhause:hase', 'zuhause:igel']);
    expect(r.s.followers).toEqual([]);
    expect(r.s.animals.some((a) => a.x === gx && a.y === gy - 1)).toBe(false);
  });

  it('Tiere im Gehege laufen nie auf das Feld hinter der Öffnung', () => {
    const world = createWorld(2);
    const [gx, gy] = HOME.penGate;
    const pen = Array.from({ length: 6 }, (_, i) => ({ id: `wild:9:9:${i}`, species: 'hase' as const }));
    let s: State = { ...initialState(world, { pen }), sleeping: false, player: { x: 0, y: 4, dir: 's' } };
    for (let i = 0; i < 3000; i++) {
      s = step(s, world, TICK).state;
      expect(s.animals.some((a) => a.mode === 'pen' && a.x === gx && a.y === gy - 1)).toBe(false);
    }
  });
});

describe('Durchgänge bleiben frei', () => {
  it('umherlaufende Tiere bleiben nie an Toren, Brücke, Gehege-Öffnung oder Pfad stehen', () => {
    const world = createWorld(5);
    const passages = [...GATES.map((g) => g.at), HOME.penGate, HOME.exit].flatMap(([x, y]) => [
      `${x},${y}`,
      `${x + 1},${y}`,
      `${x - 1},${y}`,
      `${x},${y + 1}`,
      `${x},${y - 1}`,
    ]);
    // Alle Tore offen, Figur weit weg: Die Tiere laufen lange frei umher
    let s: State = {
      ...initialState(world, { openGates: ['gartentor', 'bruecke'] }),
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
