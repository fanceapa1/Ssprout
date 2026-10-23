import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openStudio(page: Page, query = '') {
  await page.goto(`./studio.html${query}`);
  await page.waitForFunction(() => window.studio?.ready === true);
  await settle(page);
}

/** The studio paints lazily (ADR 0006); paint every shown card and keep it painted. */
function settle(page: Page) {
  return page.evaluate(() => window.studio!.settle());
}

/** Entries whose canvas has no painted pixel at all. */
function blankCanvases(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-entry]')]
      .filter((c) => {
        const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return false;
        return true;
      })
      .map((c) => c.dataset.entry),
  );
}

/** Section ids from the nav, read on an empty view (`#…` naming no section renders nothing). */
async function sectionIds(page: Page): Promise<string[]> {
  await openStudio(page, '#__none__');
  await expect(page.locator('.empty')).toContainText('No studio section');
  return page.locator('nav a[href^="#"]').evaluateAll((as) =>
    as.map((a) => decodeURIComponent((a.getAttribute('href') ?? '').slice(1))).filter((id) => id !== ''),
  );
}

/**
 * Rendering every entry of every section at once is the heaviest page in the app (tens of
 * seconds under load: all species growth stages, the full scene, fauna sheets). The check is
 * split into shards that run in parallel, and each shard shows one section at a time
 * (`#<section>`, the studio's own section view), so no single step renders the whole studio.
 */
const SHARDS = 4;

test.describe('studio', () => {
  test('lists every section in the nav, including the scene and the species', async ({ page }) => {
    const ids = await sectionIds(page);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['scene', 'species-white-clover']));
    expect(ids.some((id) => id.startsWith('fauna'))).toBe(true);
    expect(ids.some((id) => id.startsWith('ambience'))).toBe(true);
  });

  for (let shard = 0; shard < SHARDS; shard++) {
    test(`every entry renders without errors and paints something (shard ${shard + 1}/${SHARDS})`, async ({ page }) => {
      const ids = (await sectionIds(page)).filter((_, i) => i % SHARDS === shard);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        // a hash change re-mounts the grid with only that section, synchronously
        await page.evaluate((h) => (location.hash = h), id);
        await page.waitForFunction(
          (sid) => window.studio!.entries.length > 0 && window.studio!.entries.every((e) => e.startsWith(`${sid}/`)),
          id,
        );
        const entries = await page.evaluate(() => window.studio!.entries);
        await expect(page.locator('canvas[data-entry]'), id).toHaveCount(entries.length);
        await settle(page);
        expect(await page.evaluate(() => window.studio!.errors), id).toEqual([]);
        expect(await blankCanvases(page), id).toEqual([]);
      }
    });
  }

  test('reseed re-renders with a new seed', async ({ page }) => {
    // one section keeps this fast; every section's entries are covered by the shard tests
    await openStudio(page, '#scene');
    const seed = page.locator('#seed');
    await settle(page);
    const before = await seed.inputValue();
    const renders = await page.evaluate(() => window.studio!.renders());
    await page.locator('#reseed').click();
    await expect(seed).not.toHaveValue(before);
    await settle(page);
    expect(await page.evaluate(() => window.studio!.renders())).toBeGreaterThan(renders);
    expect(await blankCanvases(page)).toEqual([]);
  });

  test('#section shows only that section', async ({ page }) => {
    await openStudio(page, '#scene');
    const entries = await page.evaluate(() => window.studio!.entries);
    expect(entries.every((e) => e.startsWith('scene/'))).toBe(true);
  });

  test('?entry shows a single entry large', async ({ page }) => {
    await openStudio(page, '?entry=scene/full&t=0');
    await expect(page.locator('canvas[data-entry]')).toHaveCount(1);
    await settle(page);
    const box = await page.locator('canvas[data-entry]').boundingBox();
    expect(box!.width).toBeGreaterThan(800);
    expect(await blankCanvases(page)).toEqual([]);
  });

  test('?seed and ?t start paused at that seed; Play animates, Pause holds the frame', async ({ page }) => {
    await openStudio(page, '?seed=7&t=0#scene');
    await expect(page.locator('#seed')).toHaveValue('7');
    await expect(page.locator('#play')).toHaveText('Play');
    // the animated water must be on screen to animate (off-screen cards are skipped)
    await page.locator('canvas[data-entry="scene/water"]').scrollIntoViewIfNeeded();
    const frames = () =>
      page.evaluate(async () => {
        const r0 = window.studio!.renders();
        for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
        return window.studio!.renders() - r0;
      });
    expect(await frames(), 'paused: nothing re-renders').toBe(0);
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Pause');
    expect(await frames(), 'playing: animated entries render every frame').toBeGreaterThan(0);
    await page.locator('#play').click();
    expect(await frames()).toBe(0);
  });

  test('speed, background and scale controls', async ({ page }) => {
    await openStudio(page, '?t=0#scene');
    await page.locator('#speed').fill('1');
    await expect(page.locator('label:has(#speed) output')).toHaveText('2×');
    await page.locator('#bg').selectOption('dark');
    await expect(page.locator('body')).toHaveAttribute('data-bg', 'dark');
    const canvas = page.locator('canvas[data-entry="scene/water"]');
    const w1 = (await canvas.boundingBox())!.width;
    await page.locator('#scale').selectOption('2');
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeCloseTo(w1 * 2, 0);
    await settle(page);
    expect(await blankCanvases(page)).toEqual([]);
  });
});

