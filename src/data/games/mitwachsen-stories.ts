// Geschichten von Mitwachsen: Klangsteine am Bett und vor jedem großen Tor. Läuft die Figur hinein, erklingt die
// Melodie des Ortes, später danach die eingesprochene Geschichte. Die Texte stehen auch in docs/games/mitwachsen.md
// (Abschnitt „Klangsteine und Geschichten“); ein Test hält beide gleich.
// Aufnahmen: public/games/mitwachsen/stimme/<id>.m4a ablegen und hier bei `voice` eintragen (ein Test prüft die Datei).

import type { GateId, Point } from './mitwachsen';

export type StoryId = 'bett' | GateId;

/** Melodie: Töne [Hz, Länge in s, Lautstärke?] nacheinander, alle aus der Pentatonik C–D–E–G–A */
export type Melody = {
  wave: OscillatorType;
  gap: number; // Pause zwischen zwei Tönen (s)
  notes: readonly (readonly [number, number, number?])[];
};

export type Story = {
  title: string;
  text: string; // zum Einsprechen (und zum Vorlesen, solange es keine Aufnahme gibt)
  melody: Melody;
  voice?: string; // Adresse der Aufnahme, sobald es sie gibt
};

/** Klangstein am Bett: links vorn, gleich außerhalb des freien Platzes ums Bett (HOME.clear) */
export const BED_STONE: Point = [-3, 1];

// Töne der Pentatonik
const C3 = 130.81,
  G3 = 196,
  A3 = 220,
  C4 = 261.63,
  D4 = 293.66,
  E4 = 329.63,
  G4 = 392,
  A4 = 440,
  C5 = 523.25,
  D5 = 587.33,
  E5 = 659.25,
  G5 = 783.99,
  A5 = 880,
  C6 = 1046.5,
  E6 = 1318.51;

