// Favicon: ein Grasblock, beim Build erzeugt.
import { iconSvg } from '../lib/voxel/icon';

export function GET() {
  return new Response(iconSvg(), { headers: { 'Content-Type': 'image/svg+xml' } });
}
