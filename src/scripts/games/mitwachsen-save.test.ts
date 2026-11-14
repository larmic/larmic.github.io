import { describe, expect, it } from 'vitest';
import {
  INDEX_KEY,
  cleanName,
  loadIndex,
  loadWorld,
  migrate,
  newWorld,
  parseWorldCode,
  progressFrom,
  saveWorld,
  withProgress,
  worldCode,
  worldKey,
  type Store,
} from './mitwachsen-save';

/** Speicher im Arbeitsspeicher wie localStorage */
function memoryStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
/** Speicher, der jeden Zugriff verweigert (privates Fenster, gesperrt) */
const brokenStore: Store = {
  getItem: () => {
    throw new Error('verboten');
  },
  setItem: () => {
    throw new Error('voll');
  },
  removeItem: () => {
    throw new Error('verboten');
  },
};

describe('Welten speichern', () => {
  it('speichert eine Welt, liest sie wieder und trägt sie als aktuelle Welt in den Index ein', () => {
    const store = memoryStore();
    const w = newWorld('a1', 12345, 'Bobos Insel', 'Bobo');
    expect(saveWorld(store, w)).toBe(true);
    expect(loadWorld(store, 'a1')).toEqual(w);
    expect(loadIndex(store)).toEqual({
      v: 2,
      worlds: [{ id: 'a1', worldName: 'Bobos Insel', figureName: 'Bobo' }],
      current: 'a1',
    });
  });

  it('verwaltet mehrere Welten; Umbenennen zieht den Index mit', () => {
    const store = memoryStore();
    saveWorld(store, newWorld('a', 1, 'Erste'));
    saveWorld(store, newWorld('b', 2, 'Zweite'));
    saveWorld(store, { ...newWorld('a', 1, 'Erste'), worldName: 'Umbenannt', figureName: 'Mo' });
    const index = loadIndex(store);
    expect(index.worlds.map((w) => [w.id, w.worldName, w.figureName])).toEqual([
      ['a', 'Umbenannt', 'Mo'],
      ['b', 'Zweite', 'Bobo'],
    ]);
    expect(index.current).toBe('a');
  });

  it('übernimmt den Fortschritt aus dem Spiel und gibt ihn für den Start zurück', () => {
    const w = newWorld('a', 1, 'X');
    const p = {
      met: ['zuhause:hase'],
      pen: [{ id: 'zuhause:hase', species: 'hase' as const }],
      openGates: ['gartentor' as const],
      position: [3, 4] as [number, number],
    };
    expect(progressFrom(withProgress(w, p))).toEqual(p);
  });

  it('läuft ohne Fehler weiter, wenn der Browser nichts speichern lässt', () => {
    expect(saveWorld(brokenStore, newWorld('a', 1, 'X'))).toBe(false);
    expect(loadWorld(brokenStore, 'a')).toBeNull();
    expect(loadIndex(brokenStore)).toEqual({ v: 2, worlds: [], current: null });
  });

  it('übersteht kaputte Daten: falsches JSON, fremder Index, unbekannte aktuelle Welt', () => {
    const store = memoryStore();
    store.setItem(worldKey('x'), '{kaputt');
    expect(loadWorld(store, 'x')).toBeNull();
    store.setItem(INDEX_KEY, JSON.stringify({ v: 2, worlds: [{ id: 'a' }, 42, { nope: true }], current: 'weg' }));
    expect(loadIndex(store)).toEqual({
      v: 2,
      worlds: [{ id: 'a', worldName: 'Meine Welt', figureName: 'Bobo' }],
      current: 'a',
    });
  });
});

