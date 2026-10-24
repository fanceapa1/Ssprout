import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { calmUiMotion } from './ui-helpers';

/**
 * The planting sheet opens at once (ADR 0222): "Start studying" paints no species preview in the
 * click. Each card shows a quiet plot until its sprite lands from the plant view's worker. The
 * click is timed twice: from a window capture listener to the bubble one (the handler work, always
 * there) and with Event Timing (its processing span, and the duration to the next paint, reported
 * from 16 ms). Real species only.
 */

declare global {
  interface Window {
    __clicks?: { handler: number[]; events: Array<{ duration: number; processing: number }>; observer?: PerformanceObserver };
  }
}

/** Time every click: the handlers (capture → bubble on window) and the Event Timing entries. */
async function timeClicks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const rec: NonNullable<Window['__clicks']> = { handler: [], events: [] };
    window.__clicks = rec;
    let start = 0;
    window.addEventListener('click', () => (start = performance.now()), true);
    window.addEventListener('click', () => rec.handler.push(performance.now() - start));
    try {
      const observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEventTiming[]) {
          if (e.name === 'click') rec.events.push({ duration: e.duration, processing: e.processingEnd - e.processingStart });
        }
      });
      observer.observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
      rec.observer = observer;
    } catch {
      // no Event Timing: the handler times still stand
    }
  });
}

/** The click times so far, once the frame after the click has been painted (Event Timing reports then). */
async function clickTimes(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const rec = window.__clicks!;
    // entries queued but not yet delivered to the callback
    for (const e of (rec.observer?.takeRecords() ?? []) as PerformanceEventTiming[]) {
      if (e.name === 'click') rec.events.push({ duration: e.duration, processing: e.processingEnd - e.processingStart });
    }
    return { handler: [...rec.handler], events: [...rec.events] };
  });
}

/** Every card's preview state and how much of its canvas is inked. */
async function cards(page: Page) {
  return page.locator('dialog[data-dialog="planting"] .plant-art').evaluateAll((arts) =>
    arts.map((a) => {
      const c = a.querySelector('canvas')!;
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 24) n++;
      return { id: (a.closest('.plant-card') as HTMLElement).dataset.speciesId!, state: (a as HTMLElement).dataset.preview, ink: n / (data.length / 4) };
    }),
  );
}

test.describe('ui · planting sheet previews', () => {
  test('the first Start studying click opens the sheet at once; every preview fills in from the worker', async ({ page }) => {
    await calmUiMotion(page);
    await timeClicks(page);
    await openDev(page, 'uitime=0.02');
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(7);
      window.sprout!.ui.refresh();
    });
    const before = await page.evaluate(() => window.sprout!.plants.view.stats().syncPaints);

    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    const times = await clickTimes(page);
    const first = await cards(page);
    console.log(
      `first open: handler ${times.handler.map((t) => t.toFixed(1)).join(', ')} ms; event ${times.events.map((e) => `${e.duration} (processing ${e.processing.toFixed(1)})`).join(', ') || '< 16'} ms; ` +
        `${first.filter((c) => c.state === 'painted').length}/${first.length} drawn at once`,
    );
    expect(first.length).toBeGreaterThan(10);
    expect(times.handler.length).toBe(1);
    expect(times.handler[0]!, 'the click handlers').toBeLessThan(200);
    // Event Timing's processing span is the same handler work; its duration runs on to the next
    // paint, which includes laying out and painting the sheet itself (logged, not asserted)
    for (const e of times.events) expect(e.processing, 'click processing (Event Timing)').toBeLessThan(200);
    // the cards still waiting show their plot, not a blank
    for (const c of first.filter((c) => c.state === 'pending')) expect(c.ink, `${c.id} plot`).toBeGreaterThan(0.003);

    await page.evaluate(() => window.sprout!.ui.previewsReady());
    const filled = await cards(page);
    for (const c of filled) {
      expect(['painted', 'landed'], c.id).toContain(c.state);
      expect(c.ink, `${c.id} preview`).toBeGreaterThan(0.02);
    }
    expect(await page.evaluate(() => window.sprout!.plants.view.stats().syncPaints), 'no sprite painted on the main thread').toBe(before);

    // opened again: every card is drawn in the click, from the cache
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    await expect(sheet).toBeVisible();
    expect((await cards(page)).every((c) => c.state === 'painted')).toBe(true);
    const again = await clickTimes(page);
    console.log(`second open: handler ${again.handler[1]?.toFixed(1)} ms`);
    expect(again.handler[1]!).toBeLessThan(200);
  });

  test('pointing at Start studying paints the previews ahead: the click then draws every card at once', async ({ page }) => {
    await calmUiMotion(page);
    await timeClicks(page);
    await openDev(page, 'uitime=0.02');
    const before = await page.evaluate(() => window.sprout!.plants.view.stats().syncPaints);
    const start = page.locator('.panel').getByRole('button', { name: 'Start studying' });
    await start.scrollIntoViewIfNeeded();
    // the hover queues the prewarm (pointerover); the view's worker paints it
    await start.hover();
    await page.evaluate(() => window.sprout!.plants.view.whenReady());
    expect((await page.evaluate(() => window.sprout!.plants.view.stats())).queued).toBe(0);

    await start.click();
    await expect(page.locator('dialog[data-dialog="planting"]')).toBeVisible();
    const times = await clickTimes(page);
    const shown = await cards(page);
    console.log(`prewarmed open: handler ${times.handler[0]?.toFixed(1)} ms; ${shown.filter((c) => c.state === 'painted').length}/${shown.length} drawn at once`);
    expect(shown.every((c) => c.state === 'painted' && c.ink > 0.02)).toBe(true);
    expect(times.handler[0]!).toBeLessThan(200);
    const stats = await page.evaluate(() => window.sprout!.plants.view.stats());
    expect(stats.syncPaints).toBe(before);
    expect(stats.evicted, "the view budget holds every preview").toBe(0);
  });
});