export const STORIES: Record<StoryId, Story> = {
  bett: {
    title: 'Am Bett',
    text: 'Guten Morgen! Du bist auf der Lichtung aufgewacht, und da steht dein Bett. Gestern haben die Tiere Verstecken gespielt. Dabei sind sie so weit weggelaufen, dass sie den Weg nach Hause nicht mehr finden. Jetzt sitzen sie irgendwo und warten, dass jemand kommt. Wenn du eins siehst, lauf einfach zu ihm hin. Es freut sich so sehr, dass es mit dir mitkommt. Und hier bei deinem Bett gibt es Futter und frisches Wasser für alle.',
    // Schlaflied: langsam und weich
    melody: {
      wave: 'sine',
      gap: 0.06,
      notes: [
        [G4, 0.42],
        [E4, 0.42],
        [G4, 0.42],
        [A4, 0.6],
        [G4, 0.42],
        [E4, 0.42],
        [D4, 0.42],
        [C4, 0.9],
      ],
    },
  },
  eis: {
    title: 'Tor zur Eiswelt',
    text: 'Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Dort wohnt ein kleiner Pinguin, der den ganzen Tag auf dem Bauch übers Eis rutscht. Manchmal rutscht er bis ans Tor und schaut zu dir herüber. Noch ist das Tor zu. Aber wenn du ein bisschen größer bist, geht es auf, und dann rutscht ihr zusammen.',
    // hell und klirrend wie Eiszapfen
    melody: {
      wave: 'triangle',
      gap: 0.04,
      notes: [
        [C6, 0.14],
        [A5, 0.14],
        [G5, 0.14],
        [E5, 0.14],
        [G5, 0.14],
        [A5, 0.14],
        [C6, 0.2],
        [E6, 0.5, 0.06],
      ],
    },
  },
  sand: {
    title: 'Tor zur Sandwelt',
    text: 'Hinter diesem Tor liegt Sand, so weit du gucken kannst, ganz warm von der Sonne. Dort wohnt ein Kamel, das schon lange unterwegs ist und nicht mehr weiß, wo die Wasserstelle war. Hörst du, wie der Wind über die Sandhügel pfeift? Das Tor bleibt noch ein Weilchen zu. Irgendwann machen wir es auf und helfen dem Kamel beim Suchen.',
    // gemächlich schaukelnd wie ein Kamel
    melody: {
      wave: 'triangle',
      gap: 0.08,
      notes: [
        [D4, 0.3],
        [E4, 0.3],
        [G4, 0.45],
        [E4, 0.3],
        [D4, 0.3],
        [C4, 0.45],
        [D4, 0.3],
        [E4, 0.7],
      ],
    },
  },
  wasser: {
    title: 'Tor zur Wasserwelt',
    text: 'Hinter diesem Tor ist überall Wasser, mit kleinen Inseln dazwischen. Die Fische spielen dort gern Fangen, und eine Robbe klatscht dazu mit den Flossen. Wenn du ganz leise bist, kannst du die Wellen hören. Das Tor ist noch zu, aber die Robbe wartet schon auf dich.',
    // auf und ab wie Wellen
    melody: {
      wave: 'sine',
      gap: 0.02,
      notes: [
        [C5, 0.2],
        [E5, 0.2],
        [G5, 0.2],
        [E5, 0.2],
        [C5, 0.2],
        [E5, 0.2],
        [G5, 0.2],
        [A5, 0.3],
        [G5, 0.6],
      ],
    },
  },
  lava: {
    title: 'Tor zu den Lavabergen',
    text: 'Hinter diesem Tor sind hohe Berge, und ganz oben dampft es ein bisschen, so wie bei einem Kochtopf. Das sieht wilder aus, als es ist. Dort leben Salamander mit leuchtend orangen Punkten, die sich gern auf die warmen Steine legen und blinzeln. Wenn das Tor einmal aufgeht, bleiben wir auf den Wegen, dann kann gar nichts passieren.',
    // tief und gemütlich brummend
    melody: {
      wave: 'triangle',
      gap: 0.06,
      notes: [
        [C3, 0.32, 0.2],
        [G3, 0.32, 0.2],
        [C4, 0.4],
        [G3, 0.32, 0.2],
        [A3, 0.32, 0.2],
        [G3, 0.32, 0.2],
        [C3, 0.8, 0.2],
      ],
    },
  },
  hoehle: {
    title: 'Tor zur Höhlenwelt',
    text: 'Hinter diesem Tor geht es unter die Erde, in eine große Höhle. Dunkel ist es dort aber nicht, denn an den Wänden wachsen Kristalle, die in allen Farben glitzern. Eine Fledermaus wohnt da. Sie schläft am Tag mit dem Kopf nach unten und wacht erst auf, wenn du ins Bett gehst. Vielleicht weckst du sie später einmal.',
    // jeder Ton kommt leise als Echo zurück
    melody: {
      wave: 'sine',
      gap: 0.05,
      notes: [
        [A4, 0.3],
        [A4, 0.3, 0.04],
        [E4, 0.3],
        [E4, 0.3, 0.04],
        [C5, 0.3],
        [C5, 0.3, 0.04],
        [A4, 0.6],
        [A4, 0.6, 0.03],
      ],
    },
  },
  wald: {
    title: 'Tor zum Wald',
    text: 'Hinter diesem Tor stehen so viele Bäume, dass die Sonne nur in kleinen Flecken bis auf den Boden kommt. Dort wohnen ein Reh und ein Specht, der den ganzen Tag an die Bäume klopft: tock, tock, tock. Das Tor ist noch zu. Aber der Specht klopft schon mal an, damit es bald aufgeht.',
    // dreimal klopft der Specht, dann singt ein Vogel
    melody: {
      wave: 'triangle',
      gap: 0.1,
      notes: [
        [G3, 0.06, 0.2],
        [G3, 0.06, 0.2],
        [G3, 0.06, 0.2],
        [E5, 0.18],
        [G5, 0.18],
        [A5, 0.18],
        [G5, 0.18],
        [E5, 0.5],
      ],
    },
  },
  wolken: {
    title: 'Tor zur Wolkenwelt',
    text: 'Hinter diesem Tor geht es hinauf bis zu den Wolken. Die sind dort so dick und weich, dass man darauf hüpfen kann wie auf einem Trampolin. Ein kleiner Drache fliegt da oben herum. Er ist ganz lieb und hat vor nichts Angst, nur vor Gewitter. Wenn du größer bist, darfst du mit ihm fliegen.',
    // langsam nach oben schwebend
    melody: {
      wave: 'sine',
      gap: 0.04,
      notes: [
        [C5, 0.4],
        [D5, 0.4],
        [E5, 0.4],
        [G5, 0.4],
        [A5, 0.4],
        [C6, 0.9],
      ],
    },
  },
  pilze: {
    title: 'Tor zum Pilzwald',
    text: 'Hinter diesem Tor wachsen Pilze, so groß wie der bei deinem Bett, und nachts leuchten sie ein bisschen, blau und lila. Dort wohnen Schnecken, die ihr Haus immer mitnehmen und überhaupt keine Eile haben. Das Tor ist noch zu. Aber die Schnecken sagen, sie warten gern.',
    // hüpfend und verspielt
    melody: {
      wave: 'triangle',
      gap: 0.05,
      notes: [
        [E5, 0.18],
        [C5, 0.18],
        [E5, 0.18],
        [G5, 0.3],
        [E5, 0.18],
        [C5, 0.18],
        [D5, 0.18],
        [G4, 0.5],
      ],
    },
  },
};

/** Wie lange eine Melodie dauert (s) */
export const melodyLength = (m: Melody) => m.notes.reduce((t, [, len]) => t + len + m.gap, 0);
