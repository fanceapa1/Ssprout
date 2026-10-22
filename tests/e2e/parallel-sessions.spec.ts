import { expect, test } from './fixtures';
import { MIN, openUi, plantSession, reloadUi } from './ui-helpers';

/**
 * Parallel sessions and automatic focus watering (SPEC §2 › Parallel sessions, ADRs 0150–0157):
 * start two, switch, the waiting one's time stands still; three at most; nothing resumes after a
 * bloom; reload; the automatic watering plays in Your plant and the garden; the widget, the title
 * and the pill follow the active session. Time moves with the dev clock, never by sleeping.
 */

const sessions = (page: import('@playwright/test').Page) => page.evaluate(() => window.sprout!.sessions());

test.describe('parallel sessions', () => {
  test('start two, switch between them; the waiting one’s time does not advance', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Biology', minutes: 25, species: 'fx-violet' });
    await page.evaluate((ms) => window.sprout!.advance(ms), 5 * MIN);
    await plantSession(page, { task: 'Essay', minutes: 50, species: 'fx-violet', another: true });

    const list = page.locator('.session-list');
    await expect(list.locator('.session-row')).toHaveCount(2);
    await expect(page.locator('.panel .task-name')).toHaveText('Essay');
    await expect(page.locator('.pill .pill-more')).toHaveText('+1');
    let s = await sessions(page);
    expect(s.map((x) => [x.taskName, x.active, x.running])).toEqual([
      ['Biology', false, false],
      ['Essay', true, true],
    ]);
    const biologyBefore = s[0]!.elapsedMs;

    // ten minutes on: only the active session's time moves
    await page.evaluate((ms) => window.sprout!.advance(ms), 10 * MIN);
    s = await sessions(page);
    expect(s[0]!.elapsedMs).toBe(biologyBefore);
    expect(s[1]!.elapsedMs).toBeGreaterThanOrEqual(10 * MIN);
    await expect(list.locator('.session-row').first().locator('.session-row-meta')).toContainText('waiting');

    // switch back to Biology from its row
    await list.locator('.session-row').first().getByRole('button', { name: 'Switch to “Biology”' }).click();
    await expect(page.locator('.panel .task-name')).toHaveText('Biology');
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    s = await sessions(page);
    expect(s.map((x) => [x.taskName, x.active, x.running])).toEqual([
      ['Biology', true, true],
      ['Essay', false, false],
    ]);
    const essayBefore = s[1]!.elapsedMs;
    await page.evaluate((ms) => window.sprout!.advance(ms), 3 * MIN);
    s = await sessions(page);
    expect(s[1]!.elapsedMs).toBe(essayBefore);
    expect(s[0]!.elapsedMs).toBeGreaterThanOrEqual(biologyBefore + 3 * MIN);
    // switching is not a pause the garden nags about
    await page.evaluate((ms) => window.sprout!.advance(ms), 40 * MIN);
    await expect(page.locator('.panel')).not.toHaveAttribute('data-view', 'longPause');
  });

  test('three can grow at once; a fourth is refused gently with an offer to switch', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'One', minutes: 25, species: 'fx-violet' });
    await plantSession(page, { task: 'Two', minutes: 25, species: 'fx-violet', another: true });
    await plantSession(page, { task: 'Three', minutes: 25, species: 'fx-violet', another: true });
    const list = page.locator('.session-list');
    await expect(list.locator('.session-row')).toHaveCount(3);
    await expect(page.locator('.pill .pill-more')).toHaveText('+2');
    await expect(list.locator('.session-row[data-active="true"] .session-row-now')).toBeVisible();

    await list.getByRole('button', { name: 'Plant another' }).click();
    await expect(page.locator('dialog[data-dialog="planting"]')).toBeHidden();
    await expect(list.locator('.limit-note')).toBeVisible();
    await expect(list.locator('.limit-note')).toContainText('as many as can grow at once');
    await expect(list.getByRole('button', { name: 'Switch to “One”' })).toBeFocused();
    expect(await page.evaluate(() => window.sprout!.start(25, { taskName: 'Four' }))).toBeNull();
    expect(await sessions(page)).toHaveLength(3);

    // the spots of the three are taken: placement for a fourth would not offer them anyway
    const held = (await sessions(page)).map((x) => x.slotId);
    const options = await page.evaluate(() => window.sprout!.placementOptions('fx-violet').map((o) => o.id));
    for (const id of held) expect(options).not.toContain(id);
  });

  test('a bloom leaves the others paused; the dock offers Resume on the one left last', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.startSessions(3, 25, 60_000));
    const plant = await page.evaluate(() => window.sprout!.completeSession());
    expect(plant?.taskName).toBe('Task 3');
    await page.evaluate(() => window.sprout!.ui.refresh());

    const panel = page.locator('.panel');
    await expect(panel).toHaveAttribute('data-view', 'idle');
    await expect(panel.locator('.idle-line')).toHaveText('Two sessions are waiting for you.');
    const list = page.locator('.session-list');
    await expect(list.locator('.session-list-title')).toHaveText('Waiting for you');
    const s = await sessions(page);
    expect(s.every((x) => !x.running && !x.active)).toBe(true);
    // the seal goes to "Task 2", left when "Task 3" began
    const seal = list.locator('button.session-switch.seal');
    await expect(seal).toHaveCount(1);
    await expect(seal).toHaveAccessibleName('Resume “Task 2”');
    // nothing resumes on its own
    await page.evaluate((ms) => window.sprout!.advance(ms), 30 * MIN);
    expect((await sessions(page)).every((x) => !x.running)).toBe(true);
    await seal.click();
    await expect(panel).toHaveAttribute('data-view', 'focus');
    await expect(panel.locator('.task-name')).toHaveText('Task 2');
    expect(await page.evaluate(() => window.sprout!.log().map((e) => [e.taskName, e.outcome]))).toEqual([['Task 3', 'completed']]);
  });

  test('a reload continues every session: the active one ran while away, the waiting ones did not', async ({ page }) => {
    await openUi(page);
    // no dev-clock jumps before the reload: the dev clock starts again from real time on boot
    await page.evaluate(() => window.sprout!.startSessions(2, 50));
    const before = await sessions(page);
    await page.evaluate(() => window.sprout!.flush());
    await reloadUi(page);
    await page.evaluate((ms) => window.sprout!.advance(ms), 5 * MIN);
    const after = await sessions(page);
    expect(after.map((x) => x.id)).toEqual(before.map((x) => x.id));
    expect(after[0]).toMatchObject({ active: false, running: false, elapsedMs: before[0]!.elapsedMs });
    expect(after[1]!.active).toBe(true);
    expect(after[1]!.elapsedMs).toBeGreaterThanOrEqual(before[1]!.elapsedMs + 5 * MIN);
    await expect(page.locator('.session-list .session-row')).toHaveCount(2);
  });
});

