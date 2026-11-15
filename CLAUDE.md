# CLAUDE.md

Persönliche Website von Lars Michaelis (larmic.de) im Voxel-Stil „Inselwelt“. Astro 7, statische Ausgabe, Sprache Deutsch.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm test         # Guard-Gate: Unit-Tests (Vitest) mit Mindest-Abdeckung der reinen Module (vitest.config.ts) – muss grün sein
npm run lint     # Guard-Gate: ESLint – muss grün sein
npm run format   # Prettier; `npm run format:check` ist das Guard-Gate
npm run arch     # Guard-Gate: Architekturregeln (dependency-cruiser) – muss grün sein
npm run build    # statische Seite nach dist/
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links und Sprungmarken, Bundle-Gate (Homepage ohne Spiel, JS-Budget), Seiten-Gate (keine externen Ressourcen, alte Adressen leiten weiter)
npm run test:e2e # Guard-Gate nach dem Build: Smoke-Test im Browser (Playwright, e2e/): Insel, Detailseiten, Spiel, alte Adressen, ohne Konsolenfehler; Barrierefreiheit nach WCAG 2.2 AA (axe-core, e2e/a11y.spec.ts); einmalig: npx playwright install chromium
npm run gates    # alle Gates in der Reihenfolge der Pipeline
# Git-Hook .githooks/pre-commit (aktiviert durch npm install) prüft vor jedem Commit Formatierung, Lint, Architektur, Tests
```

Vor jedem Commit `npm run format`, `npm run lint`, `npm run arch`, `npm run check`, `npm test`, `npm run build`, `npm run verify` und `npm run test:e2e` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Über mich), `/workshops/`, `/workshops/<id>/`, `/videos/`, `/videos/<id>/`, `/impressum/`, 404, `/spiele/`, `/spiele/<id>/` (Spiele für Eltern beschrieben, Inhalte in `src/content/games/`), `/spiele/mitwachsen/spielen/` (das Kinderspiel selbst, Seite ohne Insel, `noindex`, nicht in der Sitemap; `/spiele/threeyear/` leitet dorthin)
- `src/layouts/PlainPage.astro` – Layout der Seiten ohne Insel (Impressum, Datenschutz, 404)
- `src/layouts/IslandPage.astro` – Layout aller Seiten mit Insel: Kopf bleibt beim Seitenwechsel stehen (`transition:persist`), `rest` sagt der Figur, wo sie steht
- `src/content/` – Workshops, Videos und Spiele als Markdown, Schema in `src/content.config.ts`
- `src/components/` – Astro-Komponenten, die Insel in `Island.astro`, der Kopf ohne Insel (Impressum) in `SubHero.astro`
- `src/scripts/island-state.ts` – Zustandsmaschine der Figur (rein, getestet); `larmic-island.ts` – Web Component dazu (DOM, Takt, Kopfblick)
- Kinderspiel Mitwachsen: `src/lib/games/` (Zufall, Stücke, Ansicht von vorn – generisch, läuft im Browser), `src/data/games/mitwachsen.ts` (Gegenden, Tiere, Figur), `src/scripts/games/` (Welt, Regeln und Speichern rein und getestet; `larmic-mitwachsen.ts` Web Component, `mitwachsen-3d.ts` 3D-Ansicht mit Three.js (wird per `import()` nachgeladen; dazu `mitwachsen-geo.ts` Textur-Atlas und Baukasten, `mitwachsen-gatehouse.ts` Torhäuser und Portale), `mitwachsen-tired.ts` Müde werden (Medienzeit), `mitwachsen-render.ts` 2D-Ansicht und Ebene darüber, `input-pace.ts` ruhiger Takt, `sfx.ts` Töne), `src/components/MitwachsenGame.astro`
- `src/lib/voxel/` – Voxel-Generator, läuft beim Build: `textures.ts` (Pixel-Raster), `render.ts`, `figure.ts`, `world.ts` (generische Szenen-Engine), `head.ts` (drehbarer Kopf, auch im Browser genutzt), `avatar.ts` (Avatar als Parameter)
- `src/data/` – `site.ts` (Links, Werkzeugkisten, Sprechblasen, giscus), `materials.ts` (Block und Farben je Material, einzige Quelle), `avatar.ts` (Aussehen der Figur), `island-layout.ts` (die konkrete Insel: Wege, Kisten-Plätze, Baum), `island.ts` (lädt Workshops und Videos dafür)
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `docs/design-system.md` – Farben, Materialien, Typografie, Interaktionen
- `docs/games/` – Kinderspiel Mitwachsen, wächst mit meinem Sohn: `README.md` (Einleitung, Altersstufen, gemeinsame Regeln), `mitwachsen.md` (Konzept der Stufe ab 3). Vor Arbeiten am Spiel lesen
- `docs/specs/mitwachsen.md` – Spec von Mitwachsen (Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen
- `docs/specs/insel.md` – Spec der Figur auf der Insel (Ereignisse, Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen

## Regeln

- Schichten (geprüft durch `npm run arch`): `src/lib` ist generisch und importiert nichts aus `src/data`, `components`, `layouts`, `pages`, `scripts`. `src/data` kennt keine Oberfläche. Browser-Code in `src/scripts` nutzt aus `lib` nur `head.ts`, `textures.ts` und `src/lib/games/`, nichts aus Node. `src/lib/games/` und `src/data/games/` laufen im Browser und nutzen aus `lib` nur `games/` und `textures.ts`.
- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Materialfarben stehen für Themen: Holz = Architektur, Metall = DevOps/Infrastruktur, Kristall = KI und Event Storming, Gras = Testing. Block und Icon-Farben nur in `src/data/materials.ts` ändern, Flächen/Slots/Rahmen in `tokens.css`.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz (Seite muss ohne JavaScript lesbar sein).
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal, YouTube und Kommentare per Zwei-Klick). Geprüft durch `npm run verify:dist` (Logik in `scripts/dist.ts`).
- Animationen respektieren `prefers-reduced-motion`.
- Die Homepage bleibt schlank (geprüft durch `npm run verify:bundles`, Logik in `scripts/bundles.ts`): Seiten außerhalb von `/spiele/` laden kein Spiel und kein Three.js und höchstens 32 KB JavaScript; die Spielseite lädt 3D nur nachträglich per `import()`.
- Die Insel ist auf allen Seiten die einzige Navigation. Neue Seiten mit Insel nutzen `IslandPage.astro` und setzen `rest`. Keine Text-Navigation einbauen.
- TypeScript prüft jeden Index-Zugriff (`noUncheckedIndexedAccess`): fehlende Einträge behandeln; Auswahl aus Listen über `pick`/`cycle` (`src/lib/games/rng.ts`), Feld-Schlüssel über `fromKey` (`chunks.ts`). `!` nur, wo die Stelle selbst zeigt, dass der Eintrag existiert, und in Tests.
- Skripte laufen wegen der View Transitions nur einmal: Klicks über `document` delegieren, nicht an Elemente hängen.
- Alte Adressen (`/#workshops`, `/#videos`, `/workshops/#workshop-<id>`, `/videos/#video-<id>`, `/about/`, `/spiele/threeyear/`, `/spiele/mitwachsen/` – heute die Seite zum Spiel mit „Spiel starten“) müssen funktionieren.
