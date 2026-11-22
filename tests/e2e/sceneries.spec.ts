import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { storedOf } from './paint-store';
import { calmUiMotion, plantSession, setMinutes } from './ui-helpers';

/**
 * Switching the garden on view at runtime (ADR 0243). Both gardens are offered to everyone since
 * S17. docs/systems/scenery.md › Switching.
 */

const show = (page: Page, id: string) => page.evaluate((id) => window.sprout!.showScenery(id as never), id);
const viewed = (page: Page) => page.evaluate(() => window.sprout!.scenery().viewed);
const sceneStats = (page: Page) => page.evaluate(() => window.sprout!.sceneStats());

/** The frame's mean colour at a pinned time, the ambience settled. */
const meanAt = (page: Page, time: 'noon' | 'sunset' | 'night') =>
  page.evaluate(async (time) => {
    const s = window.sprout!;
    s.setTime(time);
    await s.camera.settle();
    s.settleAmbience();
    await s.freeze();
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < data.length; i += 4 * 97, n++) for (let k = 0; k < 3; k++) sum[k]! += data[i + k]!;
    s.unfreeze();
    return sum.map((v) => v / n) as [number, number, number];
  }, time);

/** Ids of the finished plants and seedlings the plant system shows, once their sprites are in. */
async function shownPlants(page: Page): Promise<{ finished: string[]; seedlings: string[] }> {
  return page.evaluate(async () => {
    await window.sprout!.plantsReady();
    const s = window.sprout!.plants.state();
    return { finished: s.finished.map((p) => p.id).sort(), seedlings: s.seedlings.map((p) => p.id).sort() };
  });
}

/** An FNV-1a hash of the still frame at a pinned noon: only the scene's painting and the paper. */
async function frameHash(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = window.sprout!;
    s.setTime('noon');
    await s.camera.settle();
    const ids = s.mute({});
    const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper').map((id) => [id, '*']));
    mute.scene = ['waterSurface'];
    s.mute(mute);
    await s.freeze();
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i += 16) h = Math.imul(h ^ data[i]!, 0x01000193);
    s.mute({});
    s.unfreeze();
    return (h >>> 0).toString(16);
  });
}

test.describe('sceneries · switching the garden on view (ADR 0243)', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('the three gardens are offered without a flag; a new garden opens on the Japanese garden', async ({ page }) => {
    await openDev(page);
    expect(await page.evaluate(() => window.sprout!.scenery())).toMatchObject({ viewed: 'japanese-garden', available: ['japanese-garden', 'waterfall', 'oasis'] });
    await expect(show(page, 'coast')).rejects.toThrow(/not available/);
  });

  test('switches to the waterfall and back, cross-fading, without a reload', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    const garden = await frameHash(page);
    await show(page, 'waterfall');
    expect(await viewed(page)).toBe('waterfall');
    expect(await page.evaluate(() => window.sprout!.scenery().fade)).toBeGreaterThan(0);
    await page.waitForFunction(() => window.sprout!.scenery().fade === 0);
    expect(await page.evaluate(() => window.sprout!.camera.state().overview)).toBe(true);
    const falls = await frameHash(page);
    expect(falls).not.toBe(garden);
    await show(page, 'japanese-garden');
    await page.waitForFunction(() => window.sprout!.scenery().fade === 0);
    expect(await frameHash(page)).toBe(garden);
    // the same page all along
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });

  test('the second switch to the same garden comes from the paint cache', async ({ page }) => {
    await openDev(page);
    await show(page, 'waterfall');
    const first = await sceneStats(page);
    expect(first.cacheMisses).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await show(page, 'japanese-garden');
    const back = await sceneStats(page);
    expect(back.cacheHits).toBeGreaterThan(first.cacheHits);
    await page.evaluate(() => window.sprout!.paintCache.settle());
    await show(page, 'waterfall');
    const again = await sceneStats(page);
    expect(again.cacheHits).toBeGreaterThan(back.cacheHits);
    expect(again.paints).toBe(back.paints);
  });

  test('each garden shows only its own plants', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.addPlants(3, undefined, 'japanese-garden');
      window.sprout!.addPlants(2, undefined, 'waterfall');
    });
    const ids = await page.evaluate(() => window.sprout!.state().plants.map((p) => [p.id, p.sceneryId] as const));
    const of = (s: string) => ids.filter(([, x]) => x === s).map(([id]) => id).sort();
    expect((await shownPlants(page)).finished).toEqual(of('japanese-garden'));
    await show(page, 'waterfall');
    expect((await shownPlants(page)).finished).toEqual(of('waterfall'));
    await show(page, 'japanese-garden');
    expect((await shownPlants(page)).finished).toEqual(of('japanese-garden'));
  });

  test('a session keeps counting while another garden is on view; switching to it brings its garden back', async ({ page }) => {
    await openDev(page);
    const pond = await page.evaluate(() => window.sprout!.start(25, { taskName: 'Pond' })!.id);
    expect((await shownPlants(page)).seedlings).toEqual([pond]);
    await show(page, 'waterfall');
    expect((await shownPlants(page)).seedlings).toEqual([]);
    const before = await page.evaluate((id) => window.sprout!.sessions().find((s) => s.id === id)!.elapsedMs, pond);
    await page.evaluate(() => window.sprout!.advance(5 * 60_000));
    const after = await page.evaluate((id) => window.sprout!.sessions().find((s) => s.id === id)!.elapsedMs, pond);
    expect(after - before).toBeGreaterThanOrEqual(5 * 60_000 - 1000);

    // a session in the waterfall becomes active (the pond one waits), then the pond one again
    const falls = await page.evaluate(() => window.sprout!.start(25, { taskName: 'Falls', sceneryId: 'waterfall' })!.id);
    expect(await viewed(page)).toBe('waterfall');
    expect((await shownPlants(page)).seedlings).toEqual([falls]);
    await page.evaluate((id) => window.sprout!.switchTo(id), pond);
    expect(await viewed(page)).toBe('japanese-garden');
    await show(page, 'japanese-garden'); // already on view: waits for it to be ready
    expect((await shownPlants(page)).seedlings).toEqual([pond]);
  });
});