test.describe('automatic focus watering', () => {
  test('plays in Your plant and the garden every few focused minutes, with nothing to tap', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Reading', minutes: 50, species: 'fx-violet' });
    const next = await page.evaluate(() => window.sprout!.nextFocusWatering());
    expect(next).toBeGreaterThanOrEqual(4 * MIN);
    expect(next).toBeLessThanOrEqual(10 * MIN);
    // jump to it and read Your plant in the same task (the animation is 2.5 s of real time)
    const played = await page.evaluate(() => {
      const fired = window.sprout!.focusWater();
      return { fired, view: window.sprout!.ui.state().plantView.watering };
    });
    expect(played).toEqual({ fired: true, view: true });
    const id = (await sessions(page))[0]!.id;
    await expect.poll(() => page.evaluate(() => window.sprout!.plants.state().watering?.sessionId)).toBe(id);
    expect((await sessions(page))[0]!.focusWaterings).toBe(1);
    // no tip, no notification, no can to tap in focus
    await expect(page.locator('.panel button.water')).toBeHidden();
  });

  test('never while paused or during a break', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Paused', minutes: 60, plan: 'pomodoro', species: 'fx-iris' });
    await page.evaluate(() => window.sprout!.pause());
    await page.evaluate((ms) => window.sprout!.advance(ms), 120 * MIN);
    expect(await page.evaluate(() => window.sprout!.focusWater())).toBe(false);
    expect((await sessions(page))[0]!.focusWaterings).toBe(0);
    await page.evaluate(() => window.sprout!.resume());
    await page.evaluate(() => window.sprout!.toBreak());
    expect(await page.evaluate(() => window.sprout!.focusWater())).toBe(false);
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'break');
    await expect(page.locator('.panel button.water')).toBeVisible(); // breaks keep tap-to-water
  });
});

test.describe('surfaces follow the active session', () => {
  test('the floating card and the tab title follow the active session; the card can switch', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.start(25, { taskName: 'Short' });
      window.sprout!.start(50, { taskName: 'Long' });
    });
    await page.evaluate(() => window.sprout!.widget.mountHarness());
    const card = page.frameLocator('#sprout-widget-harness');
    await expect(card.locator('.ss-task')).toHaveText('Long');
    await expect.poll(() => page.evaluate(() => window.sprout!.widget.title())).toMatch(/^(50|49):\d\d · /);
    await expect(card.locator('button[data-action="switch"]')).toBeVisible();
    await card.locator('button[data-action="switch"]').click();
    await expect(card.locator('.ss-task')).toHaveText('Short');
    await expect.poll(() => page.evaluate(() => window.sprout!.widget.title())).toMatch(/^(25|24):\d\d · /);
    await expect(page.locator('.panel .task-name')).toHaveText('Short');
    // an automatic watering plays in the card too
    const watering = await page.evaluate(() => {
      window.sprout!.focusWater();
      return window.sprout!.widget.harnessWatering();
    });
    expect(watering).toBe(0);
    await page.evaluate(() => window.sprout!.widget.closeHarness());
  });
});
