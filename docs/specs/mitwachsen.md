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
| Nebel (erkundete Felder) | [`src/scripts/games/mitwachsen-fog.ts`](../../src/scripts/games/mitwachsen-fog.ts) | `mitwachsen-fog.test.ts` |
| Karte | [`src/scripts/games/mitwachsen-map.ts`](../../src/scripts/games/mitwachsen-map.ts) | – (Zeichnen) |
| Browser: Tastatur, Takt, Kamera, Töne, Menü | [`larmic-mitwachsen.ts`](../../src/scripts/games/larmic-mitwachsen.ts), [`mitwachsen-render.ts`](../../src/scripts/games/mitwachsen-render.ts) (2D und Ebene darüber), [`mitwachsen-3d.ts`](../../src/scripts/games/mitwachsen-3d.ts) (3D mit Three.js), [`sfx.ts`](../../src/scripts/games/sfx.ts) | – |

Bei Änderungen am Verhalten Spec und Tests mitziehen.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Welt** | Seed, Weltname, Figurenname und Fortschritt. Mehrere Welten nebeneinander. |
| **Feld** | Ganzzahlige Koordinate (x nach rechts, y nach unten/vorn). Jedes Feld hat eine Höhe (Wasser 0, Boden 1, Hügel bis 3). |
| **Gegend** | Von Hand entworfener Bereich. Zum Start nur die **Lichtung** mit dem Bett, ringsum Felsen mit acht großen Toren. |
| **Welt hinter einem Tor** | Endlose Landschaft in der Richtung eines großen Tors, im Thema seiner Welt (`cell.biome`): Eiswelt, Sandwelt, Wasserwelt, Lavaberge, Höhlenwelt, Wald, Wolkenwelt, Pilzwald. |
| **Landschaft** | Alles außerhalb der Gegenden, endlos aus dem Seed berechnet, in Stücken von 16 × 16 Feldern. |
| **Tor** | Tor im Zaun oder Brücke übers Wasser. Gehört zu der Gegend, in der es steht. |
| **Portal** | Drei Felder breit (Säule, Portal, Säule) im Thema eines großen Tors, steht neben dem Tor. Sein Partner steht im Kreis um das Bett (8 Felder), in Richtung seines Tors. |
| **Takt** | 100 ms. Tiere laufen im Takt, Schlafsperre und Platztausch zählen in Takten. |

## Ereignisse (Befehle an `step`)

| Befehl | Auslöser | Wirkung |
| --- | --- | --- |
| `move(dir)` | Pfeiltaste im ruhigen Takt: höchstens ein Schritt alle 260 ms, ob getippt oder gehalten. Halten läuft ab dem ersten Schritt gleichmäßig; ein Tipp während eines Schritts wird gemerkt (höchstens einer). *Tests: `input-pace.test.ts`* | Schritt, Hineinlaufen oder Wand, siehe Regeln |
| `action` | Ab 3 an keine Taste gebunden (erster Spieltest: Leertaste war zu viel; die Leertaste tut nichts, auch kein Touch-Knopf). Der Befehl bleibt in den Regeln für spätere Altersstufen | Singen und Folgen, Schlafen oder Rufen |
| `tick` | Takt, solange Seite sichtbar und Menü zu | Tiere laufen umher, Tiere der Landschaft tauchen auf und verschwinden |

Schläft die Figur, wecken `move` und `action` sie (nach der Sperrzeit), sonst tun sie nichts.

`step` liefert den neuen Zustand und **Ereignisse** für Ton, Bild und Speichern: `step` (mit Kletterrichtung), `bump`, `sing` (mit `first`), `follow`, `swap`, `home`, `gate`, `portal` (aktiviert), `teleport` (gereist, mit Ziel `gate` oder `home`), `pick` (Beeren gepflückt), `regrow` (Beeren nachgewachsen), `feed` (Beeren in den Futtertrog, mit den Tieren der Wiese), `call`, `sleep`, `wake`.

## Regeln

