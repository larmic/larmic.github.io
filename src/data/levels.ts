// Ebene 2 der Inselwelt: Workshops und Videos als Kisten in ihrer Themenfarbe um den Bereichs-Block,
// dazu die kleine Insel als Weg zurück zur Startseite.
import { getCollection } from 'astro:content';
import { buildLevel, type Scene } from '../lib/voxel/world';
import { BUBBLES, MATERIALS } from './site';

type Section = 'workshops' | 'videos';
type Entry = { id: string; data: { short: string; material: keyof typeof MATERIALS; order: number } };

const HUB: Record<Section, string> = { workshops: 'board', videos: 'screen' };
const cache = new Map<Section, { scene: Scene; idle: string }>();

export async function sectionLevel(section: Section) {
  const hit = cache.get(section);
  if (hit) return hit;
  const entries: Entry[] = section === 'workshops'
    ? await getCollection('workshops', ({ data }) => !data.draft)
    : await getCollection('videos');
  const items = entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((e) => ({
      id: e.id,
      label: e.data.short,
      block: MATERIALS[e.data.material].block,
      color: MATERIALS[e.data.material].icon || undefined,
      href: `/${section}/${e.id}/`,
    }));
  const level = { scene: buildLevel(HUB[section], items, { label: 'Zur Insel', href: `/#${section}` }), idle: BUBBLES[section] };
  cache.set(section, level);
  return level;
}
