import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * The staged boot (ADR 0232): the landscape starts painting in the first task, and what stacks on
 * it (plants, fauna, ambience) is set up only once it is painted. `main.ts` marks each stage with
 * `performance.mark('sprout:boot:<stage>')`; `window.sprout` appears whole, in the last task.
 */

const STACKED = ['plants', 'fauna', 'ambience'] as const;

/** Init script: when `window.sprout` is assigned, note the boot marks set by then and, a task later, its methods. */
function watchSprout(): void {
  let api: unknown;
  const w = window as unknown as { __boot: { marksAtSprout: string[] | null; keysAfter: string[] | null } };
  w.__boot = { marksAtSprout: null, keysAfter: null };
  Object.defineProperty(window, 'sprout', {
    configurable: true,
    get: () => api,
    set(v) {
      api = v;
      w.__boot.marksAtSprout ??= performance.getEntriesByType('mark').filter((m) => m.name.startsWith('sprout:boot:')).map((m) => m.name.slice(12));
      setTimeout(() => (w.__boot.keysAfter ??= Object.keys(v as object)));
    },
  });
}

async function bootMarks(page: Page) {
  return page.evaluate(() => {
    const at = Object.fromEntries(performance.getEntriesByType('mark').filter((m) => m.name.startsWith('sprout:boot:')).map((m) => [m.name.slice(12), m.startTime]));
    return { at, boot: (window as unknown as { __boot: { marksAtSprout: string[] | null; keysAfter: string[] | null } }).__boot };
  });
}

function expectStagedOrder({ at, boot }: Awaited<ReturnType<typeof bootMarks>>) {
  for (const k of ['start', 'scene', 'ui', 'landscape', ...STACKED, 'done']) expect(at[k], k).toBeDefined();
  // the landscape starts painting first; the UI comes after the first frame
  expect(at.start!).toBeLessThanOrEqual(at.scene!);
  expect(at.scene!).toBeLessThan(at.ui!);
  // the first scene pixels come before plants, fauna and ambience are set up
  for (const k of STACKED) expect(at.landscape!, k).toBeLessThan(at[k]!);
  expect(at.plants!).toBeLessThanOrEqual(at.fauna!);
  expect(at.fauna!).toBeLessThanOrEqual(at.ambience!);
  expect(at.ambience!).toBeLessThanOrEqual(at.done!);
  // window.sprout appears after the stacked systems are registered, with every extension at once
  expect(boot.marksAtSprout).toEqual(expect.arrayContaining(['landscape', 'plants', 'fauna']));
  expect(boot.keysAfter).toEqual(expect.arrayContaining(['ready', 'plantsReady', 'fauna', 'ambience', 'sceneStats', 'camera', 'ui', 'paintCache']));
}

test.describe('boot · the landscape first (ADR 0232)', () => {
  test.beforeEach(({ page }) => page.addInitScript(watchSprout));

  test('first visit: the landscape paints before plants, fauna and ambience are set up', async ({ page }) => {
    await openDev(page);
    expectStagedOrder(await bootMarks(page));
    const stats = await page.evaluate(() => window.sprout!.sceneStats());
    expect(stats.paints).toBe(1);
    // the systems that stack on the landscape run and draw as before
    const ids = await page.evaluate(() => window.sprout!.mute({}));
    expect(ids).toEqual(expect.arrayContaining(['paper', 'scene', 'plants', 'fauna', 'ambience']));
  });

  test('repeat visit: the landscape from the paint cache, still first', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await page.reload();
    await page.waitForFunction(() => window.sprout !== undefined);
    await page.evaluate(() => window.sprout!.ready());
    expect(await page.evaluate(() => window.sprout!.sceneStats().cacheHits)).toBe(1);
    expectStagedOrder(await bootMarks(page));
  });

  test('ambience: no sun sprites until sun weather shows', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.setTime('night');
      window.sprout!.settleAmbience();
      return window.sprout!.freeze();
    });
    const night = await page.evaluate(() => window.sprout!.ambience()!.sprites);
    expect(night).not.toContain('sun');
    await page.evaluate(() => {
      window.sprout!.setWeather('sun');
      return window.sprout!.freeze();
    });
    expect(await page.evaluate(() => window.sprout!.ambience()!.sprites)).toContain('sun');
  });
});
