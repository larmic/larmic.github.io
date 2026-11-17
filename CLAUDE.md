# CLAUDE.md

Persönliche Website von Lars Michaelis (larmic.de) im Voxel-Stil „Inselwelt“. Astro 7, statische Ausgabe, Sprache Deutsch. Das Kinderspiel Mitwachsen lebt im Repo `mitwachsen-spiele` (www.mitwachsen-spiele.de); larmic.de verlinkt es nur.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm test         # Guard-Gate: Unit-Tests (Vitest) mit Mindest-Abdeckung der reinen Module (vitest.config.ts) – muss grün sein
npm run lint     # Guard-Gate: ESLint – muss grün sein
npm run format   # Prettier; `npm run format:check` ist das Guard-Gate
npm run arch     # Guard-Gate: Architekturregeln (dependency-cruiser) – muss grün sein
npm run build    # statische Seite nach dist/
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links und Sprungmarken, Bundle-Gate (jede Seite ≤ 32 KB JS, nirgends Three.js oder Spielcode), Seiten-Gate (keine externen Ressourcen, alte Adressen leiten weiter)
npm run test:e2e # Guard-Gate nach dem Build: Smoke-Test im Browser (Playwright, e2e/): Insel samt Pilz-Ausgang, Detailseiten, alte Adressen, ohne Konsolenfehler; Barrierefreiheit nach WCAG 2.2 AA (axe-core, e2e/a11y.spec.ts); einmalig: npx playwright install chromium
npm run gates    # alle Gates in der Reihenfolge der Pipeline
# Git-Hook .githooks/pre-commit (aktiviert durch npm install) prüft vor jedem Commit Formatierung, Lint, Architektur, Tests
```

Vor jedem Commit `npm run format`, `npm run lint`, `npm run arch`, `npm run check`, `npm test`, `npm run build`, `npm run verify` und `npm run test:e2e` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Über mich), `/workshops/`, `/workshops/<id>/`, `/videos/`, `/videos/<id>/`, `/impressum/`, `/datenschutz/`, 404. Unter `/spiele/` gibt es keine Seiten mehr, nur Weiterleitungen auf www.mitwachsen-spiele.de (`astro.config.mjs`)
- `src/layouts/PlainPage.astro` – Layout der Seiten ohne Insel (Impressum, Datenschutz, 404)
- `src/layouts/IslandPage.astro` – Layout aller Seiten mit Insel: Kopf bleibt beim Seitenwechsel stehen (`transition:persist`), `rest` sagt der Figur, wo sie steht
- `src/content/` – Workshops und Videos als Markdown, Schema in `src/content.config.ts`
- `src/components/` – Astro-Komponenten, die Insel in `Island.astro`, der Kopf ohne Insel (Impressum) in `SubHero.astro`
- `src/scripts/island-state.ts` – Zustandsmaschine der Figur (rein, getestet); `larmic-island.ts` – Web Component dazu (DOM, Takt, Kopfblick, Zurück aus dem Cache)
- `src/lib/voxel/` – Voxel-Generator, läuft beim Build: `textures.ts` (Pixel-Raster), `render.ts`, `figure.ts`, `world.ts` (generische Szenen-Engine), `head.ts` (drehbarer Kopf, auch im Browser genutzt), `avatar.ts` (Avatar als Parameter)
- `src/data/` – `site.ts` (Links, Adressen von mitwachsen-spiele.de, Werkzeugkisten, Sprechblasen, giscus), `materials.ts` (Block und Farben je Material, einzige Quelle), `avatar.ts` (Aussehen der Figur), `island-layout.ts` (die konkrete Insel: Wege, Kisten-Plätze, Baum, Pilz-Ausgang), `island.ts` (lädt Workshops und Videos dafür)
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `docs/design-system.md` – Farben, Materialien, Typografie, Interaktionen
- `docs/specs/insel.md` – Spec der Figur auf der Insel (Ereignisse, Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen

## Regeln

- Schichten (geprüft durch `npm run arch`): `src/lib` ist generisch und importiert nichts aus `src/data`, `components`, `layouts`, `pages`, `scripts`. `src/data` kennt keine Oberfläche. Browser-Code in `src/scripts` nutzt aus `lib` nur `head.ts` und `textures.ts`, nichts aus Node.
- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Materialfarben stehen für Themen: Holz = Architektur, Metall = DevOps/Infrastruktur, Kristall = KI und Event Storming, Gras = Testing. Block und Icon-Farben nur in `src/data/materials.ts` ändern, Flächen/Slots/Rahmen in `tokens.css`.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz (Seite muss ohne JavaScript lesbar sein).
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal, YouTube und Kommentare per Zwei-Klick). Geprüft durch `npm run verify:dist` (Logik in `scripts/dist.ts`).
- Animationen respektieren `prefers-reduced-motion`.
- Jede Seite bleibt schlank (geprüft durch `npm run verify:bundles`, Logik in `scripts/bundles.ts`): höchstens 32 KB JavaScript beim Laden, kein Spielcode, und Three.js gibt es nirgends, auch nicht nachgeladen.
- Die Insel ist auf allen Seiten die einzige Navigation. Neue Seiten mit Insel nutzen `IslandPage.astro` und setzen `rest`. Keine Text-Navigation einbauen.
- Der Pilz-Ausgang `mitwachsen` ist der einzige Block, der von der Seite wegführt: ein normaler Link im selben Tab (kein `target`, kein `rel`), Etikett mit ↗ (`aria-hidden`) und Domain als `sr-only`-Text, kein `aria-label`. Er ist nie Ruheblock (`outside`, siehe `docs/specs/insel.md`). mitwachsen-spiele.de gehört nicht in `personLd.sameAs`.
- TypeScript prüft jeden Index-Zugriff (`noUncheckedIndexedAccess`): fehlende Einträge behandeln. `!` nur, wo die Stelle selbst zeigt, dass der Eintrag existiert, und in Tests.
- Skripte laufen wegen der View Transitions nur einmal: Klicks über `document` delegieren, nicht an Elemente hängen.
- Alte Adressen müssen für immer funktionieren (Lesezeichen, auch auf dem Startbildschirm): `/#workshops`, `/#videos`, `/workshops/#workshop-<id>`, `/videos/#video-<id>`, `/about/`; dazu leiten `/spiele/` und `/spiele/mitwachsen/` direkt auf https://www.mitwachsen-spiele.de/, `/spiele/mitwachsen/spielen/` und `/spiele/threeyear/` direkt auf https://www.mitwachsen-spiele.de/spielen/ (ohne Umweg). Geprüft durch `npm run verify:dist` (fremde Ziele nur aus `REDIRECT_HOSTS`) und `e2e/smoke.spec.ts`.
