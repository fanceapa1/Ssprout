import { expect, test } from './fixtures';
import { MIN, openUi, plantSession, reloadUi, setMinutes } from './ui-helpers';

test.describe('ui · planting a session', () => {
  test('sheet: task, time, plans and plants; locked tiers; placement shows only compatible spots', async ({ page }) => {
    await openUi(page);
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('What are you studying?')).toHaveAttribute('maxlength', '40');

    // 25 min: tier 2 earned → tier 3/4 locked, tier ≤ 2 selectable; unbroken is the only plan below 30
    await setMinutes(page, 25);
    await expect(sheet.locator('.tier-word.is-current')).toHaveText('perennial');
    await expect(sheet.locator('.plan-card')).toHaveCount(1);
    await expect(sheet.locator('.plant-card[data-species-id="fx-peony"]')).toHaveAttribute('data-locked', 'true');
    await expect(sheet.locator('.plant-card[data-species-id="fx-peony"]')).toContainText('Needs 50 min+');
    await expect(sheet.locator('.plant-card[data-species-id="fx-iris"]')).toHaveAttribute('data-earned', 'true');
    await expect(sheet.locator('.plant-card[data-species-id="fx-violet"]')).toHaveAttribute('data-locked', 'false');

    // a locked plant cannot be chosen; Choose a spot stays disabled
    await expect(sheet.locator('.plant-card[data-species-id="fx-peony"]')).toBeDisabled(); // aria-disabled
    await sheet.locator('.plant-card[data-species-id="fx-peony"]').click({ force: true });
    await expect(sheet.locator('.plant-card[data-species-id="fx-peony"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(sheet.getByRole('button', { name: 'Choose a spot' })).toBeDisabled();

    // 90 min: several plans (breaks inside), everything unlocked
    await sheet.getByRole('button', { name: '90 minutes' }).click();
    await expect(sheet.locator('.tier-word.is-current')).toHaveText('centrepiece');
    const plans = sheet.locator('.plan-card');
    expect(await plans.count()).toBeGreaterThanOrEqual(2);
    expect(await plans.count()).toBeLessThanOrEqual(4);
    await expect(sheet.locator('.plant-card[data-locked="true"]')).toHaveCount(0);

    // choose the iris: shore/water spots only
    await sheet.locator('.plant-card[data-species-id="fx-iris"]').click();
    await sheet.getByRole('button', { name: 'Choose a spot' }).click();
    const markers = page.locator('button.marker[data-slot-id]');
    await expect(markers.first()).toBeVisible();
    const habitats = await markers.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.habitat));
    expect(habitats.length).toBeGreaterThan(0);
    for (const hb of habitats) expect(['shore', 'water']).toContain(hb);
    expect((await page.evaluate(() => window.sprout!.ui.state())).mode).toBe('placement');

    // Back keeps the draft
    await page.getByRole('button', { name: 'Back to planting' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.plant-card[data-species-id="fx-iris"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('begin → focus panel with task, plan line, pause/resume', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Biology ch. 4', minutes: 60, plan: 1, species: 'fx-iris' });
    const s = await page.evaluate(() => window.sprout!.state().session);
    expect(s).toMatchObject({ taskName: 'Biology ch. 4', speciesId: 'fx-iris' });
    const panel = page.locator('.panel');
    await expect(panel.locator('.task-name')).toHaveText('Biology ch. 4');
    await expect(panel.locator('.block-label')).toContainText('Focus');
    await expect(panel.locator('.plan-line .plan-drop').first()).toBeAttached();
    await expect(panel.locator('.time')).toHaveText(/^\d{1,2}:\d{2}$/);

    await panel.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-view', 'paused');
    expect(await page.evaluate(() => window.sprout!.state().session?.pausedAt)).not.toBeNull();
    await panel.getByRole('button', { name: 'Resume' }).click();
    await expect(panel).toHaveAttribute('data-view', 'focus');
  });

  test('cancel needs a gentle confirmation naming the plant', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    const panel = page.locator('.panel');
    await panel.getByRole('button', { name: 'End', exact: true }).click();
    await expect(panel.locator('.confirm-cancel')).toContainText('End this session? Your wood violet won’t bloom this time.');
    await panel.getByRole('button', { name: 'Keep studying' }).click();
    await expect(panel.locator('.confirm-cancel')).toBeHidden();
    expect(await page.evaluate(() => window.sprout!.state().session)).not.toBeNull();

    await panel.getByRole('button', { name: 'End', exact: true }).click();
    await panel.locator('.confirm-cancel').getByRole('button', { name: 'End' }).click();
    await expect(panel).toHaveAttribute('data-view', 'idle');
    const st = await page.evaluate(() => window.sprout!.state());
    expect(st.session).toBeNull();
    expect(st.plants).toEqual([]);
    expect(st.stats.cancelled).toBe(1);
  });

  test('breaks: water the plant, then skip the rest of the break', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Essay', minutes: 60, plan: 1, species: 'fx-iris' });
    const plan = await page.evaluate(() => window.sprout!.state().session!.plan.blocks);
    expect(plan.some((b) => b.kind === 'break')).toBe(true);
    const firstFocus = plan[0]!.minutes;
    await page.evaluate((ms) => window.sprout!.advance(ms), firstFocus * MIN + 2000);
    const panel = page.locator('.panel');
    await expect(panel).toHaveAttribute('data-view', 'break');
    await expect(panel.locator('.block-label')).toContainText('Break — water your Japanese iris');

    const water = panel.locator('button.water');
    await water.click();
    await expect(water).toBeDisabled();
    await expect(water).toContainText('Watered');
    expect(await page.evaluate(() => window.sprout!.status().timeline?.watered)).toBe(true);

    await panel.getByRole('button', { name: 'Skip break' }).click();
    await expect(panel).toHaveAttribute('data-view', 'focus');
    await expect(panel.locator('.block-label')).toContainText('Focus · 2 of');
  });

  test('long pause shows "Still with us?"', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    const panel = page.locator('.panel');
    await panel.getByRole('button', { name: 'Pause' }).click();
    await page.evaluate((ms) => window.sprout!.advance(ms), 31 * MIN);
    await expect(panel).toHaveAttribute('data-view', 'longPause');
    await expect(panel.locator('.long-pause')).toContainText('Still with us?');
    await panel.locator('.long-pause').getByRole('button', { name: 'Resume' }).click();
    await expect(panel).toHaveAttribute('data-view', 'focus');
  });

  test('completion: the plant blooms, a quiet line names it, its label shows on hover', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Biology ch. 4', minutes: 25, species: 'fx-violet' });
    const slotId = await page.evaluate(() => window.sprout!.state().session!.slotId);
    // real-length quiet line for this test (openUi speeds UI delays up 50×)
    await page.evaluate(() => {
      window.sprout!.ui.setTimeScale(1);
      window.sprout!.completeSession();
    });
    await expect(page.locator('.quiet-line')).toHaveClass(/is-in/);
    await expect(page.locator('.quiet-line')).toContainText('Your Wood Violet for “Biology ch. 4” has bloomed.');
    const st = await page.evaluate(() => window.sprout!.state());
    expect(st.session).toBeNull();
    expect(st.plants).toHaveLength(1);
    expect(st.plants[0]).toMatchObject({ speciesId: 'fx-violet', slotId, taskName: 'Biology ch. 4', sessionMinutes: 25 });
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'idle');

    // hover the plant (a little above its base point) → task · minutes · date
    const p = await page.evaluate((id) => window.sprout!.ui.slotScreen(id), slotId);
    await page.mouse.move(p!.x, p!.y - 8);
    await expect(page.locator('.plant-label')).toHaveClass(/is-in/);
    await expect(page.locator('.plant-label')).toContainText('Biology ch. 4 · 25 min ·');
  });

  test('swap into an occupied spot → the old plant is pressed into the herbarium', async ({ page }) => {
    await openUi(page);
    expect(await page.evaluate(() => window.sprout!.addPlants(30))).toBeGreaterThan(0);
    await plantSession(page, { task: 'Kanji', minutes: 25, species: 'fx-violet', slot: 'occupied', begin: false });
    const selected = page.locator('button.marker[aria-pressed="true"]');
    await expect(selected).toHaveAttribute('data-occupied', 'true');
    await expect(selected).toHaveAttribute('aria-label', /^Replace .+ It will be pressed into your herbarium\.$/);
    await expect(page.locator('.placement-prompt')).toContainText('will take the place of');
    const slotId = await selected.getAttribute('data-slot-id');
    const old = await page.evaluate((id) => window.sprout!.state().plants.find((p) => p.slotId === id)!, slotId);
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await page.evaluate(() => window.sprout!.completeSession());
    await expect.poll(() => page.evaluate(() => window.sprout!.state().pressed.length)).toBe(1);
    const st = await page.evaluate(() => window.sprout!.state());
    expect(st.pressed[0]).toMatchObject({ speciesId: old.speciesId, seed: old.seed });
    expect(st.plants.find((p) => p.slotId === slotId)?.speciesId).toBe('fx-violet');

    await page.locator('.menu').getByRole('button', { name: 'Pressed flowers' }).click();
    const book = page.locator('dialog[data-dialog="herbarium"]');
    await expect(book).toBeVisible();
    await expect(book.locator('.specimen')).toHaveCount(1);
    await expect(book.locator(`.specimen[data-species-id="${old.speciesId}"] .specimen-date`)).toContainText('pressed');
    expect(await page.evaluate(() => window.sprout!.state().tips.pressed)).toBe('seen');
    await page.keyboard.press('Escape');
    await expect(book).toBeHidden();
  });

  test('a session survives a reload mid-way', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Reading', minutes: 50, species: 'fx-iris' });
    const before = await page.evaluate(() => window.sprout!.state().session);
    await reloadUi(page);
    const panel = page.locator('.panel');
    await expect(panel).toHaveAttribute('data-view', 'focus');
    await expect(panel.locator('.task-name')).toHaveText('Reading');
    expect(await page.evaluate(() => window.sprout!.state().session)).toEqual(before);
    // the dev clock restarts from real time on reload, so the timer simply continues
    const remaining = await page.evaluate(() => window.sprout!.status().timeline!.totalRemainingMs);
    expect(remaining).toBeLessThanOrEqual(50 * MIN);
    expect(remaining).toBeGreaterThan(45 * MIN);
    await expect(panel.locator('.time')).toHaveText(/^(49|50):\d{2}$/);
  });

  test('keyboard: Tab to a marker and press Enter, then Begin', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet', begin: false });
    // the first marker was clicked by the helper; move focus to the next one with Tab and select it
    const first = await page.locator('button.marker[aria-pressed="true"]').getAttribute('data-slot-id');
    await page.locator('button.marker').first().focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const chosen = await page.locator('button.marker[aria-pressed="true"]').getAttribute('data-slot-id');
    expect(chosen).not.toBeNull();
    expect(chosen === first || (await page.locator('button.marker').count()) > 1).toBe(true);
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    expect(await page.evaluate(() => window.sprout!.state().session?.slotId)).toBe(chosen);
  });
});
