# larmic.de

Persönliche Website von Lars Michaelis im Voxel-Stil „Inselwelt“. Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages.

Auf der Startseite steht eine Voxel-Figur auf einer schwebenden Insel. Zeigst du auf einen der vier Blöcke, baut sie eine Brücke dorthin. Beim Blog-Block fällt sie ins Leere und meldet „404 – Kein Blog gefunden“.

## Schnellstart

Voraussetzung ist Node.js 22.23 oder neuer, zum Beispiel über Homebrew:

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
| `npm run build` | Erzeugt die fertige Seite in `dist/` |
| `npm run preview` | Zeigt den gebauten Stand aus `dist/` lokal an |

## Projektstruktur

```
src/
  pages/              Startseite, /workshops/<id>/, /videos/<id>/, /impressum/, 404
  content/
    workshops/        Workshops als Markdown
    videos/           Videos als Markdown (mit YouTube-ID)
  content.config.ts   Schemas der Inhalte
  components/         Astro-Komponenten (Insel, Werkzeugkisten, Karten …)
  scripts/            larmic-island.ts – Web Component der Insel
  lib/voxel/          Voxel-Generator, erzeugt beim Build alle Blöcke und die Figur als SVG
  data/
    site.ts           Social Links, Werkzeugkisten, Schwerpunkte, giscus
    avatar.ts         Aussehen der Figur
  styles/             tokens.css (Design-Tokens), global.css, sections.css
public/               CNAME, robots.txt, .nojekyll, Bilder
docs/design-system.md Farben, Materialien, Typografie, Interaktionen
```

## Inhalte pflegen

**Workshop hinzufügen:** neue Datei in `src/content/workshops/`, jeder Workshop bekommt eine eigene Seite unter `/workshops/<dateiname>/`.

```markdown
---
title: "Langer Titel für die Workshop-Seite"
short: "Kurzer Titel für die Karte"
teaser: "Ein Satz für die Karte auf der Startseite."
material: "hw"        # hw = Holz, ops = Metall, ki = Kristall, gr = Gras
order: 4              # Reihenfolge
link: "https://…"     # optional: zusätzlicher Button auf der Workshop-Seite, z. B. zu Folien
linkLabel: "…"        # optional: Beschriftung des Buttons
draft: false          # true = nicht veröffentlichen
---

Beschreibung in Markdown.
```

**Video hinzufügen:** neue Datei in `src/content/videos/` mit `title`, `short`, `teaser`, `material`, `order`, `youtube` (Video-ID) und `date`. Jedes Video bekommt eine eigene Seite unter `/videos/<dateiname>/`.

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

## Umstieg vom Hugo-Stand

Am einfachsten geht es mit einem Branch auf Basis von `main`. Dann bleibt die Historie erhalten und du kannst ganz normal einen Pull Request stellen:

```bash
git switch main && git pull
git switch -c astro-redesign
git rm -r -q .                 # alle Hugo-Dateien inkl. Theme-Submodul entfernen
rm -rf themes resources public  # lokale Reste löschen
unzip ~/Downloads/larmic-astro.zip -d .
npm install
npm run build                   # einmal lokal prüfen
git add -A
git commit -m "Redesign: Inselwelt mit Astro"
git push -u origin astro-redesign
```

Die Pipeline baut den Branch, deployt ihn aber nicht. Nach dem Merge in `main` geht die neue Seite live.

Ein komplett leerer Branch (`git switch --orphan astro-redesign`) funktioniert auch. Weil er keine gemeinsame Historie mit `main` hat, lässt er sich aber nicht einfach als Pull Request mergen.

Alte Adressen funktionieren weiter: `/workshops/#workshop-…` und `/videos/#video-…` leiten auf die jeweilige Detailseite um, `/workshops/` und `/videos/` auf den passenden Bereich der Startseite, `/about/` auf „Über mich“. Die Microservices-Folien unter `/workshop_microservices/slides/` kommen aus ihrem eigenen Repository und sind nicht betroffen.

## Kommentare mit giscus

Die Videoseiten sind für Kommentare über GitHub Discussions vorbereitet:

1. Im Repository Discussions aktivieren und eine Kategorie „Kommentare“ vom Typ „Announcement“ anlegen.
2. Die [giscus-App](https://github.com/apps/giscus) für das Repository installieren.
3. Auf [giscus.app](https://giscus.app) Repository und Kategorie wählen und die IDs in `GISCUS` in `src/data/site.ts` eintragen.

Danach erscheint unter jedem Video ein Bereich „Kommentare“. Geladen wird giscus erst nach einem Klick.

## Datenschutz und Recht

- Schriften sind lokal gebündelt, es gibt keine Verbindung zu Google Fonts.
- YouTube-Videos und Kommentare laden erst nach einem Klick.
- Wenn du giscus aktivierst, gehört ein Hinweis auf GitHub und giscus in eine Datenschutzerklärung. Eine eigene Datenschutzseite gibt es noch nicht.
- Das Impressum ist unverändert übernommen. Es verweist noch auf TMG und RStV. Beide wurden ersetzt: durch das Digitale-Dienste-Gesetz (DDG) und den Medienstaatsvertrag (MStV). Bitte prüfen und anpassen.

## Design

Farben, Materialien, Typografie und Interaktionen stehen in [docs/design-system.md](docs/design-system.md). Die Design-Tokens liegen in `src/styles/tokens.css`.
