// Inhalte von Mitwachsen (Stufe ab 3): Gegenden, Tore, Zuhause, Tiere (Modell und Ton) und Figur.
// Neue Gegenden und Tiere kommen hier dazu; Regeln und Generator bleiben gleich.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import { eyes, type Part } from '../../lib/games/front';

export type RegionId = 'lichtung';
export type SpeciesId =
  'hase' | 'igel' | 'schaf' | 'kuh' | 'biene' | 'ente' | 'frosch' | 'schildkroete' | 'fuchs' | 'eichhoernchen';
export type GateTheme = 'eis' | 'sand' | 'wasser' | 'lava' | 'hoehle' | 'wald' | 'wolken' | 'pilze';
export type GateId = GateTheme; // je Welt genau ein Tor

export type Rect = { x0: number; y0: number; x1: number; y1: number }; // Grenzen eingeschlossen
export type Point = readonly [number, number];

export type Region = {
  id: RegionId;
  name: string;
  /** Ellipse um die Mitte (0, 0), deren Rand leicht unregelmäßig ist; darum liegen Felsen */
  shape: { rx: number; ry: number };
  /** Tiere mit ungefährem Wohnort; die Welt sucht das nächste Feld, das vom Bett aus erreichbar ist */
  animals: readonly { species: SpeciesId; at: Point }[];
  /** So viele Tiere je Art leben hier: das erste am Wohnort oben, die anderen verteilt die Welt aus dem Seed */
  herd: number;
};

export type Gate = {
  id: GateId;
  kind: 'grosstor'; // mächtiges Torhaus im Felsring: fünf Felder Tor, links und rechts je zwei Felder Turm
  region: RegionId; // Gegend, in der das Tor steht
  leadsTo: string; // was dahinter liegt (kommt später)
  theme: GateTheme; // Blöcke oben auf dem Tor verraten, worum es dahinter geht
  locked: boolean; // vorerst verschlossen; öffnet nicht, auch wenn alle Tiere gefunden sind
  sign?: Point; // Tafel mit den Tieren der Gegend (noch keine)
};

/** Tiere einer Gegend haben die Kennung `<gegend>:<art>`, weitere Tiere derselben Art `<gegend>:<art>:<nummer>` (ab 2) */
export const animalId = (region: RegionId, species: SpeciesId, n = 1) =>
  n <= 1 ? `${region}:${species}` : `${region}:${species}:${n}`;

/** Art eines Tiers der Gegenden aus seiner Kennung (Tiere der Landschaft: null) */
export function speciesOf(id: string): SpeciesId | null {
  const [region, species = ''] = id.split(':');
  return REGIONS.some((r) => r.id === region) && Object.hasOwn(SPECIES, species) ? (species as SpeciesId) : null;
}

/** Alle Tiere einer Gegend: je Art `herd` Stück, in fester Reihenfolge */
export function regionAnimalList(region: Region): { id: string; species: SpeciesId; n: number }[] {
  const out: { id: string; species: SpeciesId; n: number }[] = [];
  for (let n = 1; n <= region.herd; n++)
    for (const { species } of region.animals) out.push({ id: animalId(region.id, species, n), species, n });
  return out;
}

/**
 * Am Anfang gibt es nur die Lichtung mit dem Bett. Ringsum Felsen mit acht großen Toren, die vorerst zu sind.
 * Dahinter liegen die Welten der Tore als endlose Landschaft.
 */
export const REGIONS: readonly [Region, ...Region[]] = [
  {
    id: 'lichtung',
    name: 'Lichtung',
    shape: { rx: 80, ry: 68 }, // groß und frei: Hier soll man erkunden, die Tore liegen weit weg
    animals: [
      { species: 'hase', at: [-10, 8] },
      { species: 'igel', at: [13, 11] },
      { species: 'schaf', at: [-32, -18] },
      { species: 'eichhoernchen', at: [35, -23] },
      { species: 'ente', at: [-9, -35] },
      { species: 'kuh', at: [44, 26] },
      { species: 'fuchs', at: [-49, 29] },
      { species: 'frosch', at: [20, 46] },
      { species: 'biene', at: [-26, 49] },
      { species: 'schildkroete', at: [55, -9] },
    ],
    herd: 4, // erster Spieltest: zu wenige Tiere auf der großen Lichtung
  },
];

/**
 * Die großen Tore: eines je Welt. Wo sie im Felsring stehen und in welcher Reihenfolge, würfelt der Seed jeder Welt.
 * Hinter jedem Tor liegt in seiner Richtung die passende Landschaft. Vorerst sind alle verschlossen.
 */