describe('Format und Umzug (migrate)', () => {
  it('lehnt Fremdes ab: anderes Spiel, unbekannte Version, fehlender Seed', () => {
    const ok = newWorld('a', 1, 'X');
    expect(migrate(ok)).toEqual(ok);
    expect(migrate({ ...ok, game: 'anderes-spiel' })).toBeNull();
    expect(migrate({ ...ok, game: 'threeyear' })).toBeNull(); // threeyear gab es nur in Version 1
    expect(migrate({ ...ok, v: 99 })).toBeNull();
    expect(migrate({ ...ok, seed: 'abc' })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate([1, 2])).toBeNull();
  });

  it('verwirft unbekannte Tore und Tierarten, räumt Listen auf und repariert Felder', () => {
    const raw = {
      ...newWorld('a', 1, 'X'),
      openGates: ['gartentor', 'mondtor', 3],
      metAnimals: ['b', 'a', 'a', 7],
      penAnimals: [{ id: 'p', species: 'hase' }, { id: 'q', species: 'drache' }, 'kaputt'],
      position: [1.5, 2],
      visits: -3,
      worldName: '<script>Welt',
    };
    const w = migrate(raw)!;
    expect(w.openGates).toEqual(['gartentor']);
    expect(w.metAnimals).toEqual(['a', 'b']);
    expect(w.penAnimals).toEqual([{ id: 'p', species: 'hase' }]);
    expect(w.position).toEqual([0, 0]);
    expect(w.visits).toBe(0);
    expect(w.worldName).toBe('scriptWelt');
  });
});

describe('Namen und Welt-Code', () => {
  it('säubert Namen und nimmt sonst den Ersatz', () => {
    expect(cleanName('  Bobo  ', 'X')).toBe('Bobo');
    expect(cleanName('Ömer & Jö', 'X')).toBe('Ömer  Jö');
    expect(cleanName('<>{}', 'Ersatz')).toBe('Ersatz');
    expect(cleanName('a'.repeat(40), 'X')).toHaveLength(16);
  });

  it('macht aus dem Seed einen Code und zurück', () => {
    for (const seed of [0, 1, 123456789, 0xffffffff]) expect(parseWorldCode(worldCode(seed))).toBe(seed);
    expect(parseWorldCode(' 1a2b ')).toBe(parseInt('1A2B', 36));
    expect(parseWorldCode('hallo welt')).toBeNull();
    expect(parseWorldCode('ZZZZZZZ')).toBeNull(); // größer als 32 Bit
  });
});

describe('Umzug vom Arbeitstitel threeyear (Version 1)', () => {
  const v1 = {
    v: 1,
    game: 'threeyear',
    id: 'alt',
    seed: 4711,
    worldName: 'Bobos Insel',
    figureName: 'Bobo',
    openGates: ['gartentor'],
    metAnimals: ['zuhause:hase', 'zuhause:igel'],
    penAnimals: [{ id: 'zuhause:hase', species: 'hase' }],
    position: [2, 3],
    visits: 7,
  };

  it('macht aus einer threeyear-Welt eine Mitwachsen-Welt ab 3, ohne Fortschritt zu verlieren', () => {
    const w = migrate(v1)!;
    expect(w).toEqual({ ...v1, v: 2, game: 'mitwachsen', age: 3 });
  });

  it('übernimmt Index und Welten aus dem Speicher und schreibt sie im neuen Format zurück', () => {
    const store = memoryStore();
    store.setItem(worldKey('alt'), JSON.stringify(v1));
    store.setItem(
      INDEX_KEY,
      JSON.stringify({ v: 1, worlds: [{ id: 'alt', worldName: 'Bobos Insel', figureName: 'Bobo' }], current: 'alt' }),
    );
    const index = loadIndex(store);
    expect(index.current).toBe('alt');
    const w = loadWorld(store, 'alt')!;
    expect(w.metAnimals).toEqual(['zuhause:hase', 'zuhause:igel']);
    saveWorld(store, w);
    expect(JSON.parse(store.getItem(worldKey('alt'))!)).toMatchObject({ v: 2, game: 'mitwachsen', age: 3 });
    expect(JSON.parse(store.getItem(INDEX_KEY)!).v).toBe(2);
  });

  it('setzt ein unbekanntes Alter auf 3', () => {
    expect(migrate({ ...newWorld('a', 1, 'X'), age: 9 })!.age).toBe(3);
  });
});
