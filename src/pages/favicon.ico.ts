// favicon.ico für Browser und Crawler, die danach fragen (gab es schon auf der alten Seite).
import { iconIco } from '../lib/voxel/icon';

export async function GET() {
  return new Response(new Uint8Array(await iconIco()), { headers: { 'Content-Type': 'image/x-icon' } });
}
