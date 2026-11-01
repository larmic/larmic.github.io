// Alte Bild-Adressen der Hugo-Seite (/workshop/<name>.png) bleiben erreichbar: PNG aus dem WebP-Original,
// verkleinert und mit Farbpalette (die alten PNGs hatten zusammen 22 MB).
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Vom Projektordner aus: import.meta.url zeigt beim Build auf den gebündelten Code in dist/
const DIR = resolve('src/assets/workshops');

export function getStaticPaths() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => ({ params: { name: f.replace(/\.webp$/, '') } }));
}

export async function GET({ params }: { params: { name: string } }) {
  const png = await sharp(resolve(DIR, `${params.name}.webp`))
    .resize({ width: 1200, withoutEnlargement: true })
    .png({ palette: true })
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
