# Konzept: Mitwachsen ab 3

Das Kind läuft mit einer eigenen Figur durch eine endlose Voxel-Welt, findet verlorene Tiere, die singen, wenn man sie findet, bringt sie nach Hause auf die Wiese ums Bett und öffnet so nach und nach neue Gegenden. Zu jeder Gegend gibt es eine Geschichte, die der Elternteil vorliest. Zum Aufhören legt sich die Figur ins Bett, und es wird Nacht.

Hintergrund, Altersstufen und gemeinsame Regeln: [README](README.md). Dieses Dokument beschreibt die erste Stufe (ab 3). Ein früher Prototyp (feste kleine Insel, Tiere treffen) liegt als Artefakt vor und hat gezeigt: Die Pfeiltasten beherrscht das Kind, die schräge Ansicht der Homepage passt aber nicht dazu (→ läuft dort nach rechts unten).

## Grundsätze

1. **Kind steuert, Elternteil sitzt daneben.** Das Kind sieht keinen Text. Texte (Geschichten, Hinweise an Toren) sind zum Vorlesen.
2. **Nichts geht schief.** Kein Fehlerton, kein Herunterfallen, kein Verlieren. Wände antworten mit einem Wackeln und „boing“.
3. **Jede Taste tut etwas Freundliches.** Auch wildes Drücken ist gut.
4. **Ritual zum Anfangen und Aufhören.** Die Figur wacht im Bett auf und legt sich dort wieder schlafen. Wann Schluss ist, entscheidet der Elternteil; gespeichert wird ohnehin laufend.

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Pfeiltasten | Figur geht ein Feld in Bildschirmrichtung (→ nach rechts, ↑ nach oben). Gedrückt halten: höchstens etwa 4 Felder pro Sekunde, Autorepeat des Systems wird ignoriert. |
| Leertaste und andere Tasten | Ab 3 ohne Wirkung. Alles geht durch Hineinlaufen: in ein Tier (es folgt), ins Bett (schlafen), in ein Portal (reisen). |
| Maus | Nur für das Menü (Zahnrad). Das Kind spielt mit der Tastatur und öffnet es nicht aus Versehen. |
| Touch | Auf Handy und Tablet: Steuerkreuz unten links, im selben ruhigen Takt. |

**Erster Spieltest:** Eine Aktionstaste war für den Dreijährigen ein Schritt zu viel. Darum gibt es ab 3 nur Laufen. Die Regeln kennen die Aktion weiter (singen, schlafen, rufen); eine spätere Altersstufe kann sie wieder an eine Taste binden.

## Ansicht und Kamera

- **3D-Ansicht:** echtes 3D mit Three.js, Kamera schräg von oben (etwa 55°, im Code einstellbar), Sonnenlicht mit Schatten, Nebel in der Ferne. Texturen wie in `src/lib/voxel/textures.ts`, pixelig. Three.js lädt erst beim Spielstart nach, die Homepage nie (Bundle-Gate).
- **2D-Ansicht von vorn** als Rückfall ohne WebGL und während 3D lädt: Blöcke zeigen Ober- und Vorderseite.
- **Die Figur bleibt in der Bildmitte**, die Kamera folgt ihr weich, die Welt läuft darunter durch. Gezeichnet wird nur, was im Bild ist.
- **Karte** oben rechts: zeigt mehr als das Bild. Liegt das Zuhause außerhalb der Karte, zeigt ein Pfeil am Kartenrand dorthin.
- **Farben:** Farben der Spielwelt (Tiere, Herzen, Nacht, Sterne) sind Spielgrafik wie die Texturen und stehen in einer Spiel-Palette, nicht in `tokens.css`. Herzen sind rosa oder rot, nicht Gold. Tafeln sind aus Holz mit Pixel-Rahmen in Tinte, Umrisse fehlender Tiere in Tinte. Oberfläche (Zahnrad, Menü, Buttons) nutzt die Tokens und `.pxbtn`; Gold bleibt die Farbe für klickbare Aktionen.

## Welt

