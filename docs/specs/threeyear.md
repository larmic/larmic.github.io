# Spec: threeyear (Spiel für 3 Jahre)

Verhalten des Spiels unter `/spiele/threeyear/`. Konzept und Hintergrund: [docs/games/threeyear.md](../games/threeyear.md).

Umgesetzt ist es in reinen, getesteten Teilen und einer Web Component:

| Teil | Datei | Tests |
| --- | --- | --- |
| Zufall, Rauschen, Stücke | [`src/lib/games/rng.ts`](../../src/lib/games/rng.ts), [`chunks.ts`](../../src/lib/games/chunks.ts) | `rng.test.ts` |
| Ansicht von vorn, Modelle aus Quadern | [`src/lib/games/front.ts`](../../src/lib/games/front.ts) | – (Zeichnen) |
| Inhalte: Gegenden, Tore, Zuhause, Tiere, Figur | [`src/data/games/threeyear.ts`](../../src/data/games/threeyear.ts) | über die Tests unten |
| Welt aus dem Seed | [`src/scripts/games/threeyear-world.ts`](../../src/scripts/games/threeyear-world.ts) | `threeyear-world.test.ts` |
| Spielregeln (Zustandsmaschine) | [`src/scripts/games/threeyear-state.ts`](../../src/scripts/games/threeyear-state.ts) | `threeyear-state.test.ts` |
| Spielstände | [`src/scripts/games/threeyear-save.ts`](../../src/scripts/games/threeyear-save.ts) | `threeyear-save.test.ts` |
| Ruhiger Takt der Eingabe | [`src/scripts/games/input-pace.ts`](../../src/scripts/games/input-pace.ts) | `input-pace.test.ts` |
| Browser: Tastatur, Takt, Kamera, Töne, Menü | [`larmic-threeyear.ts`](../../src/scripts/games/larmic-threeyear.ts), [`threeyear-render.ts`](../../src/scripts/games/threeyear-render.ts), [`sfx.ts`](../../src/scripts/games/sfx.ts) | – |

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

`step` liefert den neuen Zustand und **Ereignisse** für Ton, Bild und Speichern: `step` (mit Kletterrichtung), `bump`, `sing` (mit `first`), `follow`, `swap`, `pen`, `gate`, `call`, `sleep`, `wake`.

## Regeln

1. **Start:** Die Figur schläft im Bett. Die erste Taste weckt sie an einem freien Platz neben dem Bett. *Test: „startet schlafend im Bett …“*
2. **Laufen:** Ein Feld in Pfeilrichtung, die Figur schaut dorthin. *Test: „geht ein Feld in Pfeilrichtung …“*
3. **Klettern:** Eine Stufe hoch oder runter geht, zwei Stufen sind eine Wand. Wasser, Bäume, Büsche, Fels, Zäune, Bett, Tafeln und geschlossene Tore versperren das Feld; die Figur bleibt stehen (`bump`). *Tests: „klettert eine Stufe …“, „läuft nicht durch Wasser …“*
4. **Aktion neben einem Tier** (vorn, sonst das nächste der acht Nachbarfelder): Es singt. Beim ersten Mal ist es getroffen. Läuft es frei umher, folgt es danach der Figur. Folgt es schon oder ist es im Gehege, singt es nur. *Tests: „singt bei der Aktion …“, „nimmt mit der Aktion auch ein Tier schräg daneben …“, „Tiere im Gehege singen …“*
5. **Hineinlaufen in ein Tier:** Es singt, folgt aber nicht. Läuft die Figur innerhalb von 15 Takten noch einmal hinein, tauschen beide den Platz (nur wenn das Tier auf dem Feld der Figur stehen darf). Steht die Figur in der Öffnung des Geheges und versperrt ein Tier im Gehege den Weg, rückt es stattdessen im Gehege beiseite. Kommt ein folgendes Tier durch den Tausch ins Gehege, bleibt es dort (Regel 7). *Tests auch: „Randfälle aus der Prüfung“* *Tests: „Hineinlaufen lässt singen …“, „tauscht nach Ablauf der Zeit nicht mehr …“*
6. **Gänsemarsch:** Geht die Figur einen Schritt, rückt jedes folgende Tier auf den Platz seines Vordermanns. *Test: „läuft im Gänsemarsch …“*
7. **Gehege:** 4 × 4 Felder mit einer Öffnung. Ein folgendes Tier, das ein Feld im Gehege betritt, löst sich aus der Kette, rückt nach hinten auf einen freien Platz und bleibt für immer dort (gespeichert). Das Feld direkt hinter der Öffnung bleibt frei: Kein Tier im Gehege läuft dorthin, so kommt das nächste Tier immer hinein. *Tests: „ein folgendes Tier bleibt im Gehege …“, „Eingang des Geheges“*
8. **Tore:** Ein Tor öffnet genau dann, wenn alle Tiere seiner Gegend getroffen sind, und bleibt offen. *Tests: „öffnen genau dann …“, „das letzte getroffene Tier öffnet das Tor sofort …“*
9. **Schlafen:** Aktion mit dem Bett vorn oder daneben (wenn kein Tier näher ist). Folgende Tiere gehen heim: Tiere einer Gegend an einen freien Platz nahe ihrem Start, Tiere der Landschaft verschwinden und tauchen später an ihrem Platz auf. 30 Takte lang weckt keine Taste. *Tests: „legt sich mit der Aktion am Bett schlafen …“, „schickt folgende Tiere beim Schlafen heim“*
10. **Rufen:** Aktion ohne Tier und Bett in der Nähe. *Test: „ruft, wenn weder Tier noch Bett …“*
11. **Umherlaufen:** Freie Tiere ruhen 8 bis 25 Takte, dann gehen sie einen Schritt oder drehen sich. Sie bleiben in ihrem Zuhause (Gegend, Stück der Landschaft oder Gehege) und nie auf einem Feld an einem Durchgang (Tor, Brücke, Gehege-Öffnung, Pfad und deren Nachbarfelder); wer außerhalb steht (nach einem Platztausch), zieht heim. Steht die Figur daneben, bleiben sie stehen und schauen sie an. *Tests: „bleibt stehen und schaut …“, „läuft umher, aber nur in seinem Zuhause“, „Durchgänge bleiben frei“*
12. **Landschaft:** Tiere der Landschaft gibt es in den Stücken um die Figur (Abstand 1). Ab Abstand 3 verschwinden frei laufende wieder. Gleiche Welt, gleiches Stück: gleiche Tiere am gleichen Platz.

