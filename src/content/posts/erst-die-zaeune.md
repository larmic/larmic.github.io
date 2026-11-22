---
title: "Erst die Zäune, dann der Spielplatz"
teaser: "28 Minuten vom Konzept zum spielbaren Spiel. Aushalten ließ sich das nur, weil die Prüfungen 13 Tage vorher standen."
date: 2026-11-22
series: mitwachsen
part: 1
track: beide
tags: [guards, ki, devops]
pattern:
  title: "Guard vor Feature"
  sentence: "KI-Tempo ist nur dann ein Vorteil, wenn die Prüfungen schon stehen, bevor das Tempo kommt. Und ein Gate, das man nie hat fallen sehen, sollte man als Behauptung behandeln."
confession: "Die Gates entstanden am 1. November für den Relaunch meiner Homepage, vom Spiel war da noch keine Rede. Ich erzähle es, als hätte ich das Spiel schon im Kopf gehabt; dass die Zäune vorher standen, stimmt, ebenso jede Uhrzeit und jede Zahl."
evidence:
  asOf: 2026-11-22
  items:
    - { hash: "e44f8e2", text: "Konzept für das Kinderspiel" }
    - { hash: "43d6fcc", text: "Erste spielbare Fassung" }
    - { hash: "a6fa68a", text: "Korrekturen aus der Durchsicht der ersten Fassung" }
    - { hash: "dadfde2", text: "Unit-Tests mit Vitest als Gate" }
    - { hash: "a0c6c17", text: "ESLint und Prettier als Gates" }
    - { hash: "80ab274", text: "Schichten per dependency-cruiser, Generator entkoppelt" }
    - { hash: "36b47dc", text: "Gültiges HTML und interne Links als Gate" }
    - { hash: "3d20141", text: "Gates dokumentiert, npm run gates" }
    - { hash: "2cf3948", text: "pre-commit-Hook mit den schnellen Gates" }
    - { hash: "59f5dba", text: "Relaunch freigegeben (Merge von Pull Request 5)" }
    - { hash: "e2eff0a", text: "Smoke-Test im Browser als Gate" }
---

Bevor die KI eine einzige Zeile Spielcode für meinen Sohn schreiben durfte, hat sie mir eine knappe Viertelstunde lang Zäune gebaut.

Wozu das gut war, zeigt ein Abend knapp zwei Wochen später. Am 14. November schläft mein Sohn längst, ich sitze am Rechner. Mit KI meine ich ein Sprachmodell, das selbst Dateien schreibt und Befehle ausführt. Um 22:16 Uhr legt die KI das Konzept ab: ein Spiel pro Lebensjahr, gespielt zusammen mit einem Elternteil, angefangen bei drei. Abgelegt wird es als Commit, ein gespeicherter Arbeitsschritt mit Uhrzeit und Notiz.

Um 22:44 Uhr folgt der nächste Commit, und im Browser läuft eine erste spielbare Fassung. 22 Dateien, 3.447 neue Zeilen, darunter vier Dateien nur mit Tests. Dazwischen liegen 28 Minuten.

## Zu schnell zum Mitlesen

Ich lese schnell. 3.447 Zeilen in 28 Minuten lese ich nicht. In der Zeit schaffe ich abends ein Bilderbuch, und auch das nur, wenn es gut läuft.

Wer bei diesem Tempo erst hinterher überlegt, wie er prüft, prüft gar nicht mehr. Aushalten konnte ich das Tempo, weil die Zäune schon standen.

## Das Treppenschutzgitter vom 1. November

Am 1. November, 13 Tage früher, habe ich meine Homepage larmic.de neu aufgesetzt. Bis zum Abend gab es dort genau eine automatische Prüfung, die Typprüfung: Sie sieht nach, ob alle Daten die Form haben, die der Code erwartet. Um 21:45 Uhr kam die erste neue dazu, um 21:56 Uhr die letzte.

Eltern kennen das Prinzip vom Treppenschutzgitter. Man schraubt es an, bevor das Kind krabbelt. Danach hat man keine Hand mehr für den Akkuschrauber frei.

In der Software heißen solche Gitter Guards oder Gates. Das sind automatische Prüfungen, die eine Änderung nur durchlassen, wenn alles stimmt.

## Ein Türsteher mit sieben Punkten

Ein Gate arbeitet wie ein Türsteher, der bei jeder Änderung dieselbe Liste abhakt und nicht verhandelt. Seit jenem Abend stehen sieben Punkte darauf.

Zuerst die Formatierung: Der Code sieht überall gleich aus. Dann Lint, ein Werkzeug, das verdächtige Stellen anstreicht wie eine Rechtschreibprüfung. Danach die Architektur: Ein Werkzeug schaut nach, welche Datei welche andere benutzen darf. Es folgt die Typprüfung. Dann die Unit-Tests, kleine Programme, die einzelne Bausteine nachrechnen. Dann der Build, das Zusammenbauen der Seite. Am Ende ein Blick auf das Ergebnis: gültiges HTML, keine toten Links.

