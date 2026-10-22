import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * Timer surfaces: tab title countdown, favicon, notifications, floating widget (src/widget).
 * `createTimerSurfaces` + `installWidgetDebug` are wired in main.ts (docs/systems/widget.md).
 *
 * Page visibility / focus and the notification APIs are stubbed with an init script so the tests
 * can play "the tab is in the background" without real waiting.
 */

declare global {
  interface Window {
    __vis?: 'visible' | 'hidden';
    __focus?: boolean;
    __notes?: { via: string; title: string; body?: string; tag?: string }[];
    __perm?: NotificationPermission;
  }
}

/**
 * Stub visibility/focus and the Notification API. Headless Chromium reports
 * `Notification.permission === 'denied'` even after `context.grantPermissions`, so the stub owns
 * the permission (`perm`).
 */
async function stubPageAndNotifications(page: Page, perm: NotificationPermission = 'default'): Promise<void> {
  await page.addInitScript((p) => {
    window.__perm = p;
    window.__vis = 'visible';
    window.__focus = true;
    window.__notes = [];
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => window.__vis });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
    Document.prototype.hasFocus = () => window.__focus === true;
    if (typeof ServiceWorkerRegistration !== 'undefined') {
      ServiceWorkerRegistration.prototype.showNotification = async function (title: string, opts?: NotificationOptions) {
        window.__notes!.push({ via: 'sw', title, body: opts?.body, tag: opts?.tag });
      };
    }
    const Real = window.Notification;
    class FakeNotification {
      static get permission() {
        return window.__perm ?? Real.permission;
      }
      static requestPermission(cb?: (p: NotificationPermission) => void) {
        // a prompt nobody answers: the user dismisses it
        cb?.(window.__perm!);
        return Promise.resolve(window.__perm!);
      }
      onclick: (() => void) | null = null;
      constructor(title: string, opts?: NotificationOptions) {
        window.__notes!.push({ via: 'page', title, body: opts?.body, tag: opts?.tag });
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: FakeNotification });
  }, perm);
}

/** Open ?dev on a fresh, seeded garden (the widget surfaces are wired in main.ts). */
async function openWidgetDev(page: Page, query = ''): Promise<void> {
  await openDev(page, query);
  expect(await page.evaluate(() => !!window.sprout?.widget), 'window.sprout.widget is installed').toBe(true);
  await page.evaluate(() => {
    window.sprout!.reset();
    window.sprout!.seed(42);
  });
}

/** Start a session through the core debug API (default total, unbroken plan, first plant). */
const start = (page: Page) => page.evaluate(() => window.sprout!.start());
/** Start a 60-minute session whose plan has a break. */
const startWithBreak = (page: Page) =>
  page.evaluate(() => {
    const plan = window.sprout!.plans(60).find((p) => p.blocks.some((b) => b.kind === 'break'));
    if (!plan) throw new Error('no plan with a break for 60 min');
    return window.sprout!.start(60, { planId: plan.id, taskName: 'Biology ch. 4' });
  });
const away = (page: Page) =>
  page.evaluate(() => {
    window.__vis = 'hidden';
    window.__focus = false;
  });
const back = (page: Page) =>
  page.evaluate(() => {
    window.__vis = 'visible';
    window.__focus = true;
    window.dispatchEvent(new Event('focus'));
  });

