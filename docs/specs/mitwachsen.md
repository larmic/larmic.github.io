# Spec: Mitwachsen (Stufe ab 3)

Verhalten des Spiels unter `/spiele/mitwachsen/` (die alte Adresse `/spiele/threeyear/` leitet dorthin weiter). Konzept und Hintergrund: [docs/games/mitwachsen.md](../games/mitwachsen.md).

Umgesetzt ist es in reinen, getesteten Teilen und einer Web Component:

| Teil | Datei | Tests |
| --- | --- | --- |
| Zufall, Rauschen, Stücke | [`src/lib/games/rng.ts`](../../src/lib/games/rng.ts), [`chunks.ts`](../../src/lib/games/chunks.ts) | `rng.test.ts` |
| Ansicht von vorn, Modelle aus Quadern | [`src/lib/games/front.ts`](../../src/lib/games/front.ts) | – (Zeichnen) |
| Inhalte: Gegenden, Tore, Zuhause, Tiere, Figur | [`src/data/games/mitwachsen.ts`](../../src/data/games/mitwachsen.ts) | über die Tests unten |
| Welt aus dem Seed | [`src/scripts/games/mitwachsen-world.ts`](../../src/scripts/games/mitwachsen-world.ts) | `mitwachsen-world.test.ts` |
| Spielregeln (Zustandsmaschine) | [`src/scripts/games/mitwachsen-state.ts`](../../src/scripts/games/mitwachsen-state.ts) | `mitwachsen-state.test.ts` |
| Spielstände | [`src/scripts/games/mitwachsen-save.ts`](../../src/scripts/games/mitwachsen-save.ts) | `mitwachsen-save.test.ts` |
| Ruhiger Takt der Eingabe | [`src/scripts/games/input-pace.ts`](../../src/scripts/games/input-pace.ts) | `input-pace.test.ts` |
| Browser: Tastatur, Takt, Kamera, Töne, Menü | [`larmic-mitwachsen.ts`](../../src/scripts/games/larmic-mitwachsen.ts), [`mitwachsen-render.ts`](../../src/scripts/games/mitwachsen-render.ts) (2D und Ebene darüber), [`mitwachsen-3d.ts`](../../src/scripts/games/mitwachsen-3d.ts) (3D mit Three.js), [`sfx.ts`](../../src/scripts/games/sfx.ts) | – |

Bei Änderungen am Verhalten Spec und Tests mitziehen.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Welt** | Seed, Weltname, Figurenname und Fortschritt. Mehrere Welten nebeneinander. |
| **Feld** | Ganzzahlige Koordinate (x nach rechts, y nach unten/vorn). Jedes Feld hat eine Höhe (Wasser 0, Boden 1, Hügel bis 3). |
| **Gegend** | Von Hand entworfener Bereich (Zuhause, Blumenwiese, Teich), ringsum durch Fels, Zaun oder Wasser abgeschlossen. |
| **Landschaft** | Alles außerhalb der Gegenden, endlos aus dem Seed berechnet, in Stücken von 16 × 16 Feldern. |
| **Tor** | Tor im Zaun oder Brücke übers Wasser. Gehört zu der Gegend, in der es steht. |
| **Takt** | 100 ms. Tiere laufen im Takt, Schlafsperre und Platztausch zählen in Takten. |

## Ereignisse (Befehle an `step`)

| Befehl | Auslöser | Wirkung |
| --- | --- | --- |
| `move(dir)` | Pfeiltaste im ruhigen Takt: höchstens ein Schritt alle 260 ms, ob getippt oder gehalten. Halten läuft ab dem ersten Schritt gleichmäßig; ein Tipp während eines Schritts wird gemerkt (höchstens einer). *Tests: `input-pace.test.ts`* | Schritt, Hineinlaufen oder Wand, siehe Regeln |
| `action` | Leertaste, Enter oder jede andere Taste außer Tab, Esc, F-Tasten und Modifikatoren; höchstens eine Aktion alle 350 ms, gehaltene Tasten zählen einmal | Singen und Folgen, Schlafen oder Rufen |
| `tick` | Takt, solange Seite sichtbar und Menü zu | Tiere laufen umher, Tiere der Landschaft tauchen auf und verschwinden |

