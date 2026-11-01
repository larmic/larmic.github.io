// Der Kopf der Figur als drehbarer Würfel. Läuft beim Build (Startbild) und im Browser (Blick zum Cursor).
// Projektion der Figur: X = (x − y)·C, Y = (x + y)·C/2 − z·V. Kopf-Quader: x 0…10, y −0,5…8,5, z 13…22, Gesicht auf +y.
// Jede Seite ist ein Pixel-Raster, das per Matrix auf die gedrehte, projizierte Fläche gelegt wird.

export const C = 2.0;
export const V = 2.236;

type V3 = [number, number, number];
export type HeadFace = {
  id: 'top' | 'front' | 'right' | 'back' | 'left';
  o: V3;
  u: V3;
  v: V3;
  n: V3;
  cols: number;
  rows: number;
};

// o = Ecke oben links der Textur, u = eine Spalte weiter, v = eine Zeile weiter, n = Außennormale
export const HEAD_FACES: HeadFace[] = [
  { id: 'top', o: [0, -0.5, 22], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], cols: 10, rows: 9 },
  { id: 'front', o: [0, 8.5, 22], u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0], cols: 10, rows: 9 },
  { id: 'right', o: [10, 8.5, 22], u: [0, -1, 0], v: [0, 0, -1], n: [1, 0, 0], cols: 9, rows: 9 },
  { id: 'back', o: [10, -0.5, 22], u: [-1, 0, 0], v: [0, 0, -1], n: [0, -1, 0], cols: 10, rows: 9 },
  { id: 'left', o: [0, -0.5, 22], u: [0, 1, 0], v: [0, 0, -1], n: [-1, 0, 0], cols: 9, rows: 9 },
];

const PIVOT: V3 = [5, 4, 13]; // Hals: Mitte des Kopfes, auf Höhe der Schultern
const VIEW: V3 = [1, 1, C / V]; // zeigt zum Betrachter: Flächen mit Normale in diese Richtung sind sichtbar

export type FaceView = { matrix: [number, number, number, number, number, number] | null; shade: number };

/**
 * Lage aller Kopfseiten für Drehung `yaw` (Grad, um die Senkrechte; positiv = Gesicht nach links)
 * und Nicken `pitch` (Grad; positiv = Blick nach unten). `matrix` ist null für abgewandte Seiten.
 * `shade`: Deckkraft der Schattierung – Oberseite weiß, Seiten schwarz, je nach Richtung zum Licht.
 */
export function headView(yaw: number, pitch: number): FaceView[] {
  const ty = (yaw * Math.PI) / 180;
  const tp = (pitch * Math.PI) / 180;
  const [cy, sy, cp, sp] = [Math.cos(ty), Math.sin(ty), Math.cos(tp), Math.sin(tp)];
  // erst nicken (um die Querachse), dann drehen (um die Senkrechte)
  const dir = ([x, y, z]: V3): V3 => {
    const y1 = y * cp + z * sp;
    const z1 = -y * sp + z * cp;
    return [x * cy - y1 * sy, x * sy + y1 * cy, z1];
  };
  const point = (p: V3): V3 => {
    const d = dir([p[0] - PIVOT[0], p[1] - PIVOT[1], p[2] - PIVOT[2]]);
    return [d[0] + PIVOT[0], d[1] + PIVOT[1], d[2] + PIVOT[2]];
  };
  const proj = ([x, y, z]: V3): [number, number] => [(x - y) * C, ((x + y) * C) / 2 - z * V];
  return HEAD_FACES.map((fc) => {
    const n = dir(fc.n);
    const visible = n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2] > 1e-6;
    const [ux, uy] = proj(dir(fc.u));
    const [vx, vy] = proj(dir(fc.v));
    const [ex, ey] = proj(point(fc.o));
    // Licht von links: Seite nach +y (zum Betrachter links) hell, nach +x dunkler
    const angle = (Math.atan2(n[1], n[0]) * 180) / Math.PI;
    const shade = fc.id === 'top' ? 0.06 : 0.22 - 0.17 * Math.min(1, Math.max(0, angle / 90));
    return { matrix: visible ? [ux, uy, vx, vy, ex, ey] : null, shade };
  });
}
