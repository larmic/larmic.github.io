// Architekturregeln (Guard-Gate, `npm run arch`): die Schichten der Seite, maschinell geprüft.
//   src/lib       generische Bausteine (Voxel-Generator) – kennt keine Seiteninhalte
//   src/data      Inhalte und Konfiguration der Seite – nutzt lib, kennt keine Oberfläche
//   src/scripts   Code im Browser – nur so viel lib wie nötig, nichts aus Node
//   components, layouts, pages – Oberfläche, darf alles darunter nutzen
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Zyklen machen Module untrennbar und die Ladereihenfolge zufällig.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-is-generic',
      severity: 'error',
      comment: 'src/lib ist der generische Unterbau. Inhalte, Avatar & Co. kommen als Parameter, nicht per Import.',
      from: { path: '^src/lib/' },
      to: { path: '^src/(data|components|layouts|pages|scripts)/' },
    },
    {
      name: 'data-knows-no-ui',
      severity: 'error',
      comment: 'Daten und Konfiguration hängen nicht von Komponenten, Layouts oder Seiten ab.',
      from: { path: '^src/data/' },
      to: { path: '^src/(components|layouts|pages|scripts)/' },
    },
    {
      name: 'client-gets-only-head',
      severity: 'error',
      comment:
        'Browser-Code nutzt aus dem Generator nur den Kopf (head.ts). Alles andere ist Build-Code und gehört nicht ins Bundle.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      // Reine Typ-Importe verschwinden beim Kompilieren und sind erlaubt
      to: { path: '^src/lib/', pathNot: '^src/lib/voxel/head\\.ts$', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-node-in-client',
      severity: 'error',
      comment: 'Browser-Code kann weder Node-Module noch sharp laden.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-sharp-in-client',
      severity: 'error',
      comment: 'sharp läuft nur beim Build.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      to: { path: 'sharp' },
    },
    {
      name: 'no-test-in-production',
      severity: 'error',
      comment: 'Tests werden nur von Tests importiert.',
      from: { pathNot: '\\.test\\.ts$' },
      to: { path: '\\.test\\.ts$' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Jeder Import muss auflösbar sein (Astro-Module wie astro:content ausgenommen).',
      from: {},
      to: { couldNotResolve: true, pathNot: '^astro:' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|\\.astro)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // Paket-Unterpfade wie astro/zod über das exports-Feld auflösen
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
  },
};
