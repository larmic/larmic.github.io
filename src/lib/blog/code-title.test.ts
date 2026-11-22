import { describe, expect, it } from 'vitest';
import { codeTitle, parseTitle, type HastRoot } from './code-title';

const pre = () => ({ type: 'element', tagName: 'pre', properties: {}, children: [] });
const run = (raw: string | undefined, meta = true): HastRoot => {
  const root: HastRoot = { type: 'root', children: [pre()] };
  codeTitle().root.call({ options: meta ? { meta: { __raw: raw } } : {} }, root);
  return root;
};

describe('parseTitle', () => {
  it('liest den Titel aus der Meta-Angabe', () => {
    expect(parseTitle('title=".dependency-cruiser.cjs"')).toBe('.dependency-cruiser.cjs');
    expect(parseTitle('{1,3} title="scripts/bundles.ts" wrap')).toBe('scripts/bundles.ts');
  });

  it('findet ohne Titel nichts', () => {
    expect(parseTitle(undefined)).toBeUndefined();
    expect(parseTitle('')).toBeUndefined();
    expect(parseTitle('subtitle="x"')).toBeUndefined();
    expect(parseTitle('title=""')).toBeUndefined();
  });
});

describe('codeTitle', () => {
  it('umschließt den Block mit figure und setzt die Dateileiste davor', () => {
    expect(run('title="a.ts"').children).toEqual([
      {
        type: 'element',
        tagName: 'figure',
        properties: { class: 'code' },
        children: [
          {
            type: 'element',
            tagName: 'figcaption',
            properties: { class: 'code-file' },
            children: [{ type: 'text', value: 'a.ts' }],
          },
          pre(),
        ],
      },
    ]);
  });

  it('lässt Blöcke ohne Titel und ohne Meta unverändert', () => {
    expect(run('wrap').children).toEqual([pre()]);
    expect(run(undefined).children).toEqual([pre()]);
    expect(run(undefined, false).children).toEqual([pre()]);
  });
});
