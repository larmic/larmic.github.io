// Guard-Gate nach dem Build (Teil von npm run verify): Jede Seite bleibt schnell und ohne Ballast.
// Eine Regel für alle Seiten: höchstens 32 KB JavaScript beim Laden und nirgends Three.js oder ein Spiel (das
// Kinderspiel lebt auf eigenen Seiten, Organisation mitwachsen-spiele).
// Logik und Tests: scripts/bundles.ts, scripts/bundles.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, nowhere, type Rule } from './bundles.ts';

const DIST = 'dist';

/** Three.js gibt es nirgends, auch nicht als nachgeladenes Modul */
export const NOWHERE = /WebGLRenderer|three\.module/;

export const RULES: Rule[] = [
  {
    name: 'schlank, ohne Spiel und 3D',
    pages: /./,
    budget: 32 * 1024,
    forbidden: /larmic-mitwachsen|WebGLRenderer|three\.module/, // Web Component des Spiels, Three.js
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

const scriptsIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? scriptsIn(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );

const pages = pagesIn(DIST);
const scripts = scriptsIn(DIST);
const problems = [
  ...pages.flatMap((file) => check(relative(DIST, file), readFileSync(file, 'utf8'), read, RULES)),
  ...nowhere(
    scripts.map((file) => [`/${relative(DIST, file)}`, readFileSync(file, 'utf8')]),
    NOWHERE,
  ),
];
if (problems.length) {
  console.error(`Bundle-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ Bundle-Gate: ${pages.length} Seiten ohne Spiel und 3D im Budget, ${scripts.length} Skripte ohne Three.js`,
);