test.describe('sceneries · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the switch is a cut', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDev(page);
    await show(page, 'waterfall');
    expect(await page.evaluate(() => window.sprout!.scenery())).toMatchObject({ viewed: 'waterfall', fade: 0 });
  });

  test('the waterfall has its own daylight: night is darker and bluer than noon, and its plates come from the cache', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDev(page);
    await show(page, 'waterfall');
    const mean = (time: 'noon' | 'night') => meanAt(page, time);
    const noon = await mean('noon');
    const night = await mean('night');
    expect(night[0] + night[1] + night[2]).toBeLessThan((noon[0] + noon[1] + noon[2]) * 0.85);
    expect(night[2] / (night[0] + 1)).toBeGreaterThan(noon[2] / (noon[0] + 1));
    // its plates are stored under its own keys (ADR 0242); a second load takes them from the cache
    await expect.poll(async () => (await storedOf(page, 'sky-plate')).filter((e) => e.key.startsWith('waterfall|')).length, { timeout: 80_000 }).toBeGreaterThanOrEqual(2);
    await openDev(page);
    await show(page, 'waterfall');
    await mean('night');
    expect((await page.evaluate(() => window.sprout!.skyStats()!)).cacheHits).toBeGreaterThanOrEqual(1);
  });

  test('the oasis has its own daylight: a golden sunset, a dark blue night, its plates under its keys (O5)', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDev(page, 'scenery=oasis');
    await show(page, 'oasis');
    const noon = await meanAt(page, 'noon');
    const sunset = await meanAt(page, 'sunset');
    const night = await meanAt(page, 'night');
    // noon is warm sand, not grey: red over blue; sunset warmer still; night darker and bluer
    expect(noon[0]).toBeGreaterThan(noon[2] + 15);
    expect(sunset[0] / (sunset[2] + 1)).toBeGreaterThan(noon[0] / (noon[2] + 1));
    expect(night[0] + night[1] + night[2]).toBeLessThan((noon[0] + noon[1] + noon[2]) * 0.85);
    expect(night[2] / (night[0] + 1)).toBeGreaterThan(noon[2] / (noon[0] + 1));
    await expect.poll(async () => (await storedOf(page, 'sky-plate')).filter((e) => e.key.startsWith('oasis|')).length, { timeout: 80_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await storedOf(page, 'light-plate')).filter((e) => e.key.startsWith('oasis|')).length, { timeout: 80_000 }).toBeGreaterThanOrEqual(2);
  });
});

