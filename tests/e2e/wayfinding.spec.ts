import type { Page } from '@playwright/test';
import { GUIDE } from '../../src/ui/dock-guide';
import { expect, openDev, test } from './fixtures';
import { MIN, openUi, plantSession } from './ui-helpers';

/**
 * Dock wayfinding (devlog 25; ADRs 0200–0204): one reading spine, a guiding path from the
 * garden's stepping stones past every section heading in order, helper lines that follow the
 * state, one primary action per state, the pill stepping aside, and one hover language.
 */

/** The visible sections' headings (client rects), in page order. */
const headings = (page: Page) =>
  page.evaluate(() =>
    window
      .sprout!.ui.dock()
      .filter((s) => s.visible)
      .map((s) => {
        const r = document.getElementById(`dock-${s.id}`)!.getBoundingClientRect();
        return { id: s.id, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      }),
  );

/** Every line box of text in the dock (headings, helper lines, buttons, the calendar…). */
const textRects = (page: Page) =>
  page.evaluate(() => {
    const out: Array<{ left: number; top: number; right: number; bottom: number; text: string }> = [];
    const dock = document.querySelector('.dock')!;
    const walk = document.createTreeWalker(dock, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement!;
      if (el.closest('[hidden], .visually-hidden, svg')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: n.textContent.trim().slice(0, 24) });
    }
    return out;
  });

const wayfinding = (page: Page, layout = true) => page.evaluate((l) => window.sprout!.ui.wayfinding({ layout: l }), layout);

/** The path passes each visible heading in order, with its stop on the heading's line, just left of it. */
async function expectStopsBesideHeadings(page: Page, gap: { min: number; max: number }) {
  const heads = await headings(page);
  const w = await wayfinding(page);
  expect(w.stops.map((s) => s.id)).toEqual(heads.map((h) => h.id));
  w.stops.forEach((s, i) => {
    const h = heads[i]!;
    expect(Math.abs(s.y - (h.top + h.height / 2))).toBeLessThan(1.5);
    expect(h.left - s.x).toBeGreaterThanOrEqual(gap.min);
    expect(h.left - s.x).toBeLessThanOrEqual(gap.max);
  });
  // the line runs down, through every stop
  for (let i = 1; i < w.points.length; i++) expect(w.points[i]!.y).toBeGreaterThanOrEqual(w.points[i - 1]!.y - 0.01);
  for (const s of w.stops) expect(w.points.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < 3)).toBe(true);
  return w;
}

/** No point of the line falls on any text in the dock. */
async function expectNoTextCrossed(page: Page) {
  const w = await wayfinding(page);
  const rects = await textRects(page);
  expect(rects.length).toBeGreaterThan(20);
  const hits = w.points.filter((p) => rects.some((r) => p.x > r.left - 1 && p.x < r.right + 1 && p.y > r.top - 1 && p.y < r.bottom + 1));
  expect(hits, 'path points over text').toEqual([]);
  // the stones keep clear of the words beside them too
  for (const s of w.stops) expect(rects.some((r) => s.x > r.left - 6 && s.x < r.right + 6 && s.y > r.top && s.y < r.bottom)).toBe(false);
}