Schläft die Figur, wecken `move` und `action` sie (nach der Sperrzeit), sonst tun sie nichts.

`step` liefert den neuen Zustand und **Ereignisse** für Ton, Bild und Speichern: `step` (mit Kletterrichtung), `bump`, `sing` (mit `first`), `follow`, `swap`, `home`, `gate`, `call`, `sleep`, `wake`.

## Regeln

1. **Start:** Die Figur schläft im Bett. Die erste Taste weckt sie an einem freien Platz neben dem Bett. *Test: „startet schlafend im Bett …“*
2. **Laufen:** Ein Feld in Pfeilrichtung, die Figur schaut dorthin. *Test: „geht ein Feld in Pfeilrichtung …“*
3. **Klettern:** Eine Stufe hoch oder runter geht, zwei Stufen sind eine Wand. Wasser, Bäume, Büsche, Fels, Zäune, Bett, Tafeln und geschlossene Tore versperren das Feld; die Figur bleibt stehen (`bump`). *Tests: „klettert eine Stufe …“, „läuft nicht durch Wasser …“*
4. **Aktion neben einem Tier** (vorn, sonst das nächste der acht Nachbarfelder): Es singt. Beim ersten Mal ist es gefunden. Läuft es frei umher, folgt es danach der Figur. Folgt es schon oder ist es im Garten, singt es nur. *Tests: „singt bei der Aktion …“, „nimmt mit der Aktion auch ein Tier schräg daneben …“, „Tiere im Garten singen …“*
5. **Hineinlaufen in ein Tier:** Es singt, folgt aber nicht. Läuft die Figur innerhalb von 15 Takten noch einmal hinein, tauschen beide den Platz (nur wenn das Tier auf dem Feld der Figur stehen darf). Steht die Figur in der Öffnung des Gartens und versperrt ein Tier im Garten den Weg, rückt es stattdessen im Garten beiseite. Kommt ein folgendes Tier durch den Tausch in den Garten, bleibt es dort (Regel 7). *Tests auch: „Randfälle aus der Prüfung“* *Tests: „Hineinlaufen lässt singen …“, „tauscht nach Ablauf der Zeit nicht mehr …“*
6. **Gänsemarsch:** Geht die Figur einen Schritt, rückt jedes folgende Tier auf den Platz seines Vordermanns. *Test: „läuft im Gänsemarsch …“*
7. **Garten:** 4 × 4 Felder mit Hecke und einem Rosenbogen als Eingang. Ein folgendes Tier, das ein Feld im Garten betritt, löst sich aus der Kette, rückt nach hinten auf einen freien Platz und bleibt für immer dort (gespeichert). Das Feld direkt hinter der Öffnung bleibt frei: Kein Tier im Garten läuft dorthin, so kommt das nächste Tier immer hinein. *Tests: „ein folgendes Tier bleibt im Garten …“, „Eingang des Gartens“*
8. **Tore:** Ein Tor öffnet genau dann, wenn alle Tiere seiner Gegend gefunden sind, und bleibt offen. *Tests: „öffnen genau dann …“, „das letzte gefundene Tier öffnet das Tor sofort …“*
9. **Schlafen:** Aktion mit dem Bett vorn oder daneben (wenn kein Tier näher ist). Folgende Tiere gehen heim: Tiere einer Gegend an einen freien Platz nahe ihrem Start, Tiere der Landschaft verschwinden und tauchen später an ihrem Platz auf. 30 Takte lang weckt keine Taste. *Tests: „legt sich mit der Aktion am Bett schlafen …“, „schickt folgende Tiere beim Schlafen heim“*
10. **Rufen:** Aktion ohne Tier und Bett in der Nähe. *Test: „ruft, wenn weder Tier noch Bett …“*
11. **Umherlaufen:** Freie Tiere ruhen 8 bis 25 Takte, dann gehen sie einen Schritt oder drehen sich. Sie bleiben in ihrem Zuhause (Gegend, Stück der Landschaft oder Garten) und nie auf einem Feld an einem Durchgang (Tor, Brücke, Garten-Öffnung, Pfad und deren Nachbarfelder); wer außerhalb steht (nach einem Platztausch), zieht heim. Steht die Figur daneben, bleiben sie stehen und schauen sie an. *Tests: „bleibt stehen und schaut …“, „läuft umher, aber nur in seinem Zuhause“, „Durchgänge bleiben frei“*
12. **Landschaft:** Tiere der Landschaft gibt es in den Stücken um die Figur (Abstand 1). Ab Abstand 3 verschwinden frei laufende wieder. Gleiche Welt, gleiches Stück: gleiche Tiere am gleichen Platz.

