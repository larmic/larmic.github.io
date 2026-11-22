// Spuren und Themen des Blogs: einzige Quelle für das Schema der Posts (content.config.ts) und für die Anzeige.
import type { Material } from './materials';

/** Für wen ein Post ist. Immer mit Symbol und Text gezeigt, nie nur als Farbe. ︎ verhindert bunte Emoji. */
export const TRACKS = {
  eltern: { label: 'Für Eltern', symbol: '♥︎' },
  technik: { label: 'Für Techniker', symbol: '⚙︎' },
  beide: { label: 'Für beide', symbol: '◆' },
} as const;

export type Track = keyof typeof TRACKS;
export const TRACK_IDS = Object.keys(TRACKS) as [Track, ...Track[]];

/** Geschlossene Liste der Themen. Das Material gibt die Randfarbe; Themen ohne Material bleiben neutral. */
export const TAGS = {
  guards: { material: 'ops' },
  devops: { material: 'ops' },
  ki: { material: 'ki' },
  testing: { material: 'gr' },
  barrierefreiheit: { material: 'gr' },
  architektur: { material: 'hw' },
  medienzeit: {},
  spieltest: {},
  kinder: {},
  meta: {},
} as const satisfies Record<string, { material?: Material }>;

export type TagId = keyof typeof TAGS;
export const TAG_IDS = Object.keys(TAGS) as [TagId, ...TagId[]];

/** Namen, die Adressen unter /blog/ belegen (heute oder geplant): Kein Post darf so heißen */
export const RESERVED_SLUGS = ['serie', 'tag', 'fuer-eltern', 'fuer-techniker', 'rss', 'feed'] as const;
