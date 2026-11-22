import { describe, expect, it } from 'vitest';
import { escapeXml, rss, type Feed } from './rss';

const feed = (items: Feed['items']): Feed => ({
  title: 'larmic.de – Blog',
  description: 'Notizen',
  link: 'https://larmic.de/blog/',
  self: 'https://larmic.de/blog/rss.xml',
  items,
});

describe('escapeXml', () => {
  it('maskiert die fünf Sonderzeichen', () => {
    expect(escapeXml(`a & b < c > d "e" 'f'`)).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
  });
});

describe('rss', () => {
  it('baut einen gültigen leeren Feed auf Deutsch mit Verweis auf sich selbst', () => {
    const xml = rss(feed([]));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
    expect(xml).toContain('<language>de</language>');
    expect(xml).toContain('<atom:link href="https://larmic.de/blog/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).not.toContain('<item>');
    expect(xml.endsWith('</channel>\n</rss>\n')).toBe(true);
  });

  it('schreibt die Einträge in der übergebenen Reihenfolge, mit Adresse als guid und Datum in UTC', () => {
    const xml = rss(
      feed([
        { title: 'Neu', link: 'https://larmic.de/blog/neu/', description: 'n', date: new Date('2026-11-22') },
        {
          title: 'Alt',
          link: 'https://larmic.de/blog/alt/',
          description: 'a',
          date: new Date('2026-11-01'),
          categories: ['guards', 'ki'],
        },
      ]),
    );
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml.indexOf('<title>Neu</title>')).toBeLessThan(xml.indexOf('<title>Alt</title>'));
    expect(xml).toContain('<guid isPermaLink="true">https://larmic.de/blog/neu/</guid>');
    expect(xml).toContain('<pubDate>Sun, 22 Nov 2026 00:00:00 GMT</pubDate>');
    expect(xml).toContain('<category>guards</category>\n      <category>ki</category>');
  });

  it('maskiert Sonderzeichen in Titel und Beschreibung', () => {
    const xml = rss(
      feed([
        { title: 'Zäune & <Gates>', link: 'https://larmic.de/blog/x/', description: '"28" Minuten', date: new Date(0) },
      ]),
    );
    expect(xml).toContain('<title>Zäune &amp; &lt;Gates&gt;</title>');
    expect(xml).toContain('<description>&quot;28&quot; Minuten</description>');
  });
});
