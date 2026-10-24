import type { Page } from '@playwright/test';
import { expect, openDev, test, waitBrowserFrames, waitFrames } from './fixtures';

/**
 * The garden draws nothing while its stage is scrolled out of view (ADR 0224): the renderer's
 * frame loop pauses on an IntersectionObserver and resumes as the stage comes back. Sessions,
 * the title countdown and the dock run on their own clocks and keep going.
 */

const toBottom = (page: Page) =>
  page.evaluate(() => window.sprout!.ui.scrollTo(document.documentElement.scrollHeight, { instant: true }));
const toTop = (page: Page) => page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
const stageVisible = (page: Page) => page.evaluate(() => window.sprout!.stageVisible());
const frames = (page: Page) => page.evaluate(() => window.sprout!.frameStats().frames);

test.describe('off-screen stage', () => {
  test('scrolled to the dock the garden draws no frames; scrolled back it draws again', async ({ page }) => {
    await openDev(page);
    expect(await stageVisible(page)).toBe(true);
    await waitFrames(page, 3);
    expect(await frames(page)).toBeGreaterThanOrEqual(3);

    await toBottom(page);
    await expect.poll(() => stageVisible(page)).toBe(false);
    // the stage really is off-screen
    expect(await page.evaluate(() => document.querySelector('#stage')!.getBoundingClientRect().bottom)).toBeLessThan(0);
    await page.evaluate(() => window.sprout!.resetFrameStats());
    await waitBrowserFrames(page, 20);
    expect(await frames(page)).toBe(0);

    await toTop(page);
    await expect.poll(() => stageVisible(page)).toBe(true);
    await waitFrames(page, 5);
    expect(await frames(page)).toBeGreaterThanOrEqual(5);
  });

  test('explicit frames still draw while off-screen: freeze and camera.settle', async ({ page }) => {
    await openDev(page);
    await toBottom(page);
    await expect.poll(() => stageVisible(page)).toBe(false);
    await page.evaluate(() => window.sprout!.resetFrameStats());
    await page.evaluate(() => window.sprout!.freeze());
    expect(await frames(page)).toBe(1);
    await page.evaluate(() => window.sprout!.unfreeze());
    await page.evaluate(() => window.sprout!.camera.settle());
    expect(await frames(page)).toBe(2);
    await waitBrowserFrames(page, 10);
    expect(await frames(page)).toBe(2);
  });

  test('a running session keeps counting while the garden is scrolled away', async ({ page }) => {
    await openDev(page, 'speed=60');
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(42);
      window.sprout!.start();
    });
    await expect(page).toHaveTitle(/^\d+:\d\d(:\d\d)? · Study Sprout$/);

    await toBottom(page);
    await expect.poll(() => stageVisible(page)).toBe(false);
    await page.evaluate(() => window.sprout!.resetFrameStats());
    const title = await page.title();
    const elapsed = () => page.evaluate(() => window.sprout!.now() - window.sprout!.state().session!.startedAt);
    const before = await elapsed();
    // 1 s real = 1 min of session at speed 60: the worker ticker moves the title on
    await expect.poll(() => page.title()).not.toBe(title);
    expect(await elapsed()).toBeGreaterThan(before);
    expect(await page.evaluate(() => window.sprout!.state().session)).not.toBeNull();
    expect(await frames(page)).toBe(0);
  });
});
