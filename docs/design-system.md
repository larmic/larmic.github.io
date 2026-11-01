# Designsystem „Inselwelt“

Die Seite ist eine Voxel-Welt: Himmel oben, eine schwebende Insel als Bühne, darunter Erde und Stein. Gold ist die einzige Farbe für Aktionen. Vier Materialfarben ordnen die Themen. Alle Werte stehen als CSS-Variablen in `src/styles/tokens.css`.

Vorbild ist die Optik von Hytale und Minecraft. Alle Grafiken sind eigene Voxel-Zeichnungen, ohne Logos, Figuren oder Texturen aus den Spielen.

## Grundfarben

| Rolle | Token | Wert | Einsatz |
| --- | --- | --- | --- |
| Tinte | `--ink` | #1d2838 | Text, Überschriften, alle Pixel-Rahmen |
| Himmel | `--sky-1/2/3` | #79c7ea, #8dd0ee, #a6dbf2 | Hero als gestufter Verlauf mit harten Kanten |
| Gold | `--gold`, `--gold-light`, `--gold-dark` | #f0a531, #ffd47e, #b46a0c | Buttons, Goldblöcke LAR und MIC, ausgewähltes Etikett |
| Papier | `--paper` | #fffdf7 | Inhaltspanel |
| Grün | `--green` | #3f7f27 | Chips mit weißer Schrift |
| Grau | `--muted` | #4b5563 | Unterzeilen |
| Fehlerrot | `--error` | #a3221b | 404-Sprechblase |
| Erde | `--tex-dirt` + `--dirt-shade` | Textur, 40 % #2b1a0f darüber | Hintergrund hinter dem Inhalt |
| Stein | `--tex-stone` + `--stone-shade` | Textur, 62 % #14161c darüber | Footer |

## Materialien und Themen

Gleiches Thema hat überall dieselbe Farbe: in den Werkzeugkisten, bei Workshops und bei Videos.

| Material | Fläche | Slot / Rahmen | Block | Steht für |
| --- | --- | --- | --- | --- |
| Holz | #f3ead6 | #e2d5ba / #b3a385 | Kiste (`crate`), #a0703f | Handwerk, Architektur |
| Metall | #e6eaf0 | #d3dae4 / #9aa6b6 | Metallblock (`metal`), #7d8ea3 | DevOps, Infrastruktur |
| Kristall | #2a2342, Schrift #f1ecff, Links #d9c6ff | #1b1630 / #4a3f70 | Kristall mit Leuchten (`crystal`), #b48cf0 | KI, außerdem Event Storming |
| Gras | #e3ecd2 | – | Grasblock, Play-Symbol #6cc46f | Testing |

Offene Frage: Soll Violett nur für KI stehen? Dann bekäme Event Storming Grün und Testing eine fünfte Farbe.

## Typografie

| Schrift | Schnitte | Einsatz |
| --- | --- | --- |
| Pixelify Sans | 500, 700 | Logo, Namenskacheln, Überschriften, Buttons, Etiketten, Sprechblase |
| Nunito | 400, 600, 800 | Fließtext, 18–19 px, Zeilenhöhe 1,6–1,7 |

Beide Schriften sind über `@fontsource` lokal gebündelt.

## Bausteine

- **Pixel-Rahmen:** vier Box-Schatten in Tinte statt `border` (`--px-4`, `--px-3`). Dadurch fehlen die Eckpixel wie in einem Spiel-Interface. Große Flächen bekommen zusätzlich 12 px versetzten Schatten.
- **Goldener Button (`.pxbtn`):** innen oben helles, unten dunkles Kantenlicht, sinkt beim Klick 3 px ein.
- **Name aus Buchstabenblöcken:** LAR und MIC in Gold, der Rest auf Holz-Slots. Beim Laden fallen die Blöcke nacheinander ein, beim Hover hüpfen die Goldblöcke.
- **Inventar-Slots:** gleichmäßiger Innenrahmen von 3 px, Block und Text in beide Richtungen zentriert, lange Wörter brechen um.
- **Sprechblase:** weiß, 3 px Pixel-Rahmen, eckiger Zipfel.

## Bewegung

Animationen nutzen meist `steps()` für den Pixel-Look. Beim Laden fallen nur die Namenskacheln ein. Danach bewegen sich nur die Wolken und die schwebenden Blöcke leicht. Alles andere reagiert auf den Nutzer. Bei `prefers-reduced-motion` sind alle Animationen aus.

## Die Insel als Navigation

Die Insel ist auf jeder Seite dieselbe und die einzige Navigation. Oben stehen Name, Intro und Insel, darunter der Inhalt der Seite. Beim Seitenwechsel bleibt der Kopf stehen (Astro View Transitions, `transition:persist`), nur der Inhalt wird getauscht. So sieht man die Figur laufen.

