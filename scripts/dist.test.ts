import { describe, expect, it } from 'vitest';
import { externalResources, isForeign, redirectProblem, redirectTarget } from './dist';

describe('Externe Ressourcen', () => {
  it('erkennt fremde Hosts, auch protokollrelativ; eigene und relative Adressen sind erlaubt', () => {
    expect(isForeign('https://cdn.example.com/x.js')).toBe(true);
    expect(isForeign('//fonts.googleapis.com/css')).toBe(true);
    expect(isForeign('http://larmic.de/a.png')).toBe(false);
    expect(isForeign('https://www.larmic.de/a.png')).toBe(false);
    expect(isForeign('/_astro/a.js')).toBe(false);
    expect(isForeign('data:image/png;base64,AAA')).toBe(false);
  });

  it('meldet Skripte, Bilder, srcset, Stylesheets, iframes und url() in CSS von fremden Hosts', () => {
    const html = `
      <script src="https://cdn.example.com/a.js"></script>
      <img src="/ok.png" srcset="/ok-1.webp 1x, https://img.example.com/b.webp 2x">
      <link rel="stylesheet" href="https://fonts.example.com/c.css">
      <iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>
      <div style="background: url('https://bg.example.com/d.png')"></div>
      <style>@import "https://e.example.com/e.css"; .x { background: url(https://f.example.com/f.png) }</style>`;
    expect(externalResources(html)).toEqual([
      '<script src> https://cdn.example.com/a.js',
      '<img srcset> https://img.example.com/b.webp',
      '<link rel="stylesheet"> https://fonts.example.com/c.css',
      '<iframe src> https://www.youtube-nocookie.com/embed/x',
      'style url() https://bg.example.com/d.png',
      '<style> https://e.example.com/e.css',
      '<style> https://f.example.com/f.png',
    ]);
  });

  it('erlaubt Links und Hinweise, die nichts laden', () => {
    const html = `
      <a href="https://github.com/larmic">GitHub</a>
      <link rel="canonical" href="https://larmic.de/">
      <link rel="alternate" href="https://example.com/feed.xml">
      <meta property="og:image" content="https://larmic.de/og.png">
      <img src="/_astro/a.webp" alt="">`;
    expect(externalResources(html)).toEqual([]);
  });
});

describe('Weiterleitungen', () => {
  it('liest das Ziel einer Weiterleitungsseite von Astro', () => {
    expect(redirectTarget('<title>Redirecting to: /</title><meta http-equiv="refresh" content="0;url=/">')).toBe('/');
    expect(redirectTarget('<meta http-equiv="Refresh" content="0; URL=/spiele/x/">')).toBe('/spiele/x/');
    expect(redirectTarget('<meta charset="utf-8">')).toBeNull();
  });

  it('verlangt eine Seite in dist, außer das Ziel liegt auf einer freigegebenen fremden Domain', () => {
    const exists = (p: string) => p === '/';
    expect(redirectProblem('/', '/', exists)).toBeNull();
    expect(redirectProblem('/weg/', '/weg/', exists)).toBe('Ziel /weg/ fehlt');
    expect(redirectProblem('/', '/videos/', exists)).toBe('führt zu /videos/ statt zu /');
    expect(redirectProblem('/', null, exists)).toBe('führt zu nichts statt zu /');
    const game = 'https://www.mitwachsen-spiele.de/spielen/';
    expect(redirectProblem(game, game, exists)).toBeNull();
    expect(redirectProblem(game, 'https://www.mitwachsen-spiele.de/', exists)).toMatch(/statt zu/);
    expect(redirectProblem('https://example.com/', 'https://example.com/', exists)).toMatch(
      /example\.com.*nicht freigegeben/,
    );
  });
});
