import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { MIN, openUi, plantSession } from './ui-helpers';

/**
 * The app shell (SPEC §12, ADRs 0130–0136): the garden stage with the dock below it, custom smooth
 * scrolling and scrollbar, the timer pill, "Your plant", the duplicated garden tools and tips that
 * follow controls to their new homes. Scrolling is read inside the page, frame by frame, never by
 * sleeping.
 */

/** Dispatch one wheel event on the garden canvas and record the scroll position every frame until it settles. */
function wheelAndSample(page: Page, deltaY: number, mods: { ctrlKey?: boolean } = {}) {
  return page.evaluate(
    async ({ deltaY, mods }) => {
      const canvas = document.querySelector('#garden')!;
      const r = canvas.getBoundingClientRect();
      const ev = new WheelEvent('wheel', {
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        ...mods,
      });
      canvas.dispatchEvent(ev);
      const immediately = window.scrollY;
      const samples: number[] = [];
      let still = 0;
      for (let i = 0; i < 240 && still < 6; i++) {
        await new Promise((res) => requestAnimationFrame(res));
        const y = window.scrollY;
        still = samples.length && Math.abs(samples[samples.length - 1]! - y) < 0.01 ? still + 1 : 0;
        samples.push(y);
      }
      return { prevented: ev.defaultPrevented, immediately, samples, final: window.scrollY, state: window.sprout!.ui.scroll() };
    },
    { deltaY, mods },
  );
}

