import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi, plantSession } from './ui-helpers';

/**
 * The camera over the garden (SPEC §12a, ADRs 0160–0168): focus on the seedling, zoom gestures,
 * drag, the on-canvas controls, the plant card, placement at any zoom, reduced motion, and the
 * detail painted for a close view. Time never matters here: glides are finished with
 * `sprout.camera.settle()`, which also waits for the detail of the resting view, and a glide that
 * must be seen to start is read from `sprout.camera.glides()` in the same task as its cause,
 * never caught mid-flight in a later round trip.
 */

type Pt = { x: number; y: number };

const camera = (page: Page) => page.evaluate(() => window.sprout!.camera.state());

/** A world point on the plant's painted pixels (scanning its box with the plant hit-test). */
function paintedPoint(page: Page, id: string) {
  return page.evaluate((pid) => {
    const r = window.sprout!.plants.bounds(pid)!;
    let best: Pt | null = null;
    let bestD = Infinity;
    for (let fy = 0.35; fy <= 0.95; fy += 0.05) {
      for (let fx = 0.2; fx <= 0.8; fx += 0.05) {
        const p = { x: r.x + r.w * fx, y: r.y + r.h * fy };
        if (window.sprout!.plants.hitTest(p)?.id !== pid) continue;
        // prefer the plant's middle
        const d = Math.hypot(fx - 0.5, fy - 0.7);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return best;
  }, id);
}

const toClient = (page: Page, world: Pt) => page.evaluate((w) => window.sprout!.camera.toClient(w), world);

/** A finished real species (the card's note is about real species) in a slot on screen. */
async function finishedClover(page: Page, task = 'Kanji'): Promise<string> {
  return page.evaluate(async (taskName) => {
    const s = window.sprout!;
    s.camera.autoFocus(false);
    const slot = s.placementOptions('white-clover').map((o) => o.id)[0]!;
    s.start(25, { speciesId: 'white-clover', slotId: slot, taskName });
    const plant = s.completeSession()!;
    s.camera.autoFocus(true);
    await s.plants.settle();
    return plant.id;
  }, task);
}

test.describe('camera', () => {
  test('a session start glides the camera onto its seedling, a little off-centre', async ({ page }) => {
    await openUi(page);
    expect((await camera(page)).overview).toBe(true);
    // The glide is read from the camera's log, started in the same task: a loaded machine can
    // finish it before another round trip could catch `state().gliding` (TESTING.md › Flakiness).
    const started = await page.evaluate(() => {
      const s = window.sprout!;
      s.camera.clearGlides();
      s.start(25, { speciesId: 'fx-violet', slotId: 'meadow-6' });
      return s.camera.glides();
    });
    expect(started).toHaveLength(1);
    const glide = started[0]!;
    expect(glide.reason).toBe('session');
    expect(glide.from.zoom).toBe(1); // from the overview
    expect(glide.target.zoom).toBeGreaterThan(1.5);
    await page.evaluate(() => window.sprout!.camera.settle());
    const st = await camera(page);
    expect(st.gliding).toBe(false);
    // one glide, and it came to rest where it was heading
    expect(await page.evaluate(() => window.sprout!.camera.glides())).toMatchObject([{ reason: 'session', target: glide.target, end: 'arrived' }]);
    expect(st.pose.zoom).toBeCloseTo(glide.target.zoom, 3);
    expect(st.pose.x).toBeCloseTo(glide.target.x, 3);
    expect(st.pose.y).toBeCloseTo(glide.target.y, 3);
    // the seedling is in view, not dead centre
    const box = (await page.evaluate(() => window.sprout!.plants.bounds(window.sprout!.state().session!.id)))!;
    const v = st.view.visible;
    const cx = box.x + box.w / 2;
    expect(cx).toBeGreaterThan(v.x);
    expect(cx).toBeLessThan(v.x + v.w);
    expect(box.y + box.h).toBeLessThanOrEqual(v.y + v.h + 1);
    expect(Math.abs(cx - (v.x + v.w / 2)) / v.w).toBeGreaterThan(0.02);
    // the user zooms out: nothing re-zooms until the next start or switch
    await page.locator('[data-zoom="whole"]').click();
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).overview).toBe(true);
    await page.evaluate(() => {
      window.sprout!.camera.clearGlides();
      window.sprout!.advance(5 * 60_000);
    });
    await page.evaluate(() => window.sprout!.camera.settle());
    expect(await page.evaluate(() => window.sprout!.camera.glides())).toEqual([]);
    expect((await camera(page)).overview).toBe(true);
  });

  test('switching sessions glides to the newly active seedling', async ({ page }) => {
    await openUi(page);
    const first = await page.evaluate(() => window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-6', taskName: 'One' })!.id);
    await page.evaluate(() => window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-1', taskName: 'Two' }));
    await page.evaluate(() => window.sprout!.camera.settle());
    const onSecond = await camera(page);
    // switch and read the log in one task (see the start test above)
    const switched = await page.evaluate((id) => {
      const s = window.sprout!;
      s.camera.clearGlides();
      return { ok: s.switchTo(id), glides: s.camera.glides() };
    }, first);
    expect(switched.ok).toBe(true);
    expect(switched.glides).toHaveLength(1);
    const glide = switched.glides[0]!;
    expect(glide.reason).toBe('switch');
    // from the second seedling's close view
    expect(glide.from.zoom).toBeCloseTo(onSecond.pose.zoom, 3);
    expect(glide.target).not.toEqual(onSecond.pose);
    await page.evaluate(() => window.sprout!.camera.settle());
    const st = await camera(page);
    expect(st.reason).toBe('switch');
    expect(await page.evaluate(() => window.sprout!.camera.glides())).toMatchObject([{ reason: 'switch', target: glide.target, end: 'arrived' }]);
    expect(st.pose.zoom).toBeCloseTo(glide.target.zoom, 3);
    expect(st.pose.x).toBeCloseTo(glide.target.x, 3);
    expect(st.pose.y).toBeCloseTo(glide.target.y, 3);
    // the first seedling is in view
    const box = (await page.evaluate((id) => window.sprout!.plants.bounds(id), first))!;
    const v = st.view.visible;
    expect(box.x + box.w / 2).toBeGreaterThan(v.x);
    expect(box.x + box.w / 2).toBeLessThan(v.x + v.w);
    expect(st.pose).not.toEqual(onSecond.pose);
  });

  test('ctrl+wheel zooms about the pointer and never scrolls; a plain wheel still scrolls the page', async ({ page }) => {
    await openUi(page);
    const stage = (await page.locator('#garden').boundingBox())!;
    const at = { x: stage.x + stage.width * 0.3, y: stage.y + stage.height * 0.6 };
    const under = await page.evaluate(({ x, y }) => {
      const c = document.querySelector('#garden')!.getBoundingClientRect();
      const st = window.sprout!.camera.state();
      return { x: st.view.visible.x + ((x - c.left) / c.width) * st.view.visible.w, y: st.view.visible.y + ((y - c.top) / c.height) * st.view.visible.h };
    }, at);
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -240);
    await page.keyboard.up('Control');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const st = await camera(page);
    expect(st.pose.zoom).toBeGreaterThan(1.2);
    const back = await toClient(page, under);
    expect(Math.abs(back.x - at.x)).toBeLessThan(3);
    expect(Math.abs(back.y - at.y)).toBeLessThan(3);
    // plain wheel: the page scrolls, the zoom stays
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    expect((await camera(page)).pose.zoom).toBeCloseTo(st.pose.zoom, 3);
  });

  test('drag pans only while zoomed in; the canvas lets the page scroll by touch at the overview', async ({ page }) => {
    await openUi(page);
    const stage = (await page.locator('#garden').boundingBox())!;
    const mid = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
    expect((await camera(page)).touchAction).toBe('pan-x pan-y');
    // overview: a drag does nothing
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 120, mid.y + 40, { steps: 6 });
    await page.mouse.up();
    expect((await camera(page)).overview).toBe(true);
    // zoomed: the painting follows the hand
    await page.evaluate(() => window.sprout!.camera.zoomTo(2, undefined, { animate: false }));
    expect((await camera(page)).touchAction).toBe('none');
    const before = await camera(page);
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 120, mid.y + 40, { steps: 6 });
    await page.mouse.up();
    const after = await camera(page);
    const scale = after.view.scale;
    expect(before.pose.x - after.pose.x).toBeCloseTo(120 / scale, 0);
    expect(before.pose.y - after.pose.y).toBeCloseTo(40 / scale, 0);
    expect(after.pose.zoom).toBeCloseTo(2, 5);
  });

  test('a two-finger pinch zooms the garden', async ({ page }) => {
    await openUi(page);
    const zoom = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const ev = (type: string, id: number, x: number, y: number) =>
        new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 });
      c.dispatchEvent(ev('pointerdown', 1, cx - 40, cy));
      c.dispatchEvent(ev('pointerdown', 2, cx + 40, cy));
      for (let i = 1; i <= 10; i++) {
        window.dispatchEvent(ev('pointermove', 1, cx - 40 - i * 8, cy));
        window.dispatchEvent(ev('pointermove', 2, cx + 40 + i * 8, cy));
      }
      window.dispatchEvent(ev('pointerup', 1, cx - 120, cy));
      window.dispatchEvent(ev('pointerup', 2, cx + 120, cy));
      return window.sprout!.camera.state().pose.zoom;
    });
    expect(zoom).toBeGreaterThan(2.5);
  });

  test('double-click zooms in about the point; + / − and Whole garden', async ({ page }) => {
    await openUi(page);
    const whole = page.locator('[data-zoom="whole"]');
    await expect(whole).toBeHidden();
    await expect(page.locator('[data-zoom="out"]')).toBeDisabled();
    // a bare spot of sky to double-click
    const sky = await toClient(page, { x: 800, y: 200 });
    await page.mouse.dblclick(sky.x, sky.y);
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeCloseTo(2, 1);
    await expect(whole).toBeVisible();
    await page.locator('[data-zoom="in"]').click();
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeCloseTo(3, 1);
    await expect(page.locator('[data-zoom="in"]')).toBeDisabled();
    await page.locator('[data-zoom="out"]').click();
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeCloseTo(3 / 1.6, 1);
    await whole.click();
    expect((await camera(page)).reason).toBe('overview');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).overview).toBe(true);
    await expect(whole).toBeHidden();
  });

  test('keyboard on the focused garden: + − 0 and the arrows', async ({ page }) => {
    await openUi(page);
    await page.locator('#garden').focus();
    await page.keyboard.press('+');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeCloseTo(1.6, 2);
    const x0 = (await camera(page)).pose.x;
    await page.keyboard.press('ArrowRight');
    expect((await camera(page)).pose.x).toBeGreaterThan(x0);
    await page.keyboard.press('-');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).overview).toBe(true);
    await page.keyboard.press('+');
    await page.keyboard.press('0');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).overview).toBe(true);
  });

  test('click a plant: the camera glides onto it and its card tells its story; Esc closes it', async ({ page }) => {
    await openUi(page);
    const id = await finishedClover(page, 'Kanji');
    const at = (await paintedPoint(page, id))!;
    expect(at).not.toBeNull();
    // the cursor offers the plant
    const c = await toClient(page, at);
    await page.mouse.move(c.x, c.y);
    await expect.poll(async () => (await camera(page)).cursor).toBe('pointer');
    await page.mouse.click(c.x, c.y);
    const card = page.locator('[data-ui="plant-card"]');
    await expect(card).toBeVisible();
    expect((await camera(page)).reason).toBe('plant');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeGreaterThan(1.5);
    await expect(card.locator('h2')).toHaveText('White Clover');
    // a labelled dialog: screen readers hear the plant's name
    await expect(page.getByRole('dialog', { name: 'White Clover' })).toBeVisible();
    await expect(card).toContainText('Shirotsumekusa');
    await expect(card).toContainText('packing grass'); // its place in Japanese gardens
    await expect(card).toContainText('three leaves for patience'); // its poetic line
    await expect(card).toContainText('“Kanji”');
    await expect(card).toContainText('25 minutes of study');
    await expect(card).toContainText('planted ');
    expect((await page.evaluate(() => window.sprout!.ui.state())).plantCard).toMatchObject({ id, kind: 'finished' });
    // the card stands beside the plant, not over it
    const cardBox = (await card.boundingBox())!;
    const plantNow = await toClient(page, at);
    expect(plantNow.x < cardBox.x || plantNow.x > cardBox.x + cardBox.width).toBe(true);
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    // closing leaves the view where it is (no fighting the gardener)
    expect((await camera(page)).overview).toBe(false);
  });

  test('the card opens from the keyboard, takes focus and gives it back; a click elsewhere closes it', async ({ page }) => {
    await openUi(page);
    const id = await finishedClover(page);
    await page.evaluate((pid) => window.sprout!.camera.focusPlant(pid, { animate: false }), id);
    await page.evaluate(() => window.sprout!.camera.settle());
    await page.locator('#garden').focus();
    await page.keyboard.press('Enter');
    const card = page.locator('[data-ui="plant-card"]');
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(page.locator('#garden')).toBeFocused();
    // open again, click in the dock: closes
    await page.keyboard.press('Enter');
    await expect(card).toBeVisible();
    await page.locator('.dock').click({ position: { x: 10, y: 10 } });
    await expect(card).toBeHidden();
  });

  test('a growing seedling’s card shows its progress and time to go', async ({ page }) => {
    await openUi(page);
    const id = await page.evaluate(() => window.sprout!.start(50, { speciesId: 'white-clover', slotId: window.sprout!.placementOptions('white-clover')[0]!.id, taskName: 'Essay' })!.id);
    await page.evaluate(() => window.sprout!.advance(10 * 60_000));
    await page.evaluate(() => window.sprout!.camera.settle());
    expect(await page.evaluate((sid) => window.sprout!.camera.openCard(sid), id)).toBe(true);
    const card = page.locator('[data-ui="plant-card"]');
    await expect(card).toHaveAttribute('data-kind', 'growing');
    await expect(card).toContainText('Growing for “Essay”');
    await expect(card).toContainText('% grown');
    await expect(card).toContainText('to go');
  });

  test('placement works at any zoom: entering it glides to the whole garden; a marker chosen while zoomed starts there', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.camera.zoomTo(2.5, undefined, { animate: false }));
    await plantSession(page, { task: 'Zoomed', minutes: 25, species: 'fx-violet', slot: 'free', begin: false });
    expect((await camera(page)).reason).toBe('placement');
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).overview).toBe(true);
    // zoom in again while choosing: the markers follow the camera
    await page.locator('[data-zoom="in"]').click();
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await camera(page)).pose.zoom).toBeGreaterThan(1.4);
    const marker = page.locator('button.marker[data-occupied="false"]:not([hidden])').first();
    const slotId = (await marker.getAttribute('data-slot-id'))!;
    const box = (await marker.boundingBox())!;
    const expected = (await page.evaluate((id) => window.sprout!.ui.slotScreen(id), slotId))!;
    // the marker's centre sits on its slot at this zoom
    expect(Math.abs(box.x + box.width / 2 - expected.x)).toBeLessThan(box.width);
    await marker.click();
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    expect(await page.evaluate(() => window.sprout!.state().session!.slotId)).toBe(slotId);
    expect((await camera(page)).reason).toBe('session');
  });

  test('close views are painted in detail: the scene, the light plate and the plants in view', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      window.sprout!.setTime('night');
      window.sprout!.addPlants(10);
      await window.sprout!.plantsReady();
    });
    const base = await page.evaluate(() => window.sprout!.sceneStats().lastView!.scale);
    await page.evaluate(() => window.sprout!.camera.glideTo({ zoom: 3, x: 806, y: 300 }, { animate: false }));
    await page.evaluate(() => window.sprout!.camera.settle());
    const detail = await page.evaluate(() => window.sprout!.sceneDetail());
    expect(detail.view!.scale).toBeGreaterThan(base * 1.5);
    expect(detail.painting).toBe(false);
    const light = await page.evaluate(() => window.sprout!.lightDetail());
    expect(light?.ready).toBe(true);
    expect(light!.scale).toBeGreaterThan(0.8);
    expect((await page.evaluate(() => window.sprout!.skyStats()))!.detail).not.toBeNull();
    // back at the overview the detail goes
    await page.evaluate(() => window.sprout!.camera.overview({ animate: false }));
    await page.evaluate(() => window.sprout!.camera.settle());
    expect((await page.evaluate(() => window.sprout!.sceneDetail())).view).toBeNull();
  });

  test('a glide stays smooth: main-thread frame cost while the camera moves', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      window.sprout!.addPlants(30);
      await window.sprout!.plantsReady();
      window.sprout!.resetFrameStats();
      window.sprout!.camera.glideTo({ zoom: 2.6, x: 500, y: 640 });
    });
    await page.waitForFunction(() => !window.sprout!.camera.state().gliding, null, { polling: 'raf' });
    const stats = await page.evaluate(() => window.sprout!.frameStats());
    console.log(`glide: ${stats.frames} frames, work avg ${stats.workAvg} ms, p95 ${stats.workP95} ms, max ${stats.workMax} ms; interval p95 ${stats.intervalP95} ms`);
    expect(stats.frames).toBeGreaterThan(10);
    // generous for loaded CI machines; a laptop measures a few ms
    expect(stats.workAvg).toBeLessThan(14);
    // no background repaint ran inside the glide
    const scene = await page.evaluate(() => window.sprout!.sceneStats());
    expect(scene.paints).toBe(1);
  });
});

