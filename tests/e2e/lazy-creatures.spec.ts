import type { Page } from '@playwright/test';
import { expect, openDev, test, waitFrames } from './fixtures';

/**
 * Each garden's creatures are a lazy chunk (ADR 0346): a visit to the Japanese garden loads its
 * own, and the waterfall's and the oasis's come only with a switch there or with the Gardens
 * section's pre-paint.
 */

/** Every script the page asks for from now on (served by the network or the service worker). */
function scripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script' || r.url().endsWith('.js')) urls.push(r.url());
  });
  return urls;
}

const chunk = (garden: string) => new RegExp(`/assets/creatures-${garden}-[\\w-]+\\.js$`);
const asked = (urls: string[], garden: string) => urls.some((u) => chunk(garden).test(u));

test.describe('creatures per garden (ADR 0346)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a first visit loads only the Japanese garden's creatures; a switch to the oasis loads its own and they appear", async ({ page }) => {
    const urls = scripts(page);
    await openDev(page);
    expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe('japanese-garden');
    await waitFrames(page, 10);
    expect(asked(urls, 'japanese-garden')).toBe(true);
    expect(asked(urls, 'waterfall')).toBe(false);
    expect(asked(urls, 'oasis')).toBe(false);
    const kinds = await page.evaluate(() => window.sprout!.fauna.kinds());
    expect(kinds).toEqual(expect.arrayContaining(['koi', 'strider', 'heron']));
    expect(kinds).not.toContain('dipper');
    expect(kinds).not.toContain('bunting');

    await page.evaluate(() => window.sprout!.showScenery('oasis'));
    expect(asked(urls, 'oasis')).toBe(true);
    expect(asked(urls, 'waterfall')).toBe(false);
    await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.step(2);
    });
    const list = await page.evaluate(() => window.sprout!.fauna.list().map((c) => c.kind));
    expect(list.filter((k) => k === 'bunting')).toHaveLength(2);
    expect(list).toContain('strider');
    expect(await page.evaluate(() => window.sprout!.fauna.roster().scenery)).toBe('oasis');
  });

  test("the Gardens section's pre-paint fetches the other gardens' creatures before any switch", async ({ page }) => {
    test.setTimeout(180_000);
    const urls = scripts(page);
    await openDev(page);
    expect(asked(urls, 'oasis') || asked(urls, 'waterfall')).toBe(false);
    await page.evaluate(() => window.sprout!.ui.scrollTo('gardens', { instant: true }));
    await page.evaluate(() => window.sprout!.gardens.prepaintReady());
    expect(asked(urls, 'waterfall')).toBe(true);
    expect(asked(urls, 'oasis')).toBe(true);
    expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe('japanese-garden');
    expect(await page.evaluate(() => window.sprout!.fauna.kinds())).toEqual(expect.arrayContaining(['dipper', 'bunting']));
  });
});
