// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Reine Weiterleitungen gehören nicht in die Sitemap, auch nichts unter /spiele/ (das Spiel hat eine eigene Seite)
const redirectPages = /^\/(about|tags|categories)\/$|^\/spiele\//;

export default defineConfig({
  site: 'https://larmic.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [sitemap({ filter: (page) => !redirectPages.test(new URL(page).pathname) })],
  // Alte Adressen weiterleiten, für immer (Lesezeichen, auch auf dem Startbildschirm). Ziele direkt, ohne Umweg.
  redirects: {
    // Hugo
    '/about': '/',
    '/tags': '/',
    '/categories': '/',
    // Das Kinderspiel Mitwachsen lebt heute auf seiner eigenen Seite (Repo mitwachsen-spiele)
    '/spiele': 'https://www.mitwachsen-spiele.de/',
    '/spiele/mitwachsen': 'https://www.mitwachsen-spiele.de/',
    '/spiele/mitwachsen/spielen': 'https://www.mitwachsen-spiele.de/spielen/',
    '/spiele/threeyear': 'https://www.mitwachsen-spiele.de/spielen/', // Arbeitstitel des Spiels
  },
});
