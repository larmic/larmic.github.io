// Geometrie eines Voxel-Würfels in 2:1-Dimetrie – alle anderen Stellen rechnen mit diesen Werten.
// Raster: i nach rechts unten, j nach links unten, k nach oben. Ein Würfel ist 80 breit und 84,8 hoch:
// oben eine Raute (80 × 40), darunter die beiden sichtbaren Seiten (je 44,8 hoch). Ein Feld weiter in i oder j
// liegt 40 seitlich und 20 tiefer, eine Ebene höher (k + 1) liegt 44,8 höher.

export type Matrix = [number, number, number, number, number, number];

export const CUBE_W = 80;
export const CUBE_H = 84.8;
export const HALF_W = CUBE_W / 2; // 40
export const STEP_Y = 20; // halbe Rautenhöhe
export const LEVEL = CUBE_H - 2 * STEP_Y; // 44,8: Höhe einer Seite = eine Ebene
export const CUBE_VIEWBOX = `0 0 ${CUBE_W} ${CUBE_H}`;

/** Linke obere Ecke der Bounding-Box des Würfels auf Feld (i, j, k) */
export const pos = (i: number, j: number, k: number): [number, number] => [
  (i - j) * HALF_W,
  (i + j) * STEP_Y - k * LEVEL,
];

/** Mitte der Oberseite des Würfels auf Feld (i, j, k): Dort steht die Figur */
export const footpt = (i: number, j: number, k: number): [number, number] => {
  const [x, y] = pos(i, j, k);
  return [x + HALF_W, y + STEP_Y];
};

// Matrizen, die eine 8×8-Textur auf die drei sichtbaren Flächen legen (ein Texel = 1/8 Kante)
const TEXELS = 8;
export const FACE_TOP: Matrix = [HALF_W / TEXELS, STEP_Y / TEXELS, -HALF_W / TEXELS, STEP_Y / TEXELS, HALF_W, 0];
export const FACE_LEFT: Matrix = [HALF_W / TEXELS, STEP_Y / TEXELS, 0, LEVEL / TEXELS, 0, STEP_Y];
export const FACE_RIGHT: Matrix = [HALF_W / TEXELS, -STEP_Y / TEXELS, 0, LEVEL / TEXELS, HALF_W, 2 * STEP_Y];

/** Umriss des Würfels für den Auswahlrahmen, 1,5 nach innen versetzt */
export const CUBE_OUTLINE = '40,1.5 78.5,20.7 78.5,64.4 40,83.4 1.5,64.4 1.5,20.7';