1. **Start:** Die Figur schläft im Bett. Die erste Taste weckt sie an einem freien Platz neben dem Bett. *Test: „startet schlafend im Bett …“*
2. **Laufen:** Ein Feld in Pfeilrichtung, die Figur schaut dorthin. *Test: „geht ein Feld in Pfeilrichtung …“*
3. **Klettern:** Eine Stufe hinauf geht immer, auch auf Klettersteine; danach Stufe für Stufe weiter. Herunter geht jederzeit, egal wie tief (auf der Lichtung gibt es aber keine Stufe höher als eins). Wasser, Bäume, Büsche, Zäune, der Felsring, Bett und geschlossene Tore versperren das Feld; die Figur bleibt stehen (`bump`). *Tests: „klettert eine Stufe …“, „fällt beliebig tief herunter …“, „läuft nicht durch Wasser …“*
3a. **Beerenbüsche:** Läuft die Figur in einen Busch mit Beeren, pflückt sie sie (sie hüpft, Beeren springen heraus, es ploppt) und bleibt stehen. Ohne Beeren ist der Busch ein Hindernis. Nach 300 Takten (30 s) wachsen neue Beeren, auch nachts. Gepflücktes wird nicht gespeichert. Nach dem Pflücken trägt die Figur einen Korb mit Beeren auf dem Rücken (`basket`). Läuft sie damit in den Futtertrog, kommen die Beeren hinein, der Korb ist weg, und alle Tiere der Wiese freuen sich (hüpfen, Herz, fröhliche Töne). Ohne Korb ist der Trog ein Hindernis. *Tests: „in einen Busch laufen pflückt die Beeren …“, „Korb mit Beeren“*
4. **Aktion neben einem Tier** (vorn, sonst das nächste der acht Nachbarfelder): Es singt. Beim ersten Mal ist es gefunden. Läuft es frei umher, folgt es danach der Figur. Folgt es schon oder ist es im Garten, singt es nur. *Tests: „singt bei der Aktion …“, „nimmt mit der Aktion auch ein Tier schräg daneben …“, „Tiere im Garten singen …“*
5. **Hineinlaufen in ein Tier:** Ein frei umherlaufendes Tier singt, ist beim ersten Mal gefunden und folgt der Figur; die Figur bleibt stehen. Die Aktionstaste braucht es dafür nicht (erster Spieltest: Leertaste war zu viel). In ein folgendes Tier hineinlaufen tauscht sofort den Platz, so kann die Figur immer umdrehen. Ein Tier im Garten singt; läuft die Figur innerhalb von 15 Takten noch einmal hinein, tauschen beide den Platz (nur wenn das Tier auf dem Feld der Figur stehen darf und die Figur im Garten steht). Kommt ein folgendes Tier durch den Tausch auf die Wiese, ist es zu Hause (Regel 7). *Tests auch: „Randfälle aus der Prüfung“* *Tests: „Hineinlaufen reicht …“, „in ein folgendes Tier hineinlaufen tauscht sofort …“, „ein Tier im Garten tauscht erst beim zweiten Mal …“*
6. **Gänsemarsch:** Geht die Figur einen Schritt, rückt jedes folgende Tier auf den Platz seines Vordermanns. *Test: „läuft im Gänsemarsch …“*
7. **Wiese ums Bett (Zuhause der Tiere):** offene Wiese mit Radius 6 um das Bett, ohne Zaun, mit Futter- und Wassertrog. Ein folgendes Tier, das die Wiese betritt, löst sich aus der Kette, ruft seinen Ton (Ereignis `home`), bekommt einen eigenen Platz auf der Wiese, läuft dorthin und bleibt für immer auf der Wiese (gespeichert, auch nach dem Schlafen). Beim Laden stehen die Tiere verteilt auf der Wiese. Intern heißt die Wiese weiter „Garten“ (`cell.garden`, `homeAnimals`). *Tests: „Wiese ums Bett“*
8. **Tore:** Die acht großen Tore der Lichtung sind verschlossen (`locked`) und öffnen nicht, auch wenn alle Tiere gefunden sind; auch ein alter Spielstand öffnet sie nicht. Für künftige, nicht verschlossene Tore gilt: Ein Tor öffnet, wenn alle Tiere seiner Gegend gefunden sind, und bleibt offen. *Tests: „Große Tore“*
9. **Schlafen:** Die Figur läuft ins Bett (nicht in den ersten 15 Takten nach dem Aufwachen, dann ist das Bett nur ein Hindernis, damit sie nicht aus Versehen gleich wieder einschläft). Mit dem Befehl `action` auch, wenn das Bett vorn oder daneben ist (und kein Tier näher). Folgende Tiere gehen heim: Tiere einer Gegend an einen freien Platz nahe ihrem Start, Tiere der Landschaft verschwinden und tauchen später an ihrem Platz auf. 30 Takte lang weckt keine Taste. *Tests: „läuft ins Bett und schläft ein …“, „gleich nach dem Aufwachen ist das Bett nur ein Hindernis“, „legt sich mit der Aktion am Bett schlafen …“, „schickt folgende Tiere beim Schlafen heim“*
9a. **Portale:** Läuft die Figur in ein noch nicht aktives Portal neben einem Tor, wird es aktiv und bleibt es (gespeichert); die Figur bleibt dabei stehen. Erst dann erscheint sein Partner am Bett, vorher ist dessen Feld einfach Wiese (zwischen zwei kleinen Sockeln). Läuft die Figur in ein aktives Portal, steht sie danach vor dem Partner (auf dem freien Feld davor, sonst dem nächsten freien), folgende Tiere stehen in der Kette um sie herum. *Tests: „Portale“*
10. **Rufen:** Aktion ohne Tier und Bett in der Nähe. *Test: „ruft, wenn weder Tier noch Bett …“*
11. **Umherlaufen:** Freie Tiere ruhen 8 bis 25 Takte, dann gehen sie einen Schritt oder drehen sich. Sie bleiben in ihrem Zuhause (Gegend, Stück der Landschaft oder Wiese ums Bett) und nie auf einem Feld an einem Durchgang (Tore, Portale und deren Nachbarfelder); wer außerhalb steht (nach einem Platztausch), zieht heim. Steht die Figur daneben, bleiben sie stehen und schauen sie an. *Tests: „bleibt stehen und schaut …“, „läuft umher, aber nur in seinem Zuhause“, „Durchgänge bleiben frei“*
11a. **Wechselnde Plätze:** Beim Öffnen einer Welt und an jedem neuen Morgen (Aufwachen) bekommen alle frei umherlaufenden Tiere der Lichtung neue Plätze: zufällige erreichbare Felder der Lichtung (`world.spots`, nicht auf der Wiese, nicht an Durchgängen), mindestens 8 Felder vom Bett und 5 voneinander. Der Zufall kommt aus dem Zustand (Seed der Welt und Zahl der Besuche), gleiche Befehle ergeben weiter den gleichen Zustand. Tiere der Wiese bleiben, wo sie sind. *Tests: „Tiere an wechselnden Stellen“*
12. **Landschaft:** Tiere der Landschaft gibt es in den Stücken um die Figur (Abstand 1). Ab Abstand 3 verschwinden frei laufende wieder. Gleiche Welt, gleiches Stück: gleiche Tiere am gleichen Platz.

