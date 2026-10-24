import { expect, openDev, test } from './fixtures';

/**
 * Boot wiring of the service worker (ADR 0230 › Registration): the e2e policy (workers blocked
 * unless a spec opts in) and the reload after a lazy chunk a deploy removed (`vite:preloadError`).
 * There are no lazy chunks yet, so the event is dispatched the way Vite's preload helper does.
 */

declare global {
  interface Window {
    __stillHere?: boolean;
  }
}

test('service workers are blocked by default: the app boots without one', async ({ page }) => {
  await openDev(page);
  expect(await page.evaluate(() => window.sprout!.sw.ready())).toBeNull();
  expect(await page.evaluate(() => window.sprout!.sw.controlled())).toBe(false);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test('a failed lazy chunk reloads the page once, then lets the error surface', async ({ page }) => {
  await openDev(page);
  let loads = 0;
  page.on('load', () => loads++);

  // dispatched in a task of its own, so the reload never cuts the evaluate short; what the handler
  // did is kept in sessionStorage, which survives the reload
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => {
      setTimeout(() => {
        const e = new Event('vite:preloadError', { cancelable: true });
        window.dispatchEvent(e);
        sessionStorage.setItem('test:prevented', String(e.defaultPrevented));
      });
    }),
  ]);
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
  expect(loads).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('test:prevented')), 'Vite is told not to throw').toBe('true');
  // the guard names the build that reloaded: the hashed entry chunk
  expect(await page.evaluate(() => sessionStorage.getItem('studysprout:preload-reload'))).toMatch(/^\/Ssprout\/assets\/main-[\w-]+\.js$/);

  // the same build fails again: no second reload, the error is left to Vite
  const prevented = await page.evaluate(() => {
    window.__stillHere = true;
    const e = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  expect(await page.evaluate(() => window.__stillHere)).toBe(true);
  expect(loads).toBe(1);
});
