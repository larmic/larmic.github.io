# CLAUDE.md

Persönliche Website von Lars Michaelis (larmic.de) im Voxel-Stil „Inselwelt“. Astro 7, statische Ausgabe, Sprache Deutsch.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm test         # Guard-Gate: Unit-Tests (Vitest) – muss grün sein
npm run lint     # Guard-Gate: ESLint – muss grün sein
npm run format   # Prettier; `npm run format:check` ist das Guard-Gate
npm run arch     # Guard-Gate: Architekturregeln (dependency-cruiser) – muss grün sein
npm run build    # statische Seite nach dist/
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links
npm run gates    # alle Gates in der Reihenfolge der Pipeline
# Git-Hook .githooks/pre-commit (aktiviert durch npm install) prüft vor jedem Commit Formatierung, Lint, Architektur, Tests
```

Vor jedem Commit `npm run format`, `npm run lint`, `npm run arch`, `npm run check`, `npm test`, `npm run build` und `npm run verify` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Über mich), `/workshops/`, `/workshops/<id>/`, `/videos/`, `/videos/<id>/`, `/impressum/`, 404
- `src/layouts/PlainPage.astro` – Layout der Seiten ohne Insel (Impressum, Datenschutz, 404)
- `src/layouts/IslandPage.astro` – Layout aller Seiten mit Insel: Kopf bleibt beim Seitenwechsel stehen (`transition:persist`), `rest` sagt der Figur, wo sie steht
- `src/content/` – Workshops und Videos als Markdown, Schema in `src/content.config.ts`
- `src/components/` – Astro-Komponenten, die Insel in `Island.astro`, der Kopf ohne Insel (Impressum) in `SubHero.astro`
- `src/scripts/island-state.ts` – Zustandsmaschine der Figur (rein, getestet); `larmic-island.ts` – Web Component dazu (DOM, Takt, Kopfblick)
- `src/lib/voxel/` – Voxel-Generator, läuft beim Build: `textures.ts` (Pixel-Raster), `render.ts`, `figure.ts`, `world.ts` (generische Szenen-Engine), `head.ts` (drehbarer Kopf, auch im Browser genutzt), `avatar.ts` (Avatar als Parameter)
- `src/data/` – `site.ts` (Links, Werkzeugkisten, Sprechblasen, giscus), `materials.ts` (Block und Farben je Material, einzige Quelle), `avatar.ts` (Aussehen der Figur), `island-layout.ts` (die konkrete Insel: Wege, Kisten-Plätze, Baum), `island.ts` (lädt Workshops und Videos dafür)
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `docs/design-system.md` – Farben, Materialien, Typografie, Interaktionen
- `docs/specs/insel.md` – Spec der Figur auf der Insel (Ereignisse, Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen

## Regeln

- Schichten (geprüft durch `npm run arch`): `src/lib` ist generisch und importiert nichts aus `src/data`, `components`, `layouts`, `pages`, `scripts`. `src/data` kennt keine Oberfläche. Browser-Code in `src/scripts` nutzt aus `lib` nur `head.ts` und nichts aus Node.
- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Materialfarben stehen für Themen: Holz = Architektur, Metall = DevOps/Infrastruktur, Kristall = KI und Event Storming, Gras = Testing. Block und Icon-Farben nur in `src/data/materials.ts` ändern, Flächen/Slots/Rahmen in `tokens.css`.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz (Seite muss ohne JavaScript lesbar sein).
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal, YouTube und Kommentare per Zwei-Klick).
- Animationen respektieren `prefers-reduced-motion`.
- Die Insel ist auf allen Seiten die einzige Navigation. Neue Seiten mit Insel nutzen `IslandPage.astro` und setzen `rest`. Keine Text-Navigation einbauen.
- Skripte laufen wegen der View Transitions nur einmal: Klicks über `document` delegieren, nicht an Elemente hängen.
- Alte Adressen (`/#workshops`, `/#videos`, `/workshops/#workshop-<id>`, `/videos/#video-<id>`, `/about/`) müssen funktionieren.
