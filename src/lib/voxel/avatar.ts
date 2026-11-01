// Aussehen der Figur als Parameter des Generators (die Werte selbst stehen in src/data/avatar.ts).
import type { Palette } from './textures';

export type Avatar = { hair: string; skin: string; shirt: string; beard: boolean; glasses: boolean };

/** Ersetzt die Platzhalter `$hair`, `$skin` und `$shirt` einer Palette durch die Farben des Avatars. */
export function dress(pal: Palette, avatar: Avatar): Palette {
  const color: Record<string, string> = { $hair: avatar.hair, $skin: avatar.skin, $shirt: avatar.shirt };
  return Object.fromEntries(
    Object.entries(pal).map(([ch, layers]) => [ch, layers.map(([fill, op]) => [color[fill] ?? fill, op] as const)]),
  ) as Palette;
}
