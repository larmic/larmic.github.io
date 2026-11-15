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
    files: ['src/data/games/mitwachsen.ts'],
    rules: { 'max-lines': ['error', { max: 428, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/lib/voxel/world.ts'],
    rules: { 'max-lines-per-function': ['error', { max: 171, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/scripts/games/larmic-mitwachsen.ts'],
    rules: {
      complexity: ['error', 31],
      'max-lines': ['error', { max: 810, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 96, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-3d.ts'],
    rules: {
      complexity: ['error', 35],
      'max-depth': ['error', 6],
      'max-lines': ['error', { max: 941, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 130, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-gatehouse.ts'],
    rules: {
      complexity: ['error', 24],
      'max-lines-per-function': ['error', { max: 169, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-map.ts'],
    rules: { 'max-lines-per-function': ['error', { max: 84, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/scripts/games/mitwachsen-render.ts'],
    rules: {
      complexity: ['error', 56],
      'max-lines': ['error', { max: 981, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 169, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['src/scripts/games/mitwachsen-save.ts'], rules: { complexity: ['error', 26] } },
  {
    files: ['src/scripts/games/mitwachsen-state.ts'],
    rules: {
      complexity: ['error', 27],
      'max-lines': ['error', { max: 542, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/scripts/games/mitwachsen-world.ts'],
    rules: {
      complexity: ['error', 76],
      'max-depth': ['error', 5],
      'max-lines': ['error', { max: 641, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 137, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['src/scripts/larmic-island.ts'], rules: { complexity: ['error', 26] } },
  // Konfigurationsdateien laufen in Node
  { files: ['*.{js,mjs}'], languageOptions: { globals: { URL: 'readonly', process: 'readonly' } } },
  {
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
  },
);
