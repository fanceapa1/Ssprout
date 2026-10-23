import { canvasStats, expect, openDev, test, waitFrames } from './fixtures';

/** Mean absolute RGB difference between two canvas readouts. */
const delta = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

test.describe('ambience & lighting', () => {
  test('a session brings its weather; every weather and night render without errors', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.setTime('noon');
      window.sprout!.seed(3);
    });
    await page.evaluate(() => window.sprout!.freeze());
    const idle = await canvasStats(page);

    const session = await page.evaluate(() => window.sprout!.start(25));
    expect(session).not.toBeNull();
    await page.evaluate(() => {
      window.sprout!.settleAmbience();
      return window.sprout!.freeze();
    });
    const amb = await page.evaluate(() => window.sprout!.ambience()!);
    expect(amb.phase).toBe('focus');
    expect(amb.weather).toBe(session!.weather);
    expect(amb.levels[session!.weather]).toBeCloseTo(1, 5);

    const looks: Record<string, Awaited<ReturnType<typeof canvasStats>>> = {};
    for (const w of ['sun', 'rain', 'mist'] as const) {
      await page.evaluate((weather) => {
        window.sprout!.setWeather(weather);
        return window.sprout!.freeze();
      }, w);
      const a = await page.evaluate(() => window.sprout!.ambience()!);
      expect(a.preview).toBe(w);
      expect(a.levels[w]).toBeCloseTo(1, 5);
      if (w === 'rain') {
        expect(a.counts.rain).toBeGreaterThan(20);
        expect(a.counts.ripples).toBeGreaterThan(0);
      }
      looks[w] = await canvasStats(page);
      // subtle, but visible: the frame changes a little, never a lot
      const d = delta(looks[w]!, idle);
      expect(d, `${w} changes the frame`).toBeGreaterThan(0.3);
      expect(d, `${w} stays subtle`).toBeLessThan(40);
    }

    await page.evaluate(() => {
      window.sprout!.setTime('night');
      return window.sprout!.freeze();
    });
    const night = await canvasStats(page);
    expect(night.r + night.g + night.b).toBeLessThan(looks.mist!.r + looks.mist!.g + looks.mist!.b - 60);
    expect(night.b).toBeGreaterThan(night.r); // indigo
    expect((await page.evaluate(() => window.sprout!.ambience()!)).time).toBe('night');
  });

  test('pause eases the weather to a still trace; ending the session fades it out', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.seed(1);
      window.sprout!.start(25);
      window.sprout!.settleAmbience();
    });
    await page.evaluate(() => window.sprout!.freeze());
    const w = (await page.evaluate(() => window.sprout!.ambience()!)).weather!;

    await page.evaluate(() => {
      window.sprout!.pause();
      window.sprout!.settleAmbience();
      return window.sprout!.freeze();
    });
    const paused = await page.evaluate(() => window.sprout!.ambience()!);
    expect(paused.phase).toBe('paused');
    expect(paused.levels.motion).toBe(0);
    expect(paused.levels[w]).toBeGreaterThan(0.1);
    expect(paused.levels[w]).toBeLessThan(0.5);

    // the fade is gradual: right after cancelling, the weather is still (mostly) there
    await page.evaluate(() => window.sprout!.unfreeze());
    await page.evaluate(() => window.sprout!.cancel());
    const just = await page.evaluate(() => window.sprout!.ambience()!);
    expect(just.levels[w]).toBeGreaterThan(0.05);
    await page.evaluate(() => {
      window.sprout!.settleAmbience();
      return window.sprout!.freeze();
    });
    const after = await page.evaluate(() => window.sprout!.ambience()!);
    expect(after.phase).toBe('idle');
    expect(after.levels[w]).toBe(0);
  });

  test('setTime accepts phases, v1 names, blends, hours and null; bad input throws', async ({ page }) => {
    await openDev(page);
    const cases = [
      ['sunrise', 'sunrise'],
      ['midday', 'midday'],
      ['sunset', 'sunset'],
      ['night', 'night'],
      ['morning', 'sunrise'],
      ['noon', 'midday'],
      ['evening', 'sunset'],
      [{ from: 'sunset', to: 'night', t: 0.8 }, 'night'],
      [13, 'midday'],
    ] as const;
    for (const [v, name] of cases) {
      await page.evaluate((x) => {
        window.sprout!.setTime(x as never);
        return window.sprout!.freeze();
      }, v);
      expect((await page.evaluate(() => window.sprout!.ambience()!)).time, JSON.stringify(v)).toBe(name);
    }
    // the v1 'dusk' is the sunset → night blend, halfway
    await page.evaluate(() => {
      window.sprout!.setTime('dusk');
      return window.sprout!.freeze();
    });
    const dusk = await page.evaluate(() => window.sprout!.ambience()!);
    expect(dusk.weights.sunset).toBeCloseTo(0.5, 5);
    expect(dusk.weights.night).toBeCloseTo(0.5, 5);
    await page.evaluate(() => window.sprout!.setTime(null));
    expect((await page.evaluate(() => window.sprout!.ambience()!)).timeOverride).toBeNull();
    const err = await page.evaluate(() => {
      try {
        window.sprout!.setTime('teatime' as never);
        return null;
      } catch (e) {
        return String(e);
      }
    });
    expect(err).toContain('setTime');
  });

  test('stays inside the frame budget', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.setTime('night');
      window.sprout!.setWeather('rain');
    });
    // let the moving average (α 0.05) settle over 90 real frames: the start value weighs < 1 %
    await page.waitForFunction(() => (window.sprout!.ambience()!.lightingPaints ?? 0) > 0);
    await waitFrames(page, 90);
    const ms = (await page.evaluate(() => window.sprout!.ambience()!)).ms;
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1.5);
  });
});

test.describe('ambience with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('rain is still (static strokes), no motes, lighting unaffected', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.setTime('dusk');
      // the overview, as before the camera (it would cut to the seedling and paint detail for it)
      window.sprout!.camera.autoFocus(false);
      window.sprout!.start(25);
      window.sprout!.setWeather('rain');
    });
    await page.evaluate(() => window.sprout!.freeze());
    const a = await page.evaluate(() => window.sprout!.ambience()!);
    expect(a.reducedMotion).toBe(true);
    expect(a.levels.motion).toBe(0);
    expect(a.levels.motes).toBe(0);
    expect(a.counts.motes).toBe(0);
    expect(a.counts.rain).toBeGreaterThan(20);
    expect(a.weights.night).toBeCloseTo(0.5, 5);

    // nothing moves between frames
    const before = await canvasStats(page);
    await page.evaluate(() => window.sprout!.unfreeze());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate(() => window.sprout!.freeze());
    const after = await canvasStats(page);
    expect(delta(before, after)).toBeLessThan(0.05);
  });
});
