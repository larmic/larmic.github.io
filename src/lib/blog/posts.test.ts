import { describe, expect, it } from 'vitest';
import {
  assertPosts,
  assertSlugs,
  byNewest,
  formatDate,
  isoDate,
  neighbours,
  partsOf,
  published,
  type PostMeta,
} from './posts';

const post = (id: string, over: Partial<PostMeta> = {}): PostMeta => ({
  id,
  date: new Date('2026-11-22'),
  draft: false,
  hasPattern: false,
  ...over,
});
const part = (n: number, over: Partial<PostMeta> = {}) =>
  post(`teil-${n}`, { series: 'mitwachsen', part: n, hasPattern: true, ...over });
const SERIES = { mitwachsen: { parts: 8 } };

describe('published', () => {
  it('entfernt Entwürfe', () => {
    expect(published([post('a'), post('b', { draft: true })]).map((p) => p.id)).toEqual(['a']);
  });
});

describe('byNewest', () => {
  it('sortiert nach Datum absteigend, bei Gleichstand nach Teil absteigend, dann nach Slug', () => {
    const posts = [
      post('b'),
      part(1),
      post('alt', { date: new Date('2026-11-01') }),
      part(2),
      post('a'),
      post('neu', { date: new Date('2026-12-01') }),
    ];
    expect(byNewest(posts).map((p) => p.id)).toEqual(['neu', 'teil-2', 'teil-1', 'a', 'b', 'alt']);
  });

  it('lässt die Eingabe unverändert', () => {
    const posts = [post('alt', { date: new Date('2026-11-01') }), post('neu')];
    byNewest(posts);
    expect(posts.map((p) => p.id)).toEqual(['alt', 'neu']);
  });
});

describe('partsOf', () => {
  it('liefert die Teile einer Serie aufsteigend, ohne Notizen und fremde Serien', () => {
    const posts = [part(3), post('notiz'), part(1), post('x', { series: 'andere', part: 1 }), part(2)];
    expect(partsOf(posts, 'mitwachsen').map((p) => p.part)).toEqual([1, 2, 3]);
  });
});

describe('neighbours', () => {
  const parts = ['eins', 'zwei', 'drei'];
  it('kennt am Anfang nur den Nachfolger, am Ende nur den Vorgänger', () => {
    expect(neighbours(parts, 0)).toEqual({ prev: undefined, next: 'zwei' });
    expect(neighbours(parts, 1)).toEqual({ prev: 'eins', next: 'drei' });
    expect(neighbours(parts, 2)).toEqual({ prev: 'zwei', next: undefined });
  });

  it('hat bei einem einzelnen Teil keine Nachbarn', () => {
    expect(neighbours(['eins'], 0)).toEqual({ prev: undefined, next: undefined });
  });
});

describe('Datum', () => {
  it('rechnet in UTC, unabhängig von der Zeitzone des Rechners', () => {
    const lateInBerlin = new Date('2026-11-22T23:30:00+01:00');
    expect(formatDate(lateInBerlin)).toBe('22.11.2026');
    expect(isoDate(lateInBerlin)).toBe('2026-11-22');
  });

  it('füllt Tag und Monat mit Nullen auf', () => {
    expect(formatDate(new Date('2027-01-05'))).toBe('05.01.2027');
  });
});

describe('assertSlugs', () => {
  it('lässt gewöhnliche Slugs durch', () => {
    expect(() => assertSlugs(['erst-die-zaeune', 'teil-2'], ['serie'])).not.toThrow();
  });

  it('bricht bei reservierten Namen ab', () => {
    expect(() => assertSlugs(['serie'], ['serie', 'tag'])).toThrow(
      /„serie“ ist für eine Adresse unter \/blog\/ reserviert/,
    );
  });

  it('bricht bei Großbuchstaben und Unterstrichen ab', () => {
    expect(() => assertSlugs(['Erst_Die'], [])).toThrow(/„Erst_Die“ taugt nicht als Adresse/);
  });
});

describe('assertPosts', () => {
  it('lässt Notizen ohne Serie und ohne Muster durch', () => {
    expect(() => assertPosts([post('notiz')], SERIES)).not.toThrow();
  });

  it('lässt Teil 1 allein und Teil 1 mit Entwurf für Teil 2 durch', () => {
    expect(() => assertPosts([part(1)], SERIES)).not.toThrow();
    expect(() => assertPosts([part(1), part(2, { draft: true })], SERIES)).not.toThrow();
  });

  it('bricht ab, wenn veröffentlichte Teile eine Lücke haben', () => {
    expect(() => assertPosts([part(1), part(3)], SERIES)).toThrow(/fehlt Teil 2/);
    expect(() => assertPosts([part(1), part(2, { draft: true }), part(3)], SERIES)).toThrow(/fehlt Teil 2/);
    expect(() => assertPosts([part(2)], SERIES)).toThrow(/fehlt Teil 1/);
  });

  it('bricht bei doppeltem Teil ab, auch wenn einer davon ein Entwurf ist', () => {
    const twice = [part(1), part(2), post('nochmal', { series: 'mitwachsen', part: 2, hasPattern: true, draft: true })];
    expect(() => assertPosts(twice, SERIES)).toThrow(
      /Teil 2 der Serie „mitwachsen“ gibt es doppelt \(teil-2 und nochmal\)/,
    );
  });

  it('bricht ab, wenn Serie und Teil nicht zusammen stehen', () => {
    expect(() => assertPosts([post('a', { series: 'mitwachsen' })], SERIES)).toThrow(/a braucht „series“ und „part“/);
    expect(() => assertPosts([post('b', { part: 1 })], SERIES)).toThrow(/b braucht „series“ und „part“/);
  });

  it('bricht bei unbekannter Serie ab', () => {
    expect(() => assertPosts([post('a', { series: 'gibt-es-nicht', part: 1, hasPattern: true })], SERIES)).toThrow(
      /Serie „gibt-es-nicht“, die es nicht gibt/,
    );
  });

  it('bricht ab, wenn der Teil über die Länge der Serie hinausgeht', () => {
    expect(() => assertPosts([part(9, { draft: true })], SERIES)).toThrow(
      /Teil 9, die Serie „mitwachsen“ hat aber nur 8/,
    );
  });

  it('verlangt das Muster bei Serienteilen', () => {
    expect(() => assertPosts([part(1, { hasPattern: false })], SERIES)).toThrow(
      /teil-1 gehört zu einer Serie und braucht „pattern“/,
    );
  });

  it('lässt ein veröffentlichtes Gegenstück durch', () => {
    expect(() => assertPosts([post('a', { counterpart: 'b' }), post('b')], SERIES)).not.toThrow();
  });

  it('bricht ab, wenn das Gegenstück unbekannt, ein Entwurf oder der Post selbst ist', () => {
    const message = /nennt als Gegenstück/;
    expect(() => assertPosts([post('a', { counterpart: 'fehlt' })], SERIES)).toThrow(message);
    expect(() => assertPosts([post('a', { counterpart: 'b' }), post('b', { draft: true })], SERIES)).toThrow(message);
    expect(() => assertPosts([post('a', { counterpart: 'a' })], SERIES)).toThrow(message);
  });

  it('prüft das Gegenstück eines Entwurfs noch nicht', () => {
    expect(() => assertPosts([post('a', { draft: true, counterpart: 'kommt-noch' })], SERIES)).not.toThrow();
  });
});
