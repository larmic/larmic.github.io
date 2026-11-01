# larmic.de

Persönliche Website von Lars Michaelis im Voxel-Stil „Inselwelt“. Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages.

Auf jeder Seite schwebt oben eine Voxel-Insel: Sie ist die einzige Navigation. Die Figur steht auf dem Block der Seite, die gerade angezeigt wird. Zeigst du auf einen anderen Block, baut sie eine Brücke dorthin; Workshops und Videos haben eigene Kisten, die beim Öffnen des Bereichs aufpoppen. Beim Blog-Block fällt sie ins Leere und meldet „404 – Kein Blog gefunden“.

## Schnellstart

Voraussetzung ist Node.js in der Version aus `.nvmrc` (24), zum Beispiel über Homebrew:

```bash
brew install node
npm install
npm run dev
```

Die Seite läuft dann unter http://localhost:4321 und lädt Änderungen sofort neu.

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Live-Reload |
| `npm run check` | Prüft Typen und Inhalts-Schemas. Läuft auch in der Pipeline als Guard-Gate |
| `npm test` | Unit-Tests (Vitest) für Voxel-Generator und Logik. Ebenfalls Guard-Gate |
| `npm run lint` | ESLint für TypeScript und Astro. Guard-Gate |
| `npm run format` / `format:check` | Prettier formatiert bzw. prüft den Code. `format:check` ist Guard-Gate |
| `npm run arch` | Architekturregeln (dependency-cruiser, `.dependency-cruiser.cjs`): Schichten `lib` → `data` → Oberfläche, Browser-Code ohne Build-Code. Guard-Gate |
| `npm run build` | Erzeugt die fertige Seite in `dist/` |
| `npm run verify` | Prüft die fertige Seite in `dist/`: gültiges HTML (html-validate) und keine toten internen Links (linkinator). Guard-Gate nach dem Build |
| `npm run preview` | Zeigt den gebauten Stand aus `dist/` lokal an |

## Projektstruktur

```
src/
  pages/              / (Über mich), /workshops/, /workshops/<id>/, /videos/, /videos/<id>/,
                      /impressum/, /datenschutz/, 404, dazu favicon.svg und og.png (beim Build erzeugt)
  layouts/            BaseLayout (Kopfdaten), IslandPage (Seiten mit Insel)
  content/
    workshops/        Workshops als Markdown
    videos/           Videos als Markdown (mit YouTube-ID)
  content.config.ts   Schemas der Inhalte
  components/         Astro-Komponenten (Insel, Werkzeugkisten, Karten …)
  scripts/            larmic-island.ts – Web Component der Insel
  lib/voxel/          Voxel-Generator, erzeugt beim Build alle Blöcke, die Insel und die Figur als SVG
  data/
    site.ts           Adressen, Social Links, Sprechblasen, Werkzeugkisten, Schwerpunkte, giscus
    island.ts         Insel mit Kisten aus Workshops und Videos
    avatar.ts         Aussehen der Figur
  styles/             tokens.css (Design-Tokens), global.css, sections.css
public/               CNAME, robots.txt, .nojekyll, Bilder
docs/design-system.md Farben, Materialien, Typografie, Interaktionen
docs/specs/insel.md   Spec der Figur auf der Insel (Regeln, Invarianten, Tests)
docs/todo.md          Offene Punkte (Livegang-Checkliste, Review-Ergebnisse)
```

## Inhalte pflegen

**Workshop hinzufügen:** neue Datei in `src/content/workshops/`, jeder Workshop bekommt eine eigene Seite unter `/workshops/<dateiname>/` und eine Kiste an der Insel. `short` ist die Beschriftung der Kiste. An Workshops gibt es vier Plätze; ein weiterer Workshop bricht den Build mit einer Meldung ab, dann braucht es einen neuen Platz in `CHILD_SLOTS` (`src/data/island-layout.ts`).

