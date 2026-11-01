// Das Seiten-Icon: ein Grasblock. Als SVG (favicon.svg) und gerastert für favicon.ico, PNG-Icons und apple-touch-icon.
import sharp from 'sharp';
import { face } from './render';
import { GRASS_SIDE, GRASS_TOP, PAL_GRASS } from './textures';

export function iconSvg(size?: number): string {
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 80 84.8">` +
    face([5, 2.5, -5, 2.5, 40, 0], GRASS_TOP, PAL_GRASS, ['#ffffff', 0.05]) +
    face([5, 2.5, 0, 5.6, 0, 20], GRASS_SIDE, PAL_GRASS, ['#000', 0.08]) +
    face([5, -2.5, 0, 5.6, 40, 40], GRASS_SIDE, PAL_GRASS, ['#000', 0.26]) +
    '</svg>'
  );
}

/** Quadratisches PNG; `background` z. B. für das apple-touch-icon, das keine Transparenz mag. */
export function iconPng(size: number, background?: string): Promise<Buffer> {
  const img = sharp(Buffer.from(iconSvg(size)));
  return (background ? img.flatten({ background }) : img).png().toBuffer();
}

/** favicon.ico mit eingebettetem 32×32-PNG (ICO-Container: 6 Byte Kopf, 16 Byte Verzeichniseintrag, Bilddaten). */
export async function iconIco(): Promise<Buffer> {
  const png = await iconPng(32);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserviert
  head.writeUInt16LE(1, 2); // Typ: Icon
  head.writeUInt16LE(1, 4); // ein Bild
  head.writeUInt8(32, 6); // Breite
  head.writeUInt8(32, 7); // Höhe
  head.writeUInt8(0, 8); // keine Farbpalette
  head.writeUInt8(0, 9); // reserviert
  head.writeUInt16LE(1, 10); // Farbebenen
  head.writeUInt16LE(32, 12); // Bit pro Pixel
  head.writeUInt32LE(png.length, 14); // Größe der Bilddaten
  head.writeUInt32LE(22, 18); // Beginn der Bilddaten
  return Buffer.concat([head, png]);
}
