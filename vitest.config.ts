// Unit-Tests für die reine Logik (Voxel-Generator, Zustandsmaschine der Figur). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
