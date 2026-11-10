import type { Page } from '@playwright/test';
import { expect, openDev, test, waitFrames } from './fixtures';
import { storedOf } from './paint-store';

/**
 * Each garden's painters are a lazy chunk (ADR 0341). A first visit loads the viewed garden's
 * chunk to paint it; a warm repeat visit takes the landscape and the plates from the paint cache
 * and never asks for it. The Japanese garden's chunk is the one with its `pond-reserve` step.
 */

/** Init script: `&e2eat=HH:MM` opens the page at that local time of today. */
function openAt(): void {
  const m = /[?&]e2eat=(\d\d):(\d\d)/.exec(location.search);
  if (!m) return;
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const at = new RealDate(realNow());
  at.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const offset = at.getTime() - realNow();
  class AtDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [number]));
    }
    static override now(): number {
      return realNow() + offset;
    }
  }
  globalThis.Date = AtDate as DateConstructor;
}

/** Every script the page asks for from now on (served by the network or the service worker). */
function scripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script' || r.url().endsWith('.js')) urls.push(r.url());
  });
  return urls;
}

const PHASES = ['sunrise', 'midday', 'sunset', 'night'] as const;

test.describe('lazy garden painters (ADR 0341)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  test.beforeEach(({ context }) => context.addInitScript(openAt));

  test('a first visit loads the garden painters; a warm repeat visit never requests them', async ({ page }) => {
    test.slow();
    const first = scripts(page);
    await openDev(page, 'e2eat=12:00');
    expect(await page.evaluate(() => window.sprout!.sceneStats())).toMatchObject({ paints: 1, cacheMisses: 1 });
    // every phase's plates painted and stored, so the repeat visit finds whichever it needs
    for (const time of PHASES) {
      await page.evaluate((t) => window.sprout!.setTime(t), time);
      await waitFrames(page, 2);
    }
    await expect.poll(async () => (await storedOf(page, 'sky-plate', 'light-plate')).length, { timeout: 40_000 }).toBe(8);
    await page.evaluate(() => window.sprout!.paintCache.settle());

    const painterChunks = [...new Set(first.filter((u) => /\/assets\/painters-[^/]+\.js$/.test(u)))];
    const bodies = await Promise.all(painterChunks.map(async (u) => ({ u, text: await (await page.request.get(u)).text() })));
    const garden = bodies.filter((b) => b.text.includes('pond-reserve')).map((b) => b.u);
    expect(garden).toHaveLength(1);

    const repeat = scripts(page);
    await openDev(page, 'e2eat=12:00');
    await page.evaluate(async () => {
      const s = window.sprout!;
      await s.camera.settle();
      s.settleAmbience();
    });
    await waitFrames(page, 4);
    expect(await page.evaluate(() => window.sprout!.sceneStats())).toMatchObject({ paints: 0, cacheHits: 1, cacheMisses: 0 });
    expect(await page.evaluate(() => window.sprout!.skyStats()!.painted)).toBe(0);
    expect(repeat.some((u) => u.includes('/assets/main-'))).toBe(true);
    expect(repeat).not.toContain(garden[0]);
  });
});
