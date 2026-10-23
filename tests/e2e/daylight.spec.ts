import type { Page } from '@playwright/test';
import { expect, openDev, test, waitFrames } from './fixtures';

/**
 * Mean colour, mean saturation (max − min channel) and luminance of a band of the garden canvas,
 * given as fractions of its height (0 = top), leaving out `inset` of its width on each side.
 */
async function band(page: Page, from = 0, to = 1, inset = 0) {
  return page.evaluate(
    ([a, b, i]) => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const ctx = c.getContext('2d')!;
      const y0 = Math.floor(c.height * a!);
      const h = Math.max(1, Math.floor(c.height * b!) - y0);
      const x0 = Math.floor(c.width * i!);
      const { data } = ctx.getImageData(x0, y0, Math.max(1, c.width - 2 * x0), h);
      let r = 0;
      let g = 0;
      let bl = 0;
      let sat = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4 * 53) {
        const R = data[i]!;
        const G = data[i + 1]!;
        const B = data[i + 2]!;
        r += R;
        g += G;
        bl += B;
        sat += Math.max(R, G, B) - Math.min(R, G, B);
        n++;
      }
      return { r: r / n, g: g / n, b: bl / n, sat: sat / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * bl) / n };
    },
    [from, to, inset],
  );
}

/** Pixel brightness at a world point (device pixels via the plant system's mapping). */
async function brightnessAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([wx, wy]) => {
      const d = window.sprout!.plants.toDevice({ x: wx!, y: wy!, w: 1, h: 1 })!;
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const p = c.getContext('2d')!.getImageData(Math.round(d.x), Math.round(d.y), 1, 1).data;
      return (p[0]! + p[1]! + p[2]!) / 3;
    },
    [x, y],
  );
}

async function show(page: Page, time: unknown) {
  await page.evaluate((t) => {
    window.sprout!.setTime(t as never);
    window.sprout!.settleAmbience();
    return window.sprout!.freeze();
  }, time);
}

