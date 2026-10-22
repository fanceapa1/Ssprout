import { writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { openUi, plantSession, reloadUi } from './ui-helpers';

test.describe('ui · menu, tips and data', () => {
  test('tips show near their control, retire when used, and stay listed under ⓘ', async ({ page }) => {
    await openUi(page);
    // fresh garden: one note at a time — the one by Start studying first; the speaker's waits
    const startTip = page.locator('.tip[data-tip-id="notifications"]');
    await expect(startTip).toBeVisible();
    const soundTip = page.locator('.tip[data-tip-id="sound"]');
    await expect(soundTip).toHaveCount(0);
    expect((await page.evaluate(() => window.sprout!.ui.state())).tips).toEqual(['notifications']);
    // tips never block clicks
    await expect(page.locator('.tips')).toHaveCSS('pointer-events', 'none');

    // using the speaker retires its tip, even while it was still waiting its turn
    await page.locator('.menu').getByRole('button', { name: 'Garden sounds' }).click();
    await expect(soundTip).toHaveCount(0);
    expect(await page.evaluate(() => window.sprout!.state().tips.sound)).toBe('seen');

    // inside the planting sheet, sheet tips appear next to their controls
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheetTips = page.locator('dialog[data-dialog="planting"] .tip');
    await expect(sheetTips.first()).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('.menu').getByRole('button', { name: 'Hints' }).click();
    const hints = page.locator('dialog[data-dialog="hints"]');
    await expect(hints).toBeVisible();
    await expect(hints.locator('.hint[data-tip-id="sound"]')).toHaveAttribute('data-retired', 'true');
    await expect(hints.locator('.hint[data-tip-id="sound"]')).toContainText('learned');
    expect(await hints.locator('.hint').count()).toBeGreaterThanOrEqual(7);
  });

  test('sound toggle persists across reloads', async ({ page }) => {
    await openUi(page);
    const sound = page.locator('.menu').getByRole('button', { name: 'Garden sounds' });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(false);
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    await expect(page.locator('.menu').getByRole('button', { name: 'Garden sounds' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.menu').getByRole('button', { name: 'Garden sounds' }).click();
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(true);
  });

  test('floating timer button follows the widget integration', async ({ page }) => {
    await openUi(page);
    // the real widget (Document PiP): the button exists exactly when it is supported
    const supported = await page.evaluate(() => window.sprout!.widget!.supported());
    await expect(page.locator('.menu').getByRole('button', { name: 'Floating timer' })).toHaveCount(supported ? 1 : 0);
    // the fake integration: opening from the button and retiring the tip
    await openUi(page, 'widget=fake');
    const btn = page.locator('.menu').getByRole('button', { name: 'Floating timer' });
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

    await page.locator('.menu').getByRole('button', { name: 'Garden data' }).click();
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
    // announced on first sight (ADR 0120): the koi is in the pond at once, the dragonfly only visits
    await expect(line).toContainText(/koi/i);
    await expect.poll(() => page.evaluate(() => window.sprout!.state().faunaSeen)).toEqual(expect.arrayContaining(['koi-1']));
  });

  test('the controls on the painting rest while studying and wake on pointer movement', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    await page.evaluate(() => window.sprout!.ui.setTimeScale(0.01));
    // focus out of the pill (Begin put it on Pause), pointer away from it
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(600, 300);
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().resting)).toBe(true);
    await expect(page.locator('.pill')).toHaveCSS('opacity', '0.42');
    await expect(page.locator('.menu')).toHaveCSS('opacity', '0.32');
    // the session controls below the garden never fade: they are read on paper, not over the painting
    await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
    await page.evaluate(() => window.sprout!.ui.setTimeScale(100));
    await page.mouse.move(200, 200);
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().resting)).toBe(false);
  });
});

test.describe('ui · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the garden fills the screen, the controls stack below it, menu reachable, planting works by touch', async ({ page }) => {
    await openUi(page);
    // the stage: ~88 % of the height below an 8 px margin; none of the session controls covers it
    const stage = (await page.locator('#stage').boundingBox())!;
    expect(stage.y).toBeCloseTo(8, 0);
    expect(stage.x).toBeCloseTo(8, 0);
    expect(stage.height / 844).toBeGreaterThan(0.85);
    expect(stage.height / 844).toBeLessThan(0.9);
    const panel = page.locator('.panel');
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThan(stage.y + stage.height);
    // one column: the plant view comes after the session controls, at the same left edge
    const session = (await page.locator('[data-section="session"]').boundingBox())!;
    const plant = (await page.locator('[data-section="plant"]').boundingBox())!;
    expect(plant.y).toBeGreaterThan(session.y + session.height - 1);
    expect(Math.abs(plant.x - session.x)).toBeLessThan(2);
    for (const name of ['Garden sounds', 'Pressed flowers', 'Garden data', 'Hints']) {
      const b = (await page.locator('.menu').getByRole('button', { name }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    // the pill sits on the garden, inside the screen
    const pill = (await page.locator('.pill').boundingBox())!;
    expect(pill.y + pill.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(pill.x).toBeGreaterThanOrEqual(0);
    expect(pill.x + pill.width).toBeLessThanOrEqual(390);
    await plantSession(page, { task: 'Vocab', minutes: 25, species: 'fx-violet' });
    await expect(panel.locator('.task-name')).toHaveText('Vocab');
  });
});