test.describe('timer surfaces', () => {
  test('ticks come from a Web Worker', async ({ page }) => {
    await openWidgetDev(page);
    expect(await page.evaluate(() => window.sprout!.widget.tickerMode())).toBe('worker');
  });

  test('tab title counts down, the favicon fills, pause and completion show', async ({ page }) => {
    await stubPageAndNotifications(page);
    await openWidgetDev(page, 'speed=60');
    const icon = () => page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel~="icon"]')!.getAttribute('href'));
    const original = await icon();
    expect(await page.title()).toBe('Study Sprout');

    await start(page);
    await expect(page).toHaveTitle(/^\d+:\d\d(:\d\d)? · Study Sprout$/);
    const first = await page.title();
    await expect.poll(() => page.title()).not.toBe(first); // 1 s real = 1 min at speed 60
    const painted = await icon();
    expect(painted).toMatch(/^data:image\/png;base64,/);
    expect(painted).not.toBe(original);
    await expect.poll(icon).not.toBe(painted); // the ring fills

    await page.evaluate(() => window.sprout!.pause());
    await expect(page).toHaveTitle('Paused · Study Sprout');
    await page.evaluate(() => window.sprout!.resume());

    await away(page);
    await page.evaluate(() => window.sprout!.completeSession());
    await expect(page).toHaveTitle('Bloomed · Study Sprout');
    expect(await page.evaluate(() => window.sprout!.widget.bloomed())).toBe(true);
    await back(page);
    await expect(page).toHaveTitle('Study Sprout');
    expect(await icon()).toBe(original);
  });

  test('breaks show in the title and favicon', async ({ page }) => {
    await stubPageAndNotifications(page);
    await openWidgetDev(page);
    await startWithBreak(page);
    await expect(page).toHaveTitle(/^\d+:\d\d · Study Sprout$/);
    const focusIcon = await page.evaluate(() => window.sprout!.widget.favicon());
    expect(await page.evaluate(() => window.sprout!.toBreak())).toBeGreaterThan(0);
    await expect(page).toHaveTitle(/^Break \d+:\d\d · Study Sprout$/);
    await expect.poll(() => page.evaluate(() => window.sprout!.widget.favicon())).not.toBe(focusIcon);
  });

  test('break and back-to-focus notify while the page is in the background', async ({ page }) => {
    await stubPageAndNotifications(page, 'granted');
    await openWidgetDev(page);
    await startWithBreak(page);
    await away(page);
    const i = await page.evaluate(() => window.sprout!.toBreak());
    await expect.poll(() => page.evaluate(() => window.__notes!.map((n) => n.title))).toEqual([
      expect.stringMatching(/^Time for a break — your .+ is thirsty\.$/),
    ]);
    await page.evaluate((next) => window.sprout!.skipToBlock(next), i + 1);
    await expect.poll(() => page.evaluate(() => window.__notes!.length)).toBe(2);
    const notes = await page.evaluate(() => window.__notes!);
    expect(notes[1]!.title).toBe('Back to focus — Biology ch. 4.');
    expect(new Set(notes.map((n) => n.tag))).toEqual(new Set(['study-sprout-session']));
  });

  test('completion notifies when the page is in the background', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await stubPageAndNotifications(page, 'granted');
    await openWidgetDev(page);
    await start(page);
    expect(await page.evaluate(() => window.sprout!.state().settings.notifications)).toBe('granted');
    await away(page);
    await page.evaluate(() => window.sprout!.completeSession());
    await expect.poll(() => page.evaluate(() => window.__notes!.length)).toBe(1);
    const [note] = await page.evaluate(() => window.__notes!);
    expect(note).toMatchObject({ title: 'Your session is complete', tag: 'study-sprout-session' });
    expect(note!.body).toMatch(/has bloomed — return to your garden\.$/);
    // delivered through the service worker registered at the app's base path
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null);
    expect(scope).toMatch(/\/Ssprout\/$/);
    expect(note!.via).toBe('sw');
  });

  test('no notification while the page is visible and focused', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await stubPageAndNotifications(page, 'granted');
    await openWidgetDev(page);
    await start(page);
    await page.evaluate(() => window.sprout!.completeSession());
    expect(await page.evaluate(() => window.sprout!.widget.lastNotification())).toEqual({ kind: 'complete', decision: 'attended' });
    expect(await page.evaluate(() => window.__notes!.length)).toBe(0);
  });

  test('denied permission is respected', async ({ page }) => {
    await stubPageAndNotifications(page, 'denied');
    await openWidgetDev(page);
    await start(page);
    expect(await page.evaluate(() => window.sprout!.state().settings.notifications)).toBe('denied');
    await away(page);
    await page.evaluate(() => window.sprout!.completeSession());
    expect(await page.evaluate(() => window.sprout!.widget.lastNotification()?.decision)).not.toBe('notify');
    expect(await page.evaluate(() => window.__notes!.length)).toBe(0);
  });
});