## Welt

| Regel | Test |
| --- | --- |
| Gleicher Seed ergibt gleiche Felder, anderer Seed andere Landschaft | „entsteht aus demselben Seed immer gleich …“ |
| Gegenden, Bett und Garten liegen bei jedem Seed an derselben Stelle | „hat die Gegenden bei jedem Seed …“ |
| Ohne offene Tore erreicht man nur Zuhause und Landschaft; der Pfad hinaus ist offen | „Ohne offene Tore erreicht man nur …“ |
| Jedes Tor öffnet genau seine nächste Gegend | „Jedes Tor öffnet genau …“ |
| Aus der Landschaft kommt man nicht seitlich in eine Gegend | „Aus der Landschaft kommt man nicht seitlich …“ |
| Der Garten hat genau einen Eingang (Rosenbogen) | „der Garten hat genau einen Eingang“ |
| Die Landschaft ist sanft (selten mehr als eine Stufe zwischen Nachbarn); vor dem Pfad steigt sie höchstens alle zwei Felder | „ist meist sanft …“ |

## Invarianten

Geprüft mit je 4000 zufälligen Befehlen auf drei Welten (*Test: „Invarianten bei wildem Drücken“*):

- Die wache Figur steht immer auf einem Feld, auf dem man stehen kann.
- Nie stehen zwei Wesen auf einem Feld.
- Tiere im Garten verlassen ihn nie.
- Jedes Tier ist höchstens einmal in der Kette.
- Gleiche Befehle ergeben den gleichen Zustand (kein `Math.random`, Zufall aus dem Zustand).

## Speichern

| Was | Regel |
| --- | --- |
| Schlüssel | `larmic.games.index` (Liste der Welten, aktuelle Welt), `larmic.games.world.<id>` je Welt, `larmic.games.muted` |
| Format | `{ v: 3, game: 'mitwachsen', age, id, seed, worldName, figureName, openGates, metAnimals, homeAnimals, position, visits }`; `age` ist die Altersstufe der Welt (bisher nur 3) |
| Umzug | Version 1 (Arbeitstitel `game: 'threeyear'`, ohne Alter) → 2 (Alter 3) → 3 (`penAnimals` heißt jetzt `homeAnimals`). Ältere Indizes werden übernommen. Nichts geht verloren |
| Wann | sofort bei gefunden, Garten, Tor, Schlafen, Weltwechsel und Umbenennen; sonst alle 10 s; beim Verlassen der Seite |
| Fehler | Jeder Zugriff fängt Fehler ab. Ohne Speicher läuft das Spiel bis zum Neuladen weiter. |
| `migrate()` | verwirft Fremdes (anderes Spiel, unbekannte Version) und räumt auf (unbekannte Tore und Arten, doppelte Einträge, kaputte Felder) |
| Welt-Code | Seed in Basis 36, z. B. `0IDFDSE`; ergibt dieselbe Landschaft ohne Spielstand |

*Tests: `mitwachsen-save.test.ts`*

## Was angezeigt wird