test.describe('wayfinding · desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('one reading spine: every section on one left edge, in order, with a heading and a helper line', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const heads = await headings(page);
    expect(heads.map((h) => h.id)).toEqual(['session', 'plant', 'calendar', 'tools']);
    for (const h of heads) expect(Math.abs(h.left - heads[0]!.left)).toBeLessThan(1);
    for (let i = 1; i < heads.length; i++) expect(heads[i]!.top).toBeGreaterThan(heads[i - 1]!.bottom);
    // the same treatment for every heading: size, weight, family; each with its helper line
    const looks = await page.locator('.dock-title').evaluateAll((els) => els.map((e) => { const c = getComputedStyle(e); return `${c.fontFamily}|${c.fontSize}|${c.fontWeight}|${c.color}`; }));
    expect(new Set(looks).size).toBe(1);
    for (const id of ['session', 'plant', 'calendar', 'tools']) await expect(page.locator(`[data-section="${id}"] .dock-helper`)).toBeVisible();
  });

  test('the path leaves the stepping stones and passes every heading in order, beside it', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const w = await expectStopsBesideHeadings(page, { min: 18, max: 48 });
    expect(w.mode).toBe('wide');
    // it begins on the garden, near the stones in the middle of the stage, above the dock
    const stage = (await page.locator('#stage').boundingBox())!;
    const dock = (await page.locator('.dock').boundingBox())!;
    const first = w.points[0]!;
    expect(first.y).toBeLessThan(dock.y);
    expect(first.y).toBeGreaterThan(stage.y + stage.height * 0.7);
    expect(Math.abs(first.x - (stage.x + stage.width / 2))).toBeLessThan(stage.width * 0.15);
    await expectNoTextCrossed(page);
  });

  test('never crosses text, with three sessions growing and a planned session waiting', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.schedule.demo();
      window.sprout!.schedule.jumpToDue();
      window.sprout!.startSessions(3, 50);
      window.sprout!.ui.refresh();
    });
    await expect(page.locator('.due-card')).toHaveCount(1);
    await expect(page.locator('.session-list .session-row')).toHaveCount(3);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    await expectStopsBesideHeadings(page, { min: 18, max: 48 });
    await expectNoTextCrossed(page);
  });

  test('lays itself out again when a section appears or goes, when content grows, and on resize', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    await expectStopsBesideHeadings(page, { min: 18, max: 48 });
    const centre = async (id: string) => {
      const h = (await headings(page)).find((x) => x.id === id)!;
      return h.top + h.height / 2;
    };
    const stopY = async (id: string) => (await wayfinding(page, false)).stops.find((s) => s.id === id)?.y ?? null;

    // the calendar's waiting card appears at the top of Study: the headings below move, the stops follow
    const before = await centre('plant');
    await page.evaluate(() => {
      window.sprout!.schedule.demo();
      window.sprout!.schedule.jumpToDue();
    });
    await expect(page.locator('.due-card')).toHaveCount(1);
    const after = await centre('plant');
    expect(after).toBeGreaterThan(before + 40);
    await expect.poll(async () => Math.abs((await stopY('plant'))! - (await centre('plant')))).toBeLessThan(1.5);

    // a section goes: its stop goes with it, and comes back with it
    await page.evaluate(() => window.sprout!.ui.setSectionHidden('calendar', true));
    await expect.poll(async () => (await wayfinding(page, false)).stops.map((s) => s.id)).toEqual(['session', 'plant', 'tools']);
    await expect.poll(async () => Math.abs((await stopY('tools'))! - (await centre('tools')))).toBeLessThan(1.5);
    await page.evaluate(() => window.sprout!.ui.setSectionHidden('calendar', false));
    await expect.poll(async () => (await wayfinding(page, false)).stops.map((s) => s.id)).toEqual(['session', 'plant', 'calendar', 'tools']);

    // a resize: the column narrows, the stops follow their headings
    await page.setViewportSize({ width: 820, height: 1000 });
    await expect.poll(async () => {
      const w = await wayfinding(page, false);
      const heads = await headings(page);
      return w.stops.every((s, i) => Math.abs(s.y - (heads[i]!.top + heads[i]!.height / 2)) < 1.5 && s.x < heads[i]!.left);
    }).toBe(true);
    await expectNoTextCrossed(page);
  });

  test('the stop of the section being read is a little stronger as the page scrolls', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.dockReady());
    await page.evaluate(() => window.sprout!.ui.scrollTo('calendar', { instant: true }));
    await expect.poll(async () => (await wayfinding(page, false)).stops.find((s) => s.here)?.id).toBe('calendar');
    await expect(page.locator('.way-stop.is-here')).toHaveCount(1);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    await expect.poll(async () => (await wayfinding(page, false)).stops.find((s) => s.here)?.id).toBe('session');
  });

  test('the helper lines follow the state', async ({ page }) => {
    await openUi(page);
    const study = page.locator('[data-section="session"] .dock-helper');
    const plant = page.locator('[data-section="plant"] .dock-helper');
    const calendar = page.locator('[data-section="calendar"] .dock-helper');
    await expect(study).toHaveText(GUIDE.idle);
    await expect(plant).toHaveText(GUIDE.empty);
    await expect(calendar).toHaveText(GUIDE.calendarDay);
    await page.locator('.cal-view[data-view="week"]').click();
    await expect(calendar).toHaveText(GUIDE.calendarWeek);
    await page.evaluate(() => {
      window.sprout!.start(50, { taskName: 'Botany', planId: 'pomodoro', speciesId: 'fx-violet' });
      window.sprout!.ui.refresh();
    });
    await expect(study).toHaveText(GUIDE.focus);
    await expect(plant).toHaveText(GUIDE.growing);
    await page.evaluate(() => window.sprout!.toBreak());
    await expect(study).toHaveText(GUIDE.break);
    await page.evaluate(() => window.sprout!.water());
    await expect(study).toHaveText(GUIDE.watered);
    await page.evaluate(() => window.sprout!.pause());
    await expect(study).toHaveText(GUIDE.paused);
    await page.evaluate((ms) => window.sprout!.advance(ms), 40 * MIN);
    await expect(study).toHaveText(GUIDE.longPause);
  });

  test('one primary action in each state', async ({ page }) => {
    // a whole planting flow and five states: over a minute on a loaded machine
    test.slow();
    await openUi(page);
    const primary = page.locator('[data-section="session"] [data-primary="true"]:visible');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAccessibleName('Start studying');
    await plantSession(page, { task: 'Botany', minutes: 50, plan: 'pomodoro', species: 'fx-violet' });
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAccessibleName('Pause');
    await page.evaluate(() => window.sprout!.toBreak());
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'break');
    await expect(primary).toHaveAccessibleName(/^Water/);
    await primary.click();
    await expect(primary).toHaveAccessibleName('Skip break');
    await page.evaluate(() => window.sprout!.pause());
    await expect(primary).toHaveAccessibleName('Resume');
    // a planned session comes due: its Start leads; the panel's controls step back
    await page.evaluate(() => {
      window.sprout!.resume();
      window.sprout!.schedule.add({ name: 'Kanji' });
    });
    await page.evaluate(() => {
      window.sprout!.schedule.jumpToDue();
      window.sprout!.ui.refresh();
    });
    await expect(page.locator('.due-card')).toHaveCount(1);
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAccessibleName('Start “Kanji”');
  });

  test('the garden pill sits in the top-left corner and steps aside while the Study controls are on screen', async ({ page }) => {
    await openUi(page);
    const stage = (await page.locator('#stage').boundingBox())!;
    const pill = page.locator('.pill');
    const box = (await pill.boundingBox())!;
    expect(box.x - stage.x).toBeLessThan(30);
    expect(box.y - stage.y).toBeLessThan(30);
    // the tools mirror it in the top-right corner
    const menu = (await page.locator('.menu').boundingBox())!;
    expect(Math.abs(menu.y - box.y)).toBeLessThan(10);
    await expect(pill).toBeVisible();
    expect(await page.evaluate(() => window.sprout!.ui.state().pillAside)).toBe(false);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().pillAside)).toBe(true);
    await expect(pill).toHaveCSS('visibility', 'hidden');
    expect(await pill.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    // only one Start studying on screen
    await expect(page.getByRole('button', { name: 'Start studying' }).filter({ visible: true })).toHaveCount(1);
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().pillAside)).toBe(false);
    await expect(pill).toHaveCSS('visibility', 'visible');
  });

  test('controls answer the pointer and the keyboard in one calm way', async ({ page }) => {
    await openUi(page);
    await plantSession(page, { task: 'Botany', minutes: 25, species: 'fx-violet' });
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    const end = page.locator('.panel button.end');
    const under = () => end.evaluate((el) => getComputedStyle(el, '::after').transform);
    expect(await under()).toMatch(/matrix\(0,/);
    await end.hover();
    await expect.poll(under).toBe('matrix(1, 0, 0, 1, 0, 0)');
    // a slip lifts a hair
    const pause = page.locator('.panel button.pause');
    await pause.hover();
    await expect.poll(() => pause.evaluate((el) => getComputedStyle(el).translate)).toBe('0px -1px');
    // the keyboard sees the same
    await page.mouse.move(5, 5);
    await pause.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(() => pause.evaluate((el) => getComputedStyle(el).translate)).toBe('0px -1px');
  });
});

