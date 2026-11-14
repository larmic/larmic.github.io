// Inhalte von threeyear: Gegenden, Tore, Zuhause, Tiere (Modell und Ton) und Figur.
// Neue Gegenden und Tiere kommen hier dazu; Regeln und Generator bleiben gleich.
// Konzept: docs/games/threeyear.md · Spec: docs/specs/threeyear.md

import { eyes, type Part } from '../../lib/games/front';

export type RegionId = 'zuhause' | 'wiese' | 'teich';
export type SpeciesId =
  'hase' | 'igel' | 'schaf' | 'kuh' | 'biene' | 'ente' | 'frosch' | 'schildkroete' | 'fuchs' | 'eichhoernchen';
export type GateId = 'gartentor' | 'bruecke';

export type Rect = { x0: number; y0: number; x1: number; y1: number }; // Grenzen eingeschlossen
export type Point = readonly [number, number];

export type Region = {
  id: RegionId;
  name: string;
  area: Rect; // begehbares Innere; der Ring darum ist Fels, außer wo BORDERS etwas anderes sagt
  animals: readonly { species: SpeciesId; at: Point }[];
};

export type Gate = {
  id: GateId;
  kind: 'tor' | 'bruecke'; // Tor im Zaun oder Brücke übers Wasser
  at: Point;
  region: RegionId; // Gegend, in der das Tor steht: Es öffnet, wenn alle ihre Tiere getroffen sind
  leadsTo: RegionId;
  sign: Point; // Tafel mit den Tieren der Gegend
};

/** Tiere einer Gegend haben die Kennung `<gegend>:<art>` */
export const animalId = (region: RegionId, species: SpeciesId) => `${region}:${species}`;

export const REGIONS: readonly Region[] = [
  {
    id: 'zuhause',
    name: 'Zuhause',
    area: { x0: -6, y0: -4, x1: 6, y1: 5 },
    animals: [
      { species: 'hase', at: [-4, 2] },
      { species: 'igel', at: [3, 3] },
    ],
  },
  {
    id: 'wiese',
    name: 'Blumenwiese',
    area: { x0: 8, y0: -4, x1: 19, y1: 5 },
    animals: [
      { species: 'schaf', at: [12, 2] },
      { species: 'kuh', at: [16, -1] },
      { species: 'biene', at: [10, -2] },
    ],
  },
  {
    id: 'teich',
    name: 'Teich',
    area: { x0: 8, y0: -16, x1: 19, y1: -6 },
    animals: [
      { species: 'ente', at: [11, -8] },
      { species: 'frosch', at: [16, -14] },
      { species: 'schildkroete', at: [10, -14] },
    ],
  },
];

/** Grenzen zwischen Gegenden, die kein Fels sind (überschreiben den Felsring) */
export const BORDERS: readonly { area: Rect; kind: 'fence' | 'water' | 'path' }[] = [
  { area: { x0: 7, y0: -4, x1: 7, y1: 5 }, kind: 'fence' }, // Zuhause | Blumenwiese
  { area: { x0: 8, y0: -5, x1: 19, y1: -5 }, kind: 'water' }, // Blumenwiese | Teich
  { area: { x0: 0, y0: 6, x1: 0, y1: 6 }, kind: 'path' }, // Pfad vom Zuhause in die endlose Landschaft
];

export const GATES: readonly Gate[] = [
  { id: 'gartentor', kind: 'tor', at: [7, 0], region: 'zuhause', leadsTo: 'wiese', sign: [6, -1] },
  { id: 'bruecke', kind: 'bruecke', at: [13, -5], region: 'wiese', leadsTo: 'teich', sign: [12, -4] },
];

export const HOME = {
  bed: [-3, -3] as Point,
  wake: [
    [-2, -3],
    [-3, -2],
    [-2, -2],
    [-4, -3],
    [-4, -2],
  ] as readonly Point[], // freie Plätze am Bett zum Aufwachen
  pen: { x0: 1, y0: -3, x1: 4, y1: -1 } as Rect, // Inneres des Geheges, Zaun ringsum
  penGate: [2, 0] as Point, // Öffnung im Zaun
  exit: [0, 6] as Point, // Pfad in die endlose Landschaft
  trees: [
    [-6, -4],
    [-6, 5],
    [5, 5],
    [-1, -4],
  ] as readonly Point[],
};

