import { test as base, expect, type Page } from '@playwright/test';

/**
 * `E2E_CLOCK=HH:MM` runs the suite as if the page opened at that local time of day, to prove a
 * spec does not depend on the hour it runs at (docs/TESTING.md › Conventions): e.g.
 * `E2E_CLOCK=17:00 npx playwright test tests/e2e/marks.spec.ts`.
 *
 * Every page of the test's context sees `Date` shifted forward to the next local `HH:MM` (in the
 * page's own time zone), by one offset kept in the origin's storage: a reload or a second page
 * carries on from the same shifted time, as the real clock would, instead of falling back to the
 * real hour behind the saved timestamps (devlog 41). The app reads time only through `Date.now()`
 * (`realClock`), so the dev clock starts there; `sprout.advance` jumps stack on top as usual.
 */
export const E2E_CLOCK = process.env.E2E_CLOCK?.trim() || null;

/** Init script: shift this document's `Date` to the pinned hour (see `E2E_CLOCK`). */
function shiftDate(hhmm: string): void {
  const KEY = 'e2e:clock-offset';
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  let offset = NaN;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) offset = Number(saved);
  } catch {
    // an opaque origin (about:blank) has no storage: nothing there reads the clock
  }
  if (!Number.isFinite(offset)) {
    const [h, m] = hhmm.split(':').map(Number);
    const now = new RealDate(realNow());
    const at = new RealDate(now);
    at.setHours(h!, m!, 0, 0);
    if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
    offset = at.getTime() - now.getTime();
    try {
      localStorage.setItem(KEY, String(offset));
    } catch {
      // as above
    }
  }
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [number]));
    }
    static override now(): number {
      return realNow() + offset;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}

/**
 * `test` that fails on any console error or uncaught page error.
 * Runs automatically for every test; use `errors` to assert explicitly mid-test.
 * With `E2E_CLOCK` set it also pins the hour for every page of the test (above).
 */
export const test = base.extend<{ errors: string[]; e2eClock: void }>({
  e2eClock: [
    async ({ context }, use) => {
      if (E2E_CLOCK) await context.addInitScript(shiftDate, E2E_CLOCK);
      await use();
    },
    { auto: true },
  ],
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, 'page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Open the app with the debug API and wait until every system has initialised. */
export async function openDev(page: Page, query = ''): Promise<void> {
  await page.goto(`./?dev${query ? `&${query}` : ''}`);
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
}

/**
 * Wait for `n` rendered garden frames (the renderer's own frame counter, `sprout.frameStats()`),
 * instead of sleeping for a wall-clock time: on a loaded machine frames simply arrive later.
 * While the stage is scrolled out of view the garden draws nothing (ADR 0224): then `n` browser
 * frames count instead.
 */
export async function waitFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(() => window.sprout!.resetFrameStats());
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let browserFrames = 0;
        const tick = () => {
          browserFrames++;
          const s = window.sprout!;
          if (s.frameStats().frames >= count || (!s.stageVisible() && browserFrames >= count)) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/** Wait for `n` browser frames (rAF callbacks), whether or not the garden draws them. */
export async function waitBrowserFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/** Average RGB + spread of the garden canvas, read back from the page. */
export async function canvasStats(page: Page, selector = '#garden') {
  return page.evaluate((sel) => {
    const c = document.querySelector<HTMLCanvasElement>(sel);
    if (!c) throw new Error(`no canvas ${sel}`);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let n = 0;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      a += data[i + 3]!;
      seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      n++;
    }
    return { r: r / n, g: g / n, b: b / n, a: a / n, distinctColours: seen.size, w: c.width, h: c.height };
  }, selector);
}
