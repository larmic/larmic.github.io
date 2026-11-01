// Vorschaubild für LinkedIn & Co. (og:image, 1200 × 630): Himmel, Wolken, die Insel mit ihren vier Blöcken und
// der Figur in der Mitte – dieselbe Szene wie auf der Seite, beim Build mit sharp in ein PNG gerendert.
import sharp from 'sharp';
import { islandScene } from '../data/island';
import { cubeDefs } from '../lib/voxel/world';

const W = 1200;
const H = 630;

export async function GET() {
  const scene = await islandScene();
  const [sx0, sy0, sw, sh] = scene.sceneSvg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const uses = scene.sceneSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const at = (pctX: number, pctY: number) => [sx0 + (pctX / 100) * sw, sy0 + (pctY / 100) * sh];

  // Die vier Bereichs-Blöcke wie auf der Seite (ohne Wippen), Kisten sind im Vorschaubild zu
  const blocks = scene.data.nav
    .filter((n) => !n.parent)
    .map((n) => {
      const [x, y] = at(n.x, n.y);
      return `<use href="#v-${n.sym}" x="${x}" y="${y}" width="80" height="84.8"/>`;
    })
    .join('');

  // Figur auf dem Startfeld in der Inselmitte; Fußpunkt und Größe wie in Island.astro
  const [fx0, fy0, fw, fh] = scene.figureSvg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const figW = (Number(scene.fig.w) / 100) * sw;
  const figH = (figW * fh) / fw;
  const [hx, hy] = at(scene.data.home.x, scene.data.home.y);
  const figure = scene.figureSvg.replace(
    /^<svg[^>]*>/,
    `<svg x="${hx - (Number(scene.fig.tx) / 100) * figW}" y="${hy - (Number(scene.fig.ty) / 100) * figH}" width="${figW}" height="${figH}" viewBox="${fx0} ${fy0} ${fw} ${fh}" overflow="visible">`,
  );

  // Szene rechts mittig, Höhe fast voll
  const size = H - 30;
  const sceneBox = `<svg x="${W - size - 70}" y="15" width="${size}" height="${size}" viewBox="${sx0} ${sy0} ${sw} ${sh}" overflow="visible">${uses}${blocks}${figure}</svg>`;
  const cloud = (x: number, y: number, w: number) =>
    `<g fill="#ffffff" opacity="0.92"><rect x="${x}" y="${y}" width="${w}" height="28"/><rect x="${x + w * 0.2}" y="${y - 22}" width="${w * 0.5}" height="22"/></g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${cubeDefs()}</defs>
<style>.fig-blink { opacity: 0; }</style>
<rect width="${W}" height="${H * 0.36}" fill="#79c7ea"/>
<rect y="${H * 0.36}" width="${W}" height="${H * 0.32}" fill="#8dd0ee"/>
<rect y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="#a6dbf2"/>
${cloud(60, 120, 180)}${cloud(330, 70, 220)}${cloud(150, 430, 140)}${cloud(1080, 520, 110)}
${sceneBox}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