/** Teich: Wasser in einer Ellipse */
export const POND = { cx: 13.5, cy: -11, rx: 3.2, ry: 2.3 };

// ---------- Tiere ----------

/** Ton eines Tiers: Folge von Tönen (Hz) mit Wellenform; alle aus der Pentatonik C–D–E–G–A, klingen also zusammen */
export type Tone = {
  notes: readonly number[];
  wave: OscillatorType;
  len: number;
  gap: number;
  slide?: number;
  gain?: number;
};

export type Species = { id: SpeciesId; name: string; scale: number; parts: readonly Part[]; tone: Tone };

const DARK = '#3a3a44';
const legs = (front: number, back: number, half: number, size: number, h: number, color = DARK): Part[] => [
  [front, -half, 0, size, size, h, color],
  [front, half - size, 0, size, size, h, color],
  [back, -half, 0, size, size, h, color],
  [back, half - size, 0, size, size, h, color],
];

export const SPECIES: Record<SpeciesId, Species> = {
  hase: {
    id: 'hase',
    name: 'Hase',
    scale: 1.4,
    tone: { notes: [1046.5, 1318.5], wave: 'triangle', len: 0.1, gap: 0.1, gain: 0.16 },
    parts: [
      [-0.22, -0.14, 0, 0.36, 0.28, 0.26, '#cbbfae'],
      [-0.3, -0.06, 0.12, 0.08, 0.12, 0.12, '#f6f3ec'],
      [0.08, -0.12, 0.18, 0.24, 0.24, 0.22, '#cbbfae'],
      [0.31, -0.03, 0.22, 0.02, 0.06, 0.04, '#e7a3b0'],
      [0.1, -0.1, 0.4, 0.07, 0.07, 0.26, '#cbbfae', '#e7a3b0'],
      [0.1, 0.03, 0.4, 0.07, 0.07, 0.26, '#cbbfae', '#e7a3b0'],
      ...eyes(0.32, 0.12, 0.3, 0.05, 0.06, 0.03),
    ],
  },
  igel: {
    id: 'igel',
    name: 'Igel',
    scale: 1.4,
    tone: { notes: [261.63], wave: 'sine', len: 0.34, gap: 0, slide: 0.92, gain: 0.22 },
    parts: [
      [-0.2, -0.16, 0, 0.34, 0.32, 0.22, '#6a5038', '#8a6a4a'],
      // Stacheln
      [-0.16, -0.13, 0.22, 0.06, 0.06, 0.07, '#4a3828'],
      [-0.04, -0.02, 0.22, 0.06, 0.06, 0.08, '#4a3828'],
      [-0.15, 0.06, 0.22, 0.06, 0.06, 0.07, '#4a3828'],
      [0.04, -0.12, 0.22, 0.06, 0.06, 0.06, '#4a3828'],
      [0.03, 0.08, 0.22, 0.06, 0.06, 0.06, '#4a3828'],
      [0.14, -0.1, 0.02, 0.12, 0.2, 0.14, '#e8c9a0'],
      [0.26, -0.02, 0.06, 0.03, 0.04, 0.04, '#2a2018'],
      ...eyes(0.26, 0.1, 0.1, 0.04, 0.04, 0.03),
    ],
  },
  schaf: {
    id: 'schaf',
    name: 'Schaf',
    scale: 1.4,
    tone: { notes: [392, 392], wave: 'triangle', len: 0.16, gap: 0.04, slide: 0.94, gain: 0.15 },
    parts: [
      ...legs(0.12, -0.2, 0.12, 0.08, 0.16),
      [-0.28, -0.18, 0.16, 0.5, 0.36, 0.3, '#f3efe6', '#ffffff'],
      [0.2, -0.11, 0.3, 0.2, 0.22, 0.22, DARK],
      ...eyes(0.4, 0.11, 0.4, 0.05, 0.05, 0.03, '#f6f3ec'),
    ],
  },
  kuh: {
    id: 'kuh',
    name: 'Kuh',
    scale: 1.5,
    tone: { notes: [196], wave: 'sawtooth', len: 0.45, gap: 0, slide: 0.85, gain: 0.07 },
    parts: [
      ...legs(0.16, -0.26, 0.15, 0.09, 0.2),
      [-0.32, -0.18, 0.2, 0.6, 0.36, 0.3, '#f3efe6'],
      [-0.2, -0.19, 0.3, 0.16, 0.02, 0.14, '#2a2a30'],
      [0.06, 0.17, 0.26, 0.14, 0.02, 0.16, '#2a2a30'],
      [-0.1, -0.08, 0.5, 0.2, 0.18, 0.01, '#2a2a30'],
      [0.24, -0.13, 0.34, 0.2, 0.26, 0.24, '#f3efe6'],
      [0.44, -0.1, 0.34, 0.06, 0.2, 0.1, '#e7a3b0'],
      [0.28, -0.15, 0.58, 0.05, 0.05, 0.07, '#e8e2c8'],
      [0.28, 0.1, 0.58, 0.05, 0.05, 0.07, '#e8e2c8'],
      ...eyes(0.44, 0.13, 0.48, 0.05, 0.05, 0.05),
    ],
  },
  biene: {
    id: 'biene',
    name: 'Biene',
    scale: 1.4,
    tone: { notes: [880, 987.77, 880], wave: 'square', len: 0.06, gap: 0.02, gain: 0.04 },
    parts: [
      [-0.12, -0.07, 0.34, 0.24, 0.14, 0.14, '#f2c94c'],
      [-0.04, -0.075, 0.34, 0.05, 0.15, 0.15, '#2a2018'],
      [0.05, -0.075, 0.34, 0.05, 0.15, 0.15, '#2a2018'],
      [-0.06, -0.16, 0.48, 0.12, 0.1, 0.02, 'rgba(255,255,255,.85)'],
      [-0.06, 0.06, 0.48, 0.12, 0.1, 0.02, 'rgba(255,255,255,.85)'],
      ...eyes(0.12, 0.07, 0.42, 0.03, 0.04, 0.02),
    ],
  },
  ente: {
    id: 'ente',
    name: 'Ente',
    scale: 1.4,
    tone: { notes: [440, 440], wave: 'square', len: 0.1, gap: 0.05, slide: 0.7, gain: 0.06 },
    parts: [
      [-0.16, -0.12, 0, 0.3, 0.24, 0.2, '#f2d14b'],
      [-0.22, -0.06, 0.1, 0.06, 0.12, 0.08, '#f2d14b'],
      [0.04, -0.09, 0.18, 0.16, 0.18, 0.18, '#f2d14b'],
      [0.2, -0.05, 0.22, 0.08, 0.1, 0.04, '#f08a3c'],
      ...eyes(0.2, 0.09, 0.28, 0.04, 0.05, 0.02),
    ],
  },
  frosch: {
    id: 'frosch',
    name: 'Frosch',
    scale: 1.4,
    tone: { notes: [293.66, 220], wave: 'triangle', len: 0.12, gap: 0.03, gain: 0.18 },
    parts: [
      [-0.2, -0.18, 0, 0.4, 0.36, 0.2, '#5fa64a', '#6dbd57'],
      [0.08, -0.16, 0.2, 0.1, 0.1, 0.1, '#f2d14b'],
      [0.08, 0.06, 0.2, 0.1, 0.1, 0.1, '#f2d14b'],
      [0.12, -0.13, 0.24, 0.07, 0.04, 0.04, '#1d2233', null, 'f'],
      [0.12, 0.09, 0.24, 0.07, 0.04, 0.04, '#1d2233', null, 'f'],
    ],
  },
  schildkroete: {
    id: 'schildkroete',
    name: 'Schildkröte',
    scale: 1.4,
    tone: { notes: [329.63], wave: 'sine', len: 0.4, gap: 0, slide: 1.12, gain: 0.2 },
    parts: [
      ...legs(0.08, -0.16, 0.16, 0.08, 0.08, '#8fbf6a'),
      [-0.2, -0.17, 0.06, 0.38, 0.34, 0.16, '#4f8a3a', '#6aa64f'],
      [-0.1, -0.1, 0.22, 0.2, 0.2, 0.04, '#3f7a2e'],
      [0.18, -0.07, 0.08, 0.14, 0.14, 0.12, '#8fbf6a'],
      ...eyes(0.32, 0.07, 0.14, 0.03, 0.04, 0.02),
    ],
  },
  fuchs: {
    id: 'fuchs',
    name: 'Fuchs',
    scale: 1.3,
    tone: { notes: [392], wave: 'triangle', len: 0.32, gap: 0, slide: 1.33, gain: 0.18 },
    parts: [
      ...legs(0.1, -0.18, 0.1, 0.06, 0.12),
      [-0.22, -0.12, 0.12, 0.42, 0.24, 0.2, '#e0782e'],
      [-0.42, -0.06, 0.16, 0.2, 0.12, 0.12, '#e0782e'],
      [-0.48, -0.06, 0.16, 0.06, 0.12, 0.12, '#f6f3ec'],
      [0.14, -0.12, 0.22, 0.2, 0.24, 0.2, '#e0782e'],
      [0.34, -0.06, 0.22, 0.1, 0.12, 0.08, '#f6f3ec'],
      [0.44, -0.02, 0.26, 0.02, 0.04, 0.04, '#3a2a22'],
      [0.18, -0.11, 0.42, 0.06, 0.07, 0.09, '#e0782e', '#3a2a22'],
      [0.18, 0.04, 0.42, 0.06, 0.07, 0.09, '#e0782e', '#3a2a22'],
      ...eyes(0.34, 0.12, 0.33, 0.05, 0.05, 0.04),
    ],
  },
  eichhoernchen: {
    id: 'eichhoernchen',
    name: 'Eichhörnchen',
    scale: 1.4,
    tone: { notes: [783.99, 880, 783.99, 880], wave: 'sine', len: 0.06, gap: 0.01, gain: 0.13 },
    parts: [
      [-0.3, -0.1, 0, 0.14, 0.2, 0.3, '#b4551f'],
      [-0.36, -0.11, 0.28, 0.2, 0.22, 0.26, '#c45f28'],
      [-0.12, -0.1, 0, 0.28, 0.2, 0.26, '#c45f28'],
      [0.15, -0.07, 0.02, 0.02, 0.14, 0.18, '#f0d9b5'],
      [0.08, -0.1, 0.2, 0.2, 0.2, 0.2, '#c45f28'],
      [0.1, -0.09, 0.4, 0.05, 0.05, 0.09, '#b4551f'],
      [0.1, 0.04, 0.4, 0.05, 0.05, 0.09, '#b4551f'],
      ...eyes(0.28, 0.1, 0.3, 0.05, 0.05, 0.02),
    ],
  },
};

