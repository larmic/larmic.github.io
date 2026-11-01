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

## Interaktionen auf der Startseite

| Aktion | Wirkung |
| --- | --- |
| Hover oder Fokus auf einen Block | Die Figur läuft zum Inselrand, setzt Holzblöcke und steigt auf den Zielblock |
| Maus weg oder Fokus verlassen | Die Figur läuft zurück, hinter ihr zerbröselt die Brücke |
| Klick auf Über mich, Workshops, Videos | Wechselt den Inhaltsbereich, Block springt mit Partikeln, Figur hüpft |
| Hover oder Klick auf Blog | Figur holt aus, hat keinen Block, fällt, spawnt mit „404 – Kein Blog gefunden“ |

Takt der Figur: 130 ms. Auf schmalen Bildschirmen (unter 700 px Containerbreite) stehen die Blöcke als Reihe unter der Insel, Brücken entfallen.

## Voxel-Technik

Alle Blöcke und die Figur entstehen beim Build als SVG (`src/lib/voxel/`).

- **Projektion:** dimetrisch 2:1. Block (i, j, k) liegt bei X = (i − j)·40, Y = (i + j)·20 − k·44,8. Ein Würfel ist ein `<symbol>` mit `viewBox="0 0 80 84.8"`.
- **Texturen:** 8×8 Pixel pro Fläche, definiert als Textraster in `textures.ts`. Schattierung: oben 5 % weiß, links 8 % schwarz, rechts 26 % schwarz.
- **Getönte Blöcke:** Kiste, Kristall und Metall nutzen `currentColor` und werden per CSS `color` eingefärbt.
- **Figur:** sechs Quader in eigener Projektion (C = 2, V = 2,236), Gesicht auf der +y-Seite, Skalierung 1,9.
- **Insel und Routen:** in `world.ts`. Die Figur startet auf (3, 3, 0). Routen zu den vier Blöcken stehen in `ROUTES`.
