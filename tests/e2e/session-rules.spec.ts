import type { ConsoleMessage } from '@playwright/test';
import { expect, test } from './fixtures';
import { MIN, openUi, plantSession } from './ui-helpers';

/**
 * Session rules from SPEC §2 "During the session" not covered by the main UI flows: what the
 * timer shows, an unwatered break, ending from the long-pause prompt, completion while the app
 * was closed, and a tapped plant label on a phone. Time moves with the dev clock, never sleeps.
 */
test.describe('session rules', () => {
  test('the timer shows the current block and the whole session; the plan line marks the block', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Physics', minutes: 60, plan: 'pomodoro', species: 'fx-iris' });
    const blocks = await page.evaluate(() => window.sprout!.state().session!.plan.blocks);
    expect(blocks.length).toBeGreaterThan(1);
    const panel = page.locator('.panel');
    // block countdown (the first focus block) and the session total (formatTimer rounds up)
    await expect(panel.locator('.time')).toHaveText(new RegExp(`^(${blocks[0]!.minutes}|${blocks[0]!.minutes - 1}):\\d\\d$`));
    await expect(panel.locator('.total')).toHaveText(/^(60|59):\d\d left in all$/);
    await expect(panel.locator('.plan-line .is-current').first()).toBeAttached();
    const before = await panel.locator('.plan-line').innerHTML();

    await page.evaluate((ms) => window.sprout!.advance(ms), blocks[0]!.minutes * MIN + 1000);
    await expect(panel).toHaveAttribute('data-view', 'break');
    await expect(panel.locator('.time')).toHaveText(new RegExp(`^(${blocks[1]!.minutes}|${blocks[1]!.minutes - 1}):\\d\\d$`));
    expect(await panel.locator('.plan-line').innerHTML(), 'the plan line moved on').not.toBe(before);
  });

  test('an unwatered break simply ends: the next focus block starts on its own and the plant still blooms', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Essay', minutes: 60, plan: 'pomodoro', species: 'fx-iris' });
    const blocks = await page.evaluate(() => window.sprout!.state().session!.plan.blocks);
    const panel = page.locator('.panel');
    await page.evaluate((ms) => window.sprout!.advance(ms), (blocks[0]!.minutes + blocks[1]!.minutes) * MIN + 1000);
    await expect(panel).toHaveAttribute('data-view', 'focus');
    await expect(panel.locator('.block-label')).toContainText('Focus · 2 of 2');
    expect(await page.evaluate(() => window.sprout!.state().session!.waterings)).toEqual([]);

    const plant = await page.evaluate(() => window.sprout!.completeSession());
    expect(plant).toMatchObject({ speciesId: 'fx-iris', taskName: 'Essay', sessionMinutes: 60 });
    const st = await page.evaluate(() => window.sprout!.state());
    expect(st.stats.completed).toBe(1);
    expect(st.stats.totalMinutes).toBe(blocks.filter((b) => b.kind === 'focus').reduce((a, b) => a + b.minutes, 0));
  });

  test('“Still with us?” can end the session too', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    const panel = page.locator('.panel');
    await panel.getByRole('button', { name: 'Pause' }).click();
    await page.evaluate((ms) => window.sprout!.advance(ms), 30 * MIN + 1000);
    await expect(panel).toHaveAttribute('data-view', 'longPause');
    await panel.locator('.long-pause').getByRole('button', { name: 'End session' }).click();
    await expect(panel).toHaveAttribute('data-view', 'idle');
    const st = await page.evaluate(() => window.sprout!.state());
    expect(st.session).toBeNull();
    expect(st.plants).toEqual([]);
    expect(st.stats.cancelled).toBe(1);
  });

  test('a session that ended while the app was closed has bloomed on return', async ({ page, context }) => {
    await openUi(page);
    await plantSession(page, { task: 'Away', minutes: 25, species: 'fx-violet' });
    const session = await page.evaluate(() => window.sprout!.state().session!);
    await page.evaluate(() => window.sprout!.flush());
    await page.close();

    // "while away": move the saved start 26 minutes back before the app boots again
    const next = await context.newPage();
    const errors: string[] = [];
    next.on('console', (m: ConsoleMessage) => m.type() === 'error' && errors.push(m.text()));
    next.on('pageerror', (e) => errors.push(e.message));
    await next.addInitScript((ms) => {
      const key = 'studysprout:v1';
      const raw = localStorage.getItem(key);
      if (!raw || sessionStorage.getItem('moved')) return;
      const doc = JSON.parse(raw);
      if (doc.session) doc.session.startedAt -= ms;
      localStorage.setItem(key, JSON.stringify(doc));
      sessionStorage.setItem('moved', '1');
    }, 26 * MIN);
    await next.goto('./?dev&fixtures&uitime=0.02');
    await next.waitForFunction(() => window.sprout !== undefined);
    await next.evaluate(() => window.sprout!.ready());

    const st = await next.evaluate(() => window.sprout!.state());
    expect(st.session).toBeNull();
    expect(st.plants).toHaveLength(1);
    expect(st.plants[0]).toMatchObject({ id: session.id, speciesId: 'fx-violet', taskName: 'Away', sessionMinutes: 25 });
    // it bloomed when the plan ended, not when the app came back
    expect(st.plants[0]!.completedAt).toBe(session.startedAt - 26 * MIN + 25 * MIN);
    expect(st.stats.completed).toBe(1);
    await expect(next.locator('.panel')).toHaveAttribute('data-view', 'idle');
    expect(errors).toEqual([]);
  });
});

test.describe('session rules · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('tapping a finished plant opens its card (the ink label is for hover)', async ({ page }) => {
    await openUi(page);
    // a finished violet in a meadow slot that is on screen in the portrait crop
    const slotId = await page.evaluate(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return window
        .sprout!.placementOptions('fx-violet')
        .map((o) => o.id)
        .find((id) => {
          const p = window.sprout!.ui.slotScreen(id);
          return p && p.x > 40 && p.x < w - 40 && p.y > 120 && p.y < h * 0.55;
        });
    });
    expect(slotId, 'a slot visible on the phone').toBeTruthy();
    await page.evaluate((id) => {
      window.sprout!.start(25, { speciesId: 'fx-violet', slotId: id!, taskName: 'Flashcards' });
      window.sprout!.completeSession();
    }, slotId);
    await page.evaluate(() => window.sprout!.camera.settle());
    await page.evaluate(() => window.sprout!.plants.settle());
    // the middle of the plant's painted box, in CSS pixels
    const tap = await page.evaluate(() => {
      const r = window.sprout!.plants.bounds(window.sprout!.state().plants[0]!.id)!;
      const v = window.sprout!.plants.toDevice({ x: r.x + r.w / 2, y: r.y + r.h * 0.7, w: 1, h: 1 })!;
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const box = c.getBoundingClientRect();
      return { x: box.left + (v.x / c.width) * box.width, y: box.top + (v.y / c.height) * box.height };
    });
    await page.touchscreen.tap(tap.x, tap.y);
    const card = page.locator('[data-ui="plant-card"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-placement', 'docked');
    await expect(card).toContainText('Flashcards');
    await expect(page.locator('.plant-label')).not.toHaveClass(/is-in/);
  });
});
