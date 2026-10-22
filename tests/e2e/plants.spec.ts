import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { MIN, openUi, plantSession, reloadUi } from './ui-helpers';

/**
 * Plant system (docs/systems/plants.md): the session's plant grows live in its slot, watering,
 * wither, completion that persists, reflections, the placement highlight and plant bounds.
 * Sprites are painted in workers; `sprout.plants.settle()` waits for them (no sleeping).
 */

/**
 * Freeze, then store (or diff against) the canvas pixels inside a world rect. Creatures are
 * cleared first so a passing visitor (a drifting leaf, a bird) cannot change the region.
 */
async function regionInk(page: Page, rect: { x: number; y: number; w: number; h: number }, mode: 'baseline' | 'diff'): Promise<number> {
  await page.evaluate(() => {
    window.sprout!.fauna.clear();
    return window.sprout!.freeze();
  });
  return page.evaluate(
    ({ rect, mode }) => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const d = window.sprout!.plants.toDevice(rect)!;
      const x0 = Math.max(0, Math.floor(d.x));
      const y0 = Math.max(0, Math.floor(d.y));
      const w = Math.max(1, Math.min(c.width - x0, Math.ceil(d.w)));
      const h = Math.max(1, Math.min(c.height - y0, Math.ceil(d.h)));
      const data = c.getContext('2d')!.getImageData(x0, y0, w, h).data;
      const store = window as unknown as { __plantBase?: Uint8ClampedArray };
      if (mode === 'baseline') {
        store.__plantBase = data;
        return 0;
      }
      const base = store.__plantBase!;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += Math.abs(data[i]! - base[i]!) + Math.abs(data[i + 1]! - base[i + 1]!) + Math.abs(data[i + 2]! - base[i + 2]!);
      }
      return sum / (data.length / 4);
    },
    { rect, mode },
  );
}

const settle = (page: Page) => page.evaluate(() => window.sprout!.plants.settle());

test.describe('plants · garden', () => {
  test('break → water plays the watering animation, then the soil dries', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.start(60, { speciesId: 'fx-iris', slotId: 'shore-1', planId: 'pomodoro' }));
    expect(await page.evaluate(() => window.sprout!.toBreak())).toBe(1);
    await settle(page);
    expect(await page.evaluate(() => window.sprout!.plants.state().watering)).toBeNull();
    // The animation runs on renderer time (2.5 s). Sample it on every frame inside the page, so
    // a slow round trip on a loaded machine cannot skip the middle of it.
    const samples = await page.evaluate(async () => {
      const out: { progress: number; active: boolean; wet: number }[] = [];
      if (!window.sprout!.water()) return out;
      await new Promise<void>((resolve) => {
        const step = () => {
          const w = window.sprout!.plants.state().watering;
          if (w) out.push(w);
          if ((w && !w.active) || out.length > 2000) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      return out;
    });
    expect(samples.length).toBeGreaterThan(2);
    expect(samples.some((w) => w.active && w.progress > 0.3 && w.progress < 1), 'seen mid-pour').toBe(true);
    const last = samples.at(-1)!;
    expect(last.active).toBe(false);
    expect(last.wet).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.sprout!.plants.state().growing?.drawn)).toBe(true);
  });

  test('cancel withers the seedling away and returns the plant it replaced', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-1' }));
    await page.evaluate(() => window.sprout!.completeSession());
    await page.evaluate((m) => {
      window.sprout!.start(50, { speciesId: 'fx-bellflower', slotId: 'meadow-1' });
      window.sprout!.advance(20 * m);
    }, MIN);
    await settle(page);
    const during = await page.evaluate(() => window.sprout!.plants.state());
    expect(during.displaced?.alpha).toBe(0);
    await page.evaluate(() => window.sprout!.cancel());
    const st = await page.evaluate(() => window.sprout!.plants.state());
    expect(st.growing).toBeNull();
    expect(st.withering).toHaveLength(1);
    // the wither and the fade back run on renderer time (~3 s); frames come slower under load
    await expect.poll(() => page.evaluate(() => window.sprout!.plants.state().withering.length), { timeout: 30_000 }).toBe(0);
    await expect.poll(() => page.evaluate(() => window.sprout!.plants.state().finished[0]?.alpha), { timeout: 30_000 }).toBe(1);
  });

  test('a completed plant blooms in place and persists after reload', async ({ page }) => {
    await openUi(page);
    const id = await page.evaluate(() => window.sprout!.start(25, { speciesId: 'fx-forget-me-not', slotId: 'rock-1' })!.id);
    const plant = await page.evaluate(() => window.sprout!.completeSession());
    expect(plant?.id).toBe(id);
    const st = await page.evaluate(() => window.sprout!.plants.state());
    expect(st.growing).toBeNull();
    expect(st.finished.find((p) => p.id === id)).toMatchObject({ slotId: 'rock-1', blooming: true });
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    await settle(page);
    await page.evaluate(() => window.sprout!.freeze());
    const after = await page.evaluate(() => window.sprout!.plants.state());
    expect(after.finished.find((p) => p.id === id)).toMatchObject({ slotId: 'rock-1', drawn: true, alpha: 1, blooming: false });
  });

  test('a shore plant casts a reflection in the pond', async ({ page }) => {
    await openUi(page);
    const id = await page.evaluate(() => {
      const s = window.sprout!.start(25, { speciesId: 'fx-forget-me-not', slotId: 'shore-1' })!;
      window.sprout!.completeSession();
      return s.id;
    });
    await settle(page);
    await page.evaluate(() => window.sprout!.freeze()); // a frame drawn with the painted sprites
    const st = await page.evaluate(() => window.sprout!.plants.state());
    expect(st.reflections).toContain(id);
    expect(st.finished.find((p) => p.id === id)?.drawn).toBe(true);
  });

  test('placement shows an in-canvas highlight and a ghost of the chosen plant', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { species: 'fx-bellflower', minutes: 25, slot: 'meadow-1', begin: false });
    await page.locator('button.marker[data-slot-id="meadow-1"]').hover();
    const st = await page.evaluate(() => window.sprout!.plants.state().highlight);
    expect(st.active).toBe(true);
    expect(st.slots).toBeGreaterThan(0);
    expect(st.ghost).toBe('fx-bellflower');
    await page.getByRole('button', { name: 'Back to planting' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.sprout!.plants.state().highlight.active)).toBe(false);
  });

  test('plant bounds drive the hover label and the plant system stays within budget', async ({ page }) => {
    // paints 30+ sprites in workers before measuring: real work, so it gets the slow-test budget
    test.slow();
    await openUi(page);
    const plant = await page.evaluate(() => {
      window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-6', taskName: 'Herbarium notes' });
      return window.sprout!.completeSession()!;
    });
    await settle(page);
    const b = await page.evaluate((pid) => window.sprout!.plants.bounds(pid)!, plant.id);
    const label = await page.evaluate((p) => window.sprout!.ui.showPlantLabel(p), { x: b.x + b.w / 2, y: b.y + b.h * 0.7 });
    expect(label).toContain('Herbarium notes');
    // a busy garden plus a growing plant for the frame budget
    await page.evaluate(() => window.sprout!.addPlants(30));
    expect(await page.evaluate(() => window.sprout!.start(50))).not.toBeNull();
    await settle(page);
    await page.evaluate(() => window.sprout!.plants.resetPerf());
    await page.waitForFunction(() => window.sprout!.plants.perf().frames > 30, null, { polling: 'raf' });
    const perf = await page.evaluate(() => window.sprout!.plants.perf());
    console.log(`plant system: ${perf.avgMs.toFixed(3)} ms/frame avg, ${perf.maxMs.toFixed(2)} max over ${perf.frames} frames`);
    expect(perf.avgMs).toBeLessThan(2);
  });
});