- **Endlos**, berechnet aus einem **Seed**. Derselbe Seed ergibt immer dieselbe Welt. Gespeichert werden nur Seed und Fortschritt, nie die Landschaft.
- **Start auf der Lichtung:** Am Anfang gibt es nur das **Bett** in der Mitte einer großen Lichtung (gut 160 × 136 Felder) mit sanften Hügeln, mehreren Teichen, einzelnen Bäumen, Blumenwiesen und Steinen zum Klettern. Keine Mauer, kein Zaun. Ums Bett liegt eine offene Wiese mit Futter- und Wassertrog: das Zuhause der gefundenen Tiere.
- **Frei zugänglich (aus dem ersten Spieltest):** Ein Dreijähriger kommt um einen Baum herum, bei mehreren dicht beieinander wird es schwierig. Darum stehen Bäume und Büsche einzeln, mit Platz ringsum. Büsche tragen rote Beeren, damit man sie nicht für Baumspitzen hält. Läuft man hinein, pflückt die Figur die Beeren und freut sich; nach kurzer Zeit wachsen neue. Die Beeren landen in einem Korb auf dem Rücken der Figur. Bringt das Kind sie zum Futtertrog auf der Wiese, ist der Korb wieder leer, und alle Tiere dort freuen sich. Keine Stufe ist höher als eins, so kommt man überall hinauf und nirgends in eine Ecke, aus der es nicht herausgeht. Die Tore liegen weit weg.
- **Ringsum natürliche Felsen** mit leicht unregelmäßigem Rand, in Terrassen ansteigend. Sie sind eine feste Grenze: Man kann sie weder besteigen noch hineinfallen. Darin stehen acht **große Tore**, eines je Welt. Wo sie stehen und in welcher Reihenfolge, würfelt jede Welt neu. Sie sind vorerst verschlossen; vorerst ist nur die Lichtung spielbar.
- **Nebel:** Zu sehen ist nur, was das Kind schon erkundet hat. Dahinter verschwindet die Welt weich im Dunst, wie echter Nebel, und zeigt sich beim Herumlaufen (gespeichert).
- Hinter den Toren: endlose, berechnete Landschaft in Stücken (16 × 16 Felder).
- **Höhen:** Eine Stufe hinauf geht automatisch mit einem kleinen Hüpfer, auch auf Steine und Felsen; dann Stufe für Stufe weiter. Herunter geht immer, egal wie tief.
- **Wasser** ist nicht begehbar.

## Die Lichtung

| | |
| --- | --- |
| Tiere zum Entdecken | zehn Arten: Hase, Igel, Schaf, Eichhörnchen, Ente, Kuh, Fuchs, Frosch, Biene, Schildkröte, je vier Tiere (aus dem ersten Spieltest: die Lichtung war zu leer). Die Leiste zeigt jede Art einmal. |
| Tore | acht, eines je Welt (Eis, Sand, Wasser, Lava, Höhle, Wald, Wolken, Pilze), Lage und Reihenfolge je Welt gewürfelt, alle vorerst zu. Jedes Torhaus ist im Stil seiner Welt geschmückt |

Die Leiste unten ist die **Liste der entdeckten Tiere**: Umriss mit Fragezeichen = noch nicht entdeckt, in Farbe = entdeckt, Herz = folgt gerade. Grün hinterlegt = zu Hause auf der Wiese. Wie sich die Tore später öffnen, hängt an der Geschichte (siehe Ideen: Tiere befreien).

## Die Welten

Die Lichtung ist das Zuhause mit dem Bett. Hinter jedem der acht großen Tore liegt eine eigene Welt mit eigenem Thema, eigenen Pflanzen, später eigenen Tieren und einer eigenen Geschichte. Die Landschaft der Welten ist schon gebaut und durch die Tore zu sehen; betreten kann man sie noch nicht. Für alle gilt: freundlich und ungefährlich, nichts kann der Figur passieren, nichts geht verloren.

| Welt | Stand | Thema (`GateTheme`) |
| --- | --- | --- |
| **Lichtung** | spielbar | – |
| **Eiswelt** | Landschaft gebaut, Tor zu | `eis` |
| **Sandwelt** | Landschaft gebaut, Tor zu | `sand` |
| **Wasserwelt** | Landschaft gebaut, Tor zu | `wasser` |
| **Lavaberge** | Landschaft gebaut, Tor zu | `lava` |
| **Höhlenwelt** | Landschaft gebaut, Tor zu | `hoehle` |
| **Wald** | Landschaft gebaut, Tor zu | `wald` |
| **Wolkenwelt** | Landschaft gebaut, Tor zu | `wolken` |
| **Pilzwald** | Landschaft gebaut, Tor zu | `pilze` |

**Was alle Welten verbindet:**

