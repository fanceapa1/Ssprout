import { describe, expect, it } from 'vitest';
import {
  buildPrecacheManifest,
  describeBundle,
  injectPrecache,
  isPrecached,
  type BundleFile,
  type OutputFileLike,
} from './sw-manifest.ts';

const BASE = '/Ssprout/';

/** A fake bundle shaped like the real one: two HTML entries, a shared chunk, a worker, fonts. */
function fakeBundle(rename: Record<string, string> = {}): BundleFile[] {
  const n = (f: string) => rename[f] ?? f;
  const font = (subset: string, ext: 'woff2' | 'woff') => `assets/cormorant-garamond-${subset}-500-normal-H${subset}.${ext}`;
  const fonts = ['latin', 'latin-ext', 'cyrillic', 'vietnamese'].flatMap((s) => [font(s, 'woff2'), font(s, 'woff')]);
  const css = fonts.map((f) => `@font-face{src:url(/Ssprout/${n(f)}) format("x")}`).join('');
  return [
    {
      fileName: 'index.html',
      size: 1200,
      text: `<script type="module" src="/Ssprout/${n('assets/main-A1.js')}"></script>
<link rel="modulepreload" href="/Ssprout/${n('assets/shared-B2.js')}">
<link rel="stylesheet" href="/Ssprout/${n('assets/main-C3.css')}">`,
    },
    {
      fileName: 'studio.html',
      size: 900,
      text: `<script type="module" src="/Ssprout/assets/studio-D4.js"></script>`,
    },
    {
      fileName: n('assets/main-A1.js'),
      size: 200,
      text: `import "./${n('assets/shared-B2.js')}";//# sourceMappingURL=${n('assets/main-A1.js')}.map`,
      links: [n('assets/shared-B2.js'), n('assets/lazy-E5.js')],
    },
    { fileName: n('assets/main-A1.js') + '.map', size: 900, text: '{}' },
    {
      fileName: n('assets/shared-B2.js'),
      size: 500,
      text: `new Worker(new URL("${n('assets/sprite-worker-F6.js')}", import.meta.url))`,
    },
    { fileName: n('assets/lazy-E5.js'), size: 50, text: 'export const x = 1;' },
    { fileName: n('assets/sprite-worker-F6.js'), size: 190 },
    { fileName: n('assets/main-C3.css'), size: 75, text: css },
    { fileName: 'assets/studio-D4.js', size: 98, text: `import "./${n('assets/shared-B2.js')}"`, links: [n('assets/shared-B2.js')] },
    { fileName: 'assets/studio-G7.css', size: 4, text: '' },
    { fileName: 'sw.js', size: 2, text: '' },
    ...fonts.map((f) => ({ fileName: n(f), size: 20 })),
  ];
}

describe('buildPrecacheManifest', () => {
  const m = buildPrecacheManifest(fakeBundle(), { base: BASE });

  it('lists what the main entry reaches: HTML, chunks (static and dynamic), CSS, the worker, latin woff2', () => {
    expect(m.urls).toEqual([
      '/Ssprout/',
      '/Ssprout/assets/cormorant-garamond-latin-500-normal-Hlatin.woff2',
      '/Ssprout/assets/cormorant-garamond-latin-ext-500-normal-Hlatin-ext.woff2',
      '/Ssprout/assets/lazy-E5.js',
      '/Ssprout/assets/main-A1.js',
      '/Ssprout/assets/main-C3.css',
      '/Ssprout/assets/shared-B2.js',
      '/Ssprout/assets/sprite-worker-F6.js',
    ]);
    expect(m.bytes).toBe(1200 + 50 + 200 + 75 + 500 + 190 + 20 + 20);
  });

  it('leaves out the studio, sourcemaps, .woff, other font subsets and sw.js', () => {
    const joined = m.urls.join(' ');
    for (const left of ['studio', '.map', '.woff ', 'cyrillic', 'vietnamese', 'sw.js']) {
      expect(joined + ' ').not.toContain(left);
    }
    expect(m.urls.some((u) => u.endsWith('.woff'))).toBe(false);
  });

  it('keeps the base whether or not it ends in a slash', () => {
    expect(buildPrecacheManifest(fakeBundle(), { base: '/Ssprout' }).urls).toEqual(m.urls);
    expect(buildPrecacheManifest(fakeBundle(), { base: '/' }).urls[1]).toBe(
      '/assets/cormorant-garamond-latin-500-normal-Hlatin.woff2',
    );
  });

  it('has a 12-hex version that changes when a listed file name changes', () => {
    expect(m.version).toMatch(/^[0-9a-f]{12}$/);
    for (const f of ['assets/lazy-E5.js', 'assets/sprite-worker-F6.js', 'assets/cormorant-garamond-latin-500-normal-Hlatin.woff2']) {
      const renamed = buildPrecacheManifest(fakeBundle({ [f]: f.replace(/-(\w+)\./, '-Z9.') }), { base: BASE });
      expect(renamed.urls).not.toEqual(m.urls);
      expect(renamed.version).not.toBe(m.version);
    }
  });

  it('keeps the version when nothing listed is renamed', () => {
    const same = fakeBundle().map((f) => ({ ...f, size: f.size + 7 }));
    expect(buildPrecacheManifest(same.reverse(), { base: BASE }).version).toBe(m.version);
    // a left-out file renamed
    const leftOut = buildPrecacheManifest(
      fakeBundle({ 'assets/cormorant-garamond-cyrillic-500-normal-Hcyrillic.woff2': 'assets/cormorant-garamond-cyrillic-500-normal-Q.woff2' }),
      { base: BASE },
    );
    expect(leftOut.version).toBe(m.version);
  });

  it('changes the version when the entry HTML changes', () => {
    const b = fakeBundle().map((f) => (f.fileName === 'index.html' ? { ...f, text: `${f.text}<meta>` } : f));
    expect(buildPrecacheManifest(b, { base: BASE }).version).not.toBe(m.version);
  });

  it('does not take a name that only ends like a bundle file', () => {
    const b: BundleFile[] = [
      { fileName: 'index.html', size: 1, text: '<script src="/Ssprout/assets/xmain-A1.js">' },
      { fileName: 'assets/main-A1.js', size: 1, text: '' },
    ];
    expect(buildPrecacheManifest(b, { base: BASE }).urls).toEqual(['/Ssprout/']);
  });

  it('throws without the entry HTML', () => {
    expect(() => buildPrecacheManifest([], { base: BASE })).toThrow(/index\.html/);
  });
});

