import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * No "recording" dots (ADR 0194): what begins a planting and what is growing now carry the inked
 * sprout mark, and a chosen thing carries a brush mark under its words. Nowhere on the page, in the
 * dock, the calendar or a sheet, is there a small round red dot.
 */

/** Small, round, vermilion-filled boxes (elements and their ::before / ::after) in view of the DOM. */
function roundRedDots(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const red = (c: string) => {
      const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c);
      if (!m) return false;
      const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
      return a > 0.3 && r > 140 && r - g > 60 && r - b > 60;
    };
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      for (const pseudo of [null, '::before', '::after'] as const) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const w = parseFloat(cs.width);
        const h = parseFloat(cs.height);
        if (!(w > 0 && w <= 16 && h > 0 && h <= 16)) continue;
        if (!red(cs.backgroundColor)) continue;
        if (cs.borderRadius === '0px') continue;
        found.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''}`);
      }
    }
    return found;
  });
}

test.describe('marks, not dots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the sprout marks what begins a planting and what grows now; no round red dot anywhere', async ({ page }) => {
    await openUi(page);
    // idle: the pill and the dock's Start studying, the calendar's Schedule a session
    await expect(page.locator('.pill svg.sprout-mark')).toHaveCount(1);
    await expect(page.locator('.panel .plant-session svg.sprout-mark')).toHaveCount(1);
    await expect(page.locator('.cal-add svg.sprout-mark')).toHaveCount(1);
    expect(await roundRedDots(page)).toEqual([]);

    // studying, with a plan due and a second session: growing now, Plant another, the due card, the blocks
    await page.evaluate(async () => {
      const s = window.sprout!;
      s.schedule.demo();
      s.startSessions(2);
      s.calendar.setView('day');
      s.calendar.go(s.now());
      await s.ui.scrollTo('calendar', { instant: true });
    });
    await expect(page.locator('.session-row-now:visible svg.sprout-mark')).toHaveCount(1);
    await expect(page.locator('.plant-another svg.sprout-mark')).toHaveCount(1);
    await expect(page.locator('.due-when svg.sprout-mark').first()).toBeAttached();
    expect(await page.locator('.cal-block svg.cal-block-mark').count()).toBeGreaterThan(0);
    expect(await roundRedDots(page)).toEqual([]);

    // a sheet with chosen chips and a pressed tool: brush marks, not dots
    await page.locator('.tool-list').getByRole('button', { name: /Garden sounds/ }).click();
    await page.locator('.cal-add').click();
    const sheet = page.locator('dialog[data-dialog="schedule"]');
    await expect(sheet).toBeVisible();
    const chosen = sheet.locator('.sched-chip[aria-checked="true"]').first();
    expect(await chosen.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('svg');
    expect(await roundRedDots(page)).toEqual([]);
  });
});
