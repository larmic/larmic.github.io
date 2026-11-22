# larmic.de

Persönliche Website von Lars Michaelis im Voxel-Stil „Inselwelt“. Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages.

Auf jeder Seite schwebt oben eine Voxel-Insel: Sie ist die einzige Navigation. Die Figur steht auf dem Block der Seite, die gerade angezeigt wird. Zeigst du auf einen anderen Block, baut sie eine Brücke dorthin; Workshops, Videos und Blog-Serien haben eigene Kisten, die beim Öffnen des Bereichs aufpoppen. Zum Blog führt eine Brücke aus zwei Blöcken zum Bücherregal; früher fiel die Figur dort ins Leere. Der Fliegenpilz „Mitwachsen ↗“ führt im selben Tab auf [www.mitwachsen-spiele.de](https://www.mitwachsen-spiele.de/), die eigene Seite meines Kinderspiels; das Spiel lebt im Repo `mitwachsen-spiele`.

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
| `npm test` | Unit-Tests (Vitest) für Voxel-Generator, Blog-Logik und Insel, mit Mindest-Abdeckung der reinen Module (Schwellen in `vitest.config.ts`). Ebenfalls Guard-Gate |
| `npm run lint` | ESLint für TypeScript und Astro. Guard-Gate |
| `npm run format` / `format:check` | Prettier formatiert bzw. prüft den Code. `format:check` ist Guard-Gate |
| `npm run arch` | Architekturregeln (dependency-cruiser, `.dependency-cruiser.cjs`): Schichten `lib` → `data` → Oberfläche, Browser-Code ohne Build-Code. Guard-Gate |
| `npm run build` | Erzeugt die fertige Seite in `dist/` |
| `npm run verify` | Prüft die fertige Seite in `dist/`: gültiges HTML (html-validate), keine toten internen Links und Sprungmarken (linkinator), das Bundle-Gate (jede Seite höchstens 32 KB JavaScript, nirgends Three.js oder Spielcode) und das Seiten-Gate (keine externen Ressourcen ohne Klick, alte Adressen leiten weiter). Guard-Gate nach dem Build |
| `npm run test:e2e` | Smoke-Test im Browser (Playwright, `e2e/`): Startseite und Insel samt Pilz-Ausgang, Detailseiten, Blog samt Feed, alte Adressen, ohne Fehler in der Konsole, dazu Barrierefreiheit jeder Seite nach WCAG 2.2 AA (axe-core). Guard-Gate nach dem Build; einmalig `npx playwright install chromium` |
| `npm run preview` | Zeigt den gebauten Stand aus `dist/` lokal an |
| `npm run gates` | Alle Guard-Gates in der Reihenfolge der Pipeline, inklusive Build |

## Projektstruktur

```
src/
  pages/              / (Über mich), /workshops/, /workshops/<id>/, /videos/, /videos/<id>/,
                      /blog/, /blog/<slug>/, /blog/serie/<id>/, /blog/rss.xml,
                      /impressum/, /datenschutz/, 404, dazu favicon.svg und og.png (beim Build erzeugt)
  layouts/            BaseLayout (Kopfdaten), IslandPage (Seiten mit Insel), PlainPage (Seiten ohne Insel)
  content/
    workshops/        Workshops als Markdown
    videos/           Videos als Markdown (mit YouTube-ID)
    posts/            Blogposts als Markdown, Dateiname = Adresse
    series/           Blog-Serien, der Text ist das Vorwort
  content.config.ts   Schemas der Inhalte
  components/         Astro-Komponenten (Insel, Werkzeugkisten, Karten …)
  scripts/            island-state.ts – Zustandsmaschine der Figur (rein, getestet),
                      larmic-island.ts – Web Component der Insel (DOM, Takt, Kopfblick)
  lib/voxel/          Voxel-Generator (generisch): Blöcke, Szenen-Engine, Figur und Kopf als SVG
  lib/blog/           Blog-Logik (rein, getestet): Lesezeit, Reihenfolge, Guards über alle Posts, RSS,
                      Dateileiste über Code-Blöcken
  data/
    site.ts           Adressen, Social Links, Sprechblasen, Werkzeugkisten, Schwerpunkte, giscus
    materials.ts      Materialien (Holz, Metall, Kristall, Gras): Block und Farben je Thema
    island-layout.ts  die konkrete Insel: Wege, Kisten-Plätze, Baum (rein, getestet)
    island.ts         lädt Workshops, Videos und Blog-Serien und baut daraus die Insel
    avatar.ts         Aussehen der Figur
    blog.ts           lädt Posts und Serien: einziger Zugang, filtert Entwürfe, ruft die Guards
    blog-taxonomy.ts  Spuren (Eltern, Techniker, beide) und die geschlossene Liste der Themen
    structured-data.ts  schema.org-Daten (Person, Workshops als Course, Blogposts) für Suchmaschinen
  styles/             tokens.css (Design-Tokens), global.css, sections.css, blog.css (nur Blog-Seiten)
public/               robots.txt
src/assets/workshops/ Workshop-Fotos (beim Build in passenden Größen ausgeliefert)
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
audience: "Entwickler:innen und Software-Architekt:innen"   # Eckdaten, auf jeder Workshop-Seite gleich aufgebaut
duration: "2 Tage am Stück"
level: "Anspruchsvoll"  # Einfach, Mittel oder Anspruchsvoll
format: "Präsenz"     # optional, Standard Präsenz
groupSize: 12         # optional, Standard 12
location: "…"         # optional, Standard „Bei uns oder bei euch vor Ort“
draft: false          # true = nicht veröffentlichen
---

Beschreibung in Markdown. Eckdaten und Kontakt-Mail nicht in den Text schreiben, die Seite zeigt sie aus den Feldern.
```

**Video hinzufügen:** neue Datei in `src/content/videos/` mit `title`, `short`, `teaser`, `material`, `order`, `youtube` (Video-ID) und optional `recording: "freitagsfruehstueck"` (Hinweis unter dem Video). Jedes Video bekommt eine eigene Seite unter `/videos/<dateiname>/` und eine Kiste an der Insel. An Videos gibt es vier Plätze.

**Blogpost hinzufügen:** neue Datei in `src/content/posts/`. Der Dateiname ist die Adresse (`/blog/<dateiname>/`) und gilt für immer, also ohne Datum und ohne Serien-Präfix. Der Post erscheint auf `/blog/`, im Feed `/blog/rss.xml` und, als Serienteil, auf der Seite der Serie.

````markdown
---
title: "Titel, höchstens 51 Zeichen"
teaser: "Ein bis zwei Sätze für Liste, Feed und Seitenbeschreibung, höchstens 160 Zeichen."
date: 2026-11-22
track: beide          # Pflicht: eltern, technik oder beide
tags: [guards, ki]    # 1 bis 4 aus der Liste in src/data/blog-taxonomy.ts, der erste ist der Aspekt
series: mitwachsen    # optional, nur zusammen mit part: Dateiname aus src/content/series/
part: 1
pattern:              # Pflicht bei Serienteilen: Untertitel „Muster 1: …“ und der orange Zettel am Ende
  title: "Guard vor Feature"
  sentence: "Das Muster in einem Satz."
confession: "…"       # optional: „Kleines Geständnis“, was an der Erzählung verdichtet ist
evidence:             # optional: Kasten „Belege“ mit Commits und Stand-Datum
  asOf: 2026-11-22
  items:
    - { hash: "80ab274", text: "Was der Commit belegt" }
counterpart: anderer-post   # optional: „Die andere Seite“, ein veröffentlichter Post der anderen Spur
draft: true           # true = erscheint nirgends: keine Seite, nicht im Feed, nicht in der Sitemap
---

Text in Markdown, Zwischenüberschriften mit `##` (daraus entsteht das Inhaltsverzeichnis).

```js title="scripts/bundles.ts"
// title="…" setzt die Dateileiste über den Code
```
````

**Serie hinzufügen:** neue Datei in `src/content/series/` mit `title`, `short`, `teaser`, `material`, `parts` (geplante Länge) und optional `featured: false`. Der Text ist das Vorwort auf `/blog/serie/<dateiname>/`. Die Serie bekommt eine Kiste hinter dem Bücherregal der Insel, `short` ist deren Beschriftung; auf ihr steht die Figur bei jedem Teil. Dafür gibt es einen Platz: Eine zweite Serie braucht `featured: false` (ihre Teile stehen dann auf dem Regal) oder einen weiteren Platz in `CHILD_SLOTS`, sonst bricht der Build ab. Eine Serie erscheint erst, wenn ein Teil veröffentlicht ist; noch nicht erschienene Teile stehen dort nur als „Teil 2 bis 8 erscheinen noch.“

Fehlt ein Pflichtfeld oder hat es den falschen Typ, bricht `npm run check` ab. So landet kein kaputter Inhalt online. Für den Blog gilt das auch für eine unbekannte Spur oder ein Thema außerhalb der Liste. Was mehrere Posts betrifft, prüft der Lader `src/data/blog.ts` und bricht `npm run build` mit einer Meldung ab:

- Ein Post hat mehr als 1200 Wörter, also mehr als 6 Minuten Lesezeit (200 Wörter pro Minute; gezählt wird der Text samt Überschriften und Code).
- `series` und `part` stehen nicht zusammen, die Serie gibt es nicht, oder der Teil liegt über `parts`.
- Ein Teil kommt doppelt vor (Entwürfe zählen mit), oder die veröffentlichten Teile sind nicht lückenlos 1, 2, 3 …
- Ein Serienteil hat kein `pattern`.
- `counterpart` zeigt auf einen Entwurf, auf einen unbekannten Post oder auf den Post selbst.
- Der Dateiname enthält anderes als Kleinbuchstaben, Ziffern und Bindestriche oder belegt eine Adresse (`serie`, `tag`, `fuer-eltern`, `fuer-techniker`, `rss`, `feed`).

**Figur anpassen:** Haarfarbe, Hautton, Pulli, Bart und Brille in `src/data/avatar.ts`.

**Werkzeugkisten und Schwerpunkte:** in `src/data/site.ts`.

## Guard-Gates

Auf der Seite steht „KI mit Leitplanken“ – hier sind sie. Jeder Commit läuft durch dieselben deterministischen Prüfungen, egal ob ein Mensch oder eine KI den Code geschrieben hat. Fällt eine durch, geht nichts live.

| Gate | Prüft | Werkzeug |
| --- | --- | --- |
| Formatierung | einheitlicher Code-Stil | Prettier |
| Lint | typische Fehler in TypeScript und Astro | ESLint |
| Architektur | Schichten: `lib` ist generisch, `data` kennt keine Oberfläche, Browser-Code bekommt keinen Build-Code, keine Zyklen | dependency-cruiser |
| Typen und Inhalte | TypeScript strikt, auch jeder Zugriff per Index (`noUncheckedIndexedAccess`), Markdown-Inhalte gegen ihr Schema (im Blog: Spur Pflicht, Themen aus geschlossener Liste) | astro check |
| Unit-Tests | Zustandsmaschine der Figur (Spec: [docs/specs/insel.md](docs/specs/insel.md)), Geometrie der Insel, Kopf, Pixel-Raster, Blog-Guards (jeder fällt in einem Test einmal), Lesezeit, RSS, Bundle- und Seiten-Gate; die Abdeckung der reinen Module darf nicht sinken | Vitest, v8-Coverage |
| Build | die Seite entsteht; die Blog-Guards über alle Posts brechen hier ab (Lesezeit über 6 Minuten, Lücke oder Dublette in einer Serie, fehlendes Muster, reservierter Dateiname) | astro build |
| Fertige Seite | gültiges HTML, keine toten internen Links und Sprungmarken, jede Seite im JavaScript-Budget und nirgends Three.js, keine externen Ressourcen ohne Klick, alte Adressen leiten weiter (fremde Ziele nur auf freigegebene Domains) | html-validate, linkinator, Bundle-Gate, Seiten-Gate |
| Im Browser | Insel und Seitenwechsel, Blog und Serien-Kiste als Links (auch ohne JavaScript und per Tastatur), Pilz-Ausgang als Link im selben Tab, Zurück aus dem Cache, Detailseiten, Blog (Feed, Post ohne JavaScript lesbar), alte Adressen führen weiter, keine Fehler in der Konsole; Barrierefreiheit jeder Seite nach WCAG 2.2 AA | Playwright, axe-core |

Lokal laufen alle zusammen mit `npm run gates`. Zusätzlich prüft ein Git-Hook (`.githooks/pre-commit`) vor jedem Commit die schnellen Gates – Formatierung, Lint, Architektur, Unit-Tests – in wenigen Sekunden. `npm install` aktiviert ihn automatisch; im Notfall überspringt `git commit --no-verify` ihn. Dass die Gates wirklich etwas fangen, ist geprüft: absichtlich eingebaute Fehler (überlappende Kisten, übersprungene Felder, verbotene Imports, tote Links, kaputtes HTML) lassen sie scheitern.

## Deployment

Die Pipeline `.github/workflows/deploy.yml` läuft bei jedem Pull Request (auch von Renovate) und bei jedem Push auf `main`. Sie hat zwei Jobs:

1. **Guard-Gates und Build** – nur mit Leserechten: installiert die Abhängigkeiten (`npm ci`), durchläuft die Guard-Gates (Formatierung, Lint, Architektur, Typen und Inhalte, Unit-Tests), baut die Seite und prüft das Ergebnis (`npm run verify`) und im Browser (`npm run test:e2e`).
2. **Deploy auf GitHub Pages** – nur auf `main`, erst wenn Job 1 grün ist: veröffentlicht die fertige Seite mit `actions/deploy-pages`. Er braucht nur die Rechte `pages: write` und `id-token: write`, keine Schreibrechte aufs Repo, und installiert und baut nichts.

So laufen die Install-Skripte neuer Paketversionen nie mit einem Schreib-Token. Für einen Branch ohne Pull Request läuft die Pipeline nicht – Änderungen kommen per Pull Request nach `main`.

In den GitHub-Pages-Einstellungen ist die Quelle „GitHub Actions“; es gibt keinen Branch `gh-pages` mehr. Die Domain `larmic.de` steht dort ebenfalls (Custom domain), eine `CNAME`-Datei braucht es dafür nicht, und Jekyll läuft bei diesem Weg nicht, also auch kein `.nojekyll`. Alle Actions sind auf Commit-SHAs gepinnt.

Renovate hält Abhängigkeiten und Actions aktuell. Neue Versionen werden erst nach drei Tagen vorgeschlagen (`minimumReleaseAge`): Kompromittierte Releases werden meist in dieser Zeit entdeckt und zurückgezogen. Minor- und Patch-Updates übernimmt Renovate automatisch, aber nur, wenn alle Guard-Gates grün sind. Major-Updates kommen als Pull Request zur Prüfung.

## Alte Adressen

Die Seite löst die frühere Hugo-Seite ab (Historie in git). Alte Adressen funktionieren weiter: `/workshops/#workshop-…` und `/videos/#video-…` leiten auf die jeweilige Detailseite um, `/#workshops` und `/#videos` auf `/workshops/` und `/videos/`, `/about/` auf die Startseite. Die Adressen des Kinderspiels leiten dauerhaft auf seine eigene Seite: `/spiele/` und `/spiele/mitwachsen/` auf https://www.mitwachsen-spiele.de/, `/spiele/mitwachsen/spielen/` und `/spiele/threeyear/` auf https://www.mitwachsen-spiele.de/spielen/. Die Microservices-Folien unter `/workshop_microservices/slides/` kommen aus ihrem eigenen Repository und sind nicht betroffen. Was beim Livegang mit den übrigen alten Adressen passiert, steht in [docs/todo.md](docs/todo.md).

## Kommentare mit giscus

Die Videoseiten sind für Kommentare über GitHub Discussions vorbereitet (Blogposts haben noch keine Kommentare):

1. Im Repository Discussions aktivieren und eine Kategorie „Kommentare“ vom Typ „Announcement“ anlegen.
2. Die [giscus-App](https://github.com/apps/giscus) für das Repository installieren.
3. Auf [giscus.app](https://giscus.app) Repository und Kategorie wählen und die IDs in `GISCUS` in `src/data/site.ts` eintragen.

Danach erscheint unter jedem Video ein Bereich „Kommentare“. Geladen wird giscus erst nach einem Klick.

## Datenschutz und Recht

- Impressum (`/impressum/`) nach § 5 DDG und § 18 Abs. 2 MStV, Datenschutzerklärung unter `/datenschutz/`.
- Beim Laden der Seite wird nichts von Dritten nachgeladen: Schriften sind lokal gebündelt, keine Cookies, kein Tracking.
- YouTube-Videos und Kommentare laden erst nach einem Klick. Unter jedem Video steht ein direkter Link zu YouTube.
- Keine Mail-Adresse steht am Stück im HTML, weder die private noch die von neusta: Der Link entsteht erst im Browser (`MailLink.astro`), ohne JavaScript steht „mail[at]larmic.de“ bzw. „l.michaelis[at]neusta.de“ da.
- Wenn du giscus aktivierst, braucht die Datenschutzerklärung einen eigenen Abschnitt dazu.

## Design

Farben, Materialien, Typografie und Interaktionen stehen in [docs/design-system.md](docs/design-system.md). Die Design-Tokens liegen in `src/styles/tokens.css`.

## Lizenz

Der Quellcode steht unter der MIT-Lizenz. Texte, Fotos, Name und Figur sind davon ausgenommen, hier sind alle Rechte vorbehalten. Details in [LICENSE](LICENSE).