```
                         ▣ ▣ ▣  ← Workshop-Kisten, offen auf /workshops/…
                        ╱
                 [Workshops]
                ╱
  [Über mich] ☺ Insel        [Blog]
                ╲
                 [Videos]
                  ╲
                   ▣ ▣ ▣ ▣  ← Video-Kisten, offen auf /videos/…
```

Die Ziele bilden einen Baum: Insel → Bereich → Kiste. Jedes Ziel hat eine eigene Seite:

| Ziel | Adresse |
| --- | --- |
| Über mich | `/` |
| Workshops / ein Workshop | `/workshops/`, `/workshops/<id>/` |
| Videos / ein Video | `/videos/`, `/videos/<id>/` |
| Blog | keine – die Figur fällt |

**Die Figur steht immer auf dem Block der angezeigten Seite.** Die Kisten eines Bereichs poppen auf, sobald er offen ist, und verschwinden, wenn die Figur ihn verlassen hat. Kisten haben die Themenfarbe ihres Eintrags; ihr Etikett erscheint beim Zeigen und an der gewählten Kiste.

| Aktion | Wirkung |
| --- | --- |
| Hover oder Fokus auf einen anderen Block | Die Figur läuft zurück bis zur Abzweigung (die Brücke dahinter zerbröselt) und baut die neue Brücke. Von Kiste zu Kiste geht es über den Bereichs-Block, zu einem anderen Bereich über die Inselmitte |
| Maus weg oder Fokus verlassen | Die Figur läuft zurück auf den Block der angezeigten Seite |
| Klick auf einen Block oder eine Karte | Seitenwechsel ohne Neuladen. Der Block springt mit Partikeln, die Figur läuft hin und bleibt stehen |
| Hover oder Klick auf Blog | Figur holt aus, hat keinen Block, fällt und spawnt auf ihrem Block mit „404 – Kein Blog gefunden“ |
| Zurück-Taste des Browsers | Vorherige Seite, die Figur läuft mit |

Die Sprechblase erscheint nur, wenn die Figur auf einem Bereichs-Block steht (auf Kisten schweigt sie) – außer der 404-Meldung, die überall erscheint und bleibt, bis man auf einen anderen Block zeigt. Beim ersten Aufruf der Startseite begrüßt sie („Hi! Zeig auf einen Block.“).

Takt der Figur: 130 ms. Auf schmalen Bildschirmen (unter 700 px Containerbreite) stehen die Blöcke als Reihe unter der Insel, offene Kisten reihen sich dazu, Brücken entfallen.

**Easter Egg Baum:** Zeigt man auf das Blätterdach, läuft die Figur zum Baum, stapelt zwei Blöcke, klettert in die Krone und sagt „Schöne Aussicht!“. Maus weg: Die Blöcke zerbröseln, sie läuft zurück. Nicht klickbar, nicht per Tastatur erreichbar, auf dem Handy nicht vorhanden.

**Blick zum Cursor:** Steht die Figur, schaut sie zum Mauszeiger. Ist er deutlich auf der anderen Seite, dreht sich die ganze Figur um; den Rest macht der Kopf: drehen (15°-Stufen, von „schaut nach links“ über „schaut dich an“ bis zur Ohrseite) und nicken (10°-Stufen, nach oben oder zum Text darunter). Der Kopf ist ein echter Würfel mit fünf Seiten (`src/lib/voxel/head.ts`), dieselbe Rechnung erzeugt beim Build das Startbild. Beim Laufen, Bauen und Fallen schaut sie geradeaus; ohne Maus und bei reduzierter Bewegung gar nicht.

**Plätze für Kisten:** drei an Workshops, vier an Videos (`CHILD_SLOTS` in `world.ts`). Ein weiterer Eintrag bricht den Build mit einer Meldung ab – dann braucht es einen neuen Platz.

## Voxel-Technik

Alle Blöcke und die Figur entstehen beim Build als SVG (`src/lib/voxel/`).

- **Projektion:** dimetrisch 2:1. Block (i, j, k) liegt bei X = (i − j)·40, Y = (i + j)·20 − k·44,8. Ein Würfel ist ein `<symbol>` mit `viewBox="0 0 80 84.8"`.
- **Texturen:** 8×8 Pixel pro Fläche, definiert als Textraster in `textures.ts`. Schattierung: oben 5 % weiß, links 8 % schwarz, rechts 26 % schwarz.
- **Getönte Blöcke:** Kiste, Kristall und Metall nutzen `currentColor` und werden per CSS `color` eingefärbt.
- **Figur:** sechs Quader in eigener Projektion (C = 2, V = 2,236), Gesicht auf der +y-Seite, Skalierung 1,9.
- **Insel und Routen:** in `world.ts`. Die Figur startet auf (3, 3, 0). Routen zu den vier Blöcken stehen in `ROUTES`.
