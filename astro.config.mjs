// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Reine Weiterleitungen gehören nicht in die Sitemap, die Kinderspiele (noch) auch nicht
const redirectPages = /^\/(about|tags|categories)\/$|^\/spiele\//;

export default defineConfig({
  site: 'https://larmic.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [sitemap({ filter: (page) => !redirectPages.test(new URL(page).pathname) })],
  // Alte Adressen weiterleiten (Hugo, Arbeitstitel des Kinderspiels)
  redirects: {
    '/about': '/',
    '/tags': '/',
    '/categories': '/',
    // Arbeitstitel des Kinderspiels
    '/spiele/threeyear': '/spiele/mitwachsen/',
  },
});
