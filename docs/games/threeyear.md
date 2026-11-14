# Konzept: threeyear (Spiel für 3 Jahre)

Das Kind läuft mit einer eigenen Figur durch eine endlose Voxel-Welt, trifft Tiere, die singen, führt sie nach Hause in ein Gehege und öffnet so nach und nach neue Gegenden. Zu jeder Gegend gibt es eine Geschichte, die der Elternteil vorliest. Zum Aufhören legt sich die Figur ins Bett, und es wird Nacht.

Hintergrund und gemeinsame Regeln der Reihe: [README](README.md). Ein früher Prototyp (feste kleine Insel, Tiere treffen) liegt als Artefakt vor und hat gezeigt: Die Pfeiltasten beherrscht das Kind, die schräge Ansicht der Homepage passt aber nicht dazu (→ läuft dort nach rechts unten).

## Grundsätze

1. **Kind steuert, Elternteil sitzt daneben.** Das Kind sieht keinen Text. Texte (Geschichten, Hinweise an Toren) sind zum Vorlesen.
2. **Nichts geht schief.** Kein Fehlerton, kein Herunterfallen, kein Verlieren. Wände antworten mit einem Wackeln und „boing“.
3. **Jede Taste tut etwas Freundliches.** Auch wildes Drücken ist gut.
4. **Ritual zum Anfangen und Aufhören.** Die Figur wacht im Bett auf und legt sich dort wieder schlafen. Wann Schluss ist, entscheidet der Elternteil; gespeichert wird ohnehin laufend.

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Pfeiltasten | Figur geht ein Feld in Bildschirmrichtung (→ nach rechts, ↑ nach oben). Gedrückt halten: höchstens etwa 4 Felder pro Sekunde, Autorepeat des Systems wird ignoriert. |
| Leertaste, Enter, jede andere Taste | Aktion, je nach Ort (siehe unten). Modifikatoren, Tab, Esc und F-Tasten bleiben frei. |
| Maus | Nur für Menü (Zahnrad) und Zurück-Button. Das Kind spielt mit der Tastatur und öffnet sie nicht aus Versehen. |

**Aktion je nach Ort:** neben einem Tier → es singt (siehe Tiere). Am Bett → schlafen. Sonst → die Figur ruft, folgende Tiere rücken auf.

Ohne Tastatur (Handy, Tablet) zeigt die Seite einen Hinweis für Eltern, dass das Spiel Pfeiltasten braucht. Große Pfeilfelder am Bildrand wären später möglich, gehören aber nicht ins MVP.

## Ansicht und Kamera

- **Ansicht von vorn:** Blöcke zeigen Ober- und Vorderseite, die Gitterachsen liegen waagerecht und senkrecht. Texturen wie in `src/lib/voxel/textures.ts`.
- **Die Figur bleibt in der Bildmitte**, die Kamera folgt ihr weich, die Welt läuft darunter durch. Gezeichnet wird nur, was im Bild ist.
- **Heimweg-Pfeil:** Liegt das Zuhause außerhalb des Bildes, zeigt ein Pfeil am Bildschirmrand dorthin.
- **Farben:** Farben der Spielwelt (Tiere, Herzen, Nacht, Sterne) sind Spielgrafik wie die Texturen und stehen in einer Spiel-Palette, nicht in `tokens.css`. Herzen sind rosa oder rot, nicht Gold. Tafeln sind aus Holz mit Pixel-Rahmen in Tinte, Umrisse fehlender Tiere in Tinte. Oberfläche (Zahnrad, Menü, Buttons) nutzt die Tokens und `.pxbtn`; Gold bleibt die Farbe für klickbare Aktionen.

## Welt

