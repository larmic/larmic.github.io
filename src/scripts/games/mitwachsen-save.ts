// Spielstände von Mitwachsen im localStorage – rein bis auf den übergebenen Speicher, damit testbar.
// Ein Index listet die Welten, jede Welt liegt unter einem eigenen Schlüssel: Eine kaputte Welt reißt die anderen
// nicht mit. Jeder Zugriff fängt Fehler ab (privates Fenster, voller Speicher); das Spiel läuft dann ohne Speichern.
// Spezifikation: docs/specs/mitwachsen.md

import { GATES, SPECIES, type GateId, type SpeciesId } from '../../data/games/mitwachsen';
import type { HomeAnimal, Progress } from './mitwachsen-state';

export const PREFIX = 'larmic.games.';
export const INDEX_KEY = `${PREFIX}index`;
export const worldKey = (id: string) => `${PREFIX}world.${id}`;
export const VERSION = 3; // 1: Arbeitstitel „threeyear“ ohne Alter · 2: „mitwachsen“ mit Alter · 3: Garten statt Gehege
export const AGES = [3] as const; // Altersstufen, die es schon gibt
export type Age = (typeof AGES)[number];

/** Nur das, was vom localStorage gebraucht wird – in Tests ersetzbar */
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SavedWorld = {
  v: typeof VERSION;
  game: 'mitwachsen';
  age: Age; // Altersstufe der Welt: schaltet Fähigkeiten frei
  id: string;
  seed: number;
  worldName: string;
  figureName: string;
  openGates: GateId[];
  metAnimals: string[];
  homeAnimals: HomeAnimal[];
  position: [number, number];
  visits: number;
};
export type Index = {
  v: typeof VERSION; // Index von Version 1 hat dasselbe Format und wird übernommen
  worlds: { id: string; worldName: string; figureName: string }[];
  current: string | null;
};

export const DEFAULT_FIGURE = 'Bobo';
export const MAX_NAME = 16;

/** Namen säubern: Buchstaben, Ziffern, Leerzeichen und wenige Satzzeichen, gekürzt */
export const cleanName = (name: string, fallback: string) =>
  name
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, MAX_NAME) || fallback;

/** Welt-Code zum Weitergeben: der Seed in Basis 36, gut lesbar */
export const worldCode = (seed: number) => (seed >>> 0).toString(36).toUpperCase().padStart(7, '0');
export function parseWorldCode(code: string): number | null {
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{1,7}$/.test(clean)) return null;
  const n = parseInt(clean, 36);
  return n <= 0xffffffff ? n : null;
}

export function newWorld(
  id: string,
  seed: number,
  worldName: string,
  figureName = DEFAULT_FIGURE,
  age: Age = 3,
): SavedWorld {
  return {
    v: VERSION,
    game: 'mitwachsen',
    age,
    id,
    seed: seed >>> 0,
    worldName: cleanName(worldName, 'Meine Welt'),
    figureName: cleanName(figureName, DEFAULT_FIGURE),
    openGates: [],
    metAnimals: [],
    homeAnimals: [],
    position: [0, 0],
    visits: 0,
  };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);

/** Version 1 (Arbeitstitel „threeyear“) → 2: neuer Spielname, Alter 3 – sonst gleich */
const fromV1 = (raw: Record<string, unknown>): Record<string, unknown> => ({
  ...raw,
  v: 2,
  game: 'mitwachsen',
  age: 3,
});
/** Version 2 → 3: Aus dem Gehege wird der Garten, aus `penAnimals` werden `homeAnimals` */
function fromV2(raw: Record<string, unknown>): Record<string, unknown> {
  const { penAnimals, ...rest } = raw;
  return { ...rest, v: 3, homeAnimals: penAnimals };
}

/**
 * Gespeicherte Daten in das aktuelle Format bringen: ältere Versionen Schritt für Schritt umziehen, dann aufräumen.
 * Unbekanntes wird verworfen statt das Spiel zu stören: fremde Tore, Tierarten, Alter oder kaputte Felder.
 * Neuere Versionen als diese und fremde Spiele → null.
 */