test.describe('app shell · page', () => {
  test('the garden stage fills ~94 % of the window under a small margin; the dock peeks out below', async ({ page }) => {
    await openUi(page);
    const vp = page.viewportSize()!;
    const stage = (await page.locator('#stage').boundingBox())!;
    expect(stage.y).toBeGreaterThanOrEqual(12);
    expect(stage.y).toBeLessThanOrEqual(16);
    expect(stage.x).toBeGreaterThanOrEqual(12);
    expect(vp.width - (stage.x + stage.width)).toBeGreaterThanOrEqual(12);
    expect(stage.height / vp.height).toBeCloseTo(0.94, 2);
    // the taller stage (ADR 0212) crops less of the sky: at 1280×720 the world shows from ~y 128
    // (it was ~155 at 88 %)
    if (vp.width === 1280 && vp.height === 720) {
      expect(await page.evaluate(() => window.sprout!.fauna.view().y)).toBeLessThan(140);
    }
    // the dock begins on screen, below the garden
    const dock = (await page.locator('.dock').boundingBox())!;
    expect(dock.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
    expect(dock.y).toBeLessThan(vp.height);
    // the renderer sizes to the stage, not the window
    const sizes = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const r = c.getBoundingClientRect();
      return { cw: c.width, ch: c.height, w: r.width, h: r.height, dpr: Math.min(2, devicePixelRatio) };
    });
    expect(sizes.w).toBeCloseTo(stage.width, 0);
    expect(sizes.h).toBeCloseTo(stage.height, 0);
    expect(sizes.cw).toBe(Math.round(sizes.w * sizes.dpr));
    // the page scrolls as a document, with no native scrollbar taking width
    const s = await page.evaluate(() => window.sprout!.ui.scroll());
    expect(s.max).toBeGreaterThan(100);
    expect(await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth)).toBe(0);
    // the edge of the painting dissolves into the page's paper through a mask
    await expect(page.locator('#garden')).toHaveAttribute('data-edge', 'masked');
  });

  test('wheel over the garden scrolls the page with an eased glide; ctrl+wheel zooms the garden instead', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.scenePainted());
    const scene = await page.evaluate(() => window.sprout!.sceneStats());
    const run = await wheelAndSample(page, 300);
    // scrolling moves the canvas element; the painted landscape is neither repainted nor rescaled
    const after = await page.evaluate(() => window.sprout!.sceneStats());
    expect(after.paints).toBe(scene.paints);
    expect(after.rescales).toBe(scene.rescales);
    expect(run.prevented).toBe(true);
    expect(run.immediately).toBe(0); // nothing jumps
    expect(run.final).toBeCloseTo(Math.min(300, run.state.max), 0);
    const between = run.samples.filter((y) => y > 1 && y < run.final - 1);
    expect(between.length, 'intermediate positions: a glide, not a jump').toBeGreaterThanOrEqual(3);
    for (let i = 1; i < run.samples.length; i++) expect(run.samples[i]!).toBeGreaterThanOrEqual(run.samples[i - 1]! - 0.01);

    // ctrl+wheel (a trackpad pinch) never scrolls the page: the camera takes it (camera.spec covers the zoom)
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    const zoomed = await wheelAndSample(page, -300, { ctrlKey: true });
    expect(zoomed.final).toBe(0);
    expect(zoomed.prevented).toBe(true);
    await page.evaluate(() => window.sprout!.camera.settle());
    expect(await page.evaluate(() => window.sprout!.camera.state().pose.zoom)).toBeGreaterThan(1);
    // another hook (e.g. a later feature) gets the same events
    await page.evaluate(() => {
      (window as unknown as { zooms: number }).zooms = 0;
      window.sprout!.ui.onZoomGesture(() => (window as unknown as { zooms: number }).zooms++);
    });
    const hooked = await wheelAndSample(page, 300, { ctrlKey: true });
    expect(hooked.final).toBe(0);
    expect(hooked.prevented).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { zooms: number }).zooms)).toBe(1);
  });

  test('keyboard scrolls the page: Page Down glides, End and Home reach the ends', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('PageDown');
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.scroll().animating)).toBe(false);
    const afterPage = await page.evaluate(() => window.sprout!.ui.scroll());
    expect(afterPage.y).toBeGreaterThan(0);
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.scroll().animating)).toBe(false);
    const end = await page.evaluate(() => window.sprout!.ui.scroll());
    expect(end.y).toBeCloseTo(end.max, 0);
    await page.keyboard.press('Home');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('the custom scrollbar shows the position and drags; the native bar is hidden', async ({ page }) => {
    await openUi(page);
    const bar = page.locator('.scrollbar');
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    await expect(bar.locator('button, [tabindex]')).toHaveCount(0); // never a focus stop
    const thumb = page.locator('.scroll-thumb');
    const before = (await thumb.boundingBox())!;
    expect(before.height).toBeGreaterThan(40);
    // scrolling wakes it (real idle delay for this check: openUi speeds UI delays up) and moves the thumb
    await page.evaluate(() => window.sprout!.ui.setTimeScale(1));
    await wheelAndSample(page, 250);
    await expect(bar).toHaveClass(/is-awake/);
    const moved = (await thumb.boundingBox())!;
    expect(moved.y).toBeGreaterThan(before.y);
    // dragging the thumb back up scrolls the page back up, exactly with the hand
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2 - 400, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.mouse.move(moved.x + moved.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width / 2, before.y + before.height / 2 + 2000, { steps: 5 });
    await page.mouse.up();
    const s = await page.evaluate(() => window.sprout!.ui.scroll());
    expect(s.y).toBeCloseTo(s.max, 0);
  });

  test('pointer mapping stays right on a scrolled page: a hovered plant shows its label', async ({ page }) => {
    await openUi(page);
    const slotId = await page.evaluate(() => {
      window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-6', taskName: 'Scrolled' });
      return window.sprout!.completeSession()!.slotId;
    });
    // the camera followed the session to its plant: let it rest (pointer mapping at any zoom)
    await page.evaluate(() => window.sprout!.camera.settle());
    await page.evaluate(() => window.sprout!.plants.settle());
    await page.evaluate(() => window.sprout!.ui.scrollTo(120, { instant: true }));
    expect(await page.evaluate(() => window.scrollY)).toBe(120);
    const p = (await page.evaluate((id) => window.sprout!.ui.slotScreen(id), slotId))!;
    await page.mouse.move(p.x, p.y - 8);
    await expect(page.locator('.plant-label')).toHaveClass(/is-in/);
    await expect(page.locator('.plant-label')).toContainText('Scrolled · 25 min');
  });
});

test.describe('app shell · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no smoothing: the wheel moves the page at once', async ({ page }) => {
    await openUi(page);
    const run = await wheelAndSample(page, 300);
    expect(run.state.smooth).toBe(false);
    expect(run.prevented).toBe(true);
    expect(run.immediately).toBeCloseTo(Math.min(300, run.state.max), 0);
    expect(run.samples.every((y) => Math.abs(y - run.immediately) < 0.5)).toBe(true);
  });
});

