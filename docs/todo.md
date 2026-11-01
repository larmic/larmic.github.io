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

- [ ] **Kisten-Links haben am Desktop keinen zugänglichen Namen.** Das Etikett ist per `display: none` versteckt (`.blk.child .tag` in `global.css`) und damit auch für Screenreader weg. Stattdessen optisch verstecken (wie `.sr-only`) oder `aria-label` setzen.
- [ ] **Fokusrahmen auf dunklen Flächen unsichtbar:** Tinte auf Kristall 1,0:1, auf dem Footer-Stein ca. 1,6:1. Fokusfarbe je Fläche anpassen (z. B. Weiß oder Gold) oder einen doppelten Ring verwenden.

### Inhalt

- [ ] **Sichtbarer Kontaktweg:** „Schreib mir“ im Footer und am Ende von „Über mich“, dazu eine Anfrage-CTA. Der Button „Workshops ansehen“ führt auf `/workshops/` ins Leere, er sollte je nach Seite wechseln (z. B. „Workshop anfragen“).
- [ ] **Positionierung schärfen:**
  - „Architekt“ in Untertitel und Meta-Description aufnehmen (z. B. „Entwickler, Architekt und Speaker“).
  - Hero-Intro, Unterzeile von „Über mich“ und Description auf dieselbe Kernaussage bringen, inklusive „KI mit Leitplanken“.
- [ ] **Belege für Aussagen:** „spreche auf Konferenzen“ und „Screencasts“ sind auf der Seite nicht belegt (alle Videos sind Freitagsfrühstück-Aufnahmen). Entweder eine Talk-Liste ergänzen (Event, Jahr, Titel, Link) oder die Texte anpassen.
- [ ] **„Wie das geht, zeige ich in Workshops und Talks“** folgt auf den KI-Absatz, es gibt aber kein KI-Angebot. Etwas verlinken oder umformulieren. Den Eintrag „KI“ in der KI-Werkzeugkiste durch etwas Konkretes ersetzen.
- [ ] **Videotexte aufräumen:**
  - „Team Neusta“ → „team neusta“, Artikel korrigieren („Veranstaltung bei team neusta“).
  - „**Hinweis**“ → „**Hinweis:**“.
  - Den viermal kopierten Freitagsfrühstück-Block zentral rendern (Frontmatter-Feld plus Komponente).
  - Überschriften `####` → `##`.
  - „ein Framework, dass“ → „das“, testcontainers.org → testcontainers.com.
  - Feld `date` mit echten Daten füllen und anzeigen, oder entfernen.

### Technik und Betrieb

- [ ] **README aktualisieren:**
  - Abschnitt zum Zip-Umstieg (Branch `astro-redesign`) streichen.
  - Aussagen zu Impressum und Datenschutz sind falsch: Die Seite gibt es, das Impressum steht auf DDG.
  - Seitenliste ohne `/datenschutz/` ergänzen.
  - Node-Version vereinheitlichen (`.nvmrc` 24, engines `>=22.23.4`, README „22.23“).
- [ ] **Vorschaubild beim Teilen:** `og:image` (1200×630, z. B. Insel mit Figur), `og:site_name`, `og:locale`, `twitter:card`. Für LinkedIn ist das die Visitenkarte.
- [x] **Videos ohne JavaScript erreichbar:** Link „direkt auf YouTube ansehen“ unter jedem Video.
- [ ] **Speicherleck der Insel beheben:** `pointermove`- und `scroll`-Listener werden nie entfernt. Bei jedem Weg Insel → Impressum/Datenschutz/404 → Insel bleibt eine alte Insel im Speicher. AbortController verwenden und `cancelAnimationFrame` in `disconnectedCallback` aufrufen.
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
- [ ] **Kisten-Plätze:** Alle Plätze sind belegt (3 Workshops, 4 Videos). Der Entwurf „DDD für Nicht-Techniker:innen“ würde den Build abbrechen. Reserveplätze anlegen. Die Fehlermeldung sollte sagen, was zu tun ist.

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
- [ ] **Toten Code entfernen:** ungenutzte Exporte und Prototyp-Reste in `textures.ts`/`render.ts`, `SITE.mail` (oder für den Kontaktweg nutzen), Token `--font-mono`.
- [ ] Das `<script>` aus `IslandPage.astro` landet hinter `</html>` (ungültiges HTML). In `Island.astro` verschieben.
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