- **Die Welt wächst beim Laufen:** Alles entsteht aus dem Seed, Stück für Stück, wenn die Figur dorthin kommt. Derselbe Seed ergibt immer dieselbe Welt, ein anderer eine andere: Die Tore stehen in jeder Welt woanders und in anderer Reihenfolge. In Richtung jedes Tors liegt seine Welt, endlos.
- **Mächtiges Torhaus:** Neun Felder breit, hohe Türme, eine geschlossene Doppeltür mit leuchtendem Zeichen in der Farbe der Welt, und Schmuck, der verrät, was dahinter wartet (Eiszapfen, Wasserfälle, glühende Lava-Adern, Kristalle, Laubkronen, ein Regenbogen, Riesenpilze). Vor dem Tor ist eine freie Bucht; steht das Kind davor, lichtet sich der Nebel im Gang dahinter, und es sieht schon ein Stück der Welt. Hinter das Tor kommt man nicht, auch nicht außen herum.
- **Portal neben dem Tor:** Drei Felder breit mit Säulen und Krone im Thema der Welt, zuerst leer. Läuft das Kind hinein, leuchtet es auf, ein Wirbel dreht sich, Funken kreisen, und es bleibt an. Gleichzeitig erscheint sein Gegenstück im Kreis um das Bett, in Richtung seines Tors (vorher zeigen dort zwei kleine Sockel, wo es stehen wird). Von da an kann das Kind zwischen Bett und Tor hin- und herreisen, folgende Tiere reisen mit.
- **Eigene Tiere:** Jede Welt bekommt ihre eigenen verlorenen Tiere, sobald man hinein kann. Die Vorschläge unten sind Ideen, gemeinsam mit dem Kind auszusuchen.
- **Gleiche Regeln:** Klettern, Nebel, Folgen und Schlafen bleiben überall gleich. Neu ist nur, wie die Welt aussieht und klingt.
- **Öffnen der Tore:** Wie die Tore aufgehen, hängt an der Geschichte (siehe Ideen: Tiere befreien). Bis dahin bleiben sie zu.

### Lichtung

Große, freie Wiese (gut 160 × 136 Felder) mit sanften Hügeln, Teichen, einzelnen Bäumen, Blumenwiesen und Klettersteinen, ringsum Felsen als feste Grenze. In der Mitte das Bett, darüber später die vier Portale in einer Reihe. Zehn Tiere: Hase, Igel, Schaf, Eichhörnchen, Ente, Kuh, Fuchs, Frosch, Biene, Schildkröte. Tag und Nacht, Schmetterlinge, nachts Glühwürmchen.

### Eiswelt

- **Aussehen:** Schneefelder, glitzernde Eisblöcke zum Klettern, zugefrorene Seen, verschneite Tannen, Iglus. Kühles, helles Licht, sanfter Schneefall (nicht bei reduzierter Bewegung).
- **Besonderes:** Auf Eis rutscht die Figur nicht (das wäre für ein kleines Kind frustrierend), es knirscht nur beim Laufen.
- **Tiere (Ideen):** Pinguin, Eisbär, Robbe, Schneehase, Schneeeule.
- **Portal:** hellblau, Rahmen aus Eis.

### Sandwelt

- **Aussehen:** Dünen in sanften Stufen, Kakteen, Palmen an einer kleinen Oase, Sandsteinfelsen, warmes Licht.
- **Besonderes:** Fußspuren im Sand, die langsam verwehen (reine Zierde).
- **Tiere (Ideen):** Kamel, Erdmännchen, Eidechse, Wüstenfuchs, Schildkröte aus der Oase.
- **Portal:** goldgelb, Rahmen aus Sandstein.

### Wasserwelt

- **Aussehen:** Viele kleine Inseln und Strände, verbunden durch Stege, Brücken und Trittsteine; Seerosen, Boote am Ufer, ein Leuchtturm.
- **Besonderes:** Wasser bleibt nicht begehbar, die Wege führen darüber. Wellen und Glitzern, leises Plätschern.
- **Tiere (Ideen):** Fisch (springt aus dem Wasser), Krebs, Seestern, Möwe, Otter.
- **Portal:** blau, Rahmen aus Wasserblöcken.

### Lavaberge

