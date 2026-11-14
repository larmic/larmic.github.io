// Unit-Tests für die reine Logik (Voxel-Generator, Zustandsmaschinen, Bundle-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
