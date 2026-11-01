// PNG-Icons: die alten Adressen favicon-16x16.png und favicon-32x32.png sowie das apple-touch-icon (180 × 180, mit Himmel als Hintergrund).
import { iconPng } from '../lib/voxel/icon';

const ICONS: Record<string, { size: number; background?: string }> = {
  'favicon-16x16': { size: 16 },
  'favicon-32x32': { size: 32 },
  'apple-touch-icon': { size: 180, background: '#8dd0ee' },
};

export function getStaticPaths() {
  return Object.keys(ICONS).map((icon) => ({ params: { icon } }));
}

export async function GET({ params }: { params: { icon: string } }) {
  const { size, background } = ICONS[params.icon];
  return new Response(new Uint8Array(await iconPng(size, background)), { headers: { 'Content-Type': 'image/png' } });
}