test.describe('wayfinding · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a straight line down the left gutter, a stop beside each stacked heading, never over text', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.schedule.demo();
      window.sprout!.startSessions(2, 50);
      window.sprout!.ui.refresh();
    });
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const w = await expectStopsBesideHeadings(page, { min: 12, max: 30 });
    expect(w.mode).toBe('gutter');
    const heads = await headings(page);
    const lane = w.stops[0]!.x;
    for (const p of w.points) if (p.y >= heads[0]!.top) expect(Math.abs(p.x - lane)).toBeLessThan(0.5);
    for (const s of w.stops) expect(s.x).toBeGreaterThan(0);
    await expectNoTextCrossed(page);
  });

  test('the pill keeps its place on the garden and steps aside in the dock', async ({ page }) => {
    await openUi(page);
    const stage = (await page.locator('#stage').boundingBox())!;
    const box = (await page.locator('.pill').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(box.y).toBeGreaterThan(stage.y + stage.height / 2);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().pillAside)).toBe(true);
    await expect(page.getByRole('button', { name: 'Start studying' }).filter({ visible: true })).toHaveCount(1);
  });
});

test.describe('wayfinding · motion', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a gentle draw-in on first view; none with reduced motion', async ({ page }) => {
    await openDev(page, 'fixtures');
    await expect.poll(async () => (await wayfinding(page, false)).drawn).toMatch(/drawing|drawn/);
    // while it draws, the reveal runs as a CSS animation
    const drawing = (await wayfinding(page, false)).drawn;
    if (drawing === 'drawing') expect(await page.evaluate(() => document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.target?.closest?.('.wayfinding') != null))).toBe(true);
  });

  test('with reduced motion the path is simply there, and nothing moves on hover', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openDev(page, 'fixtures');
    const w = await wayfinding(page);
    expect(w.drawn).toBe('instant');
    expect(w.stops.length).toBe(4);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest?.('.wayfinding') != null).length)).toBe(0);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    const start = page.locator('.panel button.plant-session');
    await start.hover();
    expect(await start.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  });
});
