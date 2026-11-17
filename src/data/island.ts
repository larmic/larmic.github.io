// Die Insel mit allen Kisten: Workshops und Videos aus den Inhalten, jede Kiste in ihrer Themenfarbe.
import { getCollection } from 'astro:content';
import type { Scene } from '../lib/voxel/world';
import { AVATAR } from './avatar';
import { buildWorld } from './island-layout';
import { MATERIALS, type Material } from './materials';

type Entry = { id: string; data: { short: string; material: Material; order: number } };

const items = (section: 'workshops' | 'videos', entries: Entry[]) =>
  entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((e) => ({
      id: e.id,
      label: e.data.short,
      block: MATERIALS[e.data.material].block,
      color: MATERIALS[e.data.material].icon,
      href: `/${section}/${e.id}/`,
    }));

let cached: Scene | undefined;

export async function islandScene(): Promise<Scene> {
  cached ??= buildWorld(
    {
      workshops: items('workshops', await getCollection('workshops', ({ data }) => !data.draft)),
      videos: items('videos', await getCollection('videos')),
    },
    AVATAR,
  );
  return cached;
}