test.describe('studio · lazy painting (ADR 0006)', () => {
  test('the whole studio paints only what is near the screen, and the rest on scroll', async ({ page }) => {
    await page.goto('./studio.html');
    await page.waitForFunction(() => window.studio?.ready === true);
    // let the frame loop paint the first screenful
    await page.waitForFunction(() => {
      const shown = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-entry]')];
      const onScreen = shown.filter((c) => c.getBoundingClientRect().top < innerHeight);
      return onScreen.length > 0 && onScreen.every((c) => c.width > 1);
    });
    const counts = () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-entry]')];
        return { total: all.length, allocated: all.filter((c) => c.width > 1).length, pending: window.studio!.pending() };
      });
    const first = await counts();
    expect(first.total).toBeGreaterThan(100);
    expect(first.allocated, 'only cards near the screen hold pixels').toBeLessThan(first.total / 3);
    expect(first.pending).toBeGreaterThan(0);

    // the last card paints once scrolled to
    const last = page.locator('canvas[data-entry]').last();
    await last.scrollIntoViewIfNeeded();
    await expect.poll(() => last.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(1);
    // and the first cards, now far above, have given their pixels back
    const firstCanvas = page.locator('canvas[data-entry]').first();
    await expect.poll(() => firstCanvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(1);
    expect(await page.evaluate(() => window.studio!.errors)).toEqual([]);
  });
});

test.describe('studio · the plant view’s round window (ADR 0184)', () => {
  test('the wash is round with a pooled rim, and lost at the bottom', async ({ page }) => {
    await openStudio(page, '?entry=ui-shell/plant-view-window&t=0');
    const result = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas[data-entry]')!;
      const g = c.getContext('2d')!;
      const out: Array<{ cv: number; top: number; bottom: number }> = [];
      const third = Math.floor(c.width / 3);
      for (let k = 0; k < 3; k++) {
        const { data, width, height } = g.getImageData(k * third, 0, third, c.height);
        const a = (x: number, y: number) => data[(Math.round(y) * width + Math.round(x)) * 4 + 3]!;
        let minX = width;
        let maxX = 0;
        let minY = height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (a(x, y) <= 8) continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
          }
        }
        const cx = (minX + maxX) / 2;
        const cy = minY + (maxX - minX) / 2;
        const edgeAt = (t: number) => {
          let r = 0;
          for (let s = 1; s < width; s++) {
            const x = cx + Math.cos(t) * s;
            const y = cy + Math.sin(t) * s;
            if (x < 0 || y < 0 || x >= width || y >= height) break;
            if (a(x, y) > 8) r = s;
          }
          return r;
        };
        // the upper three quarters of the rim (the bottom is lost into the paper on purpose)
        const radii: number[] = [];
        for (let d = -200; d <= 20; d += 4) radii.push(edgeAt((d * Math.PI) / 180));
        const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
        const sd = Math.sqrt(radii.reduce((s, r) => s + (r - mean) ** 2, 0) / radii.length);
        out.push({ cv: sd / mean, top: a(cx, cy - mean * 0.97), bottom: a(cx, Math.min(height - 1, cy + mean * 0.97)) });
      }
      return out;
    });
    expect(result).toHaveLength(3);
    for (const w of result) {
      // round: the rim wanders less than 2.5 % of the radius (the first, lumpy wash wandered ~8 %)
      expect(w.cv).toBeLessThan(0.025);
      // pigment pooled at the top of the rim, the bottom fading into the paper
      expect(w.top).toBeGreaterThan(w.bottom * 1.5);
    }
  });
});
