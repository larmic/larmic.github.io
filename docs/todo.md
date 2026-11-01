# TODO

Stand nach dem vollständigen Review (Inhalt und Code) vom November 2026. Erledigtes ist abgehakt.

## Erledigt

- [x] Impressum: auf § 5 DDG und § 18 Abs. 2 MStV umgestellt, Haftungsausschluss entfernt

## Vor dem Livegang

### Recht und Datenschutz

- [x] **Rolle von team neusta geklärt:** Workshops laufen über team neusta, Vertragspartner ist die neusta GmbH. Steht auf `/workshops/`, auf jeder Workshop-Seite und in der Datenschutzerklärung. Für Anfragen an `l.michaelis@neusta.de` gilt die Datenschutzerklärung der team neusta SE (verlinkt).
- [x] **Datenschutzerklärung nachgezogen:** Formulierung zur Auslieferung, Speicherdauer der GitHub-Logs (GitHub nennt keine Frist), Widerspruchsrecht hervorgehoben, Pflicht zur Bereitstellung und automatisierte Entscheidungen.
- [ ] **Datenschutzerklärung prüfen lassen** (Generator-Abgleich oder neusta).
- [x] **YouTube-Platzhalter:** Hinweis auf Google/USA mit Link zur Datenschutzerklärung und direkter Link zu YouTube unter jedem Video.
- [ ] Vor dem Aktivieren von giscus: eigener Abschnitt in der Datenschutzerklärung. Die Aussage „keine Cookies, keine Speicherung“ gilt dann nicht mehr uneingeschränkt.

### Barrierefreiheit (Muss)

- [x] **Kisten-Links haben einen zugänglichen Namen:** Etikett nur noch per `opacity` versteckt, nicht mehr per `display: none`.
- [x] **Fokusrahmen auf dunklen Flächen:** im Footer und auf Kristall weiß (14,8:1 bzw. mind. 6,6:1).

### Inhalt

- [x] **Sichtbarer Kontaktweg:** Workshops und Beratung über neusta (`l.michaelis@neusta.de`, auf den Workshop-Seiten), alles andere privat an `mail@larmic.de` (Footer „Kontakt“ und Ende von „Über mich“, Adresse erst per JavaScript zusammengesetzt).
- [x] **Button im Kopf:** auf `/workshops/` und Workshop-Seiten „Workshop anfragen“ (Mail an neusta, mit Workshop im Betreff), sonst „Workshops ansehen“.
- [x] **Positionierung:** Hero-Intro und Description nennen jetzt auch „KI mit Leitplanken“.
- [x] „Screencasts“ aus den Texten entfernt, „Architekt“ in Untertitel und Description aufgenommen. Die Talks auf `/videos/` sind auch die Konferenzvorträge, eine eigene Liste braucht es nicht.
- [x] Satz nach dem KI-Absatz umformuliert (Bezug auf die Workshops).
- [ ] Eintrag „KI“ in der KI-Werkzeugkiste durch ein konkretes Werkzeug oder eine Praxis ersetzen (Entscheidung offen).
- [x] **Videotexte aufgeräumt:** „team neusta“, Freitagsfrühstück-Hinweis zentral (`RecordingNote.astro`), Überschriften, Grammatik.
- [ ] Feld `date` der Videos: überall „2023-02-22“ und nicht angezeigt. Echte Daten eintragen und anzeigen oder Feld entfernen.

### Technik und Betrieb

- [x] **README aktualisiert:** Zip-Umstieg entfernt, Recht und Datenschutz, Seitenliste, Node-Version, Insel-Beschreibung.
- [x] **Vorschaubild beim Teilen:** `/og.png` (1200 × 630) wird beim Build aus der Insel-Szene gerendert, dazu `og:site_name`, `og:locale`, `twitter:card`.
- [x] **Videos ohne JavaScript erreichbar:** Link „direkt auf YouTube ansehen“ unter jedem Video.
- [x] **Speicherleck der Insel behoben:** globale Listener per AbortController, `cancelAnimationFrame` beim Entfernen.
- [ ] **Livegang-Checkliste:**
  - [ ] Pull Request `relaunch` → `main` öffnen. Der Workflow prüft ihn mit allen Gates (erster echter Lauf in GitHub).
  - [ ] Merge. Der alte Stand bleibt online, solange Pages noch aus dem Branch `gh-pages` veröffentlicht; der Deploy-Job schlägt dann vermutlich fehl, weil die Quelle noch nicht „GitHub Actions“ ist.
  - [ ] Settings → Pages → Source auf „GitHub Actions“ stellen und den Deploy-Job neu starten („Re-run failed jobs“). So ist die Seite höchstens Sekunden weg.
  - [x] Alte Adressen, die mit dem Umstieg sonst auf 404 laufen:
    - `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png` werden beim Build erzeugt
    - `/workshop/ddd_hex_architecture.png`, `/workshop/event_storming.png` entstehen beim Build aus den WebP-Dateien (verkleinert, 0,5 bzw. 0,3 MB statt 13,8 bzw. 9 MB)
    - `/tags/`, `/categories/` leiten auf die Startseite um
    - `/sitemap.xml` ist ein Sitemap-Index, der auf die neue Sitemap zeigt
    - RSS (`/index.xml`, `/videos/index.xml`, `/workshops/index.xml`) entfällt bewusst, solange es keinen Blog gibt
  - [ ] Branch-Schutz für `main`: Prüfung „Guard-Gates und Build“ als Pflicht, direkte Pushes nur per Pull Request.
  - [ ] Pages-Einstellungen prüfen: Custom domain `larmic.de` steht weiter drin, „Enforce HTTPS“ an. Seite mit CSS und Insel ausgeliefert?
  - [ ] Stichprobe der alten Adressen nach dem Deploy (`/about/`, `/#workshops`, `/workshops/#workshop-…`, `/videos/#video-…`).
  - [ ] Search Console: `sitemap-index.xml` einreichen, alte `sitemap.xml` entfernen.
  - [ ] Branches `relaunch` und `gh-pages` löschen (`gh-pages` wird nicht mehr gebraucht).