| Was | Regel |
| --- | --- |
| Ansicht | **3D** mit Three.js (WebGL): Kamera schräg von oben (55°) aus Süden, folgt der Figur; echtes Sonnenlicht mit Schatten, Himmel und Nebel in der Ferne. Three.js wird erst beim Spielstart per `import()` nachgeladen (Bundle-Gate). Darüber liegt ein durchsichtiges 2D-Canvas für Zeichen über den Tieren, Herzen, Noten, Heimweg-Pfeil, Nacht, Schmetterlinge und die Leiste. Ohne WebGL bleibt die **2D-Ansicht von vorn** (Reihe für Reihe von hinten nach vorn), sie läuft auch, bis 3D geladen ist |
| Verdeckte Figur | In 3D erscheint die Figur als heller Umriss, wo Bäume, Hecken oder Hügel sie verdecken; in 2D wird sie halb durchsichtig obenauf gezeichnet |
| Hochformat | In 3D rückt die Kamera im Hochformat weiter weg (bis 1,8-fach), der Nebel rückt mit |
| Kamera | folgt der Figur; Figur in der Bildmitte. Etwa 18 Felder breit |
| Feinheit | Texturen 8 × 8 wie auf der Seite, jedes Texel mit feiner Körnung in 2 × 2 Unterpixeln |
| Höhen | höhere Flächen etwas heller; dunkle Kante, wo es hinuntergeht; Schatten am Fuß eines höheren Nachbarn; helle Vorderkante und dunkle Unterkante jeder Stufe |
| Figur | wird zusätzlich halb durchsichtig obenauf gezeichnet, damit sie hinter Hügeln und Bäumen sichtbar bleibt |
| Wesen | gleiten zu ihrem Feld, etwas schneller als der Takt der Eingabe (gut 4 Felder/s); Sprünge über mehr als 2,5 Felder springen direkt |
| Folgende Tiere | kleines Herz darüber |
| Verlorene Tiere | noch nicht gefunden: kleines Fragezeichen über dem Kopf (wippt leicht, außer bei reduzierter Bewegung) |
| Tiere im Garten | ab und zu steigt ein kleines Herz auf (nicht bei reduzierter Bewegung) |
| Garten | Hecke ringsum, Rosenbogen als Eingang, Blumen innen |
| Natur | Grasbüschel, Farne, Pilze, bemooste Findlinge (blockieren, nur auf Hügeln); Bäume als Eiche, Birke, Herbst- oder Blütenbaum, in Gruppen; Farbflecken im Boden. Reine Zierde aus dem Seed, die Regeln ändern sich nicht |
| Licht und Leben | weiche Schatten unter Bäumen, Büschen, Tieren und Figur; warmes Licht von oben links, leichter Dunst oben, dunklere Ränder; glitzerndes Wasser mit hellem Ufer; tagsüber Schmetterlinge und Pollen, nachts Glühwürmchen (Bewegtes nicht bei reduzierter Bewegung) |
| Leiste unten | ein Platz je Tier, nach Gegenden gruppiert, dahinter Tiere der Landschaft, die im Garten wohnen: heller Platz mit Umriss und Fragezeichen = noch verloren, Holz mit Tier in Farbe = gefunden, Gras = zu Hause im Garten, Herz = folgt gerade |
| Tafel am Tor | Tiere der Gegend auf dem Brett: gefundene in Farbe, verlorene als Umriss |
| Heimweg-Pfeil | am Bildrand Richtung Bett, solange das Bett nicht zu sehen ist |
| Nacht | dunkler Himmel mit Sternen und Mond, die Figur liegt im Bett, Zzz steigt auf |
| Menü | Zahnrad oben rechts: Welten wählen, neue Welt, Namen, Welt-Code kopieren, Ton, Vollbild. Das Spiel pausiert, solange es offen ist |
| Reduzierte Bewegung | keine Partikel, Noten und Zzz, kein Gleiten und Hüpfen, Tore und Nacht ohne Überblendung; Töne bleiben |
