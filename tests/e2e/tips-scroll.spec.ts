import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openUi } from './ui-helpers';

/**
 * Tips on a scrolling page (ADR 0181, v2 polish): a note stays on its control through the custom
 * smooth scroll, waits while its control is off screen or has no room, picks the copy of a control
 * that is on screen (corner or dock), and never paints a second, faded note. Read in-page, frame by
 * frame, during a real glide.
 */

interface Frame {
  y: number;
  /** notes that paint (visible and not fully transparent) */
  painting: Array<{ id: string; on: string; top: number; left: number; bottom: number }>;
  /** the anchor copies' tops (client px), when present */
  anchors: Record<string, number | null>;
}

/** Glide the page to `target` (a scroll y or a dock section) and sample every frame until it lands. */
function glideAndSample(page: Page, target: number | string, anchors: Record<string, string>) {
  return page.evaluate(
    async ({ target, anchors }) => {
      const frames: Frame[] = [];
      let done = false;
      const sample = () => {
        const painting = [...document.querySelectorAll<HTMLElement>('.tip')]
          .filter((n) => {
            const cs = getComputedStyle(n);
            return cs.visibility === 'visible' && Number(cs.opacity) > 0.02;
          })
          .map((n) => {
            const r = n.getBoundingClientRect();
            return { id: n.dataset.tipId ?? '', on: n.dataset.on ?? '', top: r.top, left: r.left, bottom: r.bottom };
          });
        const a: Record<string, number | null> = {};
        for (const [k, sel] of Object.entries(anchors)) a[k] = document.querySelector(sel)?.getBoundingClientRect().top ?? null;
        frames.push({ y: window.scrollY, painting, anchors: a });
        if (!done) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      await window.sprout!.ui.scrollTo(target);
      // two more frames: whatever the last scroll decided has been drawn
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      done = true;
      return frames;
    },
    { target, anchors },
  ) as Promise<Frame[]>;
}

test.describe('tips · on a scrolling page', () => {
  test('a note rides with its control through a smooth glide, then hands over to the dock copy', async ({ page }) => {
    // a narrower window, where the pill sits at the bottom of the garden: a long glide keeps it on
    // screen (on wide screens it is in the top-left corner and leaves the screen at once, ADR 0203)
    await page.setViewportSize({ width: 860, height: 900 });
    await openUi(page);
    const note = page.locator('.tip[data-tip-id="notifications"]');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute('data-on', 'stage');

    const frames = await glideAndSample(page, 260, { pill: '.pill-start', dock: '.panel .plant-session' });
    expect(frames.length).toBeGreaterThan(3);
    // the page really moved during the sampling
    expect(frames[frames.length - 1]!.y - frames[0]!.y).toBeGreaterThan(150);
    const offsets: number[] = [];
    for (const f of frames) {
      // one note at a time, every frame (ADR 0124): no ghost of the previous one
      expect(f.painting.length).toBeLessThanOrEqual(1);
      const n = f.painting[0];
      const pill = f.anchors.pill;
      if (n && n.on === 'stage' && typeof pill === 'number') offsets.push(n.top - pill);
    }
    // glued: the note's distance to the pill's Start studying never changes while the page glides
    expect(offsets.length).toBeGreaterThan(2);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(1.5);
  });

  test('a note waits while its control is off screen, and picks the copy that is on screen', async ({ page }) => {
    await openUi(page);
    // after a first bloom and with a plan: the speaker's note is the one left to say
    await page.evaluate(async () => {
      const s = window.sprout!.state();
      window.sprout!.setState({ settings: { ...s.settings, notifications: 'denied' } });
      window.sprout!.schedule.demo();
      await window.sprout!.ui.dockReady();
    });
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().tips)).toEqual(['sound']);
    const note = page.locator('.tip[data-tip-id="sound"]');
    // top of the page: by the corner speaker on the garden
    await expect(note).toHaveAttribute('data-on', 'stage');
    await expect(note).toHaveClass(/is-in/);
    const near = async (sel: string) => {
      const a = (await page.locator(sel).boundingBox())!;
      const t = (await note.boundingBox())!;
      const dx = Math.max(0, a.x - (t.x + t.width), t.x - (a.x + a.width));
      const dy = Math.max(0, a.y - (t.y + t.height), t.y - (a.y + a.height));
      return Math.hypot(dx, dy);
    };
    expect(await near('.menu [data-tool="sound"]')).toBeLessThan(80);

    // the end of the page: the corner is gone, the dock's Garden sounds carries the note
    const frames = await glideAndSample(page, 1e6, {});
    for (const f of frames) expect(f.painting.length).toBeLessThanOrEqual(1);
    await expect(note).toHaveAttribute('data-on', 'page');
    await expect(note).toHaveClass(/is-in/);
    expect(await near('.tool-list [data-tool="sound"]')).toBeLessThan(200);

    // every scroll position: a painting note always has its control wholly on screen, and fits
    const max = await page.evaluate(() => window.sprout!.ui.scroll().max);
    for (let y = 0; y <= max; y += Math.max(120, Math.round(max / 9))) {
      await page.evaluate((y) => window.sprout!.ui.scrollTo(y, { instant: true }), y);
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      const check = await page.evaluate(() => {
        const shown = window.sprout!.ui.state().tips;
        const live = [...document.querySelectorAll<HTMLElement>('.tip.is-in')];
        const bad: string[] = [];
        for (const n of live) {
          const r = n.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) bad.push(`note ${n.dataset.tipId} off screen`);
        }
        for (const id of shown) {
          const anchor = ({ notifications: 'start' } as Record<string, string>)[id] ?? id;
          const copies = [...document.querySelectorAll<HTMLElement>(`[data-anchor="${anchor}"]`)];
          const onScreen = copies.some((c) => {
            const r = c.getBoundingClientRect();
            return r.height > 0 && r.top >= -1 && r.bottom <= innerHeight + 1;
          });
          if (!onScreen) bad.push(`tip ${id} shown with no control on screen`);
        }
        return { shown, live: live.length, bad };
      });
      expect(check.bad, `at scroll ${y}`).toEqual([]);
      expect(check.live).toBeLessThanOrEqual(1);
    }
  });

  test('notes step aside while a plant’s card is being read', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      window.sprout!.camera.autoFocus(false);
      window.sprout!.addPlants(4);
      await window.sprout!.plantsReady();
    });
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().tips.length)).toBe(1);
    const id = await page.evaluate(() => window.sprout!.state().plants[0]!.id);
    await page.evaluate((p) => window.sprout!.camera.openCard(p), id);
    await expect(page.locator('[data-ui="plant-card"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().tips)).toEqual([]);
    await expect(page.locator('.tip.is-in')).toHaveCount(0);
    await page.evaluate(() => window.sprout!.camera.closeCard());
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().tips.length)).toBe(1);
  });
});