- **Aussehen:** Dunkle Felsen und Berge, dazwischen glühende Lavaflüsse, die warm leuchten, auch nachts. Höher als die anderen Welten, mit viel zum Klettern.
- **Besonderes:** Ganz ungefährlich: Die Figur kommt nicht in die Lava, die Lava leuchtet nur. Kein Feuer, kein Rauch, der Angst macht.
- **Tiere (Ideen):** Bergziege, Salamander, Murmeltier, Adler, Steinbock.
- **Portal:** orange, Rahmen aus leuchtender Lava.

### Wald

- **Aussehen:** Dichter, aber lichter Wald mit Eichen, Birken, Tannen und Herbstbäumen, Beerenbüsche, Farne, Pilze, kleine Teiche.
- **Tiere (Ideen):** Reh, Wildschwein, Eule, Dachs, Specht.
- **Portal:** grün, Säulen aus Holz, oben Laub.

### Wolkenwelt

- **Aussehen:** Weiße Wolkeninseln in verschiedenen Höhen, dazwischen nur Himmel. Am Tor ein Regenbogen.
- **Besonderes:** Wenn man hineinkann, braucht es Wolkenbrücken zwischen den Inseln. Niemand fällt hinunter.
- **Tiere (Ideen):** Wolkenschaf, Vögel, Schmetterlinge, ein kleiner Drache (freundlich).
- **Portal:** goldgelb, Säulen aus Wolken.

### Pilzwald

- **Aussehen:** Lila Moos, Riesenpilze mit roten, blauen und orangen Hüten, viele kleine Pilze.
- **Tiere (Ideen):** Schnecke, Glühwürmchen, Igel, Maus.
- **Portal:** lila, Säulen wie Pilzstiele, oben ein roter Hut.

### Höhlenwelt

- **Aussehen:** Dunkle Steinblöcke, leuchtende Kristalle und Pilze als Lichtquellen, unterirdische Seen. Nie ganz dunkel: Es bleibt immer genug Licht, damit nichts unheimlich wirkt.
- **Tiere (Ideen):** Fledermaus, Maulwurf, Glühwürmchen, Höhlenmolch.
- **Portal:** lila, Rahmen aus dunklem Stein (das Thema `hoehle` gibt es schon).

## Tiere

**Die Geschichte:** Die Tiere haben sich verlaufen und finden nicht mehr nach Hause. Verlorene Tiere tragen ein kleines Fragezeichen über dem Kopf. Das Kind findet sie, sie freuen sich (Ton, Hüpfer, Herz) und laufen mit ihm nach Hause auf die Wiese ums Bett. Dort fressen und trinken sie, wohnen und sind glücklich. Es geht ums Helfen, nicht ums Sammeln oder Einsperren.


1. Jedes Tier hat eine **Heimat-Gegend** und wandert dort langsam umher.
2. Steht die Figur direkt neben einem Tier, **bleibt es stehen** und schaut sie an.
3. **Aktion neben einem Tier:** Es hüpft und **singt seinen eigenen Ton** (alle aus derselben Pentatonik, klingt immer zusammen). Beim ersten Mal gilt es als **gefunden** und bekommt ein Herz. Danach **folgt** es der Figur im Gänsemarsch, bis es auf der Wiese ums Bett ankommt oder die Figur schläft. Über folgenden Tieren schwebt ein kleines Herz.
4. **Hineinlaufen in ein Tier** genügt (aus dem ersten Spieltest: die Leertaste war zu viel): Es singt, bekommt beim ersten Mal ein Herz und folgt. Läuft die Figur in ein Tier, das schon folgt, tauschen beide sofort den Platz. So kann die Figur immer umdrehen und bleibt nie eingeklemmt. Ins Bett geht es genauso: hineinlaufen.
5. **Aktion neben einem folgenden Tier:** Es singt noch einmal, sonst ändert sich nichts.
6. **Zu Hause ankommen:** Betritt ein folgendes Tier die Wiese ums Bett, ruft es seinen Ton, freut sich und läuft zu seinem eigenen Platz auf der Wiese. Dort bleibt es, auch nach dem Schlafen, und folgt nicht mehr (erster Spieltest: nach dem Schlafen waren alle Tiere weg). Läuft man hinein, singt es.
7. **Schläft die Figur**, laufen folgende Tiere in ihre Heimat-Gegend zurück.
8. **Tiere der berechneten Landschaft:** Sie zählen für kein Tor, singen aber, folgen und dürfen mit auf die Wiese. Ihre Kennung ergibt sich aus Seed, Stück und Nummer und bleibt dadurch stabil.
9. **Wechselnde Plätze:** Bei jedem Besuch und an jedem neuen Morgen sind die noch verlorenen Tiere woanders auf der Lichtung unterwegs. So gibt es jeden Tag etwas zu suchen.
10. Positionen werden nicht gespeichert, nur „gefunden“ und „zu Hause“. Ein Tier auf der Wiese erscheint nicht mehr in seiner Heimat-Gegend.

