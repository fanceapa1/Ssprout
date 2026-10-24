import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { calmUiMotion, plantSession } from './ui-helpers';

/**
 * The garden first (ADR 0225): the dock's sheets, its guiding path and "Your plant" draw nothing
 * before the garden's first paint, then draw as they near the window (or on an idle moment), and
 * a click that changes "Your plant" (Begin) only marks it to be drawn.
 */

interface Sample {
  painted: boolean;
  dock: boolean;
  backdrops: number;
  plant: number;
  way: number;
}

/** Every frame from the first script on: is the garden painted, and what has the dock drawn? */
async function recordLoad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __dock: Sample[]; sprout?: { sceneStats?(): { paints: number } } };
    w.__dock = [];
    const tick = () => {
      const painted = (w.sprout?.sceneStats?.().paints ?? 0) > 0;
      w.__dock.push({
        painted,
        dock: document.querySelector('.dock .dock-section') !== null,
        backdrops: document.querySelectorAll('.backdrop[data-paints]').length,
        plant: Number(document.querySelector<HTMLElement>('.plant-view')?.dataset.paints ?? 0),
        way: Number(document.querySelector<SVGElement>('svg.wayfinding')?.dataset.layouts ?? 0),
      });
      if (!painted) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const open = async (page: Page) => {
  await calmUiMotion(page);
  await page.goto('./?dev&fixtures&uitime=0.02');
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
};

/** Document boxes of the visible sections (layout shift check). */
const sectionBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.dock-section:not([hidden])')].map((s) => {
      const r = s.getBoundingClientRect();
      return { id: s.dataset.section, top: Math.round(r.top + scrollY), height: Math.round(r.height) };
    }),
  );

const drawn = (page: Page) =>
  page.evaluate(() => ({
    sheets: [...document.querySelectorAll<HTMLElement>('.dock-section:not([hidden])')].every(
      (s) => s.querySelector<HTMLElement>(':scope > .backdrop')?.dataset.paints !== undefined,
    ),
    plant: Number(document.querySelector<HTMLElement>('.plant-view')?.dataset.paints ?? 0),
    way: window.sprout!.ui.wayfinding({ layout: false }).layouts,
  }));

test.describe('the dock waits for the garden (ADR 0225)', () => {
  test('before the garden’s first paint the dock has drawn no sheet, no path and no plant', async ({ page }) => {
    await recordLoad(page);
    await open(page);
    const samples = await page.evaluate(() => (window as unknown as { __dock: Sample[] }).__dock);
    const before = samples.filter((s) => !s.painted && s.dock);
    expect(before.length, 'frames with the dock built before the garden painted').toBeGreaterThan(0);
    for (const s of before) expect({ backdrops: s.backdrops, plant: s.plant, way: s.way }).toEqual({ backdrops: 0, plant: 0, way: 0 });
    // once the garden is painted, the dock draws by itself (near the window, else when idle)
    await expect.poll(() => drawn(page)).toMatchObject({ sheets: true, plant: expect.any(Number) });
    await expect.poll(async () => (await drawn(page)).plant).toBeGreaterThan(0);
    await expect.poll(async () => (await drawn(page)).way).toBeGreaterThan(0);
  });

  test('scrolled to, every section is drawn, and nothing moves when it is', async ({ page }) => {
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    const boxes = await sectionBoxes(page);
    await page.evaluate(() => window.sprout!.ui.scrollTo('tools', { instant: true }));
    await expect.poll(() => drawn(page)).toMatchObject({ sheets: true });
    await expect.poll(async () => (await drawn(page)).plant).toBeGreaterThan(0);
    await expect.poll(async () => (await drawn(page)).way).toBeGreaterThan(0);
    expect(await sectionBoxes(page)).toEqual(boxes);
    // dockReady draws whatever is still waiting, and leaves nothing behind
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const { mode, speciesId } = await page.evaluate(() => window.sprout!.ui.state().plantView);
    expect(await page.locator('.plant-view').getAttribute('data-painted')).toMatch(new RegExp(`^${mode}\\|${speciesId}\\|`));
  });

  test('Begin only marks “Your plant”: its click stays short, and the plant is current once scrolled to', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(7);
      window.sprout!.ui.refresh();
    });
    await page.evaluate(() => window.sprout!.ui.dockReady());
    expect(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('event'))).toBe(true);
    // every click the browser times at 16 ms or more (Event Timing); a shorter one is not reported
    await page.evaluate(() => {
      const w = window as unknown as { __clicks: Array<{ start: number; processing: number }> };
      w.__clicks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEventTiming[]) {
          if (e.name === 'click') w.__clicks.push({ start: e.startTime, processing: e.processingEnd - e.processingStart });
        }
      }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
    });
    await plantSession(page, { task: 'Botany', minutes: 60, plan: 'pomodoro', species: 'fx-iris', begin: false });
    const t0 = await page.evaluate(() => performance.now());
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    // Event Timing reports a click after the frame that follows it
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
    const begin = await page.evaluate((t) => (window as unknown as { __clicks: Array<{ start: number; processing: number }> }).__clicks.filter((c) => c.start >= t), t0);
    expect(begin.length, 'one click (or none timed: under 16 ms)').toBeLessThanOrEqual(1);
    for (const c of begin) expect(c.processing, 'Begin’s click handlers').toBeLessThan(100);

    const view = page.locator('.plant-view');
    await expect(view).toHaveAttribute('data-mode', 'growing');
    await page.evaluate(() => window.sprout!.ui.scrollTo('plant', { instant: true }));
    await expect(view).toHaveAttribute('data-painted', /^growing\|fx-iris\|/, { timeout: 10_000 });
  });
});
