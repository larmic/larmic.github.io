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
  - [ ] Merge `relaunch` → `main` per Pull Request, ersten Deploy-Lauf prüfen.
  - [ ] Der Deploy ersetzt `gh-pages` komplett. Diese alten Adressen werden 404, Entscheidung pro Adresse (weiterleiten, neu anbieten oder bewusst aufgeben):
    - `/index.xml`, `/videos/index.xml`, `/workshops/index.xml` (RSS; ggf. `@astrojs/rss`)
    - `/sitemap.xml`
    - `/tags/`, `/categories/`
    - `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png`
    - `/workshop/ddd_hex_architecture.png`, `/workshop/event_storming.png` (jetzt `.webp`)
  - [ ] Pages-Einstellungen: Quelle, Custom Domain `larmic.de`, „Enforce HTTPS“.
  - [ ] Stichprobe der alten Adressen nach dem Deploy (`/about/`, `/#workshops`, `/workshops/#workshop-…`, `/videos/#video-…`).
  - [ ] Search Console: `sitemap-index.xml` einreichen, alte `sitemap.xml` entfernen.
  - [ ] Branch `relaunch` löschen.
- [ ] **Mobiles Design prüfen**, auch sehr schmale und sehr breite Bildschirme.
- [x] **Kisten-Plätze:** vierter Workshop-Platz als Reserve (für „DDD für Nicht-Techniker:innen“), Fehlermeldung sagt, was zu tun ist. Videos haben weiterhin vier Plätze.

## Bald nach dem Livegang

### Guard-Gates sichtbar machen (Glaubwürdigkeit)

Die Seite wirbt mit Spec-Driven, Guard-Gates, ArchUnit und BDD. Im Repo ist `astro check` das einzige Gate. Wer den Code liest, sollte genau das wiederfinden:

- [ ] **Vitest** mit Tests für die reine Logik:
  - Zustandsmaschine der Figur: Brückenbau, Rückweg bis zur Abzweigung, Blog-Sturz, Baum.
  - `headView` (Sichtbarkeit der Seiten).
  - `cellsToRects`.
  - `buildWorld` (Slot-Grenze, Geometrie-Invarianten: keine Überlappung, Brücken benachbart).
- [ ] **ESLint und Prettier**, viele überlange Zeilen umbrechen.
- [ ] **Architekturregeln** mit dependency-cruiser als ArchUnit-Gegenstück, z. B. „`src/lib/voxel` importiert nicht aus `src/data`“.
- [ ] **Link- und HTML-Check** auf `dist` im CI (z. B. lychee, html-validate).
- [ ] Kurze **Spec** der Insel-Zustandsmaschine unter `docs/specs/`.
- [ ] Alle Gates als eigene Schritte im Workflow und im README beschreiben.

### Code und Architektur

- [ ] **Zustandsmaschine aus der Web Component lösen:**
  - Reine Funktion `step(state, world)` in eigenem Modul, die Komponente macht nur DOM und Timer.
  - Sprechende Feldnamen statt `r`, `p`, `m`, `pl`, `n`.
  - Toten Zustand entfernen (`r` ist nie null, `sel` ist immer gleich `rest`) und `msg` als String-Flag ersetzen.
- [ ] **Schichtung:** `lib/voxel` generisch halten. Konkrete Szene (Routen, Kisten-Plätze, Baum) nach `src/data`. `render.ts` nicht mehr an die Avatar-Daten koppeln.
- [ ] **Eine Quelle für Material- und Themenfarben:** heute `MATERIALS` in `site.ts`, `tokens.css` und das Enum im Schema.
- [ ] **Geometrie zentral:**
  - Würfelmaße (80 × 84,8, 40/20/44,8) und Projektionskonstanten an einer Stelle.
  - Typen zwischen Generator und Client teilen.
  - `rest` als Union-Typ statt freier String.
- [ ] **Toten Code entfernen:** ungenutzte Exporte und Prototyp-Reste in `textures.ts`/`render.ts`, Token `--font-mono`.
- [x] Skript in `IslandPage.astro` steht jetzt im Dokument (vorher hinter `</html>`).
- [ ] **Brücken-Verdeckung im Browser prüfen:** Brücken liegen als HTML über dem ganzen Insel-SVG und werden vor Inselblöcken gezeichnet, die eigentlich davor liegen (z. B. erste Brücke zu „Über mich“). Ggf. Brücken mit Tiefensortierung ins Szenen-SVG übernehmen.
- [ ] **Fokus-Listener der Blöcke** nur bei `:focus-visible` auslösen. Sonst stürzt die Figur erneut, wenn man nach einem Klick auf „Blog“ in den Tab zurückkehrt.
- [ ] Auf dem Handy läuft die Zustandsmaschine unsichtbar weiter, obwohl die Figur festgenagelt ist.
- [ ] Inline-Styles in Seiten (z. B. 404) in CSS, gemeinsames Layout für Inhaltsseiten ohne Insel.

