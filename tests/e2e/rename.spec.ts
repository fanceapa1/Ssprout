import { mkdir } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { openUi, reloadUi } from './ui-helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`rename a plant at ${viewport.width}px`, () => {
    // This flow paints a real species and reopens the whole garden after a reload.
    test.describe.configure({ timeout: 120_000 });
    test.use({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });

    test('rename directly from Study without opening a plant card', async ({ page }) => {
      await openUi(page);
      await page.evaluate(async () => {
        const s = window.sprout!;
        s.start(25, { taskName: 'Biology', speciesId: 'fx-violet' });
        await s.plants.settle();
        await s.ui.scrollTo('session', { instant: true });
      });
      const panel = page.locator('.panel');
      const rename = panel.getByRole('button', { name: 'Rename', exact: true });
      const input = panel.getByRole('textbox', { name: 'Study session name' });
      await expect(rename).toBeVisible();
      await expect(page.locator('[data-ui="plant-card"]')).toBeHidden();
      await rename.click();
      await expect(input).toBeFocused();
      await input.fill('Discard me');
      await input.press('Escape');
      await expect(panel.locator('.task-name')).toHaveText('Biology');
      await expect(rename).toBeFocused();
      await rename.click();
      await input.fill('  Cell biology  ');
      await page.evaluate(() => window.sprout!.advance(60_000));
      await expect(input).toHaveValue('  Cell biology  ');
      await panel.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(panel.locator('.task-name')).toHaveText('Cell biology');
      await expect(input).toBeHidden();
      await mkdir('artifacts/rename', { recursive: true });
      await page.screenshot({ path: `artifacts/rename/study-${viewport.width}.png` });
      await reloadUi(page);
      await expect(panel.locator('.task-name')).toHaveText('Cell biology');
      await expect(rename).toBeVisible();
    });

    test('rename a growing session and its finished plant, then reload', async ({ page }) => {
      await openUi(page);
      const id = await page.evaluate(async () => {
        const s = window.sprout!;
        s.setTime('noon');
        const session = s.start(25, { taskName: 'Biology', speciesId: 'japanese-iris' })!;
        await s.plants.settle();
        s.camera.openCard(session.id);
        await s.camera.settle();
        return session.id;
      });
      const card = page.locator('[data-ui="plant-card"]');
      await card.getByRole('button', { name: 'Rename', exact: true }).click();
      const input = card.getByRole('textbox', { name: 'Study session name' });
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('Biology');
      await input.fill('  Cell biology  ');
      // A progress update must not replace a draft or move focus.
      await page.evaluate(() => window.sprout!.advance(60_000));
      await expect(input).toHaveValue('  Cell biology  ');
      await expect(input).toBeFocused();
      await mkdir('artifacts/rename', { recursive: true });
      await page.screenshot({ path: `artifacts/rename/edit-${viewport.width}.png` });
      await input.press('Enter');
      await expect(input).toBeHidden();
      await expect(card.locator('.plant-story-taskname')).toHaveText('“Cell biology”');
      expect(await page.evaluate(() => window.sprout!.state().session?.taskName)).toBe('Cell biology');
      await expect(page.locator('.panel')).toContainText('Cell biology');

      await page.evaluate(async () => {
        window.sprout!.completeSession();
        await window.sprout!.plants.settle();
      });
      await expect(card).toHaveAttribute('data-kind', 'finished');
      await card.getByRole('button', { name: 'Rename', exact: true }).click();
      await input.fill('Final revision');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(card.locator('.plant-story-taskname')).toHaveText('“Final revision”');
      const saved = await page.evaluate(() => ({ plant: window.sprout!.state().plants[0]?.taskName, log: window.sprout!.state().log[0]?.taskName }));
      expect(saved).toEqual({ plant: 'Final revision', log: 'Final revision' });
      await page.screenshot({ path: `artifacts/rename/saved-${viewport.width}.png` });
      await reloadUi(page);
      await page.evaluate(async (plantId) => {
        window.sprout!.camera.openCard(plantId);
        await window.sprout!.camera.settle();
      }, id);
      await expect(card.locator('.plant-story-taskname')).toHaveText('“Final revision”');
      expect(await page.evaluate(() => window.sprout!.state().log[0]?.taskName)).toBe('Final revision');
    });

    test('Cancel and Escape discard drafts; blank saves use the default', async ({ page }) => {
      await openUi(page);
      await page.evaluate(async () => {
        const s = window.sprout!;
        const session = s.start(25, { taskName: 'Original', speciesId: 'fx-violet' })!;
        s.start(25, { taskName: 'Active task', speciesId: 'fx-iris' });
        await s.plants.settle();
        s.camera.openCard(session.id);
        await s.camera.settle();
      });
      const card = page.locator('[data-ui="plant-card"]');
      const rename = card.getByRole('button', { name: 'Rename', exact: true });
      const input = card.getByRole('textbox', { name: 'Study session name' });
      for (const method of ['cancel', 'escape']) {
        await rename.click();
        await input.fill('Discard this');
        if (method === 'cancel') await card.getByRole('button', { name: 'Cancel', exact: true }).click();
        else await input.press('Escape');
        await expect(card).toBeVisible();
        await expect(rename).toBeFocused();
        await expect(card.locator('.plant-story-taskname')).toHaveText('“Original”');
      }
      await rename.click();
      await input.fill('   ');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(card.locator('.plant-story-taskname')).toHaveText('“Study session”');
      const sessions = await page.evaluate(() => window.sprout!.state());
      expect(sessions.session?.taskName).toBe('Active task');
      expect(sessions.waiting[0]?.taskName).toBe('Study session');
      expect(sessions.waiting[0]?.pausedAt).not.toBeNull();
    });
  });
}