## Bett, Nacht und die Wiese

- **Die Wiese wächst:** Jedes Schlafen ist ein neuer Tag. Mit jedem Tag blühen mehr Blumen auf der Lichtung, und Pilze sprießen. So sieht dein Kind, dass Zeit vergeht.
- **Wiese ums Bett:** offen, ohne Zaun, mit Futtertrog (Heu und Möhren) und Wassertrog. Hier wohnen die gefundenen Tiere.
- **Bett:** Ins Bett laufen → die Figur legt sich hin (direkt nach dem Aufwachen noch nicht, damit sie nicht aus Versehen wieder einschläft), der Himmel wird dunkel, Sterne gehen auf, eine leise Melodie spielt, es wird gespeichert.
- **Aufwachen:** Nach dem Einschlafen reagiert das Spiel einige Sekunden nicht auf Tasten, damit wildes Drücken die Runde nicht sofort weiterführt. Danach bringt ein Tastendruck den Morgen.
- **Start einer Runde:** Die Figur schläft im Bett, ein Tastendruck weckt sie. Dieser erste Druck schaltet auch den Ton frei (Autoplay-Regeln).

## Geschichten

- Pro Gegend eine kurze Geschichte zum Vorlesen. Sie erscheint, wenn die Gegend zum ersten Mal betreten wird, und bleibt im Menü abrufbar.
- Entwürfe schreibt Claude, der Vater passt sie an.
- Kommen erst in Stufe 3; das MVP hat keine Texte.

## Welten und Menü

Eine **Welt** besteht aus Seed, Weltname, Figurenname und Fortschritt. Es kann mehrere Welten geben.

**Menü** über ein Zahnrad oben in der Ecke, nur per Maus. Das Spiel pausiert, solange es offen ist.

| Punkt | Wirkung | MVP |
| --- | --- | --- |
| Welt wählen | Kacheln mit Welt- und Figurennamen | ja |
| Neue Welt | mit zufälligem Seed | ja |
| Umbenennen | Weltname und Figurenname | ja |
| Welt-Code kopieren | nur der Seed: dieselbe Landschaft, Fortschritt von vorn. Verschicken ist nicht Teil der Umsetzung. | ja |
| Ton, Vollbild | an/aus | ja |
| Welt aus Code anlegen | Seed eingeben | später |
| Spielstand sichern / laden | Fortschritt als Datei (JSON), Schutz gegen gelöschte Browserdaten | später |
| Löschen | mit Rückfrage im Menü (zweiter Klick) | ja |
| Mini-Vorschau der Welt | auf der Kachel | später |

## Müde werden (Medienzeit)

Die S2k-Leitlinie der Kinder- und Jugendärzte rät für 3 bis 6 Jahre zu „höchstens 30 Minuten an einzelnen Tagen, und nicht ohne Anwesenheit der Eltern“ (unter 3 Jahren gar keine Bildschirmmedien). Das Spiel hilft beim Aufhören, ohne etwas wegzunehmen:

- Nach **15 und 20 Minuten** setzt sich die Figur kurz hin, gähnt, und eine Sprechblase sagt „Uaah … ich werde langsam müde.“ Bilder (Mond, Zzz) versteht das Kind selbst, den Satz lesen die Eltern vor.
- Ab 20 Minuten wird das Licht langsam golden wie am Abend.
- Nach **25 Minuten** sagt die Figur: „Ich bin müde. Bringst du mich ins Bett?“, danach alle paar Minuten wieder. Das Gute-Nacht-Bild am Bett ist das Ritual zum Aufhören.
- Gesperrt wird nichts. Wann Schluss ist, entscheiden die Eltern.
- Ein **Hinweis für Eltern** mit den Empfehlungen und Quellen erscheint beim ersten Öffnen und ist im Menü und über die Bett-Sprechblase wieder zu öffnen.

Später (Mitwachsen): Zeiten im Menü einstellbar, wenn das Kind älter wird.