/** A hash of the scene's painting and water alone over a world rect (other systems muted), two frames apart. */
const seaHashes = (page: Page) =>
  page.evaluate(async () => {
    const s = window.sprout!;
    const ids = s.mute({});
    s.mute(Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper').map((id) => [id, '*'])));
    const a = s.camera.toClient({ x: 120, y: 430 });
    const b = s.camera.toClient({ x: 560, y: 680 });
    const c = document.querySelector<HTMLCanvasElement>('#garden')!;
    const k = c.width / c.getBoundingClientRect().width;
    const hash = () => {
      const { data } = c.getContext('2d')!.getImageData(Math.round(a.x * k), Math.round(a.y * k), Math.round((b.x - a.x) * k), Math.round((b.y - a.y) * k));
      let h = 0x811c9dc5;
      for (let i = 0; i < data.length; i += 8) h = Math.imul(h ^ data[i]!, 0x01000193);
      return (h >>> 0).toString(16);
    };
    const frames = (n: number) => new Promise<void>((done) => { const f = () => (--n <= 0 ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    await s.freeze();
    const first = hash();
    s.unfreeze();
    await frames(40);
    await s.freeze();
    const second = hash();
    s.mute({});
    s.unfreeze();
    return [first, second];
  });

/** The coast on view at a pinned noon, the overview held still, its painting and the sea's motion ready. */
async function openCoast(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDev(page, 'scenery=coast');
  await page.evaluate(async () => {
    const s = window.sprout!;
    await s.showScenery('coast');
    s.camera.autoFocus(false);
    await s.camera.overview({ animate: false });
    s.setTime('noon');
    s.settleAmbience();
    await s.camera.settle();
    await s.scenePainted();
  });
}

test.describe('sceneries · the coast’s moving sea (ADRs 0362, 0374)', () => {
  test('the sea moves at the overview', async ({ page }) => {
    await openCoast(page);
    const [first, second] = await seaHashes(page);
    expect(second).not.toBe(first);
  });
});

test.describe('sceneries · the coast under reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the sea is a still painting: two frames apart it is the same', async ({ page }) => {
    await openCoast(page);
    const [first, second] = await seaHashes(page);
    expect(second).toBe(first);
  });

  test('the coast has its own daylight: a warmer sunset, a dark blue night, its plates under its keys (G5)', async ({ page }) => {
    test.slow();
    await openCoast(page);
    const noon = await meanAt(page, 'noon');
    const sunset = await meanAt(page, 'sunset');
    const night = await meanAt(page, 'night');
    // sunset warmer than noon; night darker and bluer
    expect(sunset[0] / (sunset[2] + 1)).toBeGreaterThan(noon[0] / (noon[2] + 1));
    expect(night[0] + night[1] + night[2]).toBeLessThan((noon[0] + noon[1] + noon[2]) * 0.85);
    expect(night[2] / (night[0] + 1)).toBeGreaterThan(noon[2] / (noon[0] + 1));
    await expect.poll(async () => (await storedOf(page, 'sky-plate')).filter((e) => e.key.startsWith('coast|')).length, { timeout: 80_000 }).toBeGreaterThanOrEqual(2);
  });
});

test.describe('sceneries · the coast’s slot sites (ADR 0383)', () => {
  test('a sea plant is offered only the splash rocks and a wall plant only the walls, through the real flow; addPlants keeps to the sites', async ({ page }) => {
    await calmUiMotion(page);
    await openDev(page, 'scenery=coast&uitime=0.02');
    await page.evaluate(async () => {
      window.sprout!.reset();
      window.sprout!.seed(7);
      await window.sprout!.showScenery('coast');
      window.sprout!.ui.refresh();
    });
    const options = (id: string) => page.evaluate((id) => window.sprout!.placementOptions(id, 'coast').map((o) => o.id), id);
    expect(await options('sea-lavender')).toEqual(['splash-1', 'splash-2', 'splash-3']);
    expect(await options('cyclamen')).not.toContain('splash-1');
    expect((await options('southern-maidenhair')).every((id) => id.startsWith('wall-') || id.startsWith('crack-'))).toBe(true);

    await plantSession(page, { species: 'sea-lavender', minutes: 30, begin: false });
    const markers = await page.locator('button.marker[data-slot-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-slot-id')).sort());
    expect(markers).toEqual(['splash-1', 'splash-2', 'splash-3']);
    // a slot is named by its site (ADR 0386)
    await expect(page.locator('button.marker[data-slot-id="splash-1"]')).toHaveAttribute('aria-label', 'Plant here, on the splash rocks');
    await page.locator('.placement-bar').getByRole('button', { name: 'Back to planting' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet.locator('.plant-card[data-species-id="southern-maidenhair"] .plant-habitat')).toHaveText('on the walls');
    await expect(sheet.locator('.plant-card[data-species-id="sea-lavender"] .plant-habitat')).toHaveText('on the splash rocks');

    const misplaced = await page.evaluate(() => {
      const s = window.sprout!;
      s.addPlants(48, undefined, 'coast');
      return s
        .state()
        .plants.filter((p) => p.sceneryId === 'coast' && !s.placementOptions(p.speciesId, 'coast').some((o) => o.id === p.slotId))
        .map((p) => `${p.speciesId}@${p.slotId}`);
    });
    expect(misplaced).toEqual([]);
  });
});

test.describe('sceneries · a shared species in each garden’s words (ADR 0385)', () => {
  test('a shared species’ card speaks the coast’s words at the coast and the oasis’s in the oasis: sheet, card, Your plant and herbarium', async ({ page }) => {
    await calmUiMotion(page);
    await openDev(page, 'scenery=coast&uitime=0.02');
    await page.evaluate(async () => {
      window.sprout!.reset();
      window.sprout!.seed(7);
      await window.sprout!.showScenery('coast');
      window.sprout!.ui.refresh();
    });
    const card = page.locator('[data-ui="plant-card"]');
    /** a finished grapevine in the garden on view, its card opened through the camera */
    const openVine = (sceneryId: 'coast' | 'oasis') =>
      page.evaluate(async (sceneryId) => {
        const s = window.sprout!;
        s.camera.autoFocus(false);
        const slotId = s.placementOptions('grapevine', sceneryId)[0]!.id;
        const now = s.now();
        const id = `vine-${sceneryId}`;
        s.setState({ plants: [{ id, speciesId: 'grapevine', sceneryId, slotId, seed: 5, plantedAt: now - 3_600_000, sessionMinutes: 90, taskName: 'Essay', completedAt: now - 600_000 }] });
        await s.plants.settle();
        return s.camera.openCard(id);
      }, sceneryId);

    // the planting sheet at the coast
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await setMinutes(page, 120);
    const vineCard = sheet.locator('.plant-card[data-species-id="grapevine"]');
    await expect(vineCard.locator('.plant-native')).toHaveText('Ampeli');
    await expect(vineCard.locator('.plant-native')).toHaveAttribute('lang', 'el-Latn');
    await expect(vineCard.locator('.plant-desc')).toHaveText('Grapevine — a leafy roof over the terrace, sweet bunches in its shade.');
    await expect(sheet.locator('.plant-card[data-species-id="oleander"] .plant-native')).toHaveText('Pikrodafni');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // the plant card and Your plant at the coast
    expect(await openVine('coast')).toBe(true);
    await expect(card.locator('.plant-story-native')).toHaveText('Ampeli');
    await expect(card.locator('.plant-story-line')).toHaveText('Grapevine — a leafy roof over the terrace, sweet bunches in its shade.');
    await expect(card.locator('.plant-story-note')).toContainText('κληματαριά (klimataria)');
    await expect(card).not.toContainText(/seguia|palm|Dalia/);
    await expect(page.locator('.plant-view-native')).toHaveText('Ampeli');
    await page.keyboard.press('Escape');

    // the oasis keeps its own words
    await page.evaluate(() => window.sprout!.showScenery('oasis'));
    expect(await openVine('oasis')).toBe(true);
    await expect(card.locator('.plant-story-native')).toHaveText('Dalia');
    await expect(card.locator('.plant-story-native')).toHaveAttribute('lang', 'ary-Latn');
    await expect(card.locator('.plant-story-line')).toHaveText('Grapevine — a green roof on palm posts, sweet bunches in its shade.');
    await expect(card.locator('.plant-story-note')).toContainText('seguia');
    await page.keyboard.press('Escape');

    // the herbarium names each specimen in its own garden's words
    await page.evaluate(() => {
      const now = window.sprout!.now();
      const pressed = (['coast', 'oasis'] as const).map((sceneryId) => ({ speciesId: 'pomegranate', sceneryId, seed: 1, plantedAt: now - 86_400_000, removedAt: now, taskName: '' }));
      window.sprout!.setState({ pressed });
    });
    await page.locator('.menu').getByRole('button', { name: 'Pressed flowers' }).click();
    const book = page.locator('dialog[data-dialog="herbarium"]');
    await expect(book.locator('.specimen[data-scenery-id="coast"] .specimen-native')).toHaveText('Rodia');
    await expect(book.locator('.specimen[data-scenery-id="oasis"] .specimen-native')).toHaveText('Rremman');
  });
});