### Barrierefreiheit (weitere)

- [ ] Skip-Link zum Inhalt. Die Insel als `<nav>`-Landmark, der Kopf als `<header>`.
- [ ] Nach dem Seitenwechsel den Fokus auf die neue Überschrift bzw. `main` setzen.
- [ ] Sprechblase als `aria-live`-Region entschärfen: keine wiederholten Ansagen bei jedem Takt bzw. jeder Rückkehr.
- [ ] Blog-Button: Der Name sollte die Funktion verraten. Tastaturfokus allein sollte den Sturz nicht auslösen.
- [ ] YouTube-Button: Fokus nach dem Klick auf das iframe setzen, Videotitel in den Button-Namen.
- [ ] Überschriftenhierarchie (Karten `h3` direkt unter `h1`, `h4` in Videotexten).
- [ ] 404-Seite ohne `main`-Landmark.
- [ ] `prefers-reduced-motion`: Die Figur sollte direkt aufs Ziel springen statt Schritt für Schritt zu laufen. Hover-Vorschau abschalten.
- [ ] Mehrdeutige Linktexte („Video ansehen“, „Details zum Workshop“) mit dem Titel ergänzen, z. B. per `sr-only`.
- [ ] Alt-Texte der Workshop-Fotos aussagekräftig machen.
- [ ] Schriftgrößen in `rem` statt `px`. Englische Titel mit `lang="en"`.
- [ ] Dauerbewegung (Wolken, wippende Blöcke) pausierbar machen oder dezenter.

### Inhalt (weitere)

- [ ] **Workshop-Eckdaten einheitlich** (Zielgruppe, Dauer, Format, Gruppengröße, Schwierigkeitsgrad, Ort), am besten als Frontmatter-Felder. „Anspruchsvoller“ → „Anspruchsvoll“.
- [ ] **Schreibweisen vereinheitlichen** (Domain-Driven Design, hexagonale Architektur, z. B.), Gendern konsistent.
- [ ] Event-Storming-Video und -Workshop haben fast gleiche Titel und Texte. Klarer unterscheiden.

### Build, CI und Abhängigkeiten

- [ ] **Workflow härten:**
  - `contents: read` als Standard.
  - Deploy als eigener Job nur auf `main`, besser gleich `actions/upload-pages-artifact` und `actions/deploy-pages`. Dann entfallen der `gh-pages`-Branch und die wachsende Historie.
  - Actions per SHA pinnen (Renovate `helpers:pinGitHubActionDigests`), Versionen aktualisieren.
- [ ] `cancel-in-progress` nicht für Deploy-Läufe auf `main`. Timeout setzen. Doppelte Läufe bei Pull Requests vermeiden.
- [ ] **Renovate:** `minimumReleaseAge` (z. B. 3 Tage) gegen kompromittierte Releases, weil Automerge direkt deployt. Vorher prüfen, ob das Preset es schon setzt.
- [ ] LICENSE-Datei im öffentlichen Repo.

### SEO und Performance

- [ ] **Schriften:** nur das Latin-Subset importieren. Kyrillische Pixelify-Glyphen stehen heute als Base64 im render-blockierenden CSS (ca. 57 % des CSS-Transfers). Dazu 47 Fontdateien mit 471 KB in `dist`.
- [ ] **Strukturierte Daten:** `Person`, `Course` für Workshops, `VideoObject` für Videos.
- [ ] **Icons:** `favicon.ico`/PNG, `apple-touch-icon`, `theme-color`.
- [ ] 404-Seite: kein `canonical`, dafür `noindex`.
- [ ] Workshop-Bilder mit `width`/`height`, `loading="lazy"` und kleineren Größen (heute 1600 px), z. B. über `astro:assets`.
- [ ] 28 KB Würfel-Symbole und Textur-CSS stehen in jeder Seite. Als cachebare Datei auslagern.
- [ ] Sitemap mit `lastmod`, Titel und Descriptions eindeutiger machen.

## Später

- [ ] Content-Security-Policy (Astro bringt sie mit, passt zu DevSecOps).
- [ ] Druckansicht ohne Himmel und Insel.
- [ ] Copyright-Jahr wird beim Build eingefroren. Wird die Seite länger nicht gebaut, steht das alte Jahr.
- [ ] Blog: Der Blog-Block ist ohne JavaScript ein toter Button. Mit Blog wird er ein echter Link.
