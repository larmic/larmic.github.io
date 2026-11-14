// Guard-Gate nach dem Build (Teil von npm run verify): Die Homepage bleibt schnell und ohne Ballast.
// Seiten außerhalb von /spiele/ laden kein Spiel und kein Three.js und bleiben unter einem festen Budget.
// Die Spielseite lädt beim Start nur ihren eigenen Code; Three.js darf nur nachträglich (import()) kommen.
// Logik und Tests: scripts/bundles.ts, scripts/bundles.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, type Rule } from './bundles.ts';

const DIST = 'dist';
const GAME_CODE = /larmic-mitwachsen|Mitwachsen|WebGLRenderer|three\.module/;

export const RULES: Rule[] = [
  { name: 'Homepage ohne Spiel', pages: /^(?!spiele\/)/, budget: 32 * 1024, forbidden: GAME_CODE },
  {
    name: 'Spiel lädt 3D erst bei Bedarf',
    pages: /^spiele\//,
    budget: 96 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
];

const pagesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pagesIn(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path), 'utf8');
  } catch {
    return null;
  }
};

const pages = pagesIn(DIST);
const problems = pages.flatMap((file) => check(relative(DIST, file), readFileSync(file, 'utf8'), read, RULES));
if (problems.length) {
  console.error(`Bundle-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Bundle-Gate: ${pages.length} Seiten geprüft, Homepage ohne Spiel und im Budget`);
