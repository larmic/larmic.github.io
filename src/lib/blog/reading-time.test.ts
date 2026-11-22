import { describe, expect, it } from 'vitest';
import { assertReadable, countWords, MAX_WORDS, readingMinutes } from './reading-time';

describe('countWords', () => {
  it('zählt im leeren Text nichts', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(' \n\n ')).toBe(0);
  });

  it('zählt Wörter und Zahlen, aber keine Markdown-Zeichen', () => {
    expect(countWords('## Zu schnell zum Mitlesen\n\n- eins\n- zwei\n\n> drei – vier *fünf* 3.447')).toBe(10);
  });

  it('zählt Code mit, die Zaun-Zeilen und Link-Ziele nicht', () => {
    expect(countWords('```js title="a.cjs"\nconst a = 1;\n```')).toBe(3);
    expect(countWords('Spielen kann man [hier](https://www.mitwachsen-spiele.de/).')).toBe(4);
  });
});

describe('readingMinutes', () => {
  it('rundet kaufmännisch bei 200 Wörtern pro Minute und zeigt mindestens 1', () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(299)).toBe(1);
    expect(readingMinutes(300)).toBe(2);
    expect(readingMinutes(1010)).toBe(5);
    expect(readingMinutes(1200)).toBe(6);
  });
});

describe('assertReadable', () => {
  it('lässt einen Post bis zur Obergrenze durch', () => {
    expect(() => assertReadable('x', MAX_WORDS)).not.toThrow();
  });

  it('bricht ab, wenn ein Post länger als 6 Minuten ist, und nennt Post und Zahlen', () => {
    expect(() => assertReadable('zu-lang', MAX_WORDS + 1)).toThrow(/Blog: zu-lang hat 1201 Wörter, erlaubt sind 1200/);
  });
});