/** Arten, die frei in der endlosen Landschaft unterwegs sind */
export const WILD_SPECIES: readonly SpeciesId[] = ['hase', 'igel', 'schaf', 'fuchs', 'eichhoernchen', 'ente'];

// ---------- Figur ----------

export type Look = { skin: string; hair: string; shirt: string; sleeve: string; pants: string };
export const LOOK: Look = { skin: '#e9b48e', hair: '#c9a35b', shirt: '#3f7fd0', sleeve: '#3570b8', pants: '#2d3448' };

export const figureParts = (l: Look): Part[] => [
  [-0.06, -0.2, 0, 0.12, 0.17, 0.34, l.pants],
  [-0.06, 0.03, 0, 0.12, 0.17, 0.34, l.pants],
  [-0.12, -0.22, 0.34, 0.24, 0.44, 0.4, l.shirt],
  [-0.06, -0.3, 0.4, 0.12, 0.08, 0.32, l.sleeve],
  [-0.06, 0.22, 0.4, 0.12, 0.08, 0.32, l.sleeve],
  [-0.22, -0.23, 0.74, 0.46, 0.46, 0.4, l.skin],
  [-0.23, -0.24, 1.04, 0.48, 0.48, 0.14, l.hair],
  [-0.25, -0.24, 0.84, 0.08, 0.48, 0.3, l.hair],
  ...eyes(0.24, 0.23, 0.88, 0.07, 0.1, 0.06),
];

// ---------- Farben der Spielwelt (Spielgrafik wie die Texturen, nicht Oberfläche) ----------

export const GAME_COLORS = {
  heart: '#e0577a',
  note: '#ffffff',
  water: '#5aa6e8',
  waterLight: '#8cc6f0',
  night: 'rgba(14, 18, 44, 0.62)',
  star: '#fff7d6',
  fence: '#a0703f',
  fenceDark: '#7a5432',
  board: '#c0915b',
  ink: '#1d2838',
  flowers: ['#e77fb3', '#f2d14b', '#f39a3d', '#ffffff', '#b48cf0', '#5aa6e8'],
  bed: { frame: '#a0703f', pillow: '#e8e2d6', blanket: '#5aa6e8' },
  arrow: '#ffffff',
} as const;