- **Endlos**, berechnet aus einem **Seed**. Derselbe Seed ergibt immer dieselbe Welt. Gespeichert werden nur Seed und Fortschritt, nie die Landschaft.
- Die Welt wird in Stücken (z. B. 16 × 16 Felder) berechnet, sobald die Kamera in ihre Nähe kommt.
- **Gegenden rund ums Zuhause:** Das Zuhause liegt in der Mitte. Die Geschichten-Gegenden öffnen sich nacheinander (Kette über Tore), liegen räumlich aber um das Zuhause herum, damit der Heimweg mit Tieren kurz bleibt.
- **Ränder:** Jede Geschichten-Gegend ist ringsum durch Wasser, Felsen (zwei Stufen hoch) oder Zaun abgeschlossen, hinein kommt man nur durch ihr Tor. Die berechnete Landschaft (Wiesen, Hügel, Bäume, Berge zum Klettern) beginnt außerhalb des Rings der Gegenden und ist vom Zuhause aus über einen offenen Pfad erreichbar. So ist die Welt von Anfang an endlos, und die Tore lassen sich trotzdem nicht umgehen.
- **Höhen:** Eine Stufe hoch oder runter geht automatisch mit einem kleinen Hüpfer. Zwei Stufen sind eine Wand. Herunterfallen gibt es nicht.
- **Wasser** ist nicht begehbar; Brücken führen darüber.

## Gegenden

Von Hand entworfen. Jede hat Landschaft, Tiere, ein Tor und eine Geschichte. Tiere, Reihenfolge und Tore sind festgelegt; die genaue Lage ergibt der Entwurf.

| Gegend | Tiere | Tor in die nächste Gegend |
| --- | --- | --- |
| Zuhause (Start, mit Bett und Gehege) | Hase, Igel | Gartentor zur Blumenwiese |
| Blumenwiese | Schaf, Kuh, Biene | Brücke zum Teich |
| Teich | Ente, Frosch, Schildkröte | Waldtor zum Wald |
| Wald | Eichhörnchen, Fuchs, Eule, Reh | Weg zum Strand |
| Strand | Krabbe, Robbe | – |

Neue Gegenden kommen nach und nach hinzu; so wächst die Welt mit. Berge gibt es zunächst in der berechneten Landschaft zum Klettern.

## Tore

1. Ein Tor ist zu, bis das Kind **alle Tiere der Gegend getroffen hat, in der das Tor steht**. Getroffen reicht; ins Gehege bringen muss es sie dafür nicht.
2. Am Tor steht eine **Tafel mit Bildern**: getroffene Tiere in Farbe, fehlende als dunkle Umrisse. So sieht das Kind selbst, wer noch fehlt.
3. Dazu ein **Text zum Vorlesen** („Der Fuchs wartet noch im hohen Gras …“). Kommt erst mit den Geschichten (Stufe 3).
4. Sind alle getroffen, öffnet sich das Tor sichtbar und hörbar (Brücke baut sich Block für Block, Tor schwingt auf). Offene Tore bleiben offen.

## Tiere

1. Jedes Tier hat eine **Heimat-Gegend** und wandert dort langsam umher.
2. Steht die Figur direkt neben einem Tier, **bleibt es stehen** und schaut sie an.
3. **Aktion neben einem Tier:** Es hüpft und **singt seinen eigenen Ton** (alle aus derselben Pentatonik, klingt immer zusammen). Beim ersten Mal gilt es als **getroffen** und bekommt ein Herz. Danach **folgt** es der Figur im Gänsemarsch, bis es im Gehege ist oder die Figur schläft. Über folgenden Tieren schwebt ein kleines Herz.
4. **Hineinlaufen in ein Tier:** Es singt, folgt aber nicht. Läuft die Figur innerhalb kurzer Zeit ein zweites Mal hinein, tauschen beide den Platz. So bleibt die Figur nie eingeklemmt.
5. **Aktion neben einem folgenden Tier:** Es singt noch einmal, sonst ändert sich nichts.
6. **Aktion neben einem Tier im Gehege:** Es singt und hüpft, folgt aber nicht und verlässt das Gehege nie.
7. **Schläft die Figur**, laufen folgende Tiere in ihre Heimat-Gegend zurück.
8. **Tiere der berechneten Landschaft:** Sie zählen für kein Tor, singen aber, folgen und dürfen ins Gehege. Ihre Kennung ergibt sich aus Seed, Stück und Nummer und bleibt dadurch stabil.
9. Positionen werden nicht gespeichert, nur „getroffen“ und „im Gehege“. Ein Tier im Gehege erscheint nicht mehr in seiner Heimat-Gegend.

