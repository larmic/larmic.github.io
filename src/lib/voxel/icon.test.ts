import { describe, expect, it } from 'vitest';
import { iconIco, iconSvg } from './icon';

describe('Seiten-Icon', () => {
  it('ist ein SVG, mit Größe nur auf Wunsch', () => {
    expect(iconSvg()).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="[^"]+">.+<\/svg>$/);
    expect(iconSvg(32)).toContain(' width="32" height="32"');
  });

  it('packt ein 32×32-PNG in einen gültigen ICO-Container', async () => {
    const ico = await iconIco();
    expect([ico.readUInt16LE(2), ico.readUInt16LE(4), ico[6], ico[7]]).toEqual([1, 1, 32, 32]);
    expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
    expect(ico.subarray(22, 26).toString('latin1')).toBe('\x89PNG');
  });
});