test.describe('app shell · dock', () => {
  test('sections in order on one reading spine: Study, Your plant, the calendar, the tools (ADR 0200)', async ({ page }) => {
    await openUi(page, '');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const sections = await page.evaluate(() => window.sprout!.ui.dock());
    expect(sections.map((s) => s.id)).toEqual(['session', 'plant', 'calendar', 'tools']);
    // filled by the calendar (phase 8, ADR 0175)
    expect(sections.find((s) => s.id === 'calendar')).toMatchObject({ title: 'Calendar', span: 'full', filled: true, visible: true });
    const boxes = [];
    for (const id of ['session', 'plant', 'calendar', 'tools']) boxes.push((await page.locator(`[data-section="${id}"]`).boundingBox())!);
    // one column: each below the last, on one left edge, all as wide as each other
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
      expect(Math.abs(boxes[i]!.x - boxes[0]!.x)).toBeLessThan(1);
      expect(Math.abs(boxes[i]!.width - boxes[0]!.width)).toBeLessThan(1);
    }
    // wide screens: inside Study, the sessions in progress take a second track beside the controls
    await page.evaluate(() => {
      window.sprout!.startSessions(2, 25);
      window.sprout!.ui.refresh();
    });
    await expect(page.locator('.session-list')).toHaveAttribute('data-rows', 'true');
    const controls = (await page.locator('.panel').boundingBox())!;
    const list = (await page.locator('.session-list').boundingBox())!;
    expect(list.x).toBeGreaterThan(controls.x + controls.width - 1);
  });

  test('the session controls work from the dock and the pill shows the same session', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Docked', minutes: 25, species: 'fx-violet' });
    const panel = page.locator('.panel');
    const pill = page.locator('.pill');
    await expect(pill).toHaveAttribute('data-view', 'focus');
    await expect(pill.locator('.pill-time')).toHaveText(/^\d{1,2}:\d\d$/);
    await panel.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-view', 'paused');
    await expect(pill).toHaveAttribute('data-view', 'paused');
    // the pill steps aside while the dock's controls are on screen (ADR 0203): back on the garden
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    await expect(pill.getByRole('button', { name: 'Resume' })).toBeVisible();
  });

  test('the pill pauses and resumes, and glides down to the controls', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { minutes: 25, species: 'fx-violet' });
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    const pill = page.locator('.pill');
    await pill.getByRole('button', { name: 'Pause' }).click();
    expect(await page.evaluate(() => window.sprout!.status().phase)).toBe('paused');
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'paused');
    await pill.getByRole('button', { name: 'Resume' }).click();
    expect(await page.evaluate(() => window.sprout!.status().phase)).toBe('focus');

    await pill.getByRole('button', { name: 'Session controls' }).click();
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.scroll().animating)).toBe(false);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const section = (await page.locator('[data-section="session"]').boundingBox())!;
    expect(section.y).toBeGreaterThanOrEqual(0);
    expect(section.y).toBeLessThan(page.viewportSize()!.height / 2);
    await expect(page.locator('.panel button.pause')).toBeFocused();
  });

  test('idle, the pill is a small Start studying that opens the planting sheet', async ({ page }) => {
    await openUi(page);
    const pill = page.locator('.pill');
    await expect(pill).toHaveAttribute('data-view', 'idle');
    await pill.getByRole('button', { name: 'Start studying' }).click();
    await expect(page.locator('dialog[data-dialog="planting"]')).toBeVisible();
  });

  test('garden tools exist twice, with visible names in the dock, and share one state', async ({ page }) => {
    await openUi(page, 'widget=fake');
    for (const id of ['sound', 'widget', 'herbarium', 'data', 'hints']) {
      await expect(page.locator(`button[data-tool="${id}"]`)).toHaveCount(2);
    }
    const dockSound = page.locator('.tool-list button[data-tool="sound"]');
    const cornerSound = page.locator('.menu button[data-tool="sound"]');
    await expect(dockSound.locator('.tool-name')).toHaveText('Garden sounds');
    await expect(dockSound).toBeVisible();
    await expect(cornerSound).toHaveAttribute('aria-pressed', 'false');
    await dockSound.click();
    await expect(cornerSound).toHaveAttribute('aria-pressed', 'true');
    await expect(dockSound).toHaveAttribute('aria-pressed', 'true');
    await expect(dockSound.locator('.tool-note')).toContainText('On');
    expect(await page.evaluate(() => window.sprout!.state().settings.muted)).toBe(false);
    await cornerSound.click();
    await expect(dockSound).toHaveAttribute('aria-pressed', 'false');
    // the floating timer: open from the dock, pressed in the corner too
    await page.locator('.tool-list button[data-tool="widget"]').click();
    await expect(page.locator('.menu button[data-tool="widget"]')).toHaveAttribute('aria-pressed', 'true');
    // the dock's Hints opens the same sheet as the corner's
    await page.locator('.tool-list').getByRole('button', { name: 'Hints' }).click();
    await expect(page.locator('dialog[data-dialog="hints"]')).toBeVisible();
    await page.keyboard.press('Escape');
    // corner icons: big enough to hit, labelled for hover/focus and screen readers
    for (const b of await page.locator('.menu button').all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await b.getAttribute('aria-label')).toBeTruthy();
      expect((await b.locator('.ink-icon').boundingBox())!.width).toBeGreaterThanOrEqual(22);
    }
  });

  test('"Your plant" shows the session plant growing, plays watering, then the latest bloom', async ({ page }) => {
    await openUi(page);
    const view = page.locator('.plant-view');
    await expect(view).toHaveAttribute('data-mode', 'empty');
    await expect(view.locator('.plant-view-name')).toHaveText('An empty bed');
    expect(await page.evaluate(() => window.sprout!.ui.waterPlantView())).toBe(false); // nothing to water

    await plantSession(page, { task: 'Botany', minutes: 60, plan: 'pomodoro', species: 'fx-iris' });
    await expect(view).toHaveAttribute('data-mode', 'growing');
    await expect(view).toHaveAttribute('data-species-id', 'fx-iris');
    await expect(view.locator('.plant-view-name')).toHaveText('Japanese Iris');
    await expect(view.locator('.plant-view-task')).toHaveText('for “Botany”');
    await page.evaluate((ms) => window.sprout!.advance(ms), 20 * MIN);
    const grown = await page.evaluate(() => window.sprout!.ui.state().plantView.growth);
    expect(grown).toBeGreaterThan(0.3);
    // the painting is drawn when the section nears the window (ADR 0225): draw it now
    await page.evaluate(() => window.sprout!.ui.dockReady());
    await expect(view).toHaveAttribute('data-painted', /^growing\|fx-iris\|/);
    const inked = await view.locator('canvas.plant-canvas').evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
      return n / (data.length / 4);
    });
    expect(inked, 'the plant is painted').toBeGreaterThan(0.02);

    // watering in a break, from the dock's can: the plant view pours (read in the same task)
    await page.evaluate((ms) => window.sprout!.advance(ms), 11 * MIN);
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'break');
    const pouring = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('.panel button.water')!.click();
      return window.sprout!.ui.state().plantView.watering;
    });
    expect(pouring).toBe(true);
    // the hook for automatic watering plays it too (once at a time)
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().plantView.watering), { timeout: 8000 }).toBe(false);
    expect(await page.evaluate(() => [window.sprout!.ui.waterPlantView(), window.sprout!.ui.waterPlantView()])).toEqual([true, false]);

    await page.evaluate(() => window.sprout!.completeSession());
    await expect(view).toHaveAttribute('data-mode', 'bloom');
    await expect(view.locator('.plant-view-stage')).toHaveText('Your latest bloom');
    await expect(view.locator('.plant-view-task')).toContainText('“Botany” · 60 min');
  });
});

