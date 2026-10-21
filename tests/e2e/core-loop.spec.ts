import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

const MIN = 60_000;

async function reloadDev(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
}

test.describe('core loop', () => {
  test('plant at start → break → water → skip → complete, persisted across reloads', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(42);
    });

    const plans = await page.evaluate(() => window.sprout!.plans(60).map((p) => p.id));
    expect(plans[0]).toBe('unbroken');
    expect(plans).toContain('pomodoro');

    const session = await page.evaluate(() =>
      window.sprout!.start(60, { taskName: 'Biology ch. 4', planId: 'pomodoro' }),
    );
    expect(session).toMatchObject({ goalMs: 60 * MIN, taskName: 'Biology ch. 4', pausedAt: null });
    expect(session!.plan.id).toBe('pomodoro');

    // a running session survives a reload
    await reloadDev(page);
    expect(await page.evaluate(() => window.sprout!.state().session)).toEqual(session);

    // jump to the first break, water it, skip the rest
    const breakIndex = await page.evaluate(() => window.sprout!.toBreak());
    expect(breakIndex).toBe(1);
    expect(await page.evaluate(() => window.sprout!.status().phase)).toBe('break');
    expect(await page.evaluate(() => window.sprout!.water())).toBe(true);
    expect(await page.evaluate(() => window.sprout!.skipBreak())).toBe(true);
    const status = await page.evaluate(() => window.sprout!.status());
    expect(status.phase).toBe('focus');
    expect(status.session!.waterings).toEqual([1]);
    expect(status.session!.skippedMs).toBeGreaterThan(0);

    // watering and skipping survive a reload too
    await reloadDev(page);
    const reloaded = await page.evaluate(() => window.sprout!.state().session);
    expect(reloaded!.waterings).toEqual([1]);

    const plant = await page.evaluate(() => window.sprout!.completeSession());
    expect(plant).toMatchObject({
      id: session!.id,
      speciesId: session!.speciesId,
      slotId: session!.slotId,
      taskName: 'Biology ch. 4',
      sessionMinutes: 60,
    });

    // reload straight away: the debounced save is flushed on pagehide
    await reloadDev(page);
    const state = await page.evaluate(() => window.sprout!.state());
    expect(state.plants).toEqual([plant]);
    expect(state.session).toBeNull();
    expect(state.stats.completed).toBe(1);
    expect(state.stats.totalMinutes).toBe(55); // focus minutes of 30 · (5) · 25
    expect(state.tips).toMatchObject({ task: 'seen', duration: 'seen', plan: 'seen', water: 'seen' });
  });

  test('cancel: the seedling withers and the replaced plant stays', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.reset());
    expect(await page.evaluate(() => window.sprout!.addPlants(1))).toBe(1);
    const [old] = await page.evaluate(() => window.sprout!.state().plants);
    const session = await page.evaluate(
      (o) => window.sprout!.start(25, { speciesId: o.speciesId, slotId: o.slotId }),
      old!,
    );
    expect(session!.displacedPlantId).toBe(old!.id);
    expect(await page.evaluate(() => window.sprout!.cancel())).toBe(true);
    const state = await page.evaluate(() => window.sprout!.state());
    expect(state.plants).toEqual([old]);
    expect(state.pressed).toEqual([]);
    expect(state.stats.cancelled).toBe(1);
  });

  test('a corrupt save is backed up and the garden starts fresh', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => localStorage.setItem('studysprout:v1', '{"version":1,"plants":[oops'));
    await reloadDev(page);
    expect(await page.evaluate(() => window.sprout!.state().plants)).toEqual([]);
    const backups = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('studysprout:corrupt:'))
        .map((k) => localStorage.getItem(k)),
    );
    expect(backups).toEqual(['{"version":1,"plants":[oops']);
  });

  test('addPlants creates finished, named plants; setState validates', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.reset());
    const added = await page.evaluate(() => window.sprout!.addPlants(50));
    expect(added).toBeGreaterThan(0);
    const plants = await page.evaluate(() => window.sprout!.state().plants);
    expect(plants).toHaveLength(added);
    expect(new Set(plants.map((p) => p.slotId)).size).toBe(added);
    for (const p of plants) expect(p.taskName.length).toBeGreaterThan(0);

    const err = await page.evaluate(() => {
      try {
        window.sprout!.setState({ plants: 'nope' as never });
        return null;
      } catch (e) {
        return String(e);
      }
    });
    expect(err).toContain('plants');
  });
});