test.describe('daylight phases', () => {
  test('each phase paints its own light: night darkest and blue, sunset warm, midday richest', async ({ page }) => {
    await openDev(page);
    await page.evaluate(async () => {
      window.sprout!.seed(4);
      window.sprout!.addPlants(20);
      await window.sprout!.plantsReady();
    });
    type Look = Awaited<ReturnType<typeof band>> & { sky: Awaited<ReturnType<typeof band>> };
    const looks = {} as Record<'sunrise' | 'midday' | 'sunset' | 'night', Look>;
    for (const p of ['sunrise', 'midday', 'sunset', 'night'] as const) {
      await show(page, p);
      const d = await page.evaluate(() => window.sprout!.daylight());
      expect(d.phase).toBe(p);
      // the painting itself, not the margins the stage's edge dissolves (paper at night, ADR 0184)
      looks[p] = { ...(await band(page, 0.06, 0.82, 0.05)), sky: await band(page, 0.06, 0.25, 0.05) };
    }
    const { sunrise, midday, sunset, night } = looks;
    // night: clearly darker and blue, but readable (no black veil)
    expect(night.lum).toBeLessThan(midday.lum - 40);
    expect(night.lum).toBeGreaterThan(midday.lum * 0.45);
    expect(night.b).toBeGreaterThan(night.r);
    expect(night.sky.b).toBeGreaterThan(night.sky.r + 25);
    // sunset: warmer than midday everywhere, the sky glowing warm
    expect(sunset.r - sunset.b).toBeGreaterThan(midday.r - midday.b + 10);
    expect(sunset.sky.r).toBeGreaterThan(sunset.sky.b + 30);
    // midday sky: blue overhead (bluer than the garden under it, far bluer than the sunset sky)
    expect(midday.sky.b - midday.sky.r).toBeGreaterThan(midday.b - midday.r + 8);
    expect(midday.sky.b - midday.sky.r).toBeGreaterThan(sunset.sky.b - sunset.sky.r + 40);
    // sunrise: between night and midday in brightness, a warm horizon
    expect(sunrise.lum).toBeGreaterThan(night.lum);
    expect(sunrise.sky.r).toBeGreaterThan(sunrise.sky.b);
    // midday is the most saturated light on the garden below the sky; night the least
    const garden = async (p: string) => {
      await show(page, p);
      return band(page, 0.4, 1);
    };
    const satNoon = (await garden('midday')).sat;
    expect(satNoon).toBeGreaterThan((await garden('night')).sat);
  });

  test('the moon is a light in the night sky and the sun a light low over the hills', async ({ page }) => {
    await openDev(page);
    await show(page, 'night');
    const n = await page.evaluate(() => window.sprout!.daylight());
    expect(n.moon.alpha).toBe(1);
    expect(n.sun.alpha).toBe(0);
    const moon = await brightnessAt(page, n.moon.x, n.moon.y);
    const sky = await brightnessAt(page, n.moon.x + 80, n.moon.y + 40);
    expect(moon).toBeGreaterThan(sky + 40);

    await show(page, 'sunset');
    const s = await page.evaluate(() => window.sprout!.daylight());
    expect(s.sun.alpha).toBeGreaterThan(0.5);
    expect(s.sun.x).toBeLessThan(800); // it sets on the left
    // (its lower half has sunk behind the far ridge: sample the upper half)
    const sun = await brightnessAt(page, s.sun.x, s.sun.y - s.sun.r * 0.6);
    const around = await brightnessAt(page, s.sun.x, s.sun.y - 70);
    expect(sun).toBeGreaterThan(around + 15);
    expect(s.shadow.dx).toBeGreaterThan(1); // shadows fall right, away from it
    expect(s.rim.side).toBe(-1);
  });

  test('blends sit between their phases and the sky follows setTime at once', async ({ page }) => {
    await openDev(page);
    await show(page, 'sunset');
    const a = await band(page);
    await show(page, 'night');
    const b = await band(page);
    await show(page, { from: 'sunset', to: 'night', t: 0.5 });
    const mid = await band(page);
    const d = await page.evaluate(() => window.sprout!.daylight());
    expect(d.blend).toMatchObject({ from: 'sunset', to: 'night' });
    expect(mid.lum).toBeLessThan(Math.max(a.lum, b.lum));
    expect(mid.lum).toBeGreaterThan(Math.min(a.lum, b.lum));
    const sky = await page.evaluate(() => window.sprout!.skyStats()!);
    expect(sky.plates).toBeGreaterThanOrEqual(2);
  });

  test('follows the clock: the location is guessed from the time zone, sun times are real', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => window.sprout!.setTime(null));
    const d = await page.evaluate(() => window.sprout!.daylight());
    expect(d.override).toBeNull();
    expect(Math.abs(d.location.lat)).toBeLessThanOrEqual(90);
    expect(d.sunTimes).not.toBeNull();
    const w = Object.values(d.weights).reduce((x, y) => x + y, 0);
    expect(w).toBeCloseTo(1, 6);
  });

  test('fauna rests at night by the daylight phases', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.fauna.setHour(null);
      window.sprout!.setTime('night');
    });
    await waitFrames(page, 3);
    expect(await page.evaluate(() => window.sprout!.fauna.night())).toBe(true);
    await page.evaluate(() => window.sprout!.setTime('midday'));
    await waitFrames(page, 3);
    expect(await page.evaluate(() => window.sprout!.fauna.night())).toBe(false);
  });

  test('stays inside the frame budget at night with the full light', async ({ page }) => {
    await openDev(page);
    await page.evaluate(async () => {
      window.sprout!.addPlants(30);
      await window.sprout!.plantsReady();
      window.sprout!.setTime({ from: 'sunset', to: 'night', t: 0.5 });
    });
    await waitFrames(page, 90);
    const amb = await page.evaluate(() => window.sprout!.ambience()!);
    expect(amb.ms).toBeLessThan(1.5);
    const plants = await page.evaluate(() => window.sprout!.plants.perf());
    expect(plants.avgMs).toBeLessThan(4);
  });

  test('at night the wash stops short of the margin and the margin is paper, not a grey haze (ADR 0184)', async ({ page }) => {
    await openDev(page);
    /** Mean colour of a vertical strip of the canvas, between two CSS-px distances from its left edge. */
    const strip = (x0: number, x1: number) =>
      page.evaluate(
        ([a, b]) => {
          const c = document.querySelector<HTMLCanvasElement>('#garden')!;
          const k = c.width / c.clientWidth;
          const { data } = c.getContext('2d')!.getImageData(Math.round(a! * k), Math.round(c.height * 0.3), Math.max(1, Math.round((b! - a!) * k)), Math.round(c.height * 0.3));
          let r = 0;
          let g = 0;
          let bl = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]!;
            g += data[i + 1]!;
            bl += data[i + 2]!;
            n++;
          }
          return { r: r / n, g: g / n, b: bl / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * bl) / n };
        },
        [x0, x1],
      );
    await show(page, 'night');
    const margin = await strip(1, 6);
    const inside = await strip(220, 260);
    // the margin is warm paper again (the paper layer's cream), not the night's grey-blue
    expect(margin.lum).toBeGreaterThan(205);
    expect(margin.b).toBeLessThan(margin.r);
    // while the garden itself stays in the night
    expect(inside.lum).toBeLessThan(margin.lum - 50);
    // the same paper as by day (the night's glaze used to grey it into a haze)
    await show(page, 'midday');
    const day = await strip(1, 6);
    expect(Math.abs(day.lum - margin.lum)).toBeLessThan(16);
  });
});

test.describe('plantsReady', () => {
  test('waits for plants added just before it, painted and fully shown', async ({ page }) => {
    await openDev(page);
    const st = await page.evaluate(async () => {
      window.sprout!.addPlants(25); // not awaited: no frame in between
      await window.sprout!.plantsReady();
      return window.sprout!.plants.state();
    });
    expect(st.finished.length).toBe(25);
    expect(st.cache.queued + st.cache.inFlight).toBe(0);
    const shown = st.finished.filter((f) => f.drawn && f.shown >= 1);
    expect(shown.length).toBeGreaterThanOrEqual(20); // a few may sit outside the view
  });
});