## Welt

| Regel | Test |
| --- | --- |
| Gleicher Seed ergibt gleiche Felder, anderer Seed andere Landschaft | „entsteht aus demselben Seed immer gleich …“ |
| In der Mitte steht nur das Bett, ringsum (2 Felder) ist es flach und frei | „In der Mitte steht nur das Bett …“ |
| Die Lichtung ist groß (Ellipse 80 × 68, über 9000 erreichbare Felder) mit Hügeln, Teichen, lichten Hainen, Blumenwiesen und Klettersteinen | „Alle Tiere wohnen erreichbar …“ |
| Frei zugänglich für ein kleines Kind: Benachbarte Felder unterscheiden sich um höchstens eine Ebene, so kommt man überall wieder heraus; was man nicht erreichen kann, wird Fels | „Auf der Lichtung ist keine Stufe höher als eins …“ |
| Bäume und Büsche stehen einzeln: Im Umkreis von zwei Feldern steht kein weiteres Hindernis | „Bäume und Büsche stehen einzeln …“ |
| Die großen Tore liegen weit vom Bett (über 60 Felder) und weit auseinander (über 30 Felder); vor jedem eine freie Bucht bis zur Lichtung, dahinter kommt man nie (auch nicht außen herum) | „Die großen Tore liegen weit …“, „Vor jedem großen Tor kommt man hin, dahinter nie …“, „Die fünf Felder …“ |
| Lage und Reihenfolge der acht Tore würfelt der Seed: gleichmäßig verteilt mit etwas Spiel, jedes in einer geraden Reihe senkrecht zur nächsten Achse, so tief im Fels wie die tiefste Stelle seines Torhauses | „Lage und Reihenfolge der Tore würfelt der Seed“ |
| Hinter jedem Tor ein Gang durch den Fels in seine Welt (eben, schon im Thema); außerhalb des Felsrings liegt in Richtung jedes Tors seine Welt, die Grenzen sind leicht gewellt | „Hinter jedem Tor liegt in seiner Richtung seine Welt“ |
| Vier Tiere je Art (`herd`, zusammen 40) wohnen auf vom Bett aus erreichbaren Feldern, jedes auf eigenem Platz: das erste nah am Wunschort, die weiteren aus dem Seed verteilt, mit Abstand zueinander und zum Bett (`world.spawns`, je Kennung `lichtung:<art>` bzw. `lichtung:<art>:<n>`); die Landschaft hinter dem Felsring bleibt draußen | „Alle Tiere wohnen erreichbar …“ |
| Felsring in Terrassen (3, 4, außen 5), nur fürs Auge: nicht zu betreten, also weder zu besteigen noch hineinzufallen; mit festem Außenrand, so ist er überall gut zehn Felder dick | „Der Felsring ist nicht zu betreten“ |
| Eine Stufe hinauf, beliebig tief herunter (in der Landschaft) | „In der Landschaft klettert man eine Stufe hinauf …“ |
| Acht große Tore zu je fünf Feldern, links und rechts je zwei Felder Turm (fest), alle verschlossen; die Welt liefert Felder, Mitte, Richtung nach außen und Winkel (`world.gates`) | „Acht große Tore …“ |
| Neben jedem großen Tor ein Portal (gleich neben dem Turm, sechs Felder neben der Tormitte, zwei Felder vor der Torreihe; die Bucht ist auf seiner Seite breiter), erreichbar vom Bett, zur Lichtung schauend; die Partner stehen im Kreis um das Bett, jedes in Richtung seines Tors und zum Bett schauend; die Säulen sind fest, um jedes Portal ist es frei (`world.portals`) | „neben jedem Tor ein erreichbares Portal …“ |
| Ums Bett die Wiese: eben, frei, vom Bett aus erreichbar, mit Futtertrog (`HOME.food`) und Wassertrog (`HOME.water`), am Rand Blumen; Tiere der Lichtung wohnen nicht auf der Wiese | „Ums Bett liegt die Wiese …“ |
| Die Landschaft ist sanft (selten mehr als eine Stufe zwischen Nachbarn) | „ist meist sanft …“ |

