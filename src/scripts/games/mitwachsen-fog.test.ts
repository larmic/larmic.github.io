import { describe, expect, it } from 'vitest';
import { CHUNK } from '../../lib/games/chunks';
import { Fog } from './mitwachsen-fog';

describe('Nebel', () => {
  it('ist am Anfang überall', () => {
    const fog = new Fog();
    expect(fog.has(0, 0)).toBe(false);
    expect(fog.has(-100, 37)).toBe(false);
    expect(fog.size).toBe(0);
  });

  it('lichtet sich rund um die Figur, auch über Stückgrenzen und bei negativen Koordinaten', () => {
    const fog = new Fog();
    const changed = fog.reveal(0, 0, 3);
    expect(fog.has(0, 0)).toBe(true);
    expect(fog.has(3, 0)).toBe(true);
    expect(fog.has(-3, 0)).toBe(true);
    expect(fog.has(3, 3)).toBe(false); // Ecke liegt außerhalb des Kreises
    expect(fog.has(4, 0)).toBe(false);
    expect(changed.sort()).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
  });

  it('meldet nur Stücke, in denen sich wirklich etwas geändert hat', () => {
    const fog = new Fog();
    fog.reveal(5, 5, 2);
    expect(fog.reveal(5, 5, 2)).toEqual([]);
    expect(fog.reveal(5, 6, 2)).toEqual(['0,0']);
  });

  it('übersteht das Speichern und Laden', () => {
    const fog = new Fog();
    fog.reveal(0, 0, 5);
    fog.reveal(40, -20, 4);
    const back = Fog.from(JSON.parse(JSON.stringify(fog.serialize())));
    expect(back.size).toBe(fog.size);
    for (let y = -25; y < 25; y++) for (let x = -10; x < 50; x++) expect(back.has(x, y)).toBe(fog.has(x, y));
  });

  it('ist im Spielstand klein und übergeht Kaputtes', () => {
    const fog = new Fog();
    fog.reveal(0, 0, 4);
    for (const value of Object.values(fog.serialize()))
      expect(value.length).toBeLessThanOrEqual(Math.ceil((CHUNK * CHUNK) / 6) + 4);
    const back = Fog.from({ '0,0': 'kaputt!', 'a,b': 'AAAA', '1,1': 42, ...fog.serialize() });
    expect(back.has(0, 0)).toBe(true);
    expect(Fog.from(null).size).toBe(0);
    expect(Fog.from([1, 2]).size).toBe(0);
  });
});
