import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * The tools on the painting stay clearly visible while they rest (ADR 0180, owner request 6 of
 * ADR 0005: the icons were "not at all intuitive or easily visible"). In each of the four daylight
 * phases, with a session resting the controls, every corner chip and zoom chip is measured from the
 * real rendered pixels: its ink must stand at ≥ 3:1 against its own paper (WCAG 1.4.11 for
 * graphical objects).
 */

/** Contrast of the ink against the chip's paper, from an element screenshot decoded in the page. */
async function inkContrast(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    // the middle of the chip: the icon and the paper around it (the chip's torn rim is left out)
    const m = Math.round(Math.min(img.width, img.height) * 0.2);
    const d = g.getImageData(m, m, img.width - 2 * m, img.height - 2 * m).data;
    const lin = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const lum: number[] = [];
    for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!));
    lum.sort((a, b) => a - b);
    const ink = lum[Math.floor(lum.length * 0.02)]!;
    const paper = lum[Math.floor(lum.length * 0.7)]!;
    return (paper + 0.05) / (ink + 0.05);
  }, png.toString('base64'));
}

test.describe('tools · visible at rest', () => {
  test.slow();

  test('corner tools and zoom chips read clearly while resting, in all four lights', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      window.sprout!.addPlants(12);
      window.sprout!.start(25);
      await window.sprout!.plantsReady();
      window.sprout!.ui.setTimeScale(0.01);
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.mouse.move(700, 420);
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().resting)).toBe(true);
    const chips = page.locator('.menu .menu-item, .zoom-controls .zoom-btn:not(:disabled)');
    expect(await chips.count()).toBeGreaterThanOrEqual(6);

    const report: string[] = [];
    for (const phase of ['sunrise', 'midday', 'sunset', 'night'] as const) {
      await page.evaluate(async (p) => {
        window.sprout!.setTime(p);
        window.sprout!.settleAmbience();
        await window.sprout!.freeze();
      }, phase);
      expect(await page.evaluate(() => window.sprout!.ui.state().resting)).toBe(true);
      await expect(page.locator('.menu')).toHaveCSS('opacity', '0.88');
      for (let i = 0; i < (await chips.count()); i++) {
        const chip = chips.nth(i);
        const ratio = await inkContrast(page, await chip.screenshot({ animations: 'disabled' }));
        const name = (await chip.getAttribute('aria-label')) ?? `chip ${i}`;
        if (ratio < 3) report.push(`${phase} · ${name}: ${ratio.toFixed(2)}:1`);
      }
      await page.evaluate(() => window.sprout!.unfreeze());
    }
    expect(report).toEqual([]);
  });
});
