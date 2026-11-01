// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://larmic.de',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  // Alte Hugo-Adressen weiterleiten
  redirects: {
    '/about': '/#ueber-mich',
    '/workshops/ddd_hexagonal_architecture_for_devs': '/workshops/#workshop-ddd_hexagonal_architecture_for_devs',
    '/workshops/event_storming': '/workshops/#workshop-event_storming',
  },
});
