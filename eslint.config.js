// Lint-Gate: empfohlene Regeln für JavaScript, TypeScript und Astro. Formatierung übernimmt Prettier.
// TypeScript-Dateien laufen mit Typinformation (typbewusste Regeln, z. B. nicht abgewartete Promises,
// überflüssige Casts). Dazu Grenzen für Größe und Verschachtelung als Sperrklinke: knapp über dem heutigen Stand,
// damit nichts weiter wächst; beim Aufräumen werden sie gesenkt.
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  { ignores: ['dist/', '.astro/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  // Grenzen für Größe und Verschachtelung (Tests ausgenommen bei der Länge): neuer Code bleibt klein und flach
  {
    files: ['**/*.ts'],
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['**/*.test.ts', 'e2e/**'], rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' } },
  // Sperrklinke für die großen Dateien von heute: genau ihr jetziger Stand, damit sie nicht weiter wachsen.
  // Wer eine davon verkleinert, senkt hier die Zahl (oder streicht die Zeile).
  {
    files: ['src/lib/voxel/world.ts'],
    rules: { 'max-lines-per-function': ['error', { max: 167, skipBlankLines: true, skipComments: true }] },
  },
  { files: ['src/scripts/larmic-island.ts'], rules: { complexity: ['error', 26] } },
  // Konfigurationsdateien laufen in Node
  { files: ['*.{js,mjs}'], languageOptions: { globals: { URL: 'readonly', process: 'readonly' } } },
  {
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
  },
);
