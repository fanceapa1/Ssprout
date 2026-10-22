import { expect, test } from './fixtures';
import { openUi, plantSession, reloadUi, setMinutes } from './ui-helpers';

/**
 * The planting sheet's details from SPEC §2 "Planting a session", steps 1, 2 and 4:
 * the task name, the total time control and what each plant card shows.
 * Flows run on the dev fixture species (`?fixtures`, ADR 0055) next to the real ones.
 */
test.describe('ui · start flow details', () => {
  test('an empty task name plants a “Study session”; the field suggests a task', async ({ page }) => {
    await openUi(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    const task = sheet.getByLabel('What are you studying?');
    await expect(task).toHaveValue('');
    expect((await task.getAttribute('placeholder'))?.trim().length ?? 0).toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    await plantSession(page, { task: '   ', minutes: 25, species: 'fx-violet' });
    expect(await page.evaluate(() => window.sprout!.state().session?.taskName)).toBe('Study session');
    await expect(page.locator('.panel .task-name')).toHaveText('Study session');
  });

  test('total time: a 10–180 slider in 5-minute steps with quick picks 25/50/90', async ({ page }) => {
    await openUi(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    const slider = sheet.locator('input.duration');
    await expect(slider).toHaveAttribute('min', '10');
    await expect(slider).toHaveAttribute('max', '180');
    await expect(slider).toHaveAttribute('step', '5');
    const picks = await sheet.locator('button.preset').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.minutes));
    expect(picks).toEqual(['25', '50', '90']);
    await sheet.getByRole('button', { name: '50 minutes' }).click();
    await expect(slider).toHaveValue('50');
    await expect(sheet.getByRole('button', { name: '50 minutes' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the last total is remembered for the next session, also after a reload', async ({ page }) => {
    await openUi(page);
    const slider = page.locator('dialog[data-dialog="planting"] input.duration');
    // a session of 65 minutes: the sheet opens on 65 next time, also after a reload
    await plantSession(page, { minutes: 65, species: 'fx-violet' });
    expect(await page.evaluate(() => window.sprout!.state().settings.lastGoalMinutes)).toBe(65);
    await page.locator('.panel').getByRole('button', { name: 'End', exact: true }).click();
    await page.locator('.panel .confirm-cancel').getByRole('button', { name: 'End' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'idle');
    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(slider).toHaveValue('65');
    await page.keyboard.press('Escape');

    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(page.locator('dialog[data-dialog="planting"] input.duration')).toHaveValue('65');
  });

  test('plant cards: painted preview, name, native name, poetic line and habitat; locked ones say what they need', async ({ page }) => {
    await openUi(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    await setMinutes(page, 25);
    const sheet = page.locator('dialog[data-dialog="planting"]');

    const iris = sheet.locator('.plant-card[data-species-id="fx-iris"]');
    await expect(iris.locator('.plant-name')).toHaveText('Japanese Iris');
    await expect(iris.locator('.plant-native')).toHaveText('Hanashōbu');
    await expect(iris.locator('.plant-desc')).toHaveText('Violet sails unfurled where the water meets the bank.');
    await expect(iris.locator('.plant-habitat')).not.toBeEmpty();
    const inked = await iris.locator('canvas.plant-preview').evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
      return n / (data.length / 4);
    });
    expect(inked, 'the preview is painted').toBeGreaterThan(0.02);

    // every real species card has the same parts (names come from the species files)
    const real = sheet.locator('.plant-card[data-locked="false"]:not([data-species-id^="fx-"])');
    expect(await real.count()).toBeGreaterThan(0);
    for (const card of await real.all()) {
      await expect(card.locator('.plant-name')).not.toBeEmpty();
      await expect(card.locator('.plant-desc')).not.toBeEmpty();
      await expect(card.locator('.plant-habitat')).not.toBeEmpty();
    }

    // a locked card keeps its name and preview but shows the minutes it needs instead
    const peony = sheet.locator('.plant-card[data-species-id="fx-peony"]');
    await expect(peony).toHaveAttribute('data-locked', 'true');
    await expect(peony.locator('.plant-name')).toHaveText('Tree Peony');
    await expect(peony.locator('.plant-desc')).toHaveText('Needs 50 min+');
    await expect(peony.locator('.plant-habitat')).toHaveCount(0);
  });
});