## Nebel

| Regel | Test |
| --- | --- |
| Am Anfang liegt alles im Nebel außer einem Kreis mit Radius 10 um das Bett | (Komponente) |
| Bei jedem Schritt lichtet sich ein Kreis mit Radius 7 um die Figur | „lichtet sich rund um die Figur …“ |
| Nur wenn sich etwas geändert hat, wird die Nebel-Maske neu berechnet | „meldet nur Stücke, in denen sich wirklich etwas geändert hat“ |
| Erkundetes wird gespeichert (je Stück 32 Byte als Base64) und übersteht Laden und kaputte Daten | „übersteht das Speichern und Laden“, „ist im Spielstand klein …“ |
| Im Nebel sind keine Tiere und keine Zeichen über Tieren zu sehen; die Karte zeigt nur Erkundetes | (Zeichnen) |

Die Regeln kennen den Nebel nicht: Er betrifft nur, was gezeichnet wird.

## Stimmung der Richtungen

Die Lichtung gibt auf dem Weg nur eine Ahnung dessen, was hinter einem Tor wartet; die eigentliche Welt beginnt erst hinter dem Tor. `world.climate(x, y)` liefert die Welt des nächsten Tors (wie hinter dem Felsring, Grenzen leicht gewellt) und die Stärke: 0 bis knapp zur Hälfte des Wegs zum Rand, dann weich ansteigend bis 1 am Felsring. Flecken (Schnee, Sand, Basalt, Stein, Moos) gibt es nur vereinzelt nah am Rand (höchstens etwa jedes zehnte Feld), besondere Bäume mischen sich unter die normalen; Teilchen und Wind halb so stark, Schnee fällt nur ganz nah am Eistor. Alles aus dem Seed; nur Boden, Baumart und Farben ändern sich, keine Höhen, nichts versperrt (die Regeln bleiben gleich).

