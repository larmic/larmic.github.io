// Die Insel mit allen Kisten: Workshops und Videos aus den Inhalten, jede Kiste in ihrer Themenfarbe; dazu die Spiele.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Scene } from '../lib/voxel/world';
import { AVATAR } from './avatar';
import { buildWorld } from './island-layout';
import { MATERIALS, type Material } from './materials';
import { MITWACHSEN } from './site';

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
      // Spiele: Kiste mit Fliegenpilz-Block (wie der Riesenpilz im Spiel), kein Themen-Material. Sie führt auf die
      // eigene Seite des Spiels.
      spiele: (await getCollection('games'))
        .sort((a, b) => a.data.order - b.data.order)
        .map((g: CollectionEntry<'games'>) => ({
          id: g.id,
          label: g.data.short,
          block: 'pilz',
          href: MITWACHSEN.home,
        })),
    },
    AVATAR,
  );
  return cached;
}
