import { expect, openDev, test } from './fixtures';

/**
 * The first view's fonts are preloaded from the built index.html (ADR 0231, docs/systems/ui.md ›
 * Fonts): Shippori Mincho latin 500 and Cormorant Garamond latin 500 and 500 italic, by their
 * hashed names, so they load with the HTML's own requests instead of after the JS has built the
 * dock. Each preload must be the very request the @font-face uses: a preload without
 * `crossorigin` is fetched a second time, and Chromium warns that it was not used.
 */

const PRELOADED = [
  /^\/Ssprout\/assets\/shippori-mincho-latin-500-normal-[\w-]+\.woff2$/,
  /^\/Ssprout\/assets\/cormorant-garamond-latin-500-normal-[\w-]+\.woff2$/,
  /^\/Ssprout\/assets\/cormorant-garamond-latin-500-italic-[\w-]+\.woff2$/,
];

/** The `<link rel="preload" as="font">` tags of a page's HTML, as attribute maps. */
function fontPreloads(html: string): Record<string, string>[] {
  return [...html.matchAll(/<link\b([^>]*)>/g)]
    .map((m) => Object.fromEntries([...m[1]!.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, a[2] ?? ''])))
    .filter((attrs) => attrs.rel === 'preload' && attrs.as === 'font');
}

test.describe('font preloads', () => {
  test('the built index.html preloads exactly the three first-view fonts, with crossorigin', async ({ request }) => {
    const html = await (await request.get('./')).text();
    const links = fontPreloads(html);
    expect(links.map((l) => l.href)).toHaveLength(3);
    PRELOADED.forEach((re, i) => expect(links[i]!.href).toMatch(re));
    for (const l of links) {
      expect(l.type).toBe('font/woff2');
      expect('crossorigin' in l, `${l.href} needs crossorigin`).toBe(true);
      expect(l.crossorigin, 'anonymous, the mode @font-face fetches in').toBe('');
      const res = await request.get(l.href!);
      expect(res.status(), l.href).toBe(200);
    }
    // the preloads come after the entry script and the stylesheets, in <head>
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head.indexOf(links[0]!.href!)).toBeGreaterThan(head.indexOf('rel="stylesheet"'));

    // the studio's page preloads no fonts
    expect(fontPreloads(await (await request.get('studio.html')).text())).toEqual([]);
  });

  test('each preloaded font is the one the page uses: one request, loaded by dockReady, no preload warning', async ({ page, request }) => {
    const hrefs = fontPreloads(await (await request.get('./')).text()).map((l) => l.href!);
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (/preload/i.test(msg.text())) warnings.push(`${msg.type()}: ${msg.text()}`);
    });
    const requested = new Map<string, number>();
    page.on('request', (r) => {
      const path = new URL(r.url()).pathname;
      if (path.endsWith('.woff2')) requested.set(path, (requested.get(path) ?? 0) + 1);
    });

    await openDev(page);
    await page.evaluate(() => window.sprout!.ui.dockReady());

    const faces = await page.evaluate((paths) => {
      const rules: CSSFontFaceRule[] = [];
      for (const sheet of [...document.styleSheets]) {
        for (const rule of [...sheet.cssRules]) if (rule instanceof CSSFontFaceRule) rules.push(rule);
      }
      const norm = (s: string) => s.replace(/['"]/g, '').trim();
      return paths.map((path) => {
        const rule = rules.find((r) => r.style.getPropertyValue('src').includes(path));
        const desc = (p: string) => norm(rule?.style.getPropertyValue(p) ?? '');
        // the FontFace that this rule makes: same family, style, weight and range
        const face = [...document.fonts].find(
          (f) =>
            norm(f.family) === desc('font-family') &&
            f.style === desc('font-style') &&
            f.weight === desc('font-weight') &&
            f.unicodeRange.replace(/\s/g, '').toLowerCase() === desc('unicode-range').replace(/\s/g, '').toLowerCase(),
        );
        const timing = performance.getEntriesByName(new URL(path, location.href).href)[0] as PerformanceResourceTiming | undefined;
        return { path, rule: !!rule, status: face?.status ?? 'no face', initiator: timing?.initiatorType ?? 'no entry' };
      });
    }, hrefs);

    // Chromium warns when a preload's mode does not match its use (at once) or when it goes unused
    // (a few seconds after load; its condition, one request per file, is checked below instead of
    // waiting for it)
    expect(warnings).toEqual([]);
    for (const f of faces) {
      expect(f.rule, `${f.path}: a @font-face rule uses it`).toBe(true);
      expect(f.status, `${f.path}: loaded by dockReady`).toBe('loaded');
      expect(f.initiator, `${f.path}: fetched by the preload link`).toBe('link');
      expect(requested.get(f.path), `${f.path}: fetched once, the preload reused`).toBe(1);
    }
  });
});
