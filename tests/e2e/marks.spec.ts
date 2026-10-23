import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * No "recording" dots (ADR 0194): what begins a planting and what is growing now carry the inked
 * sprout mark, and a chosen thing carries a brush mark under its words. Nowhere on the page, in the
 * dock, the calendar or a sheet, is there a small round red dot. Nor in the favicon: a session that
 * blooms while the tab is away closes the ring around the sprout mark.
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

test.describe('marks, not dots: the favicon', () => {
  test('a bloom while away closes the favicon ring around the sprout, with no red dot at any tab size', async ({ page }) => {
    // play "the tab is in the background" without real waiting
    await page.addInitScript(() => {
      const w = window as Window & { __away?: boolean };
      Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (w.__away ? 'hidden' : 'visible') });
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => w.__away === true });
      Document.prototype.hasFocus = () => w.__away !== true;
    });
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(42);
      window.sprout!.start();
      (window as Window & { __away?: boolean }).__away = true;
      window.sprout!.completeSession();
    });
    await expect(page).toHaveTitle('Bloomed · Study Sprout');
    const href = await page.locator('link[rel~="icon"]').getAttribute('href');
    expect(href).toMatch(/^data:image\/png;base64,/);
    expect(await page.evaluate(() => window.sprout!.widget.favicon())).toBe(href);

    // decode the PNG the tab got and draw it the way a tab does: 16 / 32 / 64 device px, light and dark strips
    const read = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src!;
      await img.decode();
      const out: { size: number; strip: string; red: number; leaf: number; contrast: number }[] = [];
      for (const size of [16, 32, 64]) {
        for (const [strip, bg] of [
          ['light', '#dee1e6'],
          ['dark', '#35363a'],
        ] as const) {
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, size, size);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          let red = 0;
          let leaf = 0;
          let lo = 255;
          let hi = 0;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
              if (r > 140 && r - g > 60 && r - b > 60) red++;
              // inside the ring, where the dot used to be
              if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.2) continue;
              if (g - b > 25 && g >= r) leaf++;
              const l = 0.299 * r + 0.587 * g + 0.114 * b;
              lo = Math.min(lo, l);
              hi = Math.max(hi, l);
            }
          }
          out.push({ size, strip, red, leaf, contrast: hi - lo });
        }
      }
      return { width: img.naturalWidth, out };
    }, href);
    expect(read.width).toBe(64);
    for (const r of read.out) {
      const at = `${r.size} px, ${r.strip} strip`;
      expect(r.red, `${at}: red pixels`).toBe(0);
      expect(r.leaf, `${at}: sap-green leaves`).toBeGreaterThan(0);
      expect(r.contrast, `${at}: ink against the disc`).toBeGreaterThan(r.size <= 16 ? 40 : 70);
    }
  });
});