## Zuhause, Gehege, Nacht

- **Gehege:** Zaun mit einer Öffnung am Zuhause. Figur und folgende Tiere können hindurch. Jedes folgende Tier, das ein Feld im Gehege betritt, löst sich aus der Kette und bleibt. Für Tiere im Gehege ist die Öffnung eine Wand. Gespeichert.
- **Bett:** Aktion am Bett → die Figur legt sich hin, der Himmel wird dunkel, Sterne gehen auf, eine leise Melodie spielt, es wird gespeichert.
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
| Löschen | mit Rückfrage im Menü | später |
| Mini-Vorschau der Welt | auf der Kachel | später |

## Speichern

- **localStorage**, alle Schlüssel mit Präfix `larmic.games.`: ein Index der Welten und je Welt ein eigener Schlüssel, damit eine kaputte Welt nicht alle anderen mitreißt.
- **Format je Welt:** `{ v, game: 'threeyear', seed, worldName, figureName, openGates[], metAnimals[], penAnimals[], position, visits }`. Das Versionsfeld `v` hat eine getestete `migrate()`.
- **Zeitpunkte:** sofort bei jedem wichtigen Ereignis (Tier getroffen, Tor offen, Tier im Gehege, schlafen, Welt gewechselt), zusätzlich alle 10 Sekunden die Position und beim Verlassen der Seite (`pagehide`, `visibilitychange`).
- Alle Zugriffe in `try/catch`. Speichert der Browser nicht (privates Fenster), läuft das Spiel trotzdem.
- Schlüssel und `game` bleiben auch bei einer Umbenennung der Reihe gleich oder werden in `migrate()` übernommen.

## Ton

Alles per WebAudio erzeugt, keine Audiodateien. Kurz, warm, leise, nie schrill: Schritt, Wand („boing“), jedes Tier ein eigener Ton, Freund-Melodie, Tor geht auf, Schlaflied. Lautstärke und Zahl gleichzeitiger Stimmen sind begrenzt.

## Bewegung reduziert

Bei `prefers-reduced-motion`: Die Kamera springt feldweise mit, ohne Nachgleiten. Brücke und Tor stehen sofort offen. Nacht und Morgen kommen ohne Überblendung. An der Wand gibt es nur den Ton, kein Wackeln. Keine Partikel, Herzen stehen still. Töne und Wirkungen bleiben.

## Einbau in die Homepage

Seiten und Navigation (ob der Einstieg auf der Insel sichtbar ist, ist noch offen):

- **`/spiele/`** als Seite mit Insel (`IslandPage.astro`, `rest="spiele"`): Einleitung für Eltern aus dem README, die Reihe als Kisten (eine pro Jahr), ein Standbild und ein Link zum Spiel. Mitziehen: `ROUTES` und `RestId` in `island-layout.ts`, Sprechblasen in `site.ts`, `docs/specs/insel.md`, die Tests der Insel, die Tabelle in `docs/design-system.md` und die schmale Ansicht.
- **`/spiele/threeyear/`** als Seite ohne Insel wie Impressum und 404, mit schlankem Layout. Oben in der Ecke neben dem Zahnrad ein goldener Zurück-Button wie in `SubHero.astro` (Ziel `/spiele/`), nur per Maus. Keine Text-Navigation. Die Liste der Seiten ohne Insel in `CLAUDE.md` wird um die Spielseite ergänzt.

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
| `src/data/games/threeyear.ts` | Gegenden, Tiere mit Ton, Tore, Lage ums Zuhause. Importiert nur aus `src/lib/games/` und `textures.ts`. |
| `src/scripts/games/threeyear-state.ts` | Reine Zustandsmaschine mit Tests, nach dem Muster von `island-state.ts` |
| `src/scripts/games/threeyear-save.ts` | Speichern und `migrate()` mit Tests |
| `src/scripts/games/larmic-threeyear.ts` | Web Component: Canvas, Eingabe, WebAudio |

