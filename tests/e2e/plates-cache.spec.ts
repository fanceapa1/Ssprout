import type { Page } from '@playwright/test';
import { expect, openDev, test, waitFrames } from './fixtures';
import { storedOf } from './paint-store';

/**
 * The daylight plates from the persistent paint cache (ADR 0236). The e2e server is the
 * production build, where the cache is on. Every test has its own browser context, so it starts
 * with an empty store; the loads inside one test share it, like repeat visits.
 */

/** Init script: `&e2eat=HH:MM` opens the page at that local time of today (the boot's daylight phase). */
function openAt(): void {
  const m = /[?&]e2eat=(\d\d):(\d\d)/.exec(location.search);
  if (!m) return;
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const at = new RealDate(realNow());
  at.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const offset = at.getTime() - realNow();
  class AtDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [number]));
    }
    static override now(): number {
      return realNow() + offset;
    }
  }
  globalThis.Date = AtDate as DateConstructor;
}

const PHASES = ['sunrise', 'midday', 'sunset', 'night'] as const;

/**
 * The garden frame with the painting, the sky, the light plate and the paper drawn, at a pinned
 * daylight: everything that moves (water, weather, creatures, the lantern's flame under reduced
 * motion) is left out. `view`: a resting close view instead of the overview.
 */
async function lightFrame(page: Page, time: 'noon' | 'night', view?: { zoom: number; x: number; y: number }): Promise<string> {
  return page.evaluate(
    async ({ time, view }) => {
      const s = window.sprout!;
      s.setTime(time);
      if (view) await s.camera.glideTo(view, { animate: false });
      await s.camera.settle();
      s.settleAmbience();
      const ids = s.mute({});
      const mute: Record<string, readonly string[] | '*'> = Object.fromEntries(ids.filter((id) => id !== 'scene' && id !== 'paper' && id !== 'ambience').map((id) => [id, '*']));
      mute.scene = ['waterSurface']; // the water animates with time
      mute.ambience = ['waterSurface', 'ambience'];
      s.mute(mute);
      await s.freeze();
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      s.unfreeze();
      s.mute({});
      return btoa(bin);
    },
    { time, view },
  );
}

function differingPixels(a: string, b: string): number {
  const x = Buffer.from(a, 'base64');
  const y = Buffer.from(b, 'base64');
  expect(x.length).toBe(y.length);
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) n++;
  return n;
}

const plateStats = (page: Page) =>
  page.evaluate(() => {
    const sky = window.sprout!.skyStats()!;
    return { sky: { plates: sky.plates, painted: sky.painted, hits: sky.cacheHits }, light: window.sprout!.lightPlates() };
  });

const CLOSE = { zoom: 3, x: 1180, y: 380 };

test.describe('daylight plates from the paint cache (ADR 0236)', () => {
  // the overview is the whole world: one landscape painting per load, no extension
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  test.beforeEach(({ context }) => context.addInitScript(openAt));

  test('a repeat visit paints no plate, and its frames match a fresh paint at midday, at night and close up', async ({ page }) => {
    test.slow();
    // the references: painted, with the cache off
    await openDev(page, 'nopaintcache&e2eat=12:00');
    const fresh = { noon: await lightFrame(page, 'noon'), night: await lightFrame(page, 'night'), close: await lightFrame(page, 'noon', CLOSE) };
    expect((await plateStats(page)).sky.hits).toBe(0);
    // the frames tell the light apart (a comparison of two blank frames would prove nothing)
    expect(differingPixels(fresh.noon, fresh.night)).toBeGreaterThan(100_000);

    // first visit: every phase's plates painted once, and stored
    await openDev(page, 'e2eat=12:00');
    for (const time of PHASES) {
      await page.evaluate((t) => window.sprout!.setTime(t), time);
      await waitFrames(page, 2);
    }
    const first = await plateStats(page);
    expect(first.sky).toMatchObject({ plates: 4, painted: 4 });
    expect(first.light.painted).toBe(4);
    // encoded one at a time in idle time (ADR 0227): slow on a busy machine
    await expect.poll(async () => (await storedOf(page, 'sky-plate', 'light-plate')).length, { timeout: 40_000 }).toBe(8);

    // a repeat visit at noon: the plates in use come from the cache
    await openDev(page, 'e2eat=12:00');
    const noonFrame = await lightFrame(page, 'noon');
    const noonClose = await lightFrame(page, 'noon', CLOSE);
    const atNoon = await plateStats(page);
    expect(atNoon.sky.painted).toBe(0);
    expect(atNoon.sky.hits).toBeGreaterThanOrEqual(1);
    expect(atNoon.light.painted).toBe(0);
    expect(atNoon.light.cacheHits).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => window.sprout!.ambience()!.lightingMs)).toBe(0);
    expect(differingPixels(noonFrame, fresh.noon)).toBe(0);
    expect(differingPixels(noonClose, fresh.close)).toBe(0);

    // and one at night
    await openDev(page, 'e2eat=01:00');
    const nightFrame = await lightFrame(page, 'night');
    const atNight = await plateStats(page);
    expect(atNight.sky.painted).toBe(0);
    expect(atNight.light.painted).toBe(0);
    expect(atNight.sky.hits + atNight.light.cacheHits).toBeGreaterThanOrEqual(2);
    expect(differingPixels(nightFrame, fresh.night)).toBe(0);
  });

  test('a plate not in the cache is painted and stored once', async ({ page }) => {
    await openDev(page, 'e2eat=12:00');
    const st = await plateStats(page);
    expect(st.sky.painted).toBeGreaterThanOrEqual(1);
    expect(st.sky.hits).toBe(0);
    await expect.poll(async () => (await storedOf(page, 'sky-plate', 'light-plate')).filter((e) => e.key.includes('|midday|')).length, { timeout: 30_000 }).toBe(2);
    const sizes = await storedOf(page, 'sky-plate', 'light-plate');
    for (const e of sizes) expect(e.bytes).toBeGreaterThan(1000);
  });
});