test.describe('plants · growth in a still garden', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the seedling appears at its slot and grows as focused time passes', async ({ page }) => {
    await openUi(page);
    // Only the plant may change the region between captures: pin the light (advancing the dev
    // clock would otherwise move the time of day) and settle the ambience. Reduced motion (this block)
    // keeps the plant from swaying between captures.
    await page.evaluate(() => {
      window.sprout!.setTime('noon');
      window.sprout!.settleAmbience();
    });
    await settle(page);
    const rect = (await page.evaluate(() => window.sprout!.plants.boundsFor('fx-bellflower', 'meadow-1')))!;
    expect(rect.w).toBeGreaterThan(10);
    await regionInk(page, rect, 'baseline'); // the garden without the plant
    await page.evaluate(() => window.sprout!.unfreeze());

    await page.evaluate(() => window.sprout!.start(50, { speciesId: 'fx-bellflower', slotId: 'meadow-1' }));
    await settle(page);
    const st = await page.evaluate(() => window.sprout!.plants.state());
    expect(st.growing).toMatchObject({ slotId: 'meadow-1', speciesId: 'fx-bellflower' });
    expect(st.growing!.growth).toBeLessThan(0.01);
    const seedling = await regionInk(page, rect, 'diff');
    await page.evaluate(() => window.sprout!.unfreeze());

    await page.evaluate((m) => window.sprout!.advance(15 * m), MIN);
    await settle(page);
    const mid = await regionInk(page, rect, 'diff');
    const midState = await page.evaluate(() => window.sprout!.plants.state().growing!);
    expect(midState.growth).toBeCloseTo(0.3, 2);
    expect(midState.drawn).toBe(true);
    await page.evaluate(() => window.sprout!.unfreeze());

    await page.evaluate((m) => window.sprout!.advance(25 * m), MIN);
    await settle(page);
    const late = await regionInk(page, rect, 'diff');
    expect(mid).toBeGreaterThan(seedling);
    expect(late).toBeGreaterThan(mid);
  });
});