test.describe('floating widget', () => {
  test('support follows Document Picture-in-Picture', async ({ page }) => {
    await openWidgetDev(page);
    const [supported, native] = await page.evaluate(() => [window.sprout!.widget.supported(), 'documentPictureInPicture' in window]);
    expect(supported).toBe(native);
  });

  test('opens in a (faked) PiP window, updates, pauses and closes', async ({ page }) => {
    await page.addInitScript(() => {
      const fake = {
        window: null as Window | null,
        async requestWindow(opts: { width: number; height: number }) {
          const frame = document.createElement('iframe');
          frame.id = 'fake-pip';
          frame.style.cssText = `position:fixed;right:0;top:0;width:${opts.width}px;height:${opts.height}px;border:0`;
          document.body.append(frame);
          fake.window = frame.contentWindow;
          return frame.contentWindow!;
        },
      };
      Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: fake });
    });
    await openWidgetDev(page);
    expect(await page.evaluate(() => window.sprout!.widget.supported())).toBe(true);
    await start(page);
    await page.evaluate(() => window.sprout!.widget.open());
    await expect.poll(() => page.evaluate(() => window.sprout!.widget.isOpen())).toBe(true);
    const pip = page.frameLocator('#fake-pip');
    await expect(pip.locator('.ss-time')).toHaveText(/^\d+:\d\d(:\d\d)?$/);
    await expect(pip.locator('.ss-card')).toHaveAttribute('data-mode', 'focus');

    await pip.locator('button[data-action="pause"]').click();
    await expect(pip.locator('.ss-card')).toHaveAttribute('data-mode', 'paused');
    await expect(pip.locator('.ss-state')).toHaveText(/^paused/);
    expect(await page.evaluate(() => window.sprout!.state().session?.pausedAt)).not.toBeNull();
    await pip.locator('button[data-action="resume"]').click();
    await expect(pip.locator('.ss-card')).toHaveAttribute('data-mode', 'focus');

    await page.evaluate(() => window.sprout!.widget.close());
    expect(await page.evaluate(() => window.sprout!.widget.isOpen())).toBe(false);
  });

  test('the card renders the plant and blooms on completion (iframe harness)', async ({ page }) => {
    await openWidgetDev(page);
    await page.evaluate(() => window.sprout!.widget.mountHarness());
    const card = page.frameLocator('#sprout-widget-harness');
    await expect(card.locator('.ss-state')).toHaveText('No session running');

    await start(page);
    await expect(card.locator('.ss-card')).toHaveAttribute('data-mode', 'focus');
    await expect(card.locator('.ss-time')).toHaveText(/^\d+:\d\d(:\d\d)?$/);
    // the canvas is painted (paper + plant)
    const painted = await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sprout-widget-harness')!;
      const c = frame.contentDocument!.querySelector<HTMLCanvasElement>('.ss-art')!;
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 53) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      return { w: c.width, colours: seen.size };
    });
    expect(painted.w).toBeGreaterThan(0);
    expect(painted.colours).toBeGreaterThan(20);

    await page.evaluate(() => window.sprout!.completeSession());
    await expect(card.locator('.ss-card')).toHaveAttribute('data-mode', 'complete');
    await expect(card.locator('.ss-state')).toHaveText(/has bloomed — return to your garden$/);
    await expect(card.locator('button[data-action="open"]')).toBeVisible();
    await page.evaluate(() => window.sprout!.widget.closeHarness());
    await expect(page.locator('#sprout-widget-harness')).toHaveCount(0);
  });
  test('in a break the card waters the plant and skips the break', async ({ page }) => {
    await openWidgetDev(page);
    await startWithBreak(page);
    await page.evaluate(() => window.sprout!.widget.mountHarness());
    const card = page.frameLocator('#sprout-widget-harness');
    const i = await page.evaluate(() => window.sprout!.toBreak());
    await expect(card.locator('.ss-card')).toHaveAttribute('data-mode', 'break');
    await expect(card.locator('.ss-state')).toHaveText(/^Break — your .+ is thirsty/);
    await expect(card.locator('button[data-action="water"]')).toBeVisible();
    // The watering animation is presentation-only and lasts 2.5 s of rAF time, so read it in the
    // same task as the click: a separate round trip can land after it ended on a loaded machine.
    const watering = await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sprout-widget-harness')!;
      frame.contentDocument!.querySelector<HTMLButtonElement>('button[data-action="water"]')!.click();
      return window.sprout!.widget.harnessWatering();
    });
    expect(watering).toBe(0);
    expect(await page.evaluate(() => window.sprout!.state().session?.waterings)).toEqual([i]);
    await expect(card.locator('.ss-state')).toHaveText(/^Watered — your .+ is resting/);
    await expect(card.locator('button[data-action="water"]')).toHaveCount(0);
    await card.locator('button[data-action="skip"]').click();
    await expect(card.locator('.ss-card')).toHaveAttribute('data-mode', 'focus');
  });
});