## Speichern

- **localStorage**, alle Schlüssel mit Präfix `larmic.games.`: ein Index der Welten und je Welt ein eigener Schlüssel, damit eine kaputte Welt nicht alle anderen mitreißt.
- **Format je Welt:** `{ v, game: 'mitwachsen', age, seed, worldName, figureName, openGates[], metAnimals[], homeAnimals[], position, visits }`. `age` ist die Altersstufe der Welt. Das Versionsfeld `v` hat eine getestete `migrate()`.
- **Zeitpunkte:** sofort bei jedem wichtigen Ereignis (Tier gefunden, Tor offen, Tier im Garten, schlafen, Welt gewechselt), zusätzlich alle 10 Sekunden die Position und beim Verlassen der Seite (`pagehide`, `visibilitychange`).
- Alle Zugriffe in `try/catch`. Speichert der Browser nicht (privates Fenster), läuft das Spiel trotzdem.
- Schlüssel und `game` bleiben auch bei einer Umbenennung der Reihe gleich oder werden in `migrate()` übernommen.

## Ton

Alles per WebAudio erzeugt, keine Audiodateien. Kurz, warm, leise, nie schrill: Schritt, Wand („boing“), jedes Tier ein eigener Ton, Freund-Melodie, Tor geht auf, Schlaflied. Lautstärke und Zahl gleichzeitiger Stimmen sind begrenzt.

## Bewegung reduziert

Bei `prefers-reduced-motion`: Die Kamera springt feldweise mit, ohne Nachgleiten. Brücke und Tor stehen sofort offen. Nacht und Morgen kommen ohne Überblendung. An der Wand gibt es nur den Ton, kein Wackeln. Keine Partikel, Herzen stehen still. Töne und Wirkungen bleiben.

## Einbau in die Homepage

Seiten und Navigation (ob der Einstieg auf der Insel sichtbar ist, ist noch offen):

- **`/spiele/`** als Seite mit Insel (`IslandPage.astro`, `rest="spiele"`): Einleitung für Eltern aus dem README, die Reihe als Kisten (eine pro Jahr), ein Standbild und ein Link zum Spiel. Mitziehen: `ROUTES` und `RestId` in `island-layout.ts`, Sprechblasen in `site.ts`, `docs/specs/insel.md`, die Tests der Insel, die Tabelle in `docs/design-system.md` und die schmale Ansicht.
- **`/spiele/mitwachsen/`** als Seite ohne Insel wie Impressum und 404, mit schlankem Layout. Das Spiel steht für sich: kein Zurück-Button, der Weg zur Homepage liegt im Menü für Eltern. Keine Text-Navigation. Die Liste der Seiten ohne Insel in `CLAUDE.md` wird um die Spielseite ergänzt.

Fest:

- **View Transitions:** Die Spielseite wird ohne View Transition geladen (`data-astro-reload` an den Links hin und weg, oder das Spiel-Layout ohne `ClientRouter`). Tastatur-Listener greifen nur, solange die Spiel-Komponente im DOM und die Seite sichtbar ist. In `disconnectedCallback` werden Takt, Speichern und AudioContext gestoppt.
- **Ohne JavaScript:** Standbild und kurzer Text für Eltern.
- **Keine externen Ressourcen:** Töne per WebAudio, Schriften lokal, Kopieren über die Clipboard-API.
- **Datenschutz:** Spielstände liegen nur im localStorage dieses Browsers und werden nicht übertragen. Ein Absatz in der Datenschutzerklärung; nach unserem Verständnis braucht es dafür keinen Einwilligungs-Banner (vor Veröffentlichung prüfen).
- **Name vor Stufe 2,5 festlegen.** Wird danach umbenannt, kommt die alte Adresse in die Redirects in `astro.config.mjs`.

### Aufbau im Code

Wie bei der Insel: reine, getestete Logik getrennt von der Komponente, die zeichnet und Eingaben liest.

| Ort | Inhalt |
| --- | --- |
| `src/lib/games/` | Generischer Code ohne Node: Seed-Zufall, Rauschen, Stücke, Projektion von vorn. Bekommt Gegenden als Parameter und kennt keine Tiere. |
| `src/data/games/mitwachsen.ts` | Gegenden, Tiere mit Ton, Tore, Lage ums Zuhause. Importiert nur aus `src/lib/games/` und `textures.ts`. |
| `src/scripts/games/mitwachsen-state.ts` | Reine Zustandsmaschine mit Tests, nach dem Muster von `island-state.ts` |
| `src/scripts/games/mitwachsen-save.ts` | Speichern und `migrate()` mit Tests |
| `src/scripts/games/larmic-mitwachsen.ts` | Web Component: Canvas, Eingabe, WebAudio |