export function migrate(input: unknown): SavedWorld | null {
  if (!isRecord(input)) return null;
  let raw = input;
  if (raw.v === 1 && raw.game === 'threeyear') raw = fromV1(raw);
  if (raw.v === 2 && raw.game === 'mitwachsen') raw = fromV2(raw);
  if (raw.v !== VERSION || raw.game !== 'mitwachsen') return null;
  if (typeof raw.id !== 'string' || typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) return null;
  const gates = new Set<string>(GATES.map((g) => g.id));
  const garden = Array.isArray(raw.homeAnimals)
    ? raw.homeAnimals.filter(
        (p): p is HomeAnimal =>
          isRecord(p) && typeof p.id === 'string' && typeof p.species === 'string' && p.species in SPECIES,
      )
    : [];
  const pos = Array.isArray(raw.position) && raw.position.length === 2 && raw.position.every(Number.isInteger);
  return {
    v: VERSION,
    game: 'mitwachsen',
    age: AGES.find((a) => a === raw.age) ?? 3,
    id: raw.id,
    seed: raw.seed >>> 0,
    worldName: cleanName(typeof raw.worldName === 'string' ? raw.worldName : '', 'Meine Welt'),
    figureName: cleanName(typeof raw.figureName === 'string' ? raw.figureName : '', DEFAULT_FIGURE),
    openGates: strings(raw.openGates).filter((g): g is GateId => gates.has(g)),
    metAnimals: [...new Set(strings(raw.metAnimals))].sort(),
    homeAnimals: garden.map((p) => ({ id: p.id, species: p.species as SpeciesId })),
    position: pos ? (raw.position as [number, number]) : [0, 0],
    visits: typeof raw.visits === 'number' && raw.visits >= 0 ? Math.floor(raw.visits) : 0,
  };
}

function read(store: Store, key: string): unknown {
  try {
    const text = store.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}
function write(store: Store, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadIndex(store: Store): Index {
  const raw = read(store, INDEX_KEY);
  if (!isRecord(raw) || ![1, 2, VERSION].includes(raw.v as number) || !Array.isArray(raw.worlds))
    return { v: VERSION, worlds: [], current: null };
  const worlds = raw.worlds
    .filter((w): w is Record<string, unknown> => isRecord(w) && typeof w.id === 'string')
    .map((w) => ({
      id: w.id as string,
      worldName: cleanName(typeof w.worldName === 'string' ? w.worldName : '', 'Meine Welt'),
      figureName: cleanName(typeof w.figureName === 'string' ? w.figureName : '', DEFAULT_FIGURE),
    }));
  const current =
    typeof raw.current === 'string' && worlds.some((w) => w.id === raw.current) ? raw.current : (worlds[0]?.id ?? null);
  return { v: VERSION, worlds, current };
}

export const saveIndex = (store: Store, index: Index) => write(store, INDEX_KEY, index);
export const loadWorld = (store: Store, id: string) => migrate(read(store, worldKey(id)));

/** Welt speichern und ihren Eintrag im Index (Name, aktuelle Welt) mitziehen */
export function saveWorld(store: Store, world: SavedWorld, makeCurrent = true): boolean {
  if (!write(store, worldKey(world.id), world)) return false;
  const index = loadIndex(store);
  const entry = { id: world.id, worldName: world.worldName, figureName: world.figureName };
  const at = index.worlds.findIndex((w) => w.id === world.id);
  if (at >= 0) index.worlds[at] = entry;
  else index.worlds.push(entry);
  if (makeCurrent) index.current = world.id;
  return saveIndex(store, index);
}

/** Fortschritt aus dem Spiel in die gespeicherte Welt übernehmen */
export const withProgress = (world: SavedWorld, p: Progress): SavedWorld => ({
  ...world,
  openGates: [...p.openGates],
  metAnimals: [...p.met],
  homeAnimals: [...p.garden],
  position: [...p.position],
});

/** Fortschritt einer gespeicherten Welt für den Spielstart */
export const progressFrom = (w: SavedWorld): Progress => ({
  met: [...w.metAnimals],
  garden: [...w.homeAnimals],
  openGates: [...w.openGates],
  position: [...w.position],
});