- [ ] **Mobiles Design prüfen**, auch sehr schmale und sehr breite Bildschirme.
- [x] **Kisten-Plätze:** vierter Workshop-Platz als Reserve (für „DDD für Nicht-Techniker:innen“), Fehlermeldung sagt, was zu tun ist. Videos haben weiterhin vier Plätze.

## Bald nach dem Livegang

### Guard-Gates sichtbar machen (Glaubwürdigkeit)

Die Seite wirbt mit Spec-Driven, Guard-Gates, ArchUnit und BDD. Beim Review war `astro check` das einzige Gate; inzwischen sind es sieben (siehe README, Abschnitt „Guard-Gates“):

- [x] **Vitest** mit Tests für den Voxel-Generator: `headView`, `gridSvg` (Pixel-Abdeckung aller Texturen), `buildWorld` (Determinismus, Baum-Wege, Nachbarschaft der Schritte, keine Überlappung, Slot-Grenze). Läuft als Gate in der Pipeline.
- [x] **Zustandsmaschine der Figur** als reines Modul `src/scripts/island-state.ts` mit Tests (Brückenbau, Rückweg bis zur Abzweigung, gemeinsame Brücken, Zielwechsel, Blog-Sturz, Baum, alle Kombinationen von Ruheblock und Ziel).
- [x] **ESLint und Prettier** als Gates in der Pipeline. Formatieren hat am Ergebnis nichts geändert (gebaute Seiten zeichengenau gleich).
- [x] **Architekturregeln** mit dependency-cruiser (`npm run arch`): `lib` generisch, `data` ohne Oberfläche, Browser-Code nur mit `head.ts`, keine Zyklen. Gate in der Pipeline. `.astro`-Dateien prüft dependency-cruiser nicht.
- [x] **Link- und HTML-Check** auf `dist` als Gate nach dem Build (html-validate, linkinator für interne Links). Dabei gefunden und behoben: `<style>` im Body (Partikel jetzt im `<head>`) und zu lange Seitentitel.
- [x] **Spec** der Insel-Zustandsmaschine in `docs/specs/insel.md`, jede Regel mit dem Test, der sie prüft.
- [x] Alle Gates als eigene Schritte im Workflow, im README (Abschnitt „Guard-Gates“) beschrieben, lokal mit `npm run gates`.

### Code und Architektur

- [x] **Zustandsmaschine aus der Web Component gelöst:** reines Modul mit sprechenden Feldnamen, `sel` und der nie leere Weg entfernt, `msg` durch `show404` ersetzt. Die Komponente macht nur noch DOM, Takt und Kopfblick.
- [x] **Schichtung:** Avatar ist Parameter des Generators, die konkrete Insel liegt in `src/data/island-layout.ts`, `world.ts` ist nur noch die generische Szenen-Engine.
- [x] **Eine Quelle für Materialien:** `src/data/materials.ts` (Block, Icon- und Play-Farbe); Schema-Enum, Werkzeugkisten und Karten nutzen sie, die ungenutzten `--*-icon`-Tokens sind weg.
- [x] **Geometrie zentral:** Würfelmaße, `pos`/`footpt` und Flächen-Matrizen in `src/lib/voxel/cube.ts` (aus den Maßen berechnet), Würfelflächen einmal als `cubeFaces()`. Die Zustandsmaschine übernimmt die Wege-Typen des Generators (reiner Typ-Import), `rest` ist der Union-Typ `RestId`.
- [x] **Toten Code entfernt:** Prototyp-Texturen und -Paletten (`BED`, `CRACK`, `DEEP`, `ORE`, `PSTONE`, `palOre`) und das Token `--font-mono`.
- [x] Skript in `IslandPage.astro` steht jetzt im Dokument (vorher hinter `</html>`).
- [x] **Brücken-Verdeckung behoben:** Inselblöcke vor Brücken oder Zielblöcken kommen als Vordergrund-Ebene dazu (samt allen Blöcken, die wiederum davor stehen); z-index aller Ebenen aus der Tiefenreihenfolge. Per Render geprüft, Regressionstest dazu.
- [x] **Fokus-Listener der Blöcke** reagieren nur auf Tastatur-Fokus (`:focus-visible`); kein zweiter Blog-Sturz mehr nach Tab-Wechsel.
- [x] Schmale Ansicht: Die Figur springt mit `settle()` sofort ans Ziel, statt unsichtbar Takt für Takt zu laufen. Erkannt wird die Ansicht am CSS (Brücken ausgeblendet).
- [x] Gemeinsames Layout `PlainPage.astro` für Impressum, Datenschutz und 404; statische Inline-Styles (Seiten, Footer, Symbol-SVG) als CSS-Klassen. Inline bleiben nur berechnete Werte und die Formen der Wolken.