describe('isPrecached', () => {
  it.each([
    ['assets/main-A1.js', true],
    ['assets/main-A1.js.map', false],
    ['assets/studio-D4.js', false],
    ['studio.html', false],
    ['sw.js', false],
    ['assets/shippori-mincho-latin-500-normal-X.woff2', true],
    ['assets/shippori-mincho-latin-500-normal-X.woff', false],
    ['assets/cormorant-garamond-cyrillic-ext-500-normal-X.woff2', false],
  ])('%s → %s', (f, want) => expect(isPrecached(f)).toBe(want));
});

describe('injectPrecache', () => {
  const sw = "/* sw */\nself.__SW_VERSION__ = 'dev';\nself.__PRECACHE__ = [];\nself.addEventListener('install', () => {});\n";

  it('writes the list and the version in place of the placeholders', () => {
    const out = injectPrecache(sw, { urls: ['/Ssprout/', '/Ssprout/assets/a-$&.js'], version: 'abc123', bytes: 0 });
    expect(out).toContain('self.__SW_VERSION__ = "abc123";');
    expect(out).toContain('self.__PRECACHE__ = ["/Ssprout/","/Ssprout/assets/a-$&.js"];');
    expect(out).toContain("self.addEventListener('install'");
  });

  it('throws when a placeholder is missing', () => {
    expect(() => injectPrecache('self.__PRECACHE__ = [];', { urls: [], version: 'x', bytes: 0 })).toThrow(/__SW_VERSION__/);
  });
});

describe('describeBundle', () => {
  it('reads chunk code and links, and text assets; binary assets carry only their size', () => {
    const bundle: Record<string, OutputFileLike> = {
      'assets/main-A1.js': {
        type: 'chunk',
        fileName: 'assets/main-A1.js',
        code: 'é',
        imports: ['assets/shared-B2.js'],
        dynamicImports: ['assets/lazy-E5.js'],
        viteMetadata: { importedCss: new Set(['assets/main-C3.css']), importedAssets: new Set(['assets/w.js']) },
      },
      'index.html': { type: 'asset', fileName: 'index.html', source: '<html>' },
      'assets/sprite-worker-F6.js': { type: 'asset', fileName: 'assets/sprite-worker-F6.js', source: new TextEncoder().encode('new URL("x")') },
      'assets/f.woff2': { type: 'asset', fileName: 'assets/f.woff2', source: new Uint8Array(5) },
    };
    expect(describeBundle(bundle)).toEqual([
      {
        fileName: 'assets/main-A1.js',
        size: 2,
        text: 'é',
        links: ['assets/shared-B2.js', 'assets/lazy-E5.js', 'assets/main-C3.css', 'assets/w.js'],
      },
      { fileName: 'index.html', size: 6, text: '<html>' },
      { fileName: 'assets/sprite-worker-F6.js', size: 12, text: 'new URL("x")' },
      { fileName: 'assets/f.woff2', size: 5, text: undefined },
    ]);
  });
});
