import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { openUi, reloadUi } from './ui-helpers';

async function openMixer(page: Page) {
  await page.evaluate(() => window.sprout!.freeze());
  await page.locator('.menu').getByRole('button', { name: 'Sound mixer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your soundscape' });
  await expect(sheet).toBeVisible();
  return sheet;
}
async function level(sheet: Locator, name: string, n: number) {
  await sheet.getByRole('slider', { name, exact: true }).fill(String(n));
}

test.describe('sound mixer', () => {
  test('a saved v2 garden migrates without losing plants or turning sound on', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.addPlants(1));
    const legacy = await page.evaluate(() => {
      const state = JSON.parse(window.sprout!.exportState()).state;
      state.version = 2;
      delete state.settings.soundscape;
      return state;
    });
    await page.addInitScript((json) => localStorage.setItem('studysprout:v1', json), JSON.stringify(legacy));
    await reloadUi(page);
    expect(await page.evaluate(() => window.sprout!.state().version)).toBe(4);
    expect(await page.evaluate(() => window.sprout!.state().plants)).toEqual(legacy.plants);
    const sheet = await openMixer(page);
    await expect(sheet.getByRole('button', { name: 'Follow the garden', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('studysprout:v1')!).version)).toBe(4);
  });

  test('two collections retain their mixes; sound stays off until Listen; quick mute stays in sync', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    await expect(sheet.getByRole('heading', { name: 'Your soundscape' })).toBeFocused();
    await expect(sheet.getByRole('button', { name: 'Scenery sounds', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.locator('.sound-layer:visible')).toHaveCount(5);
    await sheet.getByRole('button', { name: 'Rain on the eaves', exact: true }).click();
    await expect(sheet.getByRole('slider', { name: 'Soft rain volume' })).toHaveValue('80');
    await expect(sheet.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(true);
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    await expect(sheet.locator('.sound-layer:visible')).toHaveCount(9);
    await level(sheet, 'Café volume', 42);
    await level(sheet, 'Lo-fi volume', 27);
    await level(sheet, 'Overall volume', 65);
    await sheet.getByRole('button', { name: 'Scenery sounds', exact: true }).click();
    await expect(sheet.getByRole('slider', { name: 'Soft rain volume' })).toHaveValue('80');
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    await expect(sheet.getByRole('slider', { name: 'Café volume' })).toHaveValue('42');
    await sheet.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Mute sounds', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu').getByRole('button', { name: 'Sound mixer' })).toBeFocused();
    const quickMute = page.locator('.menu').getByRole('button', { name: 'Garden sounds', exact: true });
    await expect(quickMute).toHaveAttribute('aria-pressed', 'true');
    await quickMute.click();
  });

  test('Standard levels, overall volume and the selected collection persist across reloads', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    await level(sheet, 'Café volume', 42);
    await level(sheet, 'Lo-fi volume', 27);
    await level(sheet, 'Overall volume', 65);
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    const restored = await openMixer(page);
    await expect(restored.getByRole('slider', { name: 'Café volume' })).toHaveValue('42');
    await expect(restored.getByRole('slider', { name: 'Lo-fi volume' })).toHaveValue('27');
    await expect(restored.getByRole('slider', { name: 'Overall volume' })).toHaveValue('65');
    await expect(restored.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
  });

  test('scenery changes update the palette and restore each garden’s mix, while Standard stays universal', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    await level(sheet, 'Pond water volume', 88);
    await page.evaluate(() => window.sprout!.audio.setScenery('coast'));
    await expect(sheet.locator('.sound-place')).toHaveText('The seaside garden');
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toBeHidden();
    await level(sheet, 'Ocean waves volume', 63);
    await page.evaluate(() => window.sprout!.audio.setScenery('pond'));
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toHaveValue('88');
    await page.evaluate(() => window.sprout!.audio.setScenery('coast'));
    await expect(sheet.getByRole('slider', { name: 'Ocean waves volume' })).toHaveValue('63');
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    await level(sheet, 'Fireplace volume', 38);
    await page.evaluate(() => window.sprout!.audio.setScenery('pond'));
    await expect(sheet.getByRole('slider', { name: 'Fireplace volume' })).toHaveValue('38');
    await expect(sheet.getByRole('button', { name: 'Standard sounds', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('importing and resetting settings update the running audio gate as well as the mixer', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    await level(sheet, 'Soft rain volume', 35);
    await level(sheet, 'Overall volume', 55);
    const saved = await page.evaluate(() => window.sprout!.exportState());
    await sheet.getByRole('button', { name: 'Listen', exact: true }).click();
    expect(await page.evaluate(() => window.sprout!.audio.isMuted())).toBe(false);
    await level(sheet, 'Overall volume', 20);
    const ok = await page.evaluate((json) => window.sprout!.importState(json).ok, saved);
    expect(ok).toBe(true);
    await expect(sheet.getByRole('slider', { name: 'Overall volume' })).toHaveValue('55');
    expect(await page.evaluate(() => window.sprout!.audio.isMuted())).toBe(true);
    await sheet.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.evaluate(() => window.sprout!.reset());
    expect(await page.evaluate(() => window.sprout!.audio.isMuted())).toBe(true);
    await expect(sheet.getByRole('button', { name: 'Follow the garden', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('layer toggles, clear, automatic mode and keyboard sliders work without discarding preferences', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    await sheet.getByRole('button', { name: 'After dusk', exact: true }).click();
    const crickets = sheet.getByRole('button', { name: 'Crickets', exact: true });
    await expect(crickets).toHaveAttribute('aria-pressed', 'true');
    await crickets.click();
    await expect(sheet.getByRole('slider', { name: 'Crickets volume' })).toHaveValue('0');
    await crickets.click();
    await expect(sheet.getByRole('slider', { name: 'Crickets volume' })).toHaveValue('65');
    const range = sheet.getByRole('slider', { name: 'Crickets volume' });
    await range.focus(); await page.keyboard.press('ArrowRight');
    await expect(range).toHaveValue('66');
    await sheet.getByRole('button', { name: 'Follow the garden', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Follow the garden', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.locator('[data-sound="crickets"] output')).toHaveText('Auto');
    await sheet.getByRole('button', { name: 'Follow the garden', exact: true }).click();
    await expect(range).toHaveValue('66');
    await sheet.getByRole('button', { name: 'Clear this mix', exact: true }).click();
    await expect(sheet.locator('.sound-status')).toContainText('Your mix is quiet');
    expect(await sheet.locator('.sound-layer:visible input').evaluateAll((els) => els.every((el) => (el as HTMLInputElement).value === '0'))).toBe(true);
  });

  test('real audio graph: every Standard layer is audible, quiet, and zero channels silence scheduled birds', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.freeze());
    const measured = await page.evaluate(async () => {
      const api = window.sprout!.audio;
      const kinds = ['rain', 'waves', 'wind', 'birds', 'fire', 'cafe', 'lofi', 'white', 'brown'] as const;
      const values = [];
      for (const id of kinds) values.push({ id, ...await api.measure({ [id]: 100 }) });
      return { values, silent: await api.measure({}), birdsOff: await api.measure({ birds: 100 }, 0),
        all: await api.measure(Object.fromEntries(kinds.map((id) => [id, 100]))) };
    });
    for (const m of measured.values) {
      expect(m.rms, `${m.id} is audible`).toBeGreaterThan(0.0001);
      expect(m.peak, `${m.id} has no volume spike`).toBeLessThan(0.2);
    }
    expect(measured.silent.peak).toBe(0);
    expect(measured.birdsOff.peak).toBeLessThan(0.00001);
    expect(measured.all.peak).toBeLessThan(0.3);
  });
});

for (const width of [390, 320]) {
  test(`phone ${width}: mixer fits, keyboard and touch targets stay reachable, paper does not scroll behind it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openUi(page, 'widget=fake');
    const sheet = await openMixer(page);
    await sheet.getByRole('button', { name: 'Standard sounds', exact: true }).click();
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const y = await page.evaluate(() => scrollY);
    await sheet.getByRole('slider', { name: 'Brown noise volume' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(sheet.getByRole('slider', { name: 'Brown noise volume' })).toHaveValue('1');
    const box = (await sheet.getByRole('slider', { name: 'Brown noise volume' }).boundingBox())!;
    const footer = (await sheet.locator('.sound-footer').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThan(footer.y);
    await page.mouse.move(2, 400); await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.menu').getByRole('button', { name: 'Sound mixer' })).toBeFocused();
  });
}