| Richtung | Stimmung | Test |
| --- | --- | --- |
| Eis | Schneeflecken (ohne Grasbüschel und Blumen), Bäume mit Schnee auf der Krone, kühles Licht; Regen fällt hier als Schnee | „Richtung Eis Schnee …“ |
| Sand | gelbliches Gras, Sandflecken nahe am Rand, helles warmes Licht | „… Sand …“ |
| Wasser | Blütenbäume | „… Richtung Wasser Blüten …“ |
| Lava | trockenes Gras, Basaltflecken und kahle Bäume nahe am Rand, rötlich warmes Licht | (Zeichnen) |
| Höhle | graueres Gras, Steinflecken, dämmriger | (Zeichnen) |
| Wald | Herbstbäume in Orange und Rot, warmes Licht | „… Richtung Wald Herbst …“ |
| Pilze | lila Moosflecken, leicht lila Licht | „… Richtung Pilze Moos“ |
| Wolken | viel Wind, ziehende Wolkenschatten, weiße Federwölkchen | (Zeichnen) |
| Am Bett und auf der Wiese neutral | | „am Bett ist es neutral“ |

Leben: Herbstblätter wehen Richtung Wald, Funken glimmen Richtung Lava, Sporen schweben Richtung Pilze, Glühwürmchen leuchten Richtung Höhle auch am Tag (nicht bei reduzierter Bewegung). Wind (`windAt`, getestet): überall eine leichte Brise, stärker Richtung Wolken und Wald und bei Wolken und Regen; die Grasbüschel wiegen sich (Shader, bei reduzierter Bewegung still).

Licht: Sonne und Himmelslicht nehmen leicht Farbe und Helligkeit der Richtung an, in der die Figur steht (`MOOD_LIGHT`, höchstens gut ein Drittel); das Gras ist zart getönt (höchstens gut die Hälfte). In 2D eine ganz leichte Tönung; in 3D keine Tönung auf der Ebene darüber (dort würde sie zu einem flächigen Schleier). Die Farben der Welt bleiben erkennbar.

## Wetter und Unterstand

Rein in `mitwachsen-weather.ts`: Das Wetter folgt aus Seed, Tag (`state.day`) und Spielzeit (`state.tick`), gleiche Werte ergeben gleiches Wetter.

| Regel | Test |
| --- | --- |
| Alle 5 Minuten Spielzeit (3000 Takte) ein neues Wetter: Sonne 50 %, Wolken 25 %, Regen 25 %; jeder Tag beginnt mit Sonne | „jeder Tag beginnt mit Sonne …“ |
| Weicher Übergang über 20 s; nach dem Regen 1,5 Minuten Regenbogen | „wechselt weich …“, „nach dem Regen steht eine Weile ein Regenbogen …“ |
| Regnet es, gehen die Tiere der Wiese unter den Riesenpilz (7 × 3 Felder oben auf der Wiese, `HOME.shelter`, `cell.roof`; der Stiel in der Mitte ist fest): jedes an einen eigenen Platz darunter, vorn zuerst, oder, wenn er voll ist, dicht daneben, und bleibt dort; danach zurück an ihre Plätze. Sie verlassen die Wiese dabei nie | „Unterstand bei Regen“ |
| Bild: Wolken dämpfen Sonne und Himmel, Regen fällt in feinen schrägen Strichen (nicht bei reduzierter Bewegung), der Regenbogen steht als Pixelbogen oben rechts. Der Unterstand ist ein Riesenpilz (Fliegenpilz): cremefarbener Stiel mit Kragen in der Mitte, hoher roter Hut mit weißen Tupfen in Stufen; der Hut sitzt so hoch, dass man die Tiere in den vorderen Reihen darunter sieht, und wird vor der Figur durchsichtig wie Laub | (Zeichnen) |

## Nachwachsen

Rein in `mitwachsen-growth.ts`. Jedes Schlafen zählt einen Tag (`state.day`, gespeichert als `day`). Nur Zierde, die Regeln ändern sich nicht.

| Regel | Test |
| --- | --- |
| Mit jedem Tag blüht auf freier Wiese der Lichtung mehr (1,2 % der Felder je Tag, höchstens 12 %), dazu Pilze (0,3 % je Tag, höchstens 3 %) | „am ersten Tag wächst nichts dazu …“ |
| Was einmal gewachsen ist, bleibt an späteren Tagen | „was gewachsen ist, bleibt …“ |
| Nur freie Wiese der Lichtung; Bäume, Wasser, Steine und die Welten hinter den Toren bleiben | „nur auf freier Wiese …“ |
| Jedes Schlafen zählt einen Tag, der Tag kommt mit dem Spielstand wieder | „jedes Schlafen zählt einen Tag …“ |

## Müde werden (Medienzeit)

