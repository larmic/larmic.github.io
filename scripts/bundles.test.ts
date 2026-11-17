import { describe, expect, it } from 'vitest';
import { check, loaded, nowhere, scriptsOf, staticImports, type Rule } from './bundles.ts';

const files: Record<string, string> = {
  '/_astro/home.js': 'import{a as b}from"./shared.js";console.log(b)',
  '/_astro/shared.js': 'export const a=1;',
  '/_astro/game.js': 'import"./shared.js";const t=()=>import("./three.module.js");',
  '/_astro/three.module.js': 'class WebGLRenderer{}',
};
const read = (p: string) => files[p] ?? null;
const RULES: Rule[] = [{ name: 'Alle Seiten', pages: /./, budget: 100, forbidden: /game|WebGLRenderer/ }];
const page = (...srcs: string[]) => srcs.map((s) => `<script type="module" src="${s}"></script>`).join('');

describe('Bundle-Gate', () => {
  it('findet Skripte und Modulvorladungen im HTML', () => {
    const html = '<script type="module" src="/_astro/a.js"></script><link rel="modulepreload" href="/_astro/b.js">';
    expect(scriptsOf(html)).toEqual(['/_astro/a.js', '/_astro/b.js']);
  });

  it('folgt statischen Importen, aber nicht dynamischen', () => {
    expect(staticImports(files['/_astro/game.js']!)).toEqual(['./shared.js']);
    expect(loaded(page('/_astro/game.js'), read).sort()).toEqual(['/_astro/game.js', '/_astro/shared.js']);
  });

  it('löst relative Importe aus Unterordnern auf', () => {
    const nested: Record<string, string> = {
      '/_astro/pages/a.js': 'import"../shared.js";import"./b.js";',
      '/_astro/pages/b.js': '',
      '/_astro/shared.js': '',
    };
    const html = page('/_astro/pages/a.js');
    expect(loaded(html, (p) => nested[p] ?? null).sort()).toEqual([
      '/_astro/pages/a.js',
      '/_astro/pages/b.js',
      '/_astro/shared.js',
    ]);
  });

  it('lässt eine schlanke Homepage durch', () => {
    expect(check('index.html', page('/_astro/home.js'), read, RULES)).toEqual([]);
  });

  it('meldet Spielcode auf der Homepage', () => {
    const problems = check('index.html', page('/_astro/home.js', '/_astro/game.js'), read, RULES);
    expect(problems.some((p) => p.includes('/_astro/game.js'))).toBe(true);
  });

  it('meldet ein überschrittenes Budget', () => {
    const tight: Rule[] = [{ ...RULES[0]!, budget: 10 }];
    expect(check('index.html', page('/_astro/home.js'), read, tight)[0]).toMatch(/Bytes JavaScript/);
  });

  it('findet Three.js überall, auch wenn es nur nachgeladen wird', () => {
    const all = Object.entries(files);
    // gemeldet wird das Modul selbst und der Code, der es nachlädt
    expect(nowhere(all, /WebGLRenderer|three\.module/)).toEqual([
      '/_astro/game.js enthält, was es nirgends geben darf (/WebGLRenderer|three\\.module/)',
      '/_astro/three.module.js enthält, was es nirgends geben darf (/WebGLRenderer|three\\.module/)',
    ]);
    expect(nowhere([['/_astro/home.js', files['/_astro/home.js']!]], /WebGLRenderer|three\.module/)).toEqual([]);
  });

  it('meldet fehlende Dateien', () => {
    expect(check('index.html', page('/_astro/weg.js'), read, RULES)[0]).toMatch(/fehlt/);
  });
});
