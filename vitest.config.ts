// Unit-Tests für die reine Logik (Voxel-Generator, Zustandsmaschine der Figur, Gates). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Der Runner der Pipeline ist mit Abdeckung gut dreimal langsamer als ein Entwickler-Rechner; die Simulationen
    // (tausende Takte, ganze Welten) brauchen dort mehr als die üblichen 5 s. Langsame Tests trotzdem billig halten.
    testTimeout: 15_000,
    // Abdeckung nur für die reinen Module – die Web Component der Insel prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/scripts/island-state.ts', 'scripts/{bundles,dist}.ts'],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand: Sinkt die Abdeckung, fällt das Gate. Steigt sie, die Schwellen mitziehen.
      thresholds: {
        statements: 95,
        branches: 92,
        functions: 94,
        lines: 95,
        // Die Figur auf der Insel enger
        'src/scripts/**/*.ts': { statements: 98, branches: 93, functions: 98, lines: 98 },
      },
    },
  },
});
