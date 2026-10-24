import { describe, expect, it } from 'vitest';
import { FIRST_VIEW_FONTS, fontPreloadHrefs, type AssetLike } from './font-preload.ts';

const BASE = '/Ssprout/';
const SRC = '/repo/node_modules/@fontsource';

/** Assets shaped like Rolldown's: hashed file names, the source's base name in `names`. */
const assets: AssetLike[] = [
  { fileName: 'assets/main-C3.css', names: ['main.css'], originalFileNames: [] },
  {
    fileName: 'assets/cormorant-garamond-latin-500-italic-Y14P.woff2',
    names: ['cormorant-garamond-latin-500-italic.woff2'],
    originalFileNames: [`${SRC}/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2`],
  },
  {
    fileName: 'assets/cormorant-garamond-latin-ext-500-normal-CH1k.woff2',
    names: ['cormorant-garamond-latin-ext-500-normal.woff2'],
  },
  {
    fileName: 'assets/cormorant-garamond-latin-500-normal-BsRW.woff2',
    names: ['cormorant-garamond-latin-500-normal.woff2'],
  },
  {
    fileName: 'assets/shippori-mincho-latin-500-normal-XI1O.woff2',
    names: ['shippori-mincho-latin-500-normal.woff2'],
  },
  { fileName: 'assets/cormorant-garamond-latin-600-normal-Co1r.woff2', names: ['cormorant-garamond-latin-600-normal.woff2'] },
];

describe('font preloads', () => {
  it('names the three first-view faces: Shippori 500, Cormorant 500 and 500 italic, latin only', () => {
    expect(FIRST_VIEW_FONTS).toEqual([
      'shippori-mincho-latin-500-normal.woff2',
      'cormorant-garamond-latin-500-normal.woff2',
      'cormorant-garamond-latin-500-italic.woff2',
    ]);
  });

  it('finds each hashed file by its source name, in order, under the base', () => {
    expect(fontPreloadHrefs(assets, BASE)).toEqual([
      '/Ssprout/assets/shippori-mincho-latin-500-normal-XI1O.woff2',
      '/Ssprout/assets/cormorant-garamond-latin-500-normal-BsRW.woff2',
      '/Ssprout/assets/cormorant-garamond-latin-500-italic-Y14P.woff2',
    ]);
  });

  it('never matches the latin-ext file or another weight of the same face', () => {
    const hrefs = fontPreloadHrefs(assets, BASE);
    expect(hrefs.filter((h) => /latin-ext|-600-/.test(h))).toEqual([]);
  });

  it('falls back to the original file path when the asset has no names', () => {
    const bare = [{ fileName: 'assets/x-1.woff2', originalFileNames: [`${SRC}/shippori-mincho/files/shippori-mincho-latin-500-normal.woff2`] }];
    expect(fontPreloadHrefs(bare, '/', ['shippori-mincho-latin-500-normal.woff2'])).toEqual(['/assets/x-1.woff2']);
  });

  it('fails the build when a face is missing from the bundle', () => {
    const withoutShippori = assets.filter((a) => !a.fileName.includes('shippori'));
    expect(() => fontPreloadHrefs(withoutShippori, BASE)).toThrow(/shippori-mincho-latin-500-normal\.woff2/);
  });
});