```markdown
---
title: "Langer Titel für die Workshop-Seite"
short: "Kurzer Titel für die Karte"
teaser: "Ein Satz für die Karte auf /workshops/ und die Seitenbeschreibung."
material: "hw"        # hw = Holz, ops = Metall, ki = Kristall, gr = Gras
order: 4              # Reihenfolge
link: "https://…"     # optional: zusätzlicher Button auf der Workshop-Seite, z. B. zu Folien
linkLabel: "…"        # optional: Beschriftung des Buttons
draft: false          # true = nicht veröffentlichen
---

Beschreibung in Markdown.
```

**Video hinzufügen:** neue Datei in `src/content/videos/` mit `title`, `short`, `teaser`, `material`, `order`, `youtube` (Video-ID), `date` und optional `recording: "freitagsfruehstueck"` (Hinweis unter dem Video). Jedes Video bekommt eine eigene Seite unter `/videos/<dateiname>/` und eine Kiste an der Insel. An Videos gibt es vier Plätze.

Fehlt ein Pflichtfeld oder hat es den falschen Typ, bricht `npm run check` ab. So landet kein kaputter Inhalt online.

**Figur anpassen:** Haarfarbe, Hautton, Pulli, Bart und Brille in `src/data/avatar.ts`.

**Werkzeugkisten und Schwerpunkte:** in `src/data/site.ts`.

## Deployment

Die Pipeline `.github/workflows/deploy.yml` läuft bei jedem Push:

1. installiert die Abhängigkeiten (`npm ci`),
2. prüft Typen und Inhalte (`npm run check`),
3. baut die Seite (`npm run build`),
4. veröffentlicht `dist/` in den Branch `gh-pages`, **aber nur auf `main`**.

Andere Branches werden also gebaut und geprüft, aber nicht veröffentlicht. Die GitHub-Pages-Einstellungen bleiben wie bisher: Quelle ist der Branch `gh-pages`, die Domain kommt aus `public/CNAME`. Die Datei `public/.nojekyll` verhindert, dass GitHub Pages den Astro-Ordner `_astro/` verschluckt.

Renovate hält Abhängigkeiten und Actions aktuell. Minor- und Patch-Updates werden automatisch übernommen, sobald der Build grün ist. Major-Updates kommen als Pull Request zur Prüfung.

## Alte Adressen

Die Seite löst die frühere Hugo-Seite ab (Historie in git). Alte Adressen funktionieren weiter: `/workshops/#workshop-…` und `/videos/#video-…` leiten auf die jeweilige Detailseite um, `/#workshops` und `/#videos` auf `/workshops/` und `/videos/`, `/about/` auf die Startseite. Die Microservices-Folien unter `/workshop_microservices/slides/` kommen aus ihrem eigenen Repository und sind nicht betroffen. Was beim Livegang mit den übrigen alten Adressen passiert, steht in [docs/todo.md](docs/todo.md).

## Kommentare mit giscus

Die Videoseiten sind für Kommentare über GitHub Discussions vorbereitet:

1. Im Repository Discussions aktivieren und eine Kategorie „Kommentare“ vom Typ „Announcement“ anlegen.
2. Die [giscus-App](https://github.com/apps/giscus) für das Repository installieren.
3. Auf [giscus.app](https://giscus.app) Repository und Kategorie wählen und die IDs in `GISCUS` in `src/data/site.ts` eintragen.

Danach erscheint unter jedem Video ein Bereich „Kommentare“. Geladen wird giscus erst nach einem Klick.

## Datenschutz und Recht

- Impressum (`/impressum/`) nach § 5 DDG und § 18 Abs. 2 MStV, Datenschutzerklärung unter `/datenschutz/`.
- Beim Laden der Seite wird nichts von Dritten nachgeladen: Schriften sind lokal gebündelt, keine Cookies, kein Tracking.
- YouTube-Videos und Kommentare laden erst nach einem Klick. Unter jedem Video steht ein direkter Link zu YouTube.
- Die private Mail-Adresse steht nicht im HTML, der Link entsteht erst im Browser (`MailLink.astro`).
- Wenn du giscus aktivierst, braucht die Datenschutzerklärung einen eigenen Abschnitt dazu.

## Design

Farben, Materialien, Typografie und Interaktionen stehen in [docs/design-system.md](docs/design-system.md). Die Design-Tokens liegen in `src/styles/tokens.css`.
