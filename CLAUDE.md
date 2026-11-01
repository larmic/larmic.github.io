# CLAUDE.md

Persönliche Website von Lars Michaelis (larmic.de) im Voxel-Stil „Inselwelt“. Astro 7, statische Ausgabe, Sprache Deutsch.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm run build    # statische Seite nach dist/
```

Vor jedem Commit `npm run check` und `npm run build` ausführen.

## Aufbau

- `src/pages/` – Seiten: Startseite, `/workshops/`, `/videos/`, `/videos/<id>/`, `/impressum/`, 404
- `src/content/` – Workshops und Videos als Markdown, Schema in `src/content.config.ts`
- `src/components/` – Astro-Komponenten, die Insel in `Island.astro`
- `src/scripts/larmic-island.ts` – Web Component für Figur, Brückenbau und Blog-Sturz (ohne Framework)
- `src/lib/voxel/` – Voxel-Generator, läuft beim Build: `textures.ts` (Pixel-Raster), `render.ts`, `figure.ts`, `world.ts` (Insel, Routen)
- `src/data/` – `site.ts` (Links, Werkzeugkisten, giscus), `avatar.ts` (Aussehen der Figur)
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `docs/design-system.md` – Farben, Materialien, Typografie, Interaktionen

## Regeln

- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Materialfarben stehen für Themen: Holz = Architektur, Metall = DevOps/Infrastruktur, Kristall = KI und Event Storming, Gras = Testing.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz (Seite muss ohne JavaScript lesbar sein).
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal, YouTube und Kommentare per Zwei-Klick).
- Animationen respektieren `prefers-reduced-motion`.
- Alte Adressen (`/workshops/#workshop-<id>`, `/videos/#video-<id>`, `/about/`) müssen funktionieren.