test.describe('app shell · tips', () => {
  test('tips point at the controls in their new homes', async ({ page }) => {
    await openUi(page);
    // fresh garden at the top of the page: the note sits by the pill's Start studying
    const note = page.locator('.tip[data-tip-id="notifications"]');
    await expect(note).toBeVisible();
    const near = async (anchor: string) => {
      const a = (await page.locator(anchor).boundingBox())!;
      const t = (await note.boundingBox())!;
      const dx = Math.max(0, a.x - (t.x + t.width), t.x - (a.x + a.width));
      const dy = Math.max(0, a.y - (t.y + t.height), t.y - (a.y + a.height));
      return Math.hypot(dx, dy);
    };
    expect(await near('.pill-start')).toBeLessThan(120);
    // scrolled to the dock: the same note moves to the dock's Start studying
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    await expect.poll(() => near('.panel .plant-session')).toBeLessThan(120);

    // a break: the watering note sits by the dock's can
    await plantSession(page, { minutes: 60, plan: 'pomodoro', species: 'fx-iris' });
    const first = await page.evaluate(() => window.sprout!.state().session!.plan.blocks[0]!.minutes);
    await page.evaluate((ms) => window.sprout!.advance(ms), first * MIN + 1000);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    const water = page.locator('.tip[data-tip-id="water"]');
    await expect(water).toBeVisible();
    const a = (await page.locator('.panel button.water').boundingBox())!;
    const t = (await water.boundingBox())!;
    expect(Math.hypot(t.x + t.width / 2 - (a.x + a.width / 2), t.y + t.height / 2 - (a.y + a.height / 2))).toBeLessThan(260);
  });
});