**Architekturregel (vom Vater freigegeben):** Browser-Code darf aus `src/lib` bisher nur `head.ts` nutzen. Künftig zusätzlich `textures.ts` (reine Daten) und `src/lib/games/**`. `cube.ts`, `render.ts` und `world.ts` bleiben Build-Code: Sie gehören zur schrägen Ansicht und ziehen Node-Code nach sich. Neue Regel: `src/data/games/**` darf nur browser-taugliche Module aus `src/lib` importieren.

## Stufen

1. **Konzept** (dieses Dokument).
2. **MVP ohne Texte**, direkt im Repo unter `/spiele/threeyear/`, über alle Gates und mit Deploy. Bis Stufe 2,5 nur über die direkte Adresse erreichbar.
   - Enthalten: Ansicht von vorn mit mitlaufender Kamera, endlose Welt aus dem Seed, Zuhause mit Bett, Nacht und Gehege, Heimweg-Pfeil, Klettern, Tiere treffen und folgen lassen. Gegenden: Zuhause, Blumenwiese hinter dem Gartentor, Teich hinter der Brücke, jeweils mit Bildtafel und Tor-Regel. Welten-Menü (MVP-Punkte), Speichern.
   - Nicht enthalten: Wald, Strand, Geschichten, Tor-Texte, Spielstand-Datei, Welt aus Code.
   - Dazu `docs/specs/threeyear.md` mit Ereignissen (`move`, `action`, `tick`, `sleep`, `wake`), Regeln und Invarianten. Jede Regel hat einen Test, z. B.: gleicher Seed ergibt gleiche Stücke, ein Tor öffnet genau dann, wenn alle Tiere seiner Gegend getroffen sind, jede Gegend ist vom Zuhause erreichbar, die Figur kann nicht eingeklemmt werden.
2,5. **MVP in die Homepage einbauen:** Einstieg über die Insel, Fallback ohne JavaScript, Datenschutz-Absatz.
3. **Geschichten** schreiben und nach und nach einbauen, dazu Tor-Texte und weitere Gegenden (Wald, Strand).

Gespielt wird direkt auf der Homepage: Sobald eine Stufe spielbar ist, spielt der Vater sie mit seinem Sohn.

## Ideen für später

Nur gesammelt, noch nicht ausgeplant.

- **Höhle** als eigene Gegend.
- **Portale:** In jeder Gegend gibt es ein Portal zu finden, dazu ein passendes Gegenstück im Haus. Der Heimweg-Pfeil zeigt auf das Portal, wenn der Weg darüber kürzer ist.
- **Gemeinsame Welt:** Für ein höheres Alter: Man schickt anderen einen Link und spielt zu zweit in derselben Welt, z. B. Elternteil und Kind oder Kind und Freund. Braucht mehr als GitHub Pages (Verbindung zwischen zwei Browsern oder ein kleiner Dienst) und eine eigene Datenschutzprüfung.
- **Geschichtenerzähler:** Der Vater spricht die Geschichten selbst ein, das Spiel kann sie vorspielen. Die Aufnahmen lägen als Audiodateien auf der Seite (keine externen Ressourcen). Ob das umgesetzt wird, ist offen.

## Offen

- Name der Reihe (siehe [README](README.md)); vor Stufe 2,5 entscheiden.
- Einstieg auf der Insel: sichtbar als „Spiele“ oder eher versteckt? Soll die Spielseite von Suchmaschinen ausgeschlossen werden (`noindex`, dann auch aus der Sitemap filtern)?
- Werden die Berge später eine eigene Gegend?
- Wie viele Tiere laufen in der berechneten Landschaft?
- Aussehen der Figur (Haar- und Pullifarbe).