**Architekturregel (vom Vater freigegeben):** Browser-Code darf aus `src/lib` bisher nur `head.ts` nutzen. Künftig zusätzlich `textures.ts` (reine Daten) und `src/lib/games/**`. `cube.ts`, `render.ts` und `world.ts` bleiben Build-Code: Sie gehören zur schrägen Ansicht und ziehen Node-Code nach sich. Neue Regel: `src/data/games/**` darf nur browser-taugliche Module aus `src/lib` importieren.

## Stufen

1. **Konzept** (dieses Dokument).
2. **MVP ohne Texte**, direkt im Repo unter `/spiele/mitwachsen/`, über alle Gates und mit Deploy. Bis Stufe 2,5 nur über die direkte Adresse erreichbar.
   - Enthalten: Ansicht von vorn mit mitlaufender Kamera, endlose Welt aus dem Seed, Zuhause mit Bett, Nacht und Garten, Heimweg-Pfeil, Klettern, Tiere treffen und folgen lassen. Gegenden: Zuhause, Blumenwiese hinter dem Gartentor, Teich hinter der Brücke, jeweils mit Bildtafel und Tor-Regel. Welten-Menü (MVP-Punkte), Speichern.
   - Nicht enthalten: Wald, Strand, Geschichten, Tor-Texte, Spielstand-Datei, Welt aus Code.
   - Dazu `docs/specs/mitwachsen.md` mit Ereignissen (`move`, `action`, `tick`, `sleep`, `wake`), Regeln und Invarianten. Jede Regel hat einen Test, z. B.: gleicher Seed ergibt gleiche Stücke, ein Tor öffnet genau dann, wenn alle Tiere seiner Gegend gefunden sind, jede Gegend ist vom Zuhause erreichbar, die Figur kann nicht eingeklemmt werden.
2,5. **MVP in die Homepage einbauen:** Einstieg über die Insel, Fallback ohne JavaScript, Datenschutz-Absatz.
3. **Geschichten** schreiben und nach und nach einbauen, dazu Tor-Texte und weitere Gegenden (Wald, Strand).

Gespielt wird direkt auf der Homepage: Sobald eine Stufe spielbar ist, spielt der Vater sie mit seinem Sohn.

## Ideen für später

Nur gesammelt, noch nicht ausgeplant.

- **Welten hinter den Toren:** Alle acht sind oben unter „Die Welten“ beschrieben. Weitere Ideen: Blumenland, Herbstwald, Strand mit Gezeiten.
- **Tiere befreien:** Später sollen die Tiere nicht nur entdeckt, sondern befreit werden. Daran hängt auch, wie sich die großen Tore öffnen. Die Geschichte dazu fehlt noch: Wovon werden die Tiere befreit, und warum? (Für ein kleines Kind freundlich, ohne Bösewicht, der Angst macht.)
- **Portale:** Umgesetzt für die großen Tore (siehe Spec). Noch offen: Der Heimweg-Pfeil zeigt auf das Portal, wenn der Weg darüber kürzer ist.
- **Gemeinsame Welt:** Für ein höheres Alter: Man schickt anderen einen Link und spielt zu zweit in derselben Welt, z. B. Elternteil und Kind oder Kind und Freund. Braucht mehr als GitHub Pages (Verbindung zwischen zwei Browsern oder ein kleiner Dienst) und eine eigene Datenschutzprüfung.
- **Geschichtenerzähler:** Der Vater spricht die Geschichten selbst ein, das Spiel kann sie vorspielen. Die Aufnahmen lägen als Audiodateien auf der Seite (keine externen Ressourcen). Ob das umgesetzt wird, ist offen.

## Offen

- Einstieg auf der Insel: sichtbar als „Spiele“ oder eher versteckt? Soll die Spielseite von Suchmaschinen ausgeschlossen werden (`noindex`, dann auch aus der Sitemap filtern)?
- Werden die Berge später eine eigene Gegend?
- Wie viele Tiere laufen in der berechneten Landschaft?
- Aussehen der Figur (Haar- und Pullifarbe).