export const GATES: readonly Gate[] = [
  { id: 'eis', theme: 'eis', kind: 'grosstor', region: 'lichtung', leadsTo: 'Eiswelt', locked: true },
  { id: 'sand', theme: 'sand', kind: 'grosstor', region: 'lichtung', leadsTo: 'Sandwelt', locked: true },
  { id: 'wasser', theme: 'wasser', kind: 'grosstor', region: 'lichtung', leadsTo: 'Wasserwelt', locked: true },
  { id: 'lava', theme: 'lava', kind: 'grosstor', region: 'lichtung', leadsTo: 'Lavaberge', locked: true },
  { id: 'hoehle', theme: 'hoehle', kind: 'grosstor', region: 'lichtung', leadsTo: 'Höhlenwelt', locked: true },
  { id: 'wald', theme: 'wald', kind: 'grosstor', region: 'lichtung', leadsTo: 'Wald', locked: true },
  { id: 'wolken', theme: 'wolken', kind: 'grosstor', region: 'lichtung', leadsTo: 'Wolkenwelt', locked: true },
  { id: 'pilze', theme: 'pilze', kind: 'grosstor', region: 'lichtung', leadsTo: 'Pilzwald', locked: true },
];

export const HOME = {
  bed: [0, 0] as Point,
  wake: [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 0],
    [-1, 1],
  ] as readonly Point[], // freie Plätze am Bett zum Aufwachen
  clear: 2, // so weit um das Bett bleibt es flach und frei
  /** Partner-Portale stehen im Kreis um das Bett, jedes in Richtung seines Tors; erscheinen mit der Aktivierung */
  portalRing: 8,
  /**
   * Zuhause der gefundenen Tiere: eine offene Wiese rund um das Bett (ohne Zaun), mit Futter und Wasser.
   * Folgende Tiere, die sie betreten, bleiben dort und verteilen sich.
   */
  meadow: 6, // Radius der Wiese um das Bett
  food: [-4, 3] as Point, // Futtertrog
  water: [4, 3] as Point, // Wassertrog
  shelter: { x0: -3, y0: -5, x1: 3, y1: -3 } satisfies Rect, // unter dem Riesenpilz: Bei Regen gehen die Tiere der Wiese hierher
  shelterStem: [0, -4] as Point, // Stiel des Riesenpilzes (in der Mitte, unter dem Hutrand zu sehen, fest)
};

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
      [0.165, -0.09, 0.44, 0.01, 0.05, 0.19, '#e7a3b0'], // Ohren innen
      [0.165, 0.04, 0.44, 0.01, 0.05, 0.19, '#e7a3b0'],
      [0.13, -0.08, 0.04, 0.02, 0.16, 0.14, '#efe6d8'], // helle Brust
      [0.1, -0.1, 0, 0.09, 0.06, 0.07, '#efe6d8'], // Vorderpfoten
      [0.1, 0.04, 0, 0.09, 0.06, 0.07, '#efe6d8'],
      [-0.2, -0.17, 0, 0.18, 0.07, 0.07, '#bdb09e'], // Hinterläufe
      [-0.2, 0.1, 0, 0.18, 0.07, 0.07, '#bdb09e'],
      [0.31, -0.11, 0.23, 0.01, 0.04, 0.03, '#f0b8c2'], // Bäckchen
      [0.31, 0.07, 0.23, 0.01, 0.04, 0.03, '#f0b8c2'],
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
      // Stacheln in versetzten Reihen, außen etwas heller
      ...[-0.17, -0.07, 0.03].flatMap((f, i) =>
        [-0.14, -0.04, 0.06].map((r, j): Part => [
          f + (j % 2) * 0.04,
          r + (i % 2) * 0.03,
          0.22,
          0.06,
          0.06,
          0.05 + ((i + j) % 2) * 0.03,
          (i + j) % 2 ? '#4a3828' : '#5d4632',
        ]),
      ),
      [-0.22, -0.12, 0.05, 0.03, 0.24, 0.14, '#4a3828'], // Stacheln hinten
      [0.14, -0.1, 0.02, 0.12, 0.2, 0.14, '#e8c9a0'],
      [0.26, -0.02, 0.06, 0.03, 0.04, 0.04, '#2a2018'],
      [0.12, -0.13, 0.15, 0.04, 0.04, 0.04, '#6a5038'], // Öhrchen
      [0.12, 0.09, 0.15, 0.04, 0.04, 0.04, '#6a5038'],
      [0.08, -0.15, 0, 0.07, 0.05, 0.03, DARK], // Füße
      [0.08, 0.1, 0, 0.07, 0.05, 0.03, DARK],
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
      // Wolllocken oben und an den Seiten
      ...[-0.24, -0.08, 0.08].flatMap((f) =>
        [-0.15, 0.03].map((r): Part => [f, r, 0.46, 0.13, 0.12, 0.05, '#f7f4ee', '#ffffff']),
      ),
      [-0.2, -0.2, 0.22, 0.14, 0.02, 0.16, '#ece7dc'],
      [0.0, 0.18, 0.24, 0.14, 0.02, 0.14, '#ece7dc'],
      [-0.33, -0.04, 0.3, 0.06, 0.08, 0.08, '#f3efe6'], // Schwänzchen
      [0.2, -0.11, 0.3, 0.2, 0.22, 0.22, DARK],
      [0.22, -0.09, 0.52, 0.13, 0.18, 0.05, '#f7f4ee'], // Wollmütze
      [0.24, -0.18, 0.42, 0.08, 0.07, 0.04, DARK], // Ohren
      [0.24, 0.11, 0.42, 0.08, 0.07, 0.04, DARK],
      ...eyes(0.4, 0.11, 0.4, 0.05, 0.05, 0.03, '#f6f3ec'),
    ],
  },
  kuh: {
    id: 'kuh',
    name: 'Kuh',
    scale: 1.5,
    tone: { notes: [196], wave: 'sawtooth', len: 0.45, gap: 0, slide: 0.85, gain: 0.07 },
    parts: [
      ...legs(0.16, -0.26, 0.15, 0.09, 0.2, '#f3efe6'),
      ...legs(0.155, -0.265, 0.155, 0.1, 0.05), // dunkle Hufe
      [-0.06, -0.08, 0.14, 0.12, 0.16, 0.06, '#e7a3b0'], // Euter
      [-0.36, -0.02, 0.24, 0.04, 0.04, 0.24, '#f3efe6'], // Schwanz mit Quaste
      [-0.37, -0.03, 0.2, 0.06, 0.06, 0.06, '#2a2a30'],
      [-0.32, -0.18, 0.2, 0.6, 0.36, 0.3, '#f3efe6'],
      [-0.2, -0.19, 0.3, 0.16, 0.02, 0.14, '#2a2a30'],
      [0.06, 0.17, 0.26, 0.14, 0.02, 0.16, '#2a2a30'],
      [-0.1, -0.08, 0.5, 0.2, 0.18, 0.01, '#2a2a30'],
      [0.24, -0.13, 0.34, 0.2, 0.26, 0.24, '#f3efe6'],
      [0.44, -0.1, 0.34, 0.06, 0.2, 0.1, '#e7a3b0'],
      [0.5, -0.07, 0.38, 0.01, 0.03, 0.03, '#8a4a4a'], // Nasenlöcher
      [0.5, 0.04, 0.38, 0.01, 0.03, 0.03, '#8a4a4a'],
      [0.3, -0.2, 0.5, 0.06, 0.07, 0.05, '#f3efe6'], // Ohren
      [0.3, 0.13, 0.5, 0.06, 0.07, 0.05, '#f3efe6'],
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
      [0.1, -0.05, 0.48, 0.02, 0.02, 0.1, '#2a2018'], // Fühler
      [0.1, 0.03, 0.48, 0.02, 0.02, 0.1, '#2a2018'],
      [0.1, -0.06, 0.58, 0.04, 0.04, 0.03, '#2a2018'],
      [0.1, 0.02, 0.58, 0.04, 0.04, 0.03, '#2a2018'],
      [-0.15, -0.015, 0.395, 0.03, 0.03, 0.03, '#2a2018'], // Stachel
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
      [0.2, -0.045, 0.2, 0.07, 0.09, 0.02, '#d9702a'], // Unterschnabel
      [-0.12, -0.13, 0.06, 0.2, 0.02, 0.1, '#e3bd35'], // Flügel
      [-0.12, 0.11, 0.06, 0.2, 0.02, 0.1, '#e3bd35'],
      [-0.25, -0.04, 0.18, 0.04, 0.08, 0.06, '#e3bd35'], // Schwanzfeder
      [0.1, -0.1, 0, 0.09, 0.07, 0.02, '#f08a3c'], // Füße
      [0.1, 0.03, 0, 0.09, 0.07, 0.02, '#f08a3c'],
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
      [0.185, -0.12, 0.27, 0.015, 0.02, 0.015, '#ffffff', null, 'f'], // Glanz
      [0.185, 0.1, 0.27, 0.015, 0.02, 0.015, '#ffffff', null, 'f'],
      [-0.26, -0.22, 0, 0.16, 0.08, 0.08, '#4f8f3c'], // Hinterbeine
      [-0.26, 0.14, 0, 0.16, 0.08, 0.08, '#4f8f3c'],
      [0.12, -0.21, 0, 0.07, 0.05, 0.06, '#4f8f3c'], // Vorderbeine
      [0.12, 0.16, 0, 0.07, 0.05, 0.06, '#4f8f3c'],
      [0.2, -0.12, 0.02, 0.01, 0.24, 0.08, '#cfe6a8'], // heller Bauch
      [0.205, -0.1, 0.11, 0.005, 0.2, 0.012, '#2f5a28'], // Mund
      [-0.1, -0.1, 0.2, 0.07, 0.07, 0.006, '#4f8f3c'], // Flecken
      [-0.02, 0.05, 0.2, 0.06, 0.06, 0.006, '#4f8f3c'],
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
      [-0.21, -0.18, 0.06, 0.4, 0.36, 0.03, '#8a7a45'], // Panzerrand
      [-0.1, -0.1, 0.22, 0.2, 0.2, 0.04, '#3f7a2e'],
      ...[-0.17, 0.07].flatMap((f) =>
        [-0.15, 0.07].map((r): Part => [f, r, 0.2, 0.08, 0.08, 0.035, '#3f7a2e', '#4f8a3a']),
      ), // Panzerplatten
      [-0.25, -0.02, 0.08, 0.06, 0.04, 0.04, '#8fbf6a'], // Schwänzchen
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
      [0.2, -0.08, 0.13, 0.02, 0.16, 0.12, '#f6f3ec'], // weiße Brust
      [-0.46, -0.08, 0.14, 0.12, 0.16, 0.16, '#e0782e'], // buschiger Schwanz
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
      [0.11, -0.085, 0.49, 0.03, 0.03, 0.04, '#7a3412'], // Pinselohren
      [0.11, 0.055, 0.49, 0.03, 0.03, 0.04, '#7a3412'],
      [-0.4, -0.12, 0.5, 0.16, 0.24, 0.1, '#b4551f'], // Schwanz rollt sich ein
      [-0.32, -0.11, 0.06, 0.06, 0.22, 0.2, '#d9824a'],
      [0.2, -0.04, 0.08, 0.07, 0.08, 0.07, '#8a5a30'], // Nuss in den Pfoten
      [0.21, -0.03, 0.15, 0.05, 0.06, 0.02, '#5d3e21'],
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
  [-0.06, -0.2, 0.06, 0.12, 0.17, 0.28, l.pants],
  [-0.06, 0.03, 0.06, 0.12, 0.17, 0.28, l.pants],
  [-0.07, -0.21, 0, 0.17, 0.19, 0.07, '#6b4a36', '#7d5a44'], // Schuhe
  [-0.07, 0.02, 0, 0.17, 0.19, 0.07, '#6b4a36', '#7d5a44'],
  [-0.12, -0.22, 0.34, 0.24, 0.44, 0.4, l.shirt],
  [-0.125, -0.225, 0.34, 0.25, 0.45, 0.05, '#2a2f3d'], // Gürtel
  [0.115, -0.08, 0.66, 0.012, 0.16, 0.06, '#f6f3ec'], // Kragen
  [-0.06, -0.3, 0.42, 0.12, 0.08, 0.3, l.sleeve],
  [-0.06, 0.22, 0.42, 0.12, 0.08, 0.3, l.sleeve],
  [-0.05, -0.305, 0.34, 0.1, 0.09, 0.08, l.skin], // Hände
  [-0.05, 0.215, 0.34, 0.1, 0.09, 0.08, l.skin],
  [-0.22, -0.23, 0.74, 0.46, 0.46, 0.4, l.skin],
  [-0.05, -0.255, 0.84, 0.07, 0.03, 0.09, l.skin], // Ohren
  [-0.05, 0.225, 0.84, 0.07, 0.03, 0.09, l.skin],
  [-0.23, -0.24, 1.04, 0.48, 0.48, 0.14, l.hair],
  [-0.25, -0.24, 0.84, 0.08, 0.48, 0.3, l.hair],
  [0.2, -0.24, 0.99, 0.05, 0.48, 0.07, l.hair], // Stirnfransen
  [-0.2, -0.245, 0.92, 0.18, 0.02, 0.14, l.hair], // Haare an den Seiten
  [-0.2, 0.225, 0.92, 0.18, 0.02, 0.14, l.hair],
  [0.24, -0.04, 0.79, 0.012, 0.08, 0.02, '#a0524a'], // Mund
  [0.24, -0.19, 0.82, 0.012, 0.05, 0.03, '#f0a090'], // Bäckchen
  [0.24, 0.14, 0.82, 0.012, 0.05, 0.03, '#f0a090'],
  ...eyes(0.24, 0.23, 0.88, 0.07, 0.1, 0.06),
];

/** Korb mit Beeren auf dem Rücken der Figur (nach dem Pflücken, bis zum Futtertrog) */
export const BASKET_PARTS: Part[] = [
  [-0.33, -0.17, 0.38, 0.21, 0.34, 0.3, '#b0803c', '#c9984e'], // Korb aus Weide
  [-0.335, -0.175, 0.47, 0.22, 0.35, 0.03, '#8a5f2a'], // Flechtband
  [-0.335, -0.175, 0.6, 0.22, 0.35, 0.03, '#8a5f2a'],
  [-0.12, -0.15, 0.7, 0.25, 0.04, 0.03, '#8a5f2a'], // Riemen über den Schultern
  [-0.12, 0.11, 0.7, 0.25, 0.04, 0.03, '#8a5f2a'],
  [-0.3, -0.13, 0.68, 0.16, 0.26, 0.06, '#c8323a', '#ef5b5b'], // Beeren obenauf
  [-0.27, -0.1, 0.74, 0.07, 0.07, 0.05, '#c8323a', '#ef5b5b'],
  [-0.23, 0.02, 0.74, 0.07, 0.07, 0.05, '#c8323a', '#ef5b5b'],
  [-0.2, -0.05, 0.74, 0.05, 0.06, 0.04, '#3f9a3c', '#5ab651'], // Blatt
];

/** Eimer mit Wasser in der rechten Hand (nach dem Schöpfen am Wasser, bis zum Wassertrog) */
export const BUCKET_PARTS: Part[] = [
  [-0.11, 0.27, 0.06, 0.22, 0.2, 0.22, '#98a3ae', '#3f8fd8'], // Eimer aus Blech, oben Wasser
  [-0.115, 0.265, 0.25, 0.23, 0.21, 0.03, '#76818c'], // Rand
  [-0.01, 0.36, 0.28, 0.02, 0.02, 0.08, '#5d6873'], // Henkel bis zur Hand
];

/**
 * Großes, aufgeschlagenes Buch auf dem Schoß, wenn niemand spielt: Die weißen Seiten mit Zeilen zeigen nach oben,
 * so erkennt man es auch von schräg oben. `turning`: Eine Seite steht gerade hoch (umblättern).
 */
export const BOOK_PARTS = (l: Look, turning = false): Part[] => [
  [-0.02, -0.31, 0.4, 0.16, 0.08, 0.08, l.sleeve], // Unterarme nach vorn
  [-0.02, 0.23, 0.4, 0.16, 0.08, 0.08, l.sleeve],
  [0.12, -0.33, 0.4, 0.09, 0.07, 0.07, l.skin], // Hände halten das Buch
  [0.12, 0.26, 0.4, 0.09, 0.07, 0.07, l.skin],
  [0.1, -0.29, 0.38, 0.34, 0.58, 0.04, '#c0453a', '#c0453a'], // roter Einband, ragt am Rand hervor
  [0.12, -0.27, 0.42, 0.3, 0.255, 0.04, '#e9e4d8', '#ffffff'], // linke Seite
  [0.12, 0.015, 0.42, 0.3, 0.255, 0.04, '#e9e4d8', '#ffffff'], // rechte Seite
  [0.12, -0.015, 0.42, 0.3, 0.03, 0.03, '#8a3a30'], // Buchrücken in der Mitte
  // Zeilen auf beiden Seiten, rechts ein kleines Bild
  ...[0.16, 0.22, 0.28, 0.34].flatMap((f): Part[] => [
    [f, -0.24, 0.461, 0.025, 0.2, 0.004, '#9aa0aa'],
    ...(f < 0.27 ? [[f, 0.045, 0.461, 0.025, 0.2, 0.004, '#9aa0aa'] as Part] : []),
  ]),
  [0.27, 0.06, 0.461, 0.1, 0.16, 0.004, '#6dbd47'],
  ...(turning ? [[0.14, -0.01, 0.46, 0.26, 0.02, 0.22, '#f6f3ec', '#ffffff'] as Part] : []), // Seite beim Umblättern
];

/** Geschlossene Augen beim Einnicken: Haut über den Augen, darauf ein dunkler Strich */
export const SLEEPY_EYES = (l: Look): Part[] => [
  [0.222, -0.135, 0.875, 0.045, 0.08, 0.11, l.skin, null, 'f'],
  [0.222, 0.055, 0.875, 0.045, 0.08, 0.11, l.skin, null, 'f'],
  [0.267, -0.13, 0.9, 0.005, 0.07, 0.016, '#1d2233', null, 'f'],
  [0.267, 0.06, 0.9, 0.005, 0.07, 0.016, '#1d2233', null, 'f'],
];

// ---------- Farben der Spielwelt (Spielgrafik wie die Texturen, nicht Oberfläche) ----------

/** Farben je Welt: Seite und Oberseite der Themen-Blöcke, Leuchten (Lava), Farbe des Portals */
export const THEME_COLORS: Record<GateTheme, { side: string; top: string; glow?: string; portal: string }> = {
  eis: { side: '#9fd6ef', top: '#e6f7ff', portal: '#9fe3ff' },
  sand: { side: '#d9bf7f', top: '#ecd9a2', portal: '#ffd98a' },
  wasser: { side: '#3f8fd8', top: '#8cc6f0', portal: '#4fb3ff' },
  lava: { side: '#e8541c', top: '#ffb347', glow: '#ff5a10', portal: '#ff7a1a' },
  hoehle: { side: '#3c3f47', top: '#55596a', portal: '#a07cff' },
  wald: { side: '#5d3e21', top: '#3f9a3c', portal: '#7fdc6a' },
  wolken: { side: '#e9f1fb', top: '#ffffff', portal: '#ffe27a' },
  pilze: { side: '#c8323a', top: '#f3efe6', portal: '#e08cff' },
};

/** Licht auf dem Weg zu einem Tor: Farbe der Sonne und Helligkeit (1 = wie immer) */
export const MOOD_LIGHT: Partial<Record<GateTheme, { color: string; bright: number }>> = {
  eis: { color: '#dcecff', bright: 1.05 },
  sand: { color: '#fff1c4', bright: 1.12 },
  lava: { color: '#ffcf9e', bright: 1.0 },
  hoehle: { color: '#d6dbe6', bright: 0.78 },
  wald: { color: '#ffe0b2', bright: 0.95 },
  pilze: { color: '#eadbff', bright: 0.92 },
};

export const GAME_COLORS = {
  heart: '#e0577a',
  note: '#ffffff',
  water: '#5aa6e8',
  waterLight: '#8cc6f0',
  night: 'rgba(14, 18, 44, 0.62)',
  evening: [255, 140, 60] as const, // goldener Abend, wenn die Figur müde wird (RGB)
  star: '#fff7d6',
  fence: '#a0703f',
  fenceDark: '#7a5432',
  board: '#c0915b',
  ink: '#1d2838',
  flowers: ['#e77fb3', '#f2d14b', '#f39a3d', '#ffffff', '#b48cf0', '#5aa6e8'],
  bed: { frame: '#a0703f', pillow: '#e8e2d6', blanket: '#5aa6e8' },
  arrow: '#ffffff',
  slotHome: '#e3ecd2', // zu Hause im Garten (Fläche „Gras“)
  slotMet: '#f3ead6', // getroffen (Fläche „Holz“)
  slotEmpty: 'rgba(255, 255, 255, 0.45)', // noch nicht getroffen
  silhouette: '#4b5563',
  lost: '#1d2838', // Fragezeichen über verlorenen Tieren
  ledge: 'rgba(29, 40, 56, 0.45)', // Kante, wo es eine Stufe hinuntergeht
  shade: 'rgba(0, 0, 0, 0.16)', // Schatten am Fuß einer höheren Stufe
  highlight: 'rgba(255, 255, 255, 0.35)', // Licht auf der Vorderkante
} as const;

/** Was die Figur sagt, wenn sie müde wird (Eltern lesen vor; die Bilder in der Sprechblase versteht das Kind selbst) */
export const TIRED_TALK = {
  yawn: 'Uaah … ich werde langsam müde.',
  bed: 'Ich bin müde. Bringst du mich ins Bett?',
} as const;
