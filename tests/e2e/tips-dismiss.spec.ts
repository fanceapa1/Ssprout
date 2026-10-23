import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi, reloadUi } from './ui-helpers';

/**
 * Dismissing a tip with its small inked × (SPEC §7, ADR 0211): by mouse, by keyboard (Tab to the ×
 * and Enter, or Esc inside the note) and by touch. A dismissed tip retires for good (persisted, so
 * it stays gone after a reload), stays listed under ⓘ, and the next waiting tip takes its turn, still
 * one at a time (ADR 0124) and still waiting while the quiet line speaks.
 */

const shownTips = (page: Page) => page.evaluate(() => window.sprout!.ui.state().tips);
const retired = (page: Page, id: string) => page.evaluate((i) => window.sprout!.state().tips[i] ?? null, id);
const dismissX = (page: Page, id: string) => page.locator(`.tip[data-tip-id="${id}"] .tip-x`);

/** A fresh garden at a pinned hour: the note by Start studying speaks first. */
async function openFresh(page: Page): Promise<void> {
  await openUi(page);
  await page.evaluate(() => window.sprout!.advanceTo('10:00'));
  await expect.poll(() => shownTips(page)).toEqual(['notifications']);
}

test.describe('tips · dismiss with the ×', () => {
  test('a click retires the tip for good: the next one speaks, ⓘ lists it, a reload keeps it gone', async ({ page }) => {
    await openFresh(page);
    const note = page.locator('.tip[data-tip-id="notifications"]');
    const x = dismissX(page, 'notifications');
    await expect(note).toBeVisible();
    // a real button named after its tip; visually small, but a touch-sized target
    await expect(x).toHaveAttribute('aria-label', /^Dismiss tip: When you begin, we'll ask once/);
    expect(await x.evaluate((el) => el.tagName)).toBe('BUTTON');
    const box = (await x.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(32);
    expect(box.height).toBeGreaterThanOrEqual(32);
    // only the × takes the pointer: the slip and its layer never block clicks
    await expect(page.locator('.tips')).toHaveCSS('pointer-events', 'none');
    await expect(note).toHaveCSS('pointer-events', 'none');
    await expect(x).toHaveCSS('pointer-events', 'auto');
    // the × sits beside the words, not over them
    const words = (await note.locator('.tip-copy').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(words.x + words.width - 2);

    await x.click();
    await expect(note).toBeHidden();
    expect(await retired(page, 'notifications')).toBe('seen');
    // the next waiting tip takes its turn, alone (ADR 0124)
    await expect.poll(() => shownTips(page)).toEqual(['sound']);
    await expect(page.locator('.tip[data-tip-id="sound"]')).toBeVisible();
    await expect(page.locator('.tip.is-in')).toHaveCount(1);
    // the mechanism itself was not used: notifications are still unasked
    expect(await page.evaluate(() => window.sprout!.state().settings.notifications)).toBe('unasked');

    // ⓘ still lists it, marked as learned
    await page.locator('.menu').getByRole('button', { name: 'Hints' }).click();
    const hint = page.locator('dialog[data-dialog="hints"] .hint[data-tip-id="notifications"]');
    await expect(hint).toHaveAttribute('data-retired', 'true');
    await expect(hint).toContainText('learned');
    await page.keyboard.press('Escape');

    // persisted: after a reload it does not come back
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    expect(await retired(page, 'notifications')).toBe('seen');
    await expect.poll(() => shownTips(page)).toEqual(['sound']);
    await expect(page.locator('.tip[data-tip-id="notifications"]')).toHaveCount(0);
  });

  test('keyboard: Tab reaches the ×, Enter dismisses it and focus goes back to the control', async ({ page }) => {
    await openFresh(page);
    const x = dismissX(page, 'notifications');
    await expect(x).toBeVisible();
    const isX = () => x.evaluate((el) => el === document.activeElement);
    const focusedAnchor = () => page.evaluate(() => document.activeElement?.getAttribute('data-anchor') ?? null);
    let reached = false;
    let before: string | null = null;
    for (let i = 0; i < 60 && !reached; i++) {
      before = await focusedAnchor();
      await page.keyboard.press('Tab');
      reached = await isX();
    }
    expect(reached, 'Tab reaches the tip’s ×').toBe(true);
    // threaded into the order right after the control it is about (ADR 0211)
    expect(before).toBe('start');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedAnchor()).toBe('start');
    await page.keyboard.press('Tab');
    expect(await isX()).toBe(true);
    // and from the ×, Tab carries on past the control (no loop back into it)
    await page.keyboard.press('Tab');
    expect(await isX()).toBe(false);
    expect(await focusedAnchor()).not.toBe('start');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedAnchor()).toBe('start');
    await page.keyboard.press('Tab');
    expect(await isX()).toBe(true);
    // the shared focus-visible state (ADR 0204): the ink ring and the deeper ink
    await expect(x).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tip[data-tip-id="notifications"]')).toBeHidden();
    expect(await retired(page, 'notifications')).toBe('seen');
    // focus returns to the tip's own control (Start studying), not to the top of the page
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-anchor'))).toBe('start');
    await expect.poll(() => shownTips(page)).toEqual(['sound']);
  });

  test('Esc inside a note dismisses that tip, not the sheet around it', async ({ page }) => {
    await openFresh(page);
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await expect.poll(() => shownTips(page)).toEqual(['task']);
    const x = sheet.locator('.tip[data-tip-id="task"] .tip-x');
    await x.focus();
    await page.keyboard.press('Escape');
    // the sheet stays open; only the note went, and the sheet's next tip speaks
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.tip[data-tip-id="task"]')).toBeHidden();
    expect(await retired(page, 'task')).toBe('seen');
    await expect.poll(() => shownTips(page)).toEqual(['duration']);
    // focus went back to the field the note was about
    await expect(sheet.getByLabel('What are you studying?')).toBeFocused();
    // a second Esc, now outside any note, closes the sheet as before
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('the next tip still waits while the quiet line speaks', async ({ page }) => {
    await openFresh(page);
    await page.evaluate(() => window.sprout!.ui.setTimeScale(0.5));
    await dismissX(page, 'notifications').click();
    // a creature arrives as the note fades: its line speaks first, and no note shares the moment
    await page.evaluate(() => window.sprout!.addPlants(3));
    const line = page.locator('.quiet-line');
    await expect(line).toHaveClass(/is-in/);
    expect(await shownTips(page)).toEqual([]);
    await expect(page.locator('.tip.is-in')).toHaveCount(0);
    // once the line has gone, the waiting tip takes its turn
    await expect(line).not.toHaveClass(/is-in/, { timeout: 15_000 });
    await expect.poll(() => shownTips(page)).toEqual(['sound']);
  });
});

test.describe('tips · dismiss on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap on the × dismisses the tip', async ({ page }) => {
    await openFresh(page);
    const x = dismissX(page, 'notifications');
    await expect(x).toBeVisible();
    const box = (await x.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(32);
    await x.tap();
    await expect(page.locator('.tip[data-tip-id="notifications"]')).toBeHidden();
    expect(await retired(page, 'notifications')).toBe('seen');
    await expect.poll(() => shownTips(page)).toEqual(['sound']);
    // the next note's × is a tap target too, and the page does not scroll sideways for it
    await dismissX(page, 'sound').tap();
    expect(await retired(page, 'sound')).toBe('seen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
