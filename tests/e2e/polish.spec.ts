import { expect, openDev, test } from './fixtures';

/** Behaviour changed by the polish pass (docs/devlog/14-polish.md, ADRs 0120–0124). */
test.describe('polish', () => {
  test('the placeholder sprout is not a plant you can pick', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.setTime('noon');
    });
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet.locator('.plant-card').first()).toBeVisible();
    await expect(sheet.locator('.plant-card[data-species-id="placeholder-sprout"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.sprout!.selectableSpecies(180).map((s) => s.id))).not.toContain('placeholder-sprout');
  });

  test('one tip at a time: Start studying first, the sheet notes take turns', async ({ page }) => {
    await openDev(page, 'uitime=0.02');
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.ui.refresh();
    });
    await expect(page.locator('.tip[data-tip-id="notifications"]')).toBeVisible();
    await expect(page.locator('.tip')).toHaveCount(1);

    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet.locator('.tip[data-tip-id="task"]')).toBeVisible();
    await expect(sheet.locator('.tip.is-in')).toHaveCount(1);
    // naming the task retires its note; the time note takes its turn
    await sheet.getByLabel('What are you studying?').fill('Biology ch. 4');
    expect(await page.evaluate(() => window.sprout!.state().tips.task)).toBe('seen');
    await expect(sheet.locator('.tip[data-tip-id="duration"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().tips)).toEqual(['duration']);
  });

  test('keyboard: focus lands on Pause after Begin, Escape leaves the end question', async ({ page }) => {
    await openDev(page, 'uitime=0.02');
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.ui.refresh();
    });
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).focus();
    await page.keyboard.press('Enter');
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await sheet.locator('.plant-card[data-species-id="violet"]').focus();
    await page.keyboard.press('Enter');
    await sheet.getByRole('button', { name: 'Choose a spot' }).focus();
    await page.keyboard.press('Enter');
    await page.locator('button.marker[data-occupied="false"]').first().focus();
    await page.keyboard.press('Enter');
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).focus();
    await page.keyboard.press('Enter');
    // focus lands on the pill's Pause, on the garden (the page stays where the seedling appeared)
    await expect(page.locator('.pill button.pause')).toBeFocused();
    await page.locator('.panel button.end').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel button.keep')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.panel button.end')).toBeFocused();
    expect(await page.evaluate(() => window.sprout!.status().phase)).toBe('focus');
  });

  test('keyboard: a Begin that comes before the glide up to the garden ends still lands on Pause', async ({ page }) => {
    await openDev(page, 'uitime=0.02');
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.ui.refresh();
    });
    // focusing the dock's Start brings the Study controls on screen: the pill steps aside
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).focus();
    await page.keyboard.press('Enter');
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await sheet.locator('.plant-card[data-species-id="violet"]').focus();
    await page.keyboard.press('Enter');
    // a spot and Begin in one task, before the page's glide to the garden has moved a frame
    // (devlog 41: the pill was still aside, inert, and focus fell to <body>)
    const focused = await page.evaluate(() => {
      const button = (scope: string, text: string) => [...document.querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.includes(text))!;
      button('dialog[data-dialog="planting"]', 'Choose a spot').click();
      document.querySelector<HTMLButtonElement>('button.marker[data-occupied="false"]')!.click();
      button('.placement-bar', 'Begin').click();
      return document.activeElement?.matches('.pill button.pause') ?? false;
    });
    expect(focused).toBe(true);
    await expect(page.locator('.pill button.pause')).toBeFocused();
  });

  test('plantsReady resolves once the garden is painted', async ({ page }) => {
    await openDev(page);
    const painted = await page.evaluate(async () => {
      window.sprout!.reset();
      window.sprout!.addPlants(12);
      await window.sprout!.plantsReady();
      return window.sprout!.plants.state();
    });
    expect(JSON.stringify(painted)).toBeTruthy();
    expect(await page.evaluate(() => window.sprout!.frameStats().frames)).toBeGreaterThan(0);
  });

  test('the canvas edges dissolve into paper (no dark frame line)', async ({ page }) => {
    await openDev(page);
    await page.evaluate(async () => {
      window.sprout!.reset();
      window.sprout!.setTime('noon');
      await window.sprout!.freeze();
    });
    const { edge, inner } = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const lum = (x: number, y: number) => {
        const i = (y * c.width + x) * 4;
        return (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
      };
      // the sky, along the top: the very edge row against a row a little inside
      let edge = 0;
      let inner = 0;
      for (let x = Math.floor(c.width * 0.4); x < c.width * 0.6; x += 7) {
        edge += lum(x, 0);
        inner += lum(x, 12);
      }
      return { edge, inner };
    });
    expect(edge).toBeGreaterThan(inner * 0.97);
  });
});

test.describe('polish · phones', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a tall phone sees a wider slice of the garden, with paper above it', async ({ page }) => {
    await openDev(page);
    const v = await page.evaluate(() => {
      const r = window.sprout!.fauna.view();
      return { w: r.w, y: r.y };
    });
    expect(v.w).toBeGreaterThanOrEqual(599);
    expect(v.y).toBeLessThan(0);
  });
});