Rein in `mitwachsen-tired.ts`, die Uhr gehört zum Kind (ein Wert je Browser, `larmic.games.mitwachsen.tired`), nicht zur Welt.

| Regel | Test |
| --- | --- |
| Gezählt wird nur echte Spielzeit: Takt läuft (Seite sichtbar, Menü und Hinweis zu) und die Figur ist wach; Lücken über 5 s zählen nicht | „zählt nur echte Spielzeit …“ |
| Nach 15 und 20 Minuten setzt sich die Figur 2,5 s hin (Laufen geht so lange nicht), gähnt, und eine Sprechblase sagt es (Mond und „Zzz“ für das Kind, ein Satz zum Vorlesen) | „gähnt nach 15 und 20 Minuten …“ |
| Nach 25 Minuten will die Figur ins Bett (Mond und Bett in der Blase, dazu ein „i“-Knopf zum Hinweis für Eltern), danach alle 3 Minuten wieder | „gähnt nach 15 und 20 Minuten …“ |
| Verpasste Hinweise kommen nur einmal | „meldet verpasste Hinweise nur einmal“ |
| Spielt niemand: nach 20 s ohne Eingabe setzt sich die wache Figur, schaut zum Betrachter und liest in einem großen aufgeschlagenen Buch auf dem Schoß (weiße Seiten mit Zeilen nach oben, alle 5 s blättert eine Seite um); nach 2 Minuten nickt sie ein (Augen zu, „Zzz“). Jede Taste weckt sie, sie läuft sofort los. Solange sie liest oder döst, läuft die Uhr fürs Müdewerden nicht. Nach Menü, Hinweis oder Tab-Wechsel beginnt die Zeit neu | „ohne Eingabe setzt sich die Figur …“ |
| Ab 20 Minuten wird das Licht golden (bis 25 Minuten 60 %, ab 35 Minuten ganz) | „der Himmel wird ab 20 Minuten abendlich …“ |
| Gesperrt wird nichts. Schlafen im Bett beendet den Tag (die Zeit beginnt neu), ebenso eine Pause über 60 Minuten | „nach einer langen Pause beginnt ein neuer Tag“ |
| Gespeichert alle 5 s und mit dem Spielstand; Kaputtes ergibt einen neuen Tag | „übersteht Speichern und Laden …“ |

**Hinweis für Eltern** (`MitwachsenParentInfo.astro`): unter 3 Jahren, 3 bis 6 Jahre (S2k-Leitlinie), WHO, gemeinsames Spielen (Madigan u. a.), jeweils mit Angabe, wer es empfiehlt, und ohne Vorschriften, wie das Spiel hilft, Quellen als Links. Erscheint beim ersten Öffnen vor dem Spiel (gemerkt in `larmic.games.mitwachsen.info`), wieder zu öffnen im Menü („Für Eltern: Medienzeit“) und über den „i“-Knopf der Bett-Sprechblase. Steht ohne JavaScript im Text der Seite. Solange er offen ist, ruht das Spiel.

## Invarianten

Geprüft mit je 4000 zufälligen Befehlen auf drei Welten (*Test: „Invarianten bei wildem Drücken“*):

- Die wache Figur steht immer auf einem Feld, auf dem man stehen kann.
- Nie stehen zwei Wesen auf einem Feld.
- Tiere auf der Wiese verlassen sie nie.
- Jedes Tier ist höchstens einmal in der Kette.
- Gleiche Befehle ergeben den gleichen Zustand (kein `Math.random`, Zufall aus dem Zustand).

## Speichern

| Was | Regel |
| --- | --- |
| Schlüssel | `larmic.games.index` (Liste der Welten, aktuelle Welt), `larmic.games.world.<id>` je Welt, `larmic.games.muted` |
| Format | `{ v: 4, game: 'mitwachsen', age, id, seed, worldName, figureName, openGates, metAnimals, homeAnimals, portals, position, visits, day, explored }`; `day` zählt die Tage (fehlt er, ist es Tag 0); `portals` sind die aktiven Portale (Unbekanntes fällt weg); `explored` ist der Nebel je Stück (fehlt er, beginnt die Welt im Nebel); `age` ist die Altersstufe der Welt (bisher nur 3) |
| Umzug | Version 1 (Arbeitstitel `game: 'threeyear'`, ohne Alter) → 2 (Alter 3) → 3 (`penAnimals` heißt jetzt `homeAnimals`) → 4 (Start auf der Lichtung: gefundene Tiere des alten Zuhauses, die es auf der Lichtung gibt, bleiben gefunden; Tore, Garten und Position beginnen neu). Ältere Indizes werden übernommen |
| Wann | sofort bei gefunden, Garten, Tor, Portal, Reise, Schlafen, Weltwechsel und Umbenennen; sonst alle 10 s; beim Verlassen der Seite |
| Fehler | Jeder Zugriff fängt Fehler ab. Ohne Speicher läuft das Spiel bis zum Neuladen weiter. |
| `migrate()` | verwirft Fremdes (anderes Spiel, unbekannte Version) und räumt auf (unbekannte Tore und Arten, doppelte Einträge, kaputte Felder) |
| Welt-Code | Seed in Basis 36, z. B. `0IDFDSE`; ergibt dieselbe Landschaft ohne Spielstand |

