// Alte Bild-Adressen der Hugo-Seite (/workshop/<name>.png) bleiben erreichbar: PNG aus dem WebP-Original,
// verkleinert und mit Farbpalette (die alten PNGs hatten zusammen 22 MB).
import { readdirSync } from 'node:fs';
import sharp from 'sharp';

const DIR = new URL('../../../public/workshop/', import.meta.url);

export function getStaticPaths() {
  return readdirSync(DIR).filter((f) => f.endsWith('.webp')).map((f) => ({ params: { name: f.replace(/\.webp$/, '') } }));
}

export async function GET({ params }: { params: { name: string } }) {
  const png = await sharp(new URL(`${params.name}.webp`, DIR).pathname).resize({ width: 1200, withoutEnlargement: true }).png({ palette: true }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
