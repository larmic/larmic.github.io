// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Reine Weiterleitungen gehören nicht in die Sitemap
const redirectPages = /^\/(about|tags|categories)\/$/;

export default defineConfig({
  site: 'https://larmic.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [sitemap({ filter: (page) => !redirectPages.test(new URL(page).pathname) })],
  // Alte Hugo-Adressen weiterleiten
  redirects: {
    '/about': '/',
    '/tags': '/',
    '/categories': '/',
  },
});
