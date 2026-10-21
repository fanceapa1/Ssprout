import { writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { openUi, plantSession, reloadUi } from './ui-helpers';

test.describe('ui · menu, tips and data', () => {
  test('tips show near their control, retire when used, and stay listed under ⓘ', async ({ page }) => {
    await openUi(page);
    // fresh garden: the sound tip sits under the menu
    const soundTip = page.locator('.tip[data-tip-id="sound"]');
    await expect(soundTip).toBeVisible();
    await expect(soundTip).toContainText('speaker');
    expect((await page.evaluate(() => window.sprout!.ui.state())).tips.length).toBeLessThanOrEqual(2);
    // tips never block clicks
    await expect(page.locator('.tips')).toHaveCSS('pointer-events', 'none');

    await page.getByRole('button', { name: 'Garden sounds' }).click();
    await expect(soundTip).toHaveCount(0);
    expect(await page.evaluate(() => window.sprout!.state().tips.sound)).toBe('seen');

    // inside the planting sheet, sheet tips appear next to their controls
    await page.getByRole('button', { name: 'Start studying' }).click();
    const sheetTips = page.locator('dialog[data-dialog="planting"] .tip');
    await expect(sheetTips.first()).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Hints' }).click();
    const hints = page.locator('dialog[data-dialog="hints"]');
    await expect(hints).toBeVisible();
    await expect(hints.locator('.hint[data-tip-id="sound"]')).toHaveAttribute('data-retired', 'true');
    await expect(hints.locator('.hint[data-tip-id="sound"]')).toContainText('learned');
    expect(await hints.locator('.hint').count()).toBeGreaterThanOrEqual(7);
  });

  test('sound toggle persists across reloads', async ({ page }) => {
    await openUi(page);
    const sound = page.getByRole('button', { name: 'Garden sounds' });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(false);
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    await expect(page.getByRole('button', { name: 'Garden sounds' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Garden sounds' }).click();
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(true);
  });

  test('floating timer button follows the widget integration', async ({ page }) => {
    await openUi(page);
    // the real widget (Document PiP): the button exists exactly when it is supported
    const supported = await page.evaluate(() => window.sprout!.widget!.supported());
    await expect(page.getByRole('button', { name: 'Floating timer' })).toHaveCount(supported ? 1 : 0);
    // the fake integration: opening from the button and retiring the tip
    await openUi(page, 'widget=fake');
    const btn = page.getByRole('button', { name: 'Floating timer' });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.sprout!.ui.widget!.opened)).toBe(1);
    expect(await page.evaluate(() => window.sprout!.state().tips.widget)).toBe('seen');
  });

  test('export downloads the garden; import validates, confirms and restores', async ({ page }, info) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.addPlants(4));
    const before = await page.evaluate(() => window.sprout!.state().plants);

    await page.getByRole('button', { name: 'Garden data' }).click();
    const sheet = page.locator('dialog[data-dialog="data"]');
    await expect(sheet.locator('.data-summary')).toContainText('4 plants growing');
    const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: 'Export garden' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^study-sprout-garden-\d{4}-\d{2}-\d{2}\.json$/);
    const file = info.outputPath('garden.json');
    await download.saveAs(file);

    // wipe, then a broken file is refused with a readable error
    await page.evaluate(() => window.sprout!.reset());
    const bad = info.outputPath('bad.json');
    await writeFile(bad, '{"nope": true}');
    let chooser = await Promise.all([page.waitForEvent('filechooser'), sheet.getByRole('button', { name: 'Import a garden…' }).click()]);
    await chooser[0].setFiles(bad);
    await expect(sheet.locator('.data-error')).toContainText('doesn’t look like a Study Sprout garden');
    expect(await page.evaluate(() => window.sprout!.state().plants)).toEqual([]);

    chooser = await Promise.all([page.waitForEvent('filechooser'), sheet.getByRole('button', { name: 'Import a garden…' }).click()]);
    await chooser[0].setFiles(file);
    await expect(sheet.locator('.import-confirm')).toContainText('4 plants');
    await sheet.getByRole('button', { name: 'Replace' }).click();
    await expect(sheet.locator('.data-status')).toContainText('restored');
    expect(await page.evaluate(() => window.sprout!.state().plants)).toEqual(before);
  });

  test('a creature arrival gets one quiet line and is recorded', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.ui.setTimeScale(1);
      window.sprout!.addPlants(3);
    });
    const line = page.locator('.quiet-line');
    await expect(line).toHaveClass(/is-in/);
    await expect(line).toContainText(/dragonfly|koi/i);
    await expect.poll(() => page.evaluate(() => window.sprout!.state().faunaSeen)).toEqual(expect.arrayContaining(['dragonfly']));
  });

  test('the panel rests while studying and wakes on pointer movement', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    await page.evaluate(() => window.sprout!.ui.setTimeScale(0.01));
    await page.mouse.move(10, 10);
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().resting)).toBe(true);
    await expect(page.locator('.panel')).toHaveCSS('opacity', '0.2');
    await page.evaluate(() => window.sprout!.ui.setTimeScale(100));
    await page.mouse.move(200, 200);
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().resting)).toBe(false);
  });
});

test.describe('ui · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('panel spans the bottom, menu reachable, planting works by touch', async ({ page }) => {
    await openUi(page);
    const panel = page.locator('.panel');
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeGreaterThan(380);
    expect(box.y + box.height).toBeGreaterThan(840);
    for (const name of ['Garden sounds', 'Pressed flowers', 'Garden data', 'Hints']) {
      const b = (await page.getByRole('button', { name }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    await plantSession(page, { task: 'Vocab', minutes: 25, species: 'fx-violet' });
    await expect(panel.locator('.task-name')).toHaveText('Vocab');
  });
});
