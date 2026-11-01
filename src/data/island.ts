// Die Insel mit allen Kisten: Workshops und Videos aus den Inhalten, jede Kiste in ihrer Themenfarbe.
import { getCollection } from 'astro:content';
import { buildWorld, type Scene } from '../lib/voxel/world';
import { MATERIALS } from './site';

type Entry = { id: string; data: { short: string; material: keyof typeof MATERIALS; order: number } };

const items = (section: 'workshops' | 'videos', entries: Entry[]) =>
  entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((e) => ({
      id: e.id,
      label: e.data.short,
      block: MATERIALS[e.data.material].block,
      color: MATERIALS[e.data.material].icon || undefined,
      href: `/${section}/${e.id}/`,
    }));

let cached: Scene | undefined;

export async function islandScene(): Promise<Scene> {
  cached ??= buildWorld({
    workshops: items('workshops', await getCollection('workshops', ({ data }) => !data.draft)),
    videos: items('videos', await getCollection('videos')),
  });
  return cached;
}
