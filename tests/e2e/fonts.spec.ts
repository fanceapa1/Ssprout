import { expect, test } from './fixtures';

/**
 * Web fonts (ADR 0239, docs/systems/ui.md › Fonts): src/ui/fonts.css declares the app's faces,
 * Latin and Latin-extended only, woff2 only. On the first view every face the page uses loads,
 * only latin woff2 files are fetched and none fails; the shipped CSS has no other @font-face rules.
 */

const FAMILIES = ['Shippori Mincho', 'Cormorant Garamond'];

test.describe('fonts', () => {
  test('first view: every font the page uses loads, only latin woff2 files, no failed request', async ({ page }) => {
    const fetched: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      if (/\.woff2?(\?|$)/.test(r.url())) fetched.push({ url: r.url(), status: r.status() });
    });
    const failed: string[] = [];
    page.on('requestfailed', (r) => {
      if (/\.woff2?(\?|$)/.test(r.url())) failed.push(r.url());
    });
    await page.goto('./');
    await page.waitForLoadState('load');
    const used = await page.evaluate(async (families) => {
      await document.fonts.ready;
      // every family + weight + style an element with text computes to, among our web fonts
      const combos = new Set<string>();
      for (const el of document.querySelectorAll('*')) {
        const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        if (!hasText && !el.matches('button, input, textarea, select')) continue;
        const cs = getComputedStyle(el);
        const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        if (families.includes(family)) combos.add(`${cs.fontStyle} ${cs.fontWeight} 16px "${family}"`);
      }
      await Promise.all([...combos].map((c) => document.fonts.load(c, 'Study')));
      return [...combos].map((c) => ({ font: c, ready: document.fonts.check(c, 'Study') }));
    }, FAMILIES);

    // the dock's display type, body type and its italics are all on the first view
    const fonts = used.map((u) => u.font);
    expect(fonts).toEqual(
      expect.arrayContaining(['normal 500 16px "Shippori Mincho"', 'normal 500 16px "Cormorant Garamond"', 'italic 500 16px "Cormorant Garamond"']),
    );
    for (const u of used) expect(u.ready, u.font).toBe(true);

    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.style} ${f.weight} ${f.family.replace(/['"]/g, '')}`),
    );
    for (const f of ['normal 500 Shippori Mincho', 'normal 500 Cormorant Garamond', 'italic 500 Cormorant Garamond']) {
      expect(loaded, f).toContain(f);
    }

    expect(failed).toEqual([]);
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.length).toBeLessThanOrEqual(5);
    for (const f of fetched) {
      expect(f.status, f.url).toBe(200);
      expect(f.url, 'woff2 only').toMatch(/\.woff2(\?|$)/);
      expect(f.url, 'latin subset only').toMatch(/-latin-\d{3}-(normal|italic)-/);
    }
  });

  test('the shipped CSS declares latin and latin-ext woff2 faces only, and every one of them loads', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('load');
    const faces = await page.evaluate(() => {
      const out: string[] = [];
      for (const sheet of [...document.styleSheets]) {
        for (const rule of [...sheet.cssRules]) if (rule instanceof CSSFontFaceRule) out.push(rule.cssText);
      }
      return out;
    });
    // src/ui/fonts.css: Shippori Mincho 500; Cormorant Garamond 400, 400 italic, 500, 500 italic, 600
    expect(faces).toHaveLength(12);
    for (const css of faces) {
      expect(css).not.toMatch(/\.woff[)'"?]/);
      expect(css).not.toMatch(/cyrillic|vietnamese/);
      expect(css).toMatch(/-latin(-ext)?-\d{3}-(normal|italic)-[\w-]+\.woff2/);
      expect(css).toContain('unicode-range');
      expect(css).toContain('font-display: swap');
    }
    // no declared file is missing from the build
    const statuses = await page.evaluate(async () => {
      const all = [...document.fonts];
      await Promise.allSettled(all.map((f) => f.load()));
      return all.map((f) => `${f.family} ${f.weight} ${f.style} ${f.unicodeRange.slice(0, 12)}: ${f.status}`);
    });
    expect(statuses).toHaveLength(12);
    for (const s of statuses) expect(s).toMatch(/: loaded$/);
  });
});
