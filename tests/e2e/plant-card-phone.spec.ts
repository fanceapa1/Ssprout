import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * The plant card on phones (ADR 0191): docked at the bottom of the stage, the whole card can be
 * read. A card that fits shows everything; a taller one keeps its name, scrolls the rest inside the
 * card with a visible mark at the cut, and the scrolling part is a keyboard-focusable region.
 * Checked with the longest species note (the lotus) and the longest growing card (a spider lily
 * that replaced a plant: its note, three facts and the replaced line).
 */

const card = (page: Page) => page.locator('[data-ui="plant-card"]');

/** A finished lotus (the longest note) placed straight into the state on a water slot. */
async function lotus(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.camera.autoFocus(false);
    const slot = s.placementOptions('water-lily')[0]!.id;
    const now = Date.now();
    s.setState({
      plants: [{ id: 'lotus-1', speciesId: 'lotus', slotId: slot, seed: 7, plantedAt: now - 3_600_000, sessionMinutes: 50, taskName: 'Thermodynamics, problem set 6', completedAt: now - 600_000 }],
    });
    await s.plants.settle();
    return 'lotus-1';
  });
}

/** A spider lily growing where another plant stood (it steps aside): the longest growing card. */
async function growingSpiderLily(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.camera.autoFocus(false);
    const slot = s.placementOptions('spider-lily')[0]!.id;
    const now = Date.now();
    s.setState({
      plants: [{ id: 'old-1', speciesId: 'white-clover', slotId: slot, seed: 3, plantedAt: now - 86_400_000, sessionMinutes: 25, taskName: 'Kanji', completedAt: now - 86_000_000 }],
    });
    const session = s.start(25, { speciesId: 'spider-lily', slotId: slot, taskName: 'Organic chemistry revision' })!;
    s.advance(6 * 60_000);
    await s.plants.settle();
    return session.id;
  });
}

async function readsWhole(page: Page, id: string): Promise<void> {
  expect(await page.evaluate((pid) => window.sprout!.camera.openCard(pid), id)).toBe(true);
  await page.evaluate(() => window.sprout!.camera.settle());
  const c = card(page);
  await expect(c).toHaveAttribute('data-placement', 'docked');
  const body = c.locator('.plant-story-body');

  // the card stays on the garden
  const geo = await c.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const stage = (el as HTMLElement).offsetParent!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, stageTop: stage.top, stageBottom: stage.bottom };
  });
  expect(geo.top).toBeGreaterThanOrEqual(geo.stageTop);
  expect(geo.bottom).toBeLessThanOrEqual(geo.stageBottom + 0.5);

  const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
  if (overflow > 1) {
    // there is more: the cut is marked, and the scrolling part takes keyboard focus as a region
    await expect(c).toHaveAttribute('data-more', /below/);
    await expect(c.locator('.plant-story-more')).toBeVisible();
    await expect(body).toHaveAttribute('tabindex', '0');
    await expect(body).toHaveAttribute('role', 'region');
    await body.focus();
    await page.keyboard.press('End');
    await expect.poll(() => body.evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1)).toBe(true);
    await expect(c).not.toHaveAttribute('data-more', /below/);
    await expect(c.locator('.plant-story-more')).toBeHidden();
  } else {
    await expect(c).not.toHaveAttribute('data-more', /.+/);
    await expect(body).not.toHaveAttribute('tabindex', /.*/);
  }

  // every line of the story is now wholly inside the card's visible part (none half cut)
  const cut = await body.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const lines = [...el.querySelectorAll<HTMLElement>('p:not([hidden]), li, h3')];
    return lines
      .map((n) => ({ text: n.textContent ?? '', r: n.getBoundingClientRect() }))
      .filter(({ r }) => r.height > 0)
      .slice(-4)
      .filter(({ r }) => r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
      .map(({ text }) => text);
  });
  expect(cut).toEqual([]);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
]) {
  test.describe(`plant card on a ${viewport.width}×${viewport.height} phone`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test('the longest note (lotus) can be read whole', async ({ page }) => {
      await openUi(page);
      await readsWhole(page, await lotus(page));
    });

    test('a growing spider lily that replaced a plant can be read whole, its last fact included', async ({ page }) => {
      await openUi(page);
      const id = await growingSpiderLily(page);
      await readsWhole(page, id);
      await expect(card(page).locator('.plant-story-replaced')).toContainText('steps aside');
      await expect(card(page).locator('.plant-story-facts li')).toHaveCount(3);
    });
  });
}

test.describe('plant card on a small phone, by touch', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test('the mark at the cut reads on', async ({ page }) => {
    await openUi(page);
    const id = await growingSpiderLily(page);
    await page.evaluate((pid) => window.sprout!.camera.openCard(pid), id);
    await page.evaluate(() => window.sprout!.camera.settle());
    const body = card(page).locator('.plant-story-body');
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(1);
    await card(page).locator('.plant-story-more').tap();
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(card(page)).toHaveAttribute('data-more', /above/);
  });
});
