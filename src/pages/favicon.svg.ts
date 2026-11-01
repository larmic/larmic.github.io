// Favicon: ein Grasblock, beim Build erzeugt.
import { face } from '../lib/voxel/render';
import { GRASS_SIDE, GRASS_TOP, PAL_GRASS } from '../lib/voxel/textures';

export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 84.8">`
    + face([5, 2.5, -5, 2.5, 40, 0], GRASS_TOP, PAL_GRASS, ['#ffffff', 0.05])
    + face([5, 2.5, 0, 5.6, 0, 20], GRASS_SIDE, PAL_GRASS, ['#000', 0.08])
    + face([5, -2.5, 0, 5.6, 40, 40], GRASS_SIDE, PAL_GRASS, ['#000', 0.26])
    + '</svg>';
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
}