### Barrierefreiheit (weitere)

- [x] Skip-Link „Zum Inhalt springen“, Kopf als `<header>`, die Insel in `<nav aria-label="Hauptnavigation">`, `main` als Sprungziel (`tabindex="-1"`).
- [x] Nach dem Seitenwechsel liegt der Fokus auf `main` (ohne Scrollen); den Titel sagt Astros Router an.
- [x] Sprechblase ist Dekoration und für Screenreader ausgeblendet (keine wiederholten Ansagen mehr).
- [x] Blog-Button heißt für Screenreader „Blog – gibt es noch nicht“; Tastaturfokus allein löst keinen Sturz mehr aus.
- [ ] YouTube-Button: Fokus nach dem Klick auf das iframe setzen, Videotitel in den Button-Namen.
- [ ] Überschriftenhierarchie (Karten `h3` direkt unter `h1`, `h4` in Videotexten).
- [x] 404-Seite hat jetzt eine `main`-Landmark (über `PlainPage`).
- [ ] `prefers-reduced-motion`: Die Figur sollte direkt aufs Ziel springen statt Schritt für Schritt zu laufen. Hover-Vorschau abschalten.
- [ ] Mehrdeutige Linktexte („Video ansehen“, „Details zum Workshop“) mit dem Titel ergänzen, z. B. per `sr-only`.
- [ ] Alt-Texte der Workshop-Fotos aussagekräftig machen.
- [ ] Schriftgrößen in `rem` statt `px`. Englische Titel mit `lang="en"`.
- [ ] Dauerbewegung (Wolken, wippende Blöcke) pausierbar machen oder dezenter.

### Inhalt (weitere)

- [ ] **Workshop-Eckdaten einheitlich** (Zielgruppe, Dauer, Format, Gruppengröße, Schwierigkeitsgrad, Ort), am besten als Frontmatter-Felder. „Anspruchsvoller“ → „Anspruchsvoll“.
- [ ] **Schreibweisen vereinheitlichen** (Domain-Driven Design, hexagonale Architektur, z. B.), Gendern konsistent.
- [x] Seitentitel unterscheiden Workshop und Video („Event Storming – Workshop“ / „– Video“). Die Texte von Event-Storming-Video und -Workshop ähneln sich weiter.

### Build, CI und Abhängigkeiten

- [x] **Workflow gehärtet:** global nur Leserechte, Deploy als eigener Job mit Schreibrechten nur auf `main`, Prüfung nur bei Pull Requests und Pushes auf `main` (keine doppelten Läufe), Timeouts, Deploys werden nicht abgebrochen.
- [x] Actions auf Commit-SHAs gepinnt, Renovate hält sie aktuell (`helpers:pinGitHubActionDigests`).
- [x] Auf `actions/deploy-pages` umgestellt: kein Branch `gh-pages` mehr, Deploy ohne Schreibrechte aufs Repo, `CNAME` und `.nojekyll` entfallen.
- [x] **Renovate:** `minimumReleaseAge` 3 Tage, `internalChecksFilter: strict`.
- [ ] LICENSE-Datei im öffentlichen Repo.

### SEO und Performance

- [ ] **Schriften:** nur das Latin-Subset importieren. Kyrillische Pixelify-Glyphen stehen heute als Base64 im render-blockierenden CSS (ca. 57 % des CSS-Transfers). Dazu 47 Fontdateien mit 471 KB in `dist`.
- [ ] **Strukturierte Daten:** `Person`, `Course` für Workshops, `VideoObject` für Videos.
- [x] **Icons:** `favicon.ico`, PNG-Icons, `apple-touch-icon` (180 × 180) und `theme-color`.
- [x] 404-Seite: kein `canonical`, dafür `noindex`.
- [ ] Workshop-Bilder mit `width`/`height`, `loading="lazy"` und kleineren Größen (heute 1600 px), z. B. über `astro:assets`.
- [ ] 28 KB Würfel-Symbole und Textur-CSS stehen in jeder Seite. Als cachebare Datei auslagern.
- [ ] Sitemap mit `lastmod`, Titel und Descriptions eindeutiger machen.

## Später

- [ ] Content-Security-Policy (Astro bringt sie mit, passt zu DevSecOps).
- [ ] Druckansicht ohne Himmel und Insel.
- [ ] Copyright-Jahr wird beim Build eingefroren. Wird die Seite länger nicht gebaut, steht das alte Jahr.
- [ ] Blog: Der Blog-Block ist ohne JavaScript ein toter Button. Mit Blog wird er ein echter Link.