*Tests: `mitwachsen-save.test.ts`*

## Was angezeigt wird

| Was | Regel |
| --- | --- |
| Ansicht | **3D** mit Three.js (WebGL): Kamera schräg von oben (55°) aus Süden, folgt der Figur; echtes Sonnenlicht mit Schatten, Himmel und Nebel in der Ferne. Three.js wird erst beim Spielstart per `import()` nachgeladen (Bundle-Gate: höchstens 128 KB JavaScript beim Laden der Spielseite, kein Three.js). Darüber liegt ein durchsichtiges 2D-Canvas für Zeichen über den Tieren, Herzen, Noten, Heimweg-Pfeil, Nacht, Schmetterlinge und die Leiste. Ohne WebGL bleibt die **2D-Ansicht von vorn** (Reihe für Reihe von hinten nach vorn), sie läuft auch, bis 3D geladen ist |
| Verdeckte Figur | In 3D wird Laub halb durchsichtig, das zwischen Kamera und Figur steht (Baumkronen, Büsche, Hecken auf Körperhöhe oder darüber; Boden und Felsen bleiben fest): ein weicher Kreis um die Sichtlinie, bis zu drei von vier Pixeln weggelassen, die Figur selbst bleibt unverändert. In 2D wird die Figur halb durchsichtig obenauf gezeichnet |
| Nebel | keine Blöcke: Die Welt verblasst am Rand des Erkundeten weich in die Himmelsfarbe und verschwindet im Dunst. 3D: Nebel-Maske (128 × 128 Felder um die Figur, zweimal weich verwischt) als Textur, ein Shader-Zusatz mischt nach der Beleuchtung in die Himmelsfarbe (nachts dunkel). 2D: Unerkundetes bleibt leer, am Rand heller Dunst |
| Große Tore | Mächtige Torhäuser (9 Felder breit, Türme gut 6 Ebenen hoch) mit geschlossener Doppeltür und leuchtendem Zeichen, je Welt geschmückt: Eis (Schneehauben, Eisspitzen, Eiszapfen), Sand (Stufenkronen, Bänder), Wasser (Wasserfälle, Muscheln), Lava (glühende Adern und Krone), Höhle (leuchtende Kristalle), Wald (Laubkronen, Ranken), Wolken (Wolkentürme, Regenbogen), Pilze (Pilzstiele mit Riesenhüten). Vor der Figur wird ihr Mauerwerk durchsichtig. Steht die Figur vor einem Tor, lichtet sich der Nebel im Gang dahinter (Blick in die Welt) |
| Welten hinter den Toren | Eis: Schnee, zugefrorene Seen, Eisblöcke, Schneetannen. Sand: Dünen, blühende Kakteen, Oasen mit Palmen. Wasser: Inseln mit Palmen und Seerosen. Lava: Basalt, glühende Flüsse und Seen, kahle Bäume. Höhle: dunkler Stein, leuchtende Kristalle, Tropfsteine. Wald: Bäume, Tannen, Beerenbüsche, Farne. Wolken: Wolkeninseln über dem Himmel. Pilze: lila Moos und Riesenpilze. Tiere dort sind vorerst die der Landschaft |
| Portale | Säulen, Sturz und Krone im Thema des Tors (Lava leuchtet), leuchtender Stein oben; innen dreht sich ein Wirbel in der Farbe der Welt und Funken kreisen, sobald aktiv (ruhig bei reduzierter Bewegung). Der Partner am Bett erscheint erst mit der Aktivierung, vorher zeigen zwei kleine Sockel, wo er stehen wird. Auf der Karte: farbiges Kästchen, am Tor sobald erkundet, am Bett sobald aktiv. Aktivieren und Reisen klingen und funkeln |
| Hochformat | In 3D rückt die Kamera im Hochformat weiter weg (bis 1,8-fach), der Nebel rückt mit |
| Kamera | folgt der Figur; Figur in der Bildmitte. Etwa 18 Felder breit |
| Feinheit | Texturen 8 × 8 wie auf der Seite, jedes Texel mit feiner Körnung in 2 × 2 Unterpixeln |
| Höhen | höhere Flächen etwas heller; dunkle Kante, wo es hinuntergeht; Schatten am Fuß eines höheren Nachbarn; helle Vorderkante und dunkle Unterkante jeder Stufe |
| Figur | wird zusätzlich halb durchsichtig obenauf gezeichnet, damit sie hinter Hügeln und Bäumen sichtbar bleibt |
| Wesen | gleiten zu ihrem Feld, etwas schneller als der Takt der Eingabe (gut 4 Felder/s); Sprünge über mehr als 2,5 Felder springen direkt |
| Folgende Tiere | kleines Herz darüber |
| Verlorene Tiere | noch nicht gefunden: kleines Fragezeichen über dem Kopf (wippt leicht, außer bei reduzierter Bewegung) |
| Tiere auf der Wiese | ab und zu steigt ein kleines Herz auf (nicht bei reduzierter Bewegung); beim Ankommen hüpfen sie, rufen ihren Ton und funkeln |
| Wiese ums Bett | offen, Blumen am Rand; Futtertrog aus Holz mit Heu und Möhren, Wassertrog |
| Beerenbüsche | niedrig und rund in zwei Stufen, mit roten Beeren oben und vorn, damit man sie nicht für Baumwipfel hält (erster Spieltest) |
| Natur | Grasbüschel, Farne, Pilze, bemooste Findlinge (blockieren, nur auf Hügeln); Bäume als Eiche, Birke, Herbst- oder Blütenbaum, in Gruppen; Farbflecken im Boden. Reine Zierde aus dem Seed, die Regeln ändern sich nicht |
| Licht und Leben | weiche Schatten unter Bäumen, Büschen, Tieren und Figur; warmes Licht von oben links, leichter Dunst oben, dunklere Ränder; glitzerndes Wasser mit hellem Ufer; tagsüber Schmetterlinge und Pollen, nachts Glühwürmchen (Bewegtes nicht bei reduzierter Bewegung) |
| Leiste unten | ein Platz je Art, nach Gegenden gruppiert (eine Art gilt als gefunden, sobald eines ihrer Tiere gefunden ist), dahinter Tiere der Landschaft, die im Garten wohnen: heller Platz mit Umriss und Fragezeichen = noch verloren, Holz mit Tier in Farbe = gefunden, Gras = zu Hause im Garten, Herz = folgt gerade |
| Tafel am Tor | Tiere der Gegend auf dem Brett: gefundene in Farbe, verlorene als Umriss |
| Karte | oben rechts, genordet wie die Kamera, etwa 41 × 41 Felder um die Figur: Felder in ihren Farben, die Figur als Punkt, das Bett als Häuschen. Liegt das Bett außerhalb, zeigt ein Pfeil am Kartenrand nach Hause |
| Touch-Steuerung | auf Geräten ohne Maus (oder nach der ersten Berührung): Steuerkreuz unten links (kein Aktionsknopf); langes Drücken öffnet keine Lupe, Auswahl oder Menüs des Browsers (`touchstart`/`contextmenu` abgefangen, `-webkit-touch-callout: none`), im selben ruhigen Takt wie die Tastatur; die Leiste rückt darüber |
| Kopf | oben links Zahnrad (Menü für Eltern, darin auch der Weg zur Homepage), Mitte Name der Figur, rechts Karte. Kein Zurück-Button: Das Spiel steht für sich |
| Nacht | dunkler Himmel mit Sternen und Mond, die Figur liegt im Bett, Zzz steigt auf |
| Menü | Zahnrad oben links: Welten wählen, neue Welt, Welt löschen (zweiter Klick bestätigt), Namen, Welt-Code kopieren, Ton, Vollbild, zur Homepage. Das Spiel pausiert, solange es offen ist |
| Reduzierte Bewegung | keine Partikel, Noten und Zzz, kein Gleiten und Hüpfen, Tore und Nacht ohne Überblendung; Töne bleiben |
