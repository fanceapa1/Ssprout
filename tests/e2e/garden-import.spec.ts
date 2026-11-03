import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GardenState } from '../../src/core/state';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * Importing gardens through Garden data (S17): a real schema-v3 export (made with the last v3
 * build's Export button) lands in the Japanese garden, and a v4 export with plants in both
 * gardens round-trips. docs/systems/scenery.md › Tests.
 */
const V3_FILE = resolve('src/core/fixtures/garden-v3-export.json');
const v3Export = JSON.parse(readFileSync(V3_FILE, 'utf8')) as { state: GardenState };

const dataSheet = (page: Page) => page.locator('dialog[data-dialog="data"]');

async function openData(page: Page) {
  await page.locator('.menu').getByRole('button', { name: 'Garden data' }).click();
  await expect(dataSheet(page)).toBeVisible();
}

async function importFile(page: Page, file: string, confirm: RegExp) {
  const sheet = dataSheet(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), sheet.getByRole('button', { name: 'Import a garden…' }).click()]);
  await chooser.setFiles(file);
  await expect(sheet.locator('.import-confirm')).toContainText(confirm);
  await sheet.getByRole('button', { name: 'Replace' }).click();
  await expect(sheet.locator('.data-status')).toContainText('restored');
}

/** The finished plants the plant system shows for the garden on view, once painted. */
const shownFinished = (page: Page) =>
  page.evaluate(async () => {
    await window.sprout!.plantsReady();
    return window.sprout!.plants.state().finished.map((p) => p.id).sort();
  });

const show = (page: Page, id: 'japanese-garden' | 'waterfall') => page.evaluate((id) => window.sprout!.showScenery(id), id);

test.describe('garden import · sceneries (S17)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('a real v3 export imports into the Japanese garden with everything intact', async ({ page }) => {
    await openUi(page);
    await show(page, 'waterfall');
    await openData(page);
    await importFile(page, V3_FILE, /4 plants/);
    const v3 = v3Export.state;
    const s = await page.evaluate(() => window.sprout!.state());
    expect(s.version).toBe(4);
    expect(s.scenery).toBe('japanese-garden');
    // its sessions may have finished since the file was made: every one is kept, as a session or in the log
    const all = [...s.plants, ...s.pressed, ...s.waiting, ...s.log, ...(s.session ? [s.session] : [])];
    expect(all.every((x) => x.sceneryId === 'japanese-garden')).toBe(true);
    const plantIds = s.plants.map((p) => p.id);
    for (const p of v3.plants) expect(plantIds).toContain(p.id);
    expect(s.pressed.map((p) => p.speciesId)).toEqual(expect.arrayContaining(v3.pressed.map((p) => p.speciesId)));
    const known = [...s.log.map((e) => e.id), ...s.waiting.map((w) => w.id), ...(s.session ? [s.session.id] : [])];
    for (const id of [v3.session!.id, ...v3.waiting.map((w) => w.id), ...v3.log.map((e) => e.id)]) expect(known).toContain(id);
    expect(s.schedules).toEqual(v3.schedules);
    expect(s.settings.soundscape).toMatchObject(v3.settings.soundscape as unknown as Record<string, unknown>);
    expect(s.settings.soundscape!.standard.falls).toBe(0);

    // the garden on view is the Japanese garden, with the file's plants; the waterfall is empty
    await page.keyboard.press('Escape');
    await expect(page.locator('.dock-section[data-section="gardens"] button.garden-card[data-scenery="japanese-garden"]')).toHaveAttribute('aria-pressed', 'true');
    await show(page, 'japanese-garden');
    expect(await shownFinished(page)).toEqual(plantIds.sort());
    await show(page, 'waterfall');
    expect(await shownFinished(page)).toEqual([]);
  });

  test('a v4 export with plants in both gardens round-trips', async ({ page }, info) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.addPlants(3, undefined, 'japanese-garden');
      window.sprout!.addPlants(4, undefined, 'waterfall');
    });
    await show(page, 'waterfall');
    const before = await page.evaluate(() => window.sprout!.state());
    const ids = (sceneryId: string) => before.plants.filter((p) => p.sceneryId === sceneryId).map((p) => p.id).sort();
    expect(ids('japanese-garden')).toHaveLength(3);
    expect(ids('waterfall')).toHaveLength(4);

    await openData(page);
    const [download] = await Promise.all([page.waitForEvent('download'), dataSheet(page).getByRole('button', { name: 'Export garden' }).click()]);
    const file = info.outputPath('two-gardens.json');
    await download.saveAs(file);

    await page.evaluate(() => window.sprout!.reset());
    expect(await page.evaluate(() => window.sprout!.state().plants)).toEqual([]);
    await importFile(page, file, /7 plants/);
    const after = await page.evaluate(() => window.sprout!.state());
    expect(after.plants).toEqual(before.plants);
    expect(after.scenery).toBe('waterfall');
    await page.keyboard.press('Escape');

    await show(page, 'waterfall');
    expect(await shownFinished(page)).toEqual(ids('waterfall'));
    await show(page, 'japanese-garden');
    expect(await shownFinished(page)).toEqual(ids('japanese-garden'));
  });
});