Neu waren an dem Abend fünf dieser Punkte. Die Typprüfung und den Build gab es schon. Der Befehl `npm run gates` arbeitet die Liste in dieser Reihenfolge ab. Seit dem 15. November steht ein achter Punkt darauf, ein Test im echten Browser.

## Ein Zaun zählt erst, wenn er gehalten hat

Besteht eine Prüfung, zeigt sie Grün, sonst Rot. Ein Gate, das nichts prüft, sieht aber genauso grün aus wie eines, das nichts findet. Darum gilt bei mir eine Bedingung: Ein Gate, dessen Regeln für dieses Projekt geschrieben sind, muss einmal Alarm geschlagen haben, bevor ich ihm traue. Am Treppenschutzgitter rüttelt man ja auch, bevor man das Kind loslässt.

Das Verfahren heißt Mutationsprobe. Man baut mit Absicht einen Fehler ein und schaut, ob das Gate anschlägt. Die KI hat das bei drei Gates gemacht. Meine Homepage ist eine Insel aus Blöcken mit Kisten für Workshops und Videos. Für die Tests stellte die KI zwei Kisten auf denselben Platz. Die fertige Seite bekam einen toten Link und falsch verschachteltes HTML. Und in der Architektur griff der Baukasten auf Inhalte der Homepage zu. Für Techniker: Das Werkzeug heißt dependency-cruiser, und das ist die Regel, die den Zugriff verbietet.

```js title=".dependency-cruiser.cjs"
{
  name: 'lib-is-generic',
  severity: 'error',
  comment: 'src/lib ist der generische Unterbau. Inhalte, Avatar & Co. kommen als Parameter, nicht per Import.',
  from: { path: '^src/lib/' },
  to: { path: '^src/(data|components|layouts|pages|scripts)/' },
},
```

Übersetzt heißt das: Der Baukasten in `src/lib` darf nichts über die konkrete Insel wissen. Damit die Regel grün werden konnte, musste die KI vorher den Grafik-Generator umbauen. Laut Commit-Nachricht kamen danach alle 32 erzeugten Dateien bis aufs Byte genauso heraus wie vorher.

Alle drei Gates schlugen an. Für Formatierung und Lint gab es keine solche Probe. Vermerkt sind die Proben nur in den Commit-Nachrichten der KI, nicht als Test im Projekt. Ich habe ihr das geglaubt. Warum mir das inzwischen nicht mehr reicht, ist Thema von Teil 7.

## Die Absprache mit der KI

Getippt hat das alles die KI. Ich habe den Auftrag gegeben und um 22:58 Uhr den Relaunch samt Gates freigegeben.

Zwischen der KI und mir gilt inzwischen eine Absprache. Sie legt nach jedem Schritt selbst einen Commit an, aber nur, wenn die Gates grün sind. Das Veröffentlichen, im Jargon Push, mache ich.

Auf Absprachen allein verlasse ich mich ungern, bei Dreijährigen wie bei Sprachmodellen. Darum gibt es seit 21:59 Uhr einen pre-commit-Hook. Das ist ein kleines Skript, das vor jedem Commit von selbst startet. Es prüft die vier schnellen Punkte Formatierung, Lint, Architektur und Unit-Tests und braucht dafür nur wenige Sekunden. Bei einem Fehler kommt der Commit nicht zustande. Der Rest der Liste ist vor dem Commit nur Anweisung. Erzwungen wird er erst in der Pipeline, dem automatischen Ablauf vor jeder Veröffentlichung.

Einen Notausgang hat der Hook auch. Er steht offen in Zeile 4 des Skripts: `git commit --no-verify`. Eine Tür, die jeder kennt, ist mir lieber als ein Loch im Zaun.

## Zurück zum 14. November

Der Commit von 22:44 Uhr brachte seine Tests gleich mit und dazu neue Architekturregeln für den Spielcode. Der Spielplatz bekam also sofort eigene Zäune. Keine fünf Minuten später folgte der erste Commit mit Korrekturen aus meiner Durchsicht.

Jede Zeile prüfen kann ich bei diesem Tempo nicht mehr. Ich kann prüfen, ob meine Prüfungen taugen. Das geht vorher, in Ruhe.

Gates prüfen, ob etwas richtig gebaut ist. Ob es das Richtige für einen Dreijährigen ist, prüft ein Dreijähriger. Wie das am nächsten Morgen ausging, erzähle ich in Teil 2.

## Lesekarte der Serie

Die Serie hat acht Folgen, jede dauert etwa fünf Minuten. Es gibt zwei Spuren: Eltern lesen die Teile 1, 2, 4, 6 und 8, Techniker 1, 3, 5, 7 und 8. Ein paar Szenen sind verdichtet, die Zahlen nicht.

Was hier nie vorkommt: Name, Foto oder Stimme meines Sohnes. Mit 14 soll er hier nichts Peinliches finden.

Spielen kann man auf [www.mitwachsen-spiele.de](https://www.mitwachsen-spiele.de/).