## Welt

| Regel | Test |
| --- | --- |
| Gleicher Seed ergibt gleiche Felder, anderer Seed andere Landschaft | „entsteht aus demselben Seed immer gleich …“ |
| Gegenden, Bett und Gehege liegen bei jedem Seed an derselben Stelle | „hat die Gegenden bei jedem Seed …“ |
| Ohne offene Tore erreicht man nur Zuhause und Landschaft; der Pfad hinaus ist offen | „Ohne offene Tore erreicht man nur …“ |
| Jedes Tor öffnet genau seine nächste Gegend | „Jedes Tor öffnet genau …“ |
| Aus der Landschaft kommt man nicht seitlich in eine Gegend | „Aus der Landschaft kommt man nicht seitlich …“ |
| Das Gehege hat genau eine Öffnung | „das Gehege hat genau eine Öffnung“ |
| Die Landschaft ist sanft (selten mehr als eine Stufe zwischen Nachbarn); vor dem Pfad steigt sie höchstens alle zwei Felder | „ist meist sanft …“ |

## Invarianten

Geprüft mit je 4000 zufälligen Befehlen auf drei Welten (*Test: „Invarianten bei wildem Drücken“*):

- Die wache Figur steht immer auf einem Feld, auf dem man stehen kann.
- Nie stehen zwei Wesen auf einem Feld.
- Tiere im Gehege verlassen es nie.
- Jedes Tier ist höchstens einmal in der Kette.
- Gleiche Befehle ergeben den gleichen Zustand (kein `Math.random`, Zufall aus dem Zustand).

## Speichern

| Was | Regel |
| --- | --- |
| Schlüssel | `larmic.games.index` (Liste der Welten, aktuelle Welt), `larmic.games.world.<id>` je Welt, `larmic.games.muted` |
| Format | `{ v: 1, game: 'threeyear', id, seed, worldName, figureName, openGates, metAnimals, penAnimals, position, visits }` |
| Wann | sofort bei getroffen, Gehege, Tor, Schlafen, Weltwechsel und Umbenennen; sonst alle 10 s; beim Verlassen der Seite |
| Fehler | Jeder Zugriff fängt Fehler ab. Ohne Speicher läuft das Spiel bis zum Neuladen weiter. |
| `migrate()` | verwirft Fremdes (anderes Spiel, unbekannte Version) und räumt auf (unbekannte Tore und Arten, doppelte Einträge, kaputte Felder) |
| Welt-Code | Seed in Basis 36, z. B. `0IDFDSE`; ergibt dieselbe Landschaft ohne Spielstand |

*Tests: `threeyear-save.test.ts`*

## Was angezeigt wird

| Was | Regel |
| --- | --- |
| Ansicht | von vorn, Reihe für Reihe von hinten nach vorn; Felder zeigen nur die Blöcke, die das Feld davor nicht verdeckt |
| Kamera | folgt der Figur; Figur in der Bildmitte. Etwa 18 Felder breit |
| Feinheit | Texturen 8 × 8 wie auf der Seite, jedes Texel mit feiner Körnung in 2 × 2 Unterpixeln |
| Höhen | höhere Flächen etwas heller; dunkle Kante, wo es hinuntergeht; Schatten am Fuß eines höheren Nachbarn; helle Vorderkante und dunkle Unterkante jeder Stufe |
| Figur | wird zusätzlich halb durchsichtig obenauf gezeichnet, damit sie hinter Hügeln und Bäumen sichtbar bleibt |
| Wesen | gleiten zu ihrem Feld, etwas schneller als der Takt der Eingabe (gut 4 Felder/s); Sprünge über mehr als 2,5 Felder springen direkt |
| Folgende Tiere | kleines Herz darüber |
| Leiste unten | ein Platz je Tier, nach Gegenden gruppiert, dahinter Tiere der Landschaft im Gehege: heller Platz mit Umriss = noch nicht getroffen, Holz mit Tier in Farbe = getroffen, Gras = im Gehege, Herz = folgt gerade |
| Tafel am Tor | Tiere der Gegend auf dem Brett: getroffene in Farbe, fehlende als Umriss |
| Heimweg-Pfeil | am Bildrand Richtung Bett, solange das Bett nicht zu sehen ist |
| Nacht | dunkler Himmel mit Sternen und Mond, die Figur liegt im Bett, Zzz steigt auf |
| Menü | Zahnrad oben rechts: Welten wählen, neue Welt, Namen, Welt-Code kopieren, Ton, Vollbild. Das Spiel pausiert, solange es offen ist |
| Reduzierte Bewegung | keine Partikel, Noten und Zzz, kein Gleiten und Hüpfen, Tore und Nacht ohne Überblendung; Töne bleiben |
