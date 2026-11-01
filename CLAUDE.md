# CLAUDE.md

Persönliche Website von Lars Michaelis (larmic.de) im Voxel-Stil „Inselwelt“. Astro 7, statische Ausgabe, Sprache Deutsch.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm test         # Guard-Gate: Unit-Tests (Vitest) – muss grün sein
npm run build    # statische Seite nach dist/
```

Vor jedem Commit `npm run check`, `npm test` und `npm run build` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Über mich), `/workshops/`, `/workshops/<id>/`, `/videos/`, `/videos/<id>/`, `/impressum/`, 404
- `src/layouts/IslandPage.astro` – Layout aller Seiten mit Insel: Kopf bleibt beim Seitenwechsel stehen (`transition:persist`), `rest` sagt der Figur, wo sie steht
- `src/content/` – Workshops und Videos als Markdown, Schema in `src/content.config.ts`
- `src/components/` – Astro-Komponenten, die Insel in `Island.astro`, der Kopf ohne Insel (Impressum) in `SubHero.astro`
- `src/scripts/island-state.ts` – Zustandsmaschine der Figur (rein, getestet); `larmic-island.ts` – Web Component dazu (DOM, Takt, Kopfblick)
- `src/lib/voxel/` – Voxel-Generator, läuft beim Build: `textures.ts` (Pixel-Raster), `render.ts`, `figure.ts`, `world.ts` (Insel, Wege, Plätze der Kisten, Baum-Easter-Egg), `head.ts` (drehbarer Kopf, auch im Browser genutzt)
- `src/data/` – `site.ts` (Links, Werkzeugkisten, Sprechblasen, giscus), `avatar.ts` (Aussehen der Figur), `island.ts` (Insel mit Kisten aus Workshops und Videos)
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `docs/design-system.md` – Farben, Materialien, Typografie, Interaktionen

## Regeln

- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Materialfarben stehen für Themen: Holz = Architektur, Metall = DevOps/Infrastruktur, Kristall = KI und Event Storming, Gras = Testing.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz (Seite muss ohne JavaScript lesbar sein).
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal, YouTube und Kommentare per Zwei-Klick).
- Animationen respektieren `prefers-reduced-motion`.
- Die Insel ist auf allen Seiten die einzige Navigation. Neue Seiten mit Insel nutzen `IslandPage.astro` und setzen `rest`. Keine Text-Navigation einbauen.
- Skripte laufen wegen der View Transitions nur einmal: Klicks über `document` delegieren, nicht an Elemente hängen.
- Alte Adressen (`/#workshops`, `/#videos`, `/workshops/#workshop-<id>`, `/videos/#video-<id>`, `/about/`) müssen funktionieren.
