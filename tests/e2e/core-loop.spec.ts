import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

const MIN = 60_000;

async function reloadDev(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
}

test.describe('core loop', () => {
  test('start → complete → choose → place, persisted across reloads', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.seed(42);
    });

    const session = await page.evaluate(() => window.sprout!.start(25));
    expect(session).toMatchObject({ goalMs: 25 * MIN, pausedAt: null });

    // a running session survives a reload
    await reloadDev(page);
    const resumed = await page.evaluate(() => window.sprout!.state().session);
    expect(resumed).toEqual(session);

    const reward = await page.evaluate(() => window.sprout!.completeSession());
    expect(reward).toMatchObject({ sessionId: session!.id, goalMinutes: 25, tier: 2, chosen: null });
    expect(reward!.options.length).toBeGreaterThan(0);

    // the pending reward also survives a reload ("plant later")
    await reloadDev(page);
    expect(await page.evaluate(() => window.sprout!.state().pendingReward)).toEqual(reward);

    expect(await page.evaluate((id) => window.sprout!.choose(id), reward!.options[0]!)).toBe(true);
    const options = await page.evaluate(() => window.sprout!.placementOptions());
    expect(options.length).toBeGreaterThan(0);
    const plant = await page.evaluate((slotId) => window.sprout!.place(slotId), options[0]!.id);
    expect(plant).toMatchObject({ speciesId: reward!.options[0], slotId: options[0]!.id, sessionMinutes: 25 });

    // reload straight away: the debounced save is flushed on pagehide
    await reloadDev(page);
    const state = await page.evaluate(() => window.sprout!.state());
    expect(state.plants).toEqual([plant]);
    expect(state.pendingReward).toBeNull();
    expect(state.session).toBeNull();
    expect(state.stats).toEqual({ totalMinutes: 25, completed: 1, cancelled: 0 });
    expect(state.tips).toMatchObject({ duration: 'seen', placement: 'seen' });
  });

  test('a corrupt save is backed up and the garden starts fresh', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => localStorage.setItem('studysprout:v1', '{"version":1,"plants":[oops'));
    await reloadDev(page);
    const state = await page.evaluate(() => window.sprout!.state());
    expect(state.plants).toEqual([]);
    const backups = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('studysprout:corrupt:'))
        .map((k) => localStorage.getItem(k)),
    );
    expect(backups).toEqual(['{"version":1,"plants":[oops']);
  });

  test('addPlants fills free compatible slots and setState validates', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.reset());
    const added = await page.evaluate(() => window.sprout!.addPlants(50));
    expect(added).toBeGreaterThan(0);
    const plants = await page.evaluate(() => window.sprout!.state().plants);
    expect(plants).toHaveLength(added);
    expect(new Set(plants.map((p) => p.slotId)).size).toBe(added);

    const err = await page.evaluate(() => {
      try {
        window.sprout!.setState({ plants: 'nope' as never });
        return null;
      } catch (e) {
        return String(e);
      }
    });
    expect(err).toContain('plants');
    const stats = await page.evaluate(() => window.sprout!.setState({ stats: { totalMinutes: 5, completed: 1, cancelled: 0 } }).stats);
    expect(stats.totalMinutes).toBe(5);
  });
});
