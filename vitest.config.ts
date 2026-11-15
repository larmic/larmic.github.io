// Unit-Tests für die reine Logik (Voxel-Generator, Zustandsmaschinen, Bundle-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Abdeckung nur für die reinen Module – Web Components, Canvas und Three.js prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/data/games/*.ts',
        'src/scripts/island-state.ts',
        'src/scripts/games/input-pace.ts',
        'src/scripts/games/mitwachsen-{fog,growth,save,state,tired,weather,world}.ts',
        'scripts/{bundles,dist}.ts',
      ],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand: Sinkt die Abdeckung, fällt das Gate. Steigt sie, die Schwellen mitziehen.
      thresholds: {
        statements: 92,
        branches: 89,
        functions: 91,
        lines: 92,
        // Die Spielregeln und die Figur auf der Insel enger
        'src/scripts/**/*.ts': { statements: 95, branches: 86, functions: 95, lines: 95 },
      },
    },
  },
});