test.describe('camera · cost at rest', () => {
  test('a close view at rest costs about what the overview costs (ADR 0207)', async ({ page }) => {
    // The main thread's whole time per frame, raster included: on a CPU rasteriser (headless) the
    // canvas is rasterised on the main thread, inside or after the frame callback depending on
    // when Chromium flushes, so `frameStats().workAvg` alone can hide it or show it. Relative to
    // the overview on the same page, so a loaded machine slows both alike.
    await openUi(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const busyMs = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration')!.value * 1000;
    const perFrame = async () => {
      await page.evaluate(() => window.sprout!.resetFrameStats());
      const t0 = await busyMs();
      await page.waitForFunction(() => window.sprout!.frameStats().frames >= 40, null, { polling: 100 });
      const t1 = await busyMs();
      return (t1 - t0) / (await page.evaluate(() => window.sprout!.frameStats().frames));
    };
    await page.evaluate(async () => {
      window.sprout!.setTime('noon');
      window.sprout!.addPlants(30);
      await window.sprout!.plantsReady();
    });
    const rest = async (zoom: number) => {
      await page.evaluate(async (z) => {
        if (z > 1) window.sprout!.camera.glideTo({ zoom: z, x: 500, y: 640 }, { animate: false });
        else window.sprout!.camera.overview({ animate: false });
        await window.sprout!.camera.settle();
        await window.sprout!.plantsReady();
      }, zoom);
      return Math.min(await perFrame(), await perFrame());
    };
    const overview = await rest(1);
    const close = await rest(2.6);
    console.log(`rest: overview ${overview.toFixed(1)} ms/frame, 2.6× ${close.toFixed(1)} ms/frame (main thread, raster included)`);
    // measured 1.1–1.5× (CPU rasteriser, DPR 1 and 2); a close view drawing far more than it shows fails
    expect(close).toBeLessThan(overview * 1.75);
  });
});

test.describe('camera · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('glides become cuts', async ({ page }) => {
    await openUi(page);
    await page.locator('[data-zoom="in"]').click();
    const st = await camera(page);
    expect(st.gliding).toBe(false);
    expect(st.pose.zoom).toBeCloseTo(1.6, 3);
    await page.evaluate(() => window.sprout!.start(25, { speciesId: 'fx-violet', slotId: 'meadow-6' }));
    const s2 = await camera(page);
    expect(s2.reason).toBe('session');
    expect(s2.gliding).toBe(false);
  });
});

test.describe('camera · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the card docks at the bottom of the stage and the plant is framed above it', async ({ page }) => {
    await openUi(page);
    const id = await finishedClover(page, 'Phone');
    expect(await page.evaluate((pid) => window.sprout!.camera.openCard(pid), id)).toBe(true);
    await page.evaluate(() => window.sprout!.camera.settle());
    const card = page.locator('[data-ui="plant-card"]');
    await expect(card).toHaveAttribute('data-placement', 'docked');
    const cardBox = (await card.boundingBox())!;
    const box = (await page.evaluate((pid) => window.sprout!.plants.bounds(pid), id))!;
    const base = await toClient(page, { x: box.x + box.w / 2, y: box.y + box.h * 0.9 });
    expect(base.y).toBeLessThan(cardBox.y);
    expect(base.x).toBeGreaterThan(0);
    expect(base.x).toBeLessThan(390);
    // the pill and the zoom chips step back behind it
    await expect(page.locator('.zoom-controls')).toBeHidden();
  });
});

