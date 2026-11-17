// Guard-Gate nach dem Build (Teil von npm run verify): Regeln aus CLAUDE.md, die sonst nur Absprache wären.
// – Keine externen Ressourcen ohne Klick auf irgendeiner Seite.
// – Alte Adressen leiten an ihr Ziel weiter, und das Ziel gibt es – oder es liegt auf einer freigegebenen fremden
//   Domain (REDIRECT_HOSTS). (Die Sprungmarken wie /#workshops prüft der Smoke-Test im Browser, e2e/smoke.spec.ts.)
// Logik und Tests: scripts/dist.ts, scripts/dist.test.ts

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { externalResources, redirectProblem, redirectTarget } from './dist.ts';

const DIST = 'dist';
/** Alte Adressen und wohin sie führen müssen */
export const LEGACY: [string, string][] = [
  ['/about/', '/'],
  ['/tags/', '/'],
  ['/categories/', '/'],
  // Das Kinderspiel Mitwachsen hat eine eigene Seite
  ['/spiele/', 'https://www.mitwachsen-spiele.de/'],
  ['/spiele/mitwachsen/', 'https://www.mitwachsen-spiele.de/'],
  ['/spiele/mitwachsen/spielen/', 'https://www.mitwachsen-spiele.de/spielen/'],
  ['/spiele/threeyear/', 'https://www.mitwachsen-spiele.de/spielen/'],
];

const pagesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pagesIn(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );
const pageFile = (path: string) => join(DIST, path, 'index.html');

const problems: string[] = [];
const pages = pagesIn(DIST);
for (const file of pages)
  for (const r of externalResources(readFileSync(file, 'utf8')))
    problems.push(`${relative(DIST, file)}: externe Ressource ${r}`);
for (const [from, to] of LEGACY) {
  if (!existsSync(pageFile(from))) {
    problems.push(`alte Adresse ${from}: keine Seite`);
    continue;
  }
  const problem = redirectProblem(to, redirectTarget(readFileSync(pageFile(from), 'utf8')), (p) =>
    existsSync(pageFile(p)),
  );
  if (problem) problems.push(`alte Adresse ${from}: ${problem}`);
}

if (problems.length) {
  console.error(`Seiten-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ Seiten-Gate: ${pages.length} Seiten ohne externe Ressourcen, ${LEGACY.length} alte Adressen leiten weiter`,
);
