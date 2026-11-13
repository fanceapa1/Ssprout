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
    await expect(sheet.locator('.sound-place')).toHaveText('The Greek coast');
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toBeHidden();
    await level(sheet, 'The sea on the pebbles volume', 63);
    await page.evaluate(() => window.sprout!.audio.setScenery('pond'));
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toHaveValue('88');
    await page.evaluate(() => window.sprout!.audio.setScenery('coast'));
    await expect(sheet.getByRole('slider', { name: 'The sea on the pebbles volume' })).toHaveValue('63');
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

  test('viewing the waterfall garden brings its sounds: the falls in the palette, its presets, and back at the pond (ADR 0283)', async ({ page }) => {
    await openUi(page);
    const sheet = await openMixer(page);
    expect(await page.evaluate(() => window.sprout!.audio.getScenery())).toBe('pond');
    await page.evaluate(() => window.sprout!.showScenery('waterfall'));
    expect(await page.evaluate(() => window.sprout!.audio.getScenery())).toBe('waterfall');
    await expect(sheet.locator('.sound-place')).toHaveText('The rocky waterfall');
    await expect(sheet.getByRole('slider', { name: 'The falls volume' })).toBeVisible();
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toBeHidden();
    await expect(sheet.getByRole('button', { name: 'By the falls', exact: true })).toBeVisible();
    await level(sheet, 'The falls volume', 64);
    await page.evaluate(() => window.sprout!.showScenery('japanese-garden'));
    expect(await page.evaluate(() => window.sprout!.audio.getScenery())).toBe('pond');
    await expect(sheet.getByRole('slider', { name: 'Pond water volume' })).toBeVisible();
    await expect(sheet.getByRole('slider', { name: 'The falls volume' })).toBeHidden();
    await page.evaluate(() => window.sprout!.showScenery('waterfall'));
    await expect(sheet.getByRole('slider', { name: 'The falls volume' })).toHaveValue('64');
  });

  test('viewing the oasis brings its own sounds: the seguia, the palms, its words and presets, a mix kept per garden (ADR 0303)', async ({ page }) => {
    await openUi(page, 'scenery=oasis');
    const sheet = await openMixer(page);
    await page.evaluate(() => window.sprout!.showScenery('oasis'));
    expect(await page.evaluate(() => window.sprout!.audio.getScenery())).toBe('oasis');
    await expect(sheet.locator('.sound-place')).toHaveText('The Ksar oasis');
    for (const name of ['The seguia', 'Wind in the palms', 'Doves and buntings', 'Insects and geckos', 'Soft rain']) {
      await expect(sheet.getByRole('slider', { name: `${name} volume`, exact: true })).toBeVisible();
    }
    for (const name of ['Pond water', 'The falls', 'Wind in the leaves']) {
      await expect(sheet.getByRole('slider', { name: `${name} volume`, exact: true })).toBeHidden();
    }
    await expect(sheet.getByRole('button', { name: 'In the palm grove', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'By the falls', exact: true })).toBeHidden();
    await level(sheet, 'The seguia volume', 42);
    // back at the pond the shared layers take their own words again
    await page.evaluate(() => window.sprout!.showScenery('japanese-garden'));
    await expect(sheet.getByRole('slider', { name: 'Distant birds volume', exact: true })).toBeVisible();
    await expect(sheet.getByRole('slider', { name: 'Crickets volume', exact: true })).toBeVisible();
    await expect(sheet.getByRole('slider', { name: 'The seguia volume', exact: true })).toBeHidden();
    await page.evaluate(() => window.sprout!.showScenery('oasis'));
    await expect(sheet.getByRole('slider', { name: 'The seguia volume', exact: true })).toHaveValue('42');
    const saved = await page.evaluate(() => window.sprout!.state().settings.soundscape!.sceneries);
    expect(saved.oasis!.levels.seguia).toBe(42);
    expect(saved.pond).toBeUndefined();
  });

  test('viewing the coast brings its own sounds: the sea, the pines, the cicadas, its words and presets (ADR 0376)', async ({ page }) => {
    await openUi(page, 'scenery=coast');
    const sheet = await openMixer(page);
    await page.evaluate(() => window.sprout!.showScenery('coast'));
    expect(await page.evaluate(() => window.sprout!.audio.getScenery())).toBe('coast');
    await expect(sheet.locator('.sound-place')).toHaveText('The Greek coast');
    for (const name of ['The sea on the pebbles', 'Breeze in the pines', 'Cicadas', 'Gulls and goat bells', 'The owl and crickets', 'Soft rain']) {
      await expect(sheet.getByRole('slider', { name: `${name} volume`, exact: true })).toBeVisible();
    }
    for (const name of ['Pond water', 'Ocean waves', 'The seguia', 'Wind in the leaves']) {
      await expect(sheet.getByRole('slider', { name: `${name} volume`, exact: true })).toBeHidden();
    }
    await expect(sheet.getByRole('button', { name: 'A still night on the cove', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'In the palm grove', exact: true })).toBeHidden();
    await level(sheet, 'Cicadas volume', 12);
    await page.evaluate(() => window.sprout!.showScenery('japanese-garden'));
    await expect(sheet.getByRole('slider', { name: 'Cicadas volume', exact: true })).toBeHidden();
    await page.evaluate(() => window.sprout!.showScenery('coast'));
    await expect(sheet.getByRole('slider', { name: 'Cicadas volume', exact: true })).toHaveValue('12');
    const saved = await page.evaluate(() => window.sprout!.state().settings.soundscape!.sceneries);
    expect(saved.coast!.levels.cicadas).toBe(12);
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

  test('real audio graph: the waterfall sits as quietly as the pond and the switch glides without a dip or a jump (ADR 0283)', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.freeze());
    const r = await page.evaluate(async () => {
      const api = window.sprout!.audio;
      return {
        pond: await api.scene({ scenery: 'pond', seconds: 12 }),
        falls: await api.scene({ scenery: 'waterfall', seconds: 12 }),
        there: await api.scene({ scenery: 'pond', to: 'waterfall', switchAt: 4, seconds: 12 }),
        back: await api.scene({ scenery: 'waterfall', to: 'pond', switchAt: 4, seconds: 12 }),
      };
    });
    const mean = (w: number[]) => 10 * Math.log10(w.reduce((s, v) => s + 10 ** (v / 10), 0) / w.length);
    // windows are 250 ms; the first second is the beds settling
    const pond = mean(r.pond.windowsDb.slice(4)), falls = mean(r.falls.windowsDb.slice(4));
    expect(falls).toBeGreaterThan(-44);
    expect(falls).toBeLessThan(-34);
    // a waterfall is a little fuller than a still pond, never much louder
    expect(falls - pond).toBeGreaterThan(0);
    expect(falls - pond).toBeLessThan(4);
    expect(r.falls.peak).toBeLessThan(0.08);
    for (const [m, from, to] of [[r.there, r.pond, r.falls], [r.back, r.falls, r.pond]] as const) {
      const w = m.windowsDb.slice(4);
      // neighbouring quarter-seconds never jump, and the level never dips through the switch
      for (let i = 1; i < w.length; i++) expect(Math.abs(w[i]! - w[i - 1]!)).toBeLessThan(2.5);
      expect(Math.min(...w)).toBeGreaterThan(Math.min(mean(from.windowsDb.slice(4)), mean(to.windowsDb.slice(4))) - 3);
      // 6 s on, it sounds as the new garden does at that moment
      expect(Math.abs(mean(m.windowsDb.slice(-8)) - mean(to.windowsDb.slice(-8)))).toBeLessThan(1.5);
    }
  });

  test('real audio graph: the oasis sits as calmly as the pond, under the falls, and the switch glides (ADR 0303)', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.freeze());
    const r = await page.evaluate(async () => {
      const api = window.sprout!.audio;
      return {
        pond: await api.scene({ scenery: 'pond', seconds: 12 }),
        falls: await api.scene({ scenery: 'waterfall', seconds: 12 }),
        oasis: await api.scene({ scenery: 'oasis', seconds: 12 }),
        night: await api.scene({ scenery: 'oasis', seconds: 12, hour: 23 }),
        voices: await api.scene({ scenery: 'oasis', seconds: 30, hour: 8, events: true }),
        there: await api.scene({ scenery: 'pond', to: 'oasis', switchAt: 4, seconds: 12 }),
        back: await api.scene({ scenery: 'oasis', to: 'pond', switchAt: 4, seconds: 12 }),
      };
    });
    const mean = (w: number[]) => 10 * Math.log10(w.reduce((s, v) => s + 10 ** (v / 10), 0) / w.length);
    const pond = mean(r.pond.windowsDb.slice(4)), falls = mean(r.falls.windowsDb.slice(4)), oasis = mean(r.oasis.windowsDb.slice(4));
    // calm enough to study to: within a couple of dB of the pond, never over the falls
    expect(Math.abs(oasis - pond)).toBeLessThan(2.5);
    expect(oasis).toBeLessThan(falls);
    expect(mean(r.night.windowsDb.slice(4))).toBeLessThan(oasis + 0.5);
    expect(r.oasis.peak).toBeLessThan(0.08);
    // the morning's voices sound over the bed without ever standing out loudly
    expect(mean(r.voices.windowsDb.slice(4))).toBeGreaterThan(oasis - 1.5);
    expect(Math.max(...r.voices.windowsDb)).toBeLessThan(oasis + 6);
    for (const [m, from, to] of [[r.there, r.pond, r.oasis], [r.back, r.oasis, r.pond]] as const) {
      const w = m.windowsDb.slice(4);
      for (let i = 1; i < w.length; i++) expect(Math.abs(w[i]! - w[i - 1]!)).toBeLessThan(2.5);
      expect(Math.min(...w)).toBeGreaterThan(Math.min(mean(from.windowsDb.slice(4)), mean(to.windowsDb.slice(4))) - 3);
      expect(Math.abs(mean(m.windowsDb.slice(-8)) - mean(to.windowsDb.slice(-8)))).toBeLessThan(1.5);
    }
  });

  test('real audio graph: the coast sits between the pond and the falls, breathes without jumps, and the switch glides (ADR 0376)', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.freeze());
    const r = await page.evaluate(async () => {
      const api = window.sprout!.audio;
      return {
        pond: await api.scene({ scenery: 'pond', seconds: 12 }),
        falls: await api.scene({ scenery: 'waterfall', seconds: 12 }),
        coast: await api.scene({ scenery: 'coast', seconds: 24 }),
        night: await api.scene({ scenery: 'coast', seconds: 24, hour: 23 }),
        voices: await api.scene({ scenery: 'coast', seconds: 30, hour: 20, events: true,
          play: [[2, 'gull'], [7, 'goatbell'], [12, 'caique'], [16, 'chapel'], [21, 'scops']] as const }),
        there: await api.scene({ scenery: 'pond', to: 'coast', switchAt: 4, seconds: 12 }),
        back: await api.scene({ scenery: 'coast', to: 'pond', switchAt: 4, seconds: 12 }),
      };
    });
    const mean = (w: number[]) => 10 * Math.log10(w.reduce((s, v) => s + 10 ** (v / 10), 0) / w.length);
    const pond = mean(r.pond.windowsDb.slice(4)), falls = mean(r.falls.windowsDb.slice(4)), coast = mean(r.coast.windowsDb.slice(4));
    // calm enough to study to: within a couple of dB of the pond, under the falls
    expect(Math.abs(coast - pond)).toBeLessThan(2.5);
    expect(coast).toBeLessThan(falls);
    expect(r.coast.peak).toBeLessThan(0.08);
    // the sea breathes: a few dB between the waves and their wash, never a jump (its own swell steps ~2.2 dB a quarter-second)
    const sea = r.coast.windowsDb.slice(4);
    expect(Math.max(...sea) - Math.min(...sea)).toBeGreaterThan(3);
    for (let i = 1; i < sea.length; i++) expect(Math.abs(sea[i]! - sea[i - 1]!)).toBeLessThan(3);
    expect(mean(r.night.windowsDb.slice(4))).toBeLessThan(coast + 0.5);
    // the rare voices, packed close together, never stand out loudly
    expect(Math.max(...r.voices.windowsDb.slice(4))).toBeLessThan(coast + 6);
    expect(r.voices.peak).toBeLessThan(0.1);
    const quietest = (m: { windowsDb: number[] }) => Math.min(...m.windowsDb.slice(4));
    for (const [m, from, to] of [[r.there, r.pond, r.coast], [r.back, r.coast, r.pond]] as const) {
      const w = m.windowsDb.slice(4);
      for (let i = 1; i < w.length; i++) expect(Math.abs(w[i]! - w[i - 1]!)).toBeLessThan(3);
      // never dips below the quieter garden's own lulls between waves
      expect(Math.min(...w)).toBeGreaterThan(Math.min(quietest(from), quietest(to)) - 1.5);
      expect(Math.abs(mean(w.slice(-8)) - mean(to.windowsDb.slice(4)))).toBeLessThan(3);
    }
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
