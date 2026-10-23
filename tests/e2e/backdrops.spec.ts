import type { Page } from '@playwright/test';
import { expect, test, waitFrames } from './fixtures';
import { MIN, openUi } from './ui-helpers';

/**
 * Section backdrops (ADR 0208, devlog 32): every visible dock section lies on its own torn leaf of
 * washi, the calendar's the firmest; the sheets follow their content without repainting per frame;
 * the path's lane stays outside them; and every text on them reads at ≥ 4.5 : 1 in every light,
 * measured from the pixels under it.
 */

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * Sessions in progress (three by default) and the demo calendar (35 days of history, three
 * schedules). The demo goes first: it moves the dev clock to the next 16:10, up to a day ahead,
 * which would carry sessions already growing to their end, and the active one would bloom on a
 * later tick, in the middle of a measurement (devlog 41). With three growing the waiting card
 * offers "See them"; with two it has the seal "Start".
 */
const busy = (page: Page, sessions = 3) =>
  page.evaluate(
    ({ gap, sessions }) => {
      window.sprout!.schedule.demo();
      window.sprout!.startSessions(sessions, 50, gap);
      window.sprout!.ui.refresh();
    },
    { gap: MIN, sessions },
  );

/** Wait until every visible section's sheet is drawn for its current size. */
async function sheetsSettled(page: Page): Promise<void> {
  await page.evaluate(() => window.sprout!.ui.dockReady());
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.dock-section:not([hidden])')].every((s) => {
          const b = s.querySelector<HTMLElement>(':scope > .backdrop');
          return !!b && b.dataset.size === `${Math.round(s.offsetWidth)}x${Math.round(s.offsetHeight)}`;
        }),
      ),
    )
    .toBe(true);
}

/** Each visible section, its sheet, and the boxes of what is on it (client rects). */
const sheets = (page: Page) =>
  page.evaluate(() => {
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    return [...document.querySelectorAll<HTMLElement>('.dock-section:not([hidden])')].map((s) => {
      const b = s.querySelector<HTMLElement>(':scope > .backdrop')!;
      const inTimeline = (el: Element) => !!el.closest('.cal-timeline');
      const controls = [...s.querySelectorAll<HTMLElement>('button, [data-primary], .due-card, .session-list, .plant-view, .calendar, .tool-list')]
        .filter((el) => !inTimeline(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => ({ what: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} “${(el.textContent ?? '').trim().slice(0, 18)}”`, ...box(el.getBoundingClientRect()) }));
      return {
        id: s.dataset.section!,
        strength: b.dataset.strength!,
        paints: Number(b.dataset.paints ?? 0),
        mask: b.style.getPropertyValue('--sheet-mask'),
        section: box(s.getBoundingClientRect()),
        sheet: box(b.getBoundingClientRect()),
        head: box(s.querySelector('.dock-head')!.getBoundingClientRect()),
        body: box(s.querySelector('.dock-body')!.getBoundingClientRect()),
        controls,
      };
    });
  });

const inside = (a: Box, b: Box, inset = 0) => a.left >= b.left + inset && a.right <= b.right - inset && a.top >= b.top + inset && a.bottom <= b.bottom - inset;

/**
 * Mean colour of each rect in the current window's pixels (a screenshot decoded in the page).
 * Rects are client coordinates.
 */
async function sample(page: Page, rects: Box[]): Promise<Array<{ r: number; g: number; b: number }>> {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ png, rects }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const k = img.width / window.innerWidth;
      return rects.map((r) => {
        const x = Math.max(0, Math.round(r.left * k));
        const y = Math.max(0, Math.round(r.top * k));
        const w = Math.max(1, Math.min(img.width - x, Math.round((r.right - r.left) * k)));
        const h = Math.max(1, Math.min(img.height - y, Math.round((r.bottom - r.top) * k)));
        const d = ctx.getImageData(x, y, w, h).data;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let i = 0; i < d.length; i += 4) {
          sr += d[i]!;
          sg += d[i + 1]!;
          sb += d[i + 2]!;
        }
        const n = d.length / 4;
        return { r: sr / n, g: sg / n, b: sb / n };
      });
    },
    { png, rects },
  );
}

const lum = (c: { r: number; g: number; b: number }) => {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
};

/** Every visible text line box in the dock now on screen, with its colour and the opacity above it. */
const collectLines = (page: Page) =>
  page.evaluate(() => {
    const out: Array<{ key: string; at: string; text: string; color: string; alpha: number; left: number; top: number; right: number; bottom: number }> = [];
    const walk = document.createTreeWalker(document.querySelector('.dock')!, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    // the same element keeps its id across both passes; a re-rendered one gets a new id (a ticking
    // countdown rewrites its text, not its element)
    const w = window as unknown as { __lineIds?: WeakMap<Element, number>; __lineNext?: number };
    const ids = (w.__lineIds ??= new WeakMap());
    const elId = (e: Element) => {
      if (!ids.has(e)) ids.set(e, (w.__lineNext = (w.__lineNext ?? 0) + 1));
      return ids.get(e)!;
    };
    let i = 0;
    for (let n = walk.nextNode(); n; n = walk.nextNode(), i++) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement!;
      if (el.closest('[hidden], .visually-hidden, svg, [aria-hidden="true"]')) continue;
      // a missed plan is shown faintly on purpose (no guilt, ADR 0172): it is not body text
      if (el.closest('[data-occurrence-status="missed"], [data-outcome="cancelled"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let alpha = 1;
      for (let e: Element | null = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
      // inside the hours, only lines clear of the window's faded edges are read
      const tl = el.closest('.cal-timeline')?.getBoundingClientRect();
      range.selectNodeContents(n);
      let k = 0;
      for (const r of range.getClientRects()) {
        k++;
        if (r.width < 2 || r.height < 2) continue;
        if (r.top < 0 || r.bottom > window.innerHeight) continue;
        if (tl && (r.top < tl.top + 26 || r.bottom > tl.bottom - 26)) continue;
        const text = n.textContent.trim().slice(0, 24);
        out.push({ key: `${i}:${k}:${elId(el)}`, at: `${text}:${Math.round(r.left)}:${Math.round(r.top + scrollY)}`, text, color: cs.color, alpha, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
    }
    return out;
  });

/**
 * Every visible text line on the dock's sheets, against the pixels under it: the text is made
 * transparent, the window photographed, and each line box's ground averaged. Walks the page
 * section by section so every line is measured on screen.
 */
async function textContrast(page: Page): Promise<{ count: number; low: string[] }> {
  const ids = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.dock-section:not([hidden])')].map((s) => s.dataset.section!));
  const low: string[] = [];
  let count = 0;
  const seen = new Set<string>();
  for (const id of ids) {
    await page.evaluate((id) => window.sprout!.ui.scrollTo(id, { instant: true }), id);
    await waitFrames(page, 2);
    // colours with the text shown; rects again once it is hidden, right before the photograph, so a
    // page that settles in between (a scroll finishing, a line rewrapping) is measured where it is
    const lines = await collectLines(page);
    await page.evaluate(() => {
      const st = document.createElement('style');
      st.dataset.test = 'no-text';
      // the text goes, and so do the floating tip notes, which may lie over a line on purpose
      st.textContent =
        '.dock, .dock * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } .tips { visibility: hidden !important; }';
      document.head.append(st);
    });
    await waitFrames(page, 2);
    const hidden = await collectLines(page);
    // both passes must read the same lines: a dock that re-renders in between (a session blooming,
    // a card changing mode) would pair one text's colour with another's ground
    expect(hidden.map((l) => l.key), `${id}: the dock changed while it was measured`).toEqual(lines.map((l) => l.key));
    const where = new Map(hidden.map((l) => [l.key, l]));
    const todo = lines
      .filter((l) => where.has(l.key))
      .map((l) => ({ ...l, ...where.get(l.key)!, color: l.color, alpha: l.alpha }))
      .filter((l) => !seen.has(l.at));
    const grounds = todo.length ? await sample(page, todo) : [];
    await page.evaluate(() => document.querySelector('style[data-test="no-text"]')?.remove());
    todo.forEach((l, i) => {
      seen.add(l.at);
      const p = /rgba?\(([^)]+)\)/.exec(l.color)![1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      const a = (p[3] ?? 1) * l.alpha;
      const g = grounds[i]!;
      const seenText = { r: p[0]! * a + g.r * (1 - a), g: p[1]! * a + g.g * (1 - a), b: p[2]! * a + g.b * (1 - a) };
      const [x, y] = [lum(seenText), lum(g)];
      const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      count++;
      if (ratio < 4.5) low.push(`${ratio.toFixed(2)} “${l.text}”`);
    });
  }
  return { count, low };
}

test.describe('section backdrops · desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('every visible section lies on its own sheet, which holds its heading, helper line and content', async ({ page }) => {
    await openUi(page);
    await busy(page);
    await sheetsSettled(page);
    const list = await sheets(page);
    expect(list.map((s) => s.id)).toEqual(['session', 'plant', 'calendar', 'tools']);
    for (const s of list) {
      // the sheet is the section's own box: the heading block and the body lie on it, inside its margin
      expect(Math.abs(s.sheet.left - s.section.left)).toBeLessThan(1);
      expect(Math.abs(s.sheet.bottom - s.section.bottom)).toBeLessThan(1);
      expect(inside(s.head, s.sheet, 10)).toBe(true);
      expect(inside(s.body, s.sheet, 10)).toBe(true);
      for (const c of s.controls) expect(inside(c, s.sheet, 2), `${s.id}: ${c.what}`).toBe(true);
      expect(s.mask).toContain('data:image/svg+xml');
    }
    // seeded per section: four different torn edges
    expect(new Set(list.map((s) => s.mask)).size).toBe(4);
    // the waiting card lies on the Study sheet
    expect(list[0]!.controls.some((c) => c.what.startsWith('li.due-card'))).toBe(true);
  });

  test('the calendar’s sheet is the strongest: firm, and lifted furthest from the page', async ({ page }) => {
    await openUi(page);
    await busy(page);
    await page.evaluate(() => window.sprout!.setTime('midday'));
    await sheetsSettled(page);
    const ids = ['session', 'plant', 'calendar', 'tools'];
    const lift: Record<string, number> = {};
    for (const id of ids) {
      await page.evaluate((id) => window.sprout!.ui.scrollTo(id, { instant: true }), id);
      await waitFrames(page, 2);
      const [s] = (await sheets(page)).filter((x) => x.id === id);
      const sheet = s!.sheet;
      // a bare patch of the sheet (its top right, clear of any text) against bare page beside it
      const [onSheet, onPage] = await sample(page, [
        { left: sheet.right - 90, top: sheet.top + 14, right: sheet.right - 30, bottom: sheet.top + 24 },
        { left: sheet.right + 40, top: sheet.top + 14, right: sheet.right + 100, bottom: sheet.top + 24 },
      ]);
      lift[id] = lum(onSheet!) - lum(onPage!);
      expect(s!.strength).toBe(id === 'calendar' ? 'firm' : 'leaf');
    }
    for (const id of ids) expect(lift[id]!, id).toBeGreaterThan(0.01); // lighter than the page
    for (const id of ['session', 'plant', 'tools']) expect(lift.calendar!).toBeGreaterThan(lift[id]! * 1.4);
  });

  test('sheets lay out again when a section grows or the window resizes, never on a tick or a scroll', async ({ page }) => {
    await openUi(page);
    await sheetsSettled(page);
    const study = async () => (await sheets(page)).find((s) => s.id === 'session')!;
    const before = await study();
    // a tick and a scroll: the size does not change, nothing is drawn again
    await page.evaluate((ms) => window.sprout!.advance(ms), MIN);
    await page.evaluate(() => window.sprout!.ui.scrollTo('tools', { instant: true }));
    await waitFrames(page, 3);
    expect((await study()).paints).toBe(before.paints);
    // three sessions and a waiting card: Study grows, its sheet follows
    await busy(page);
    await sheetsSettled(page);
    const grown = await study();
    expect(grown.section.bottom - grown.section.top).toBeGreaterThan(before.section.bottom - before.section.top + 100);
    expect(grown.paints).toBeGreaterThan(before.paints);
    expect(Math.abs(grown.sheet.bottom - grown.section.bottom)).toBeLessThan(1);
    // a narrower window: every sheet is drawn for its new width
    await page.setViewportSize({ width: 1000, height: 900 });
    await sheetsSettled(page);
    for (const s of await sheets(page)) expect(Math.abs(s.sheet.right - s.section.right)).toBeLessThan(1);
    const calendar = (await sheets(page)).find((s) => s.id === 'calendar')!;
    // the calendar switching views changes its height: its sheet follows
    await page.evaluate(() => window.sprout!.calendar.setView('month'));
    await sheetsSettled(page);
    const month = (await sheets(page)).find((s) => s.id === 'calendar')!;
    expect(month.paints).toBeGreaterThan(calendar.paints);
    for (const c of month.controls) expect(inside(c, month.sheet, 2), c.what).toBe(true);
  });

  test('the path’s lane and its stones stay outside the sheets, beside each heading', async ({ page }) => {
    await openUi(page);
    await busy(page);
    await sheetsSettled(page);
    const w = await page.evaluate(() => window.sprout!.ui.wayfinding({ layout: true }));
    const list = await sheets(page);
    for (const p of w.points)
      for (const s of list) expect(p.x < s.sheet.left - 6 || p.y < s.sheet.top - 2 || p.y > s.sheet.bottom + 2, `${s.id} at ${p.x.toFixed(0)},${p.y.toFixed(0)}`).toBe(true);
    w.stops.forEach((st, i) => {
      const s = list[i]!;
      expect(st.id).toBe(s.id);
      expect(st.x + 12).toBeLessThan(s.sheet.left);
      expect(st.y).toBeGreaterThan(s.head.top);
      expect(st.y).toBeLessThan(s.head.bottom);
    });
  });

  for (const phase of ['sunrise', 'midday', 'sunset', 'night'] as const) {
    test(`every text on the sheets reads at ≥ 4.5 : 1 from its pixels · ${phase}`, async ({ page }) => {
      test.slow();
      await openUi(page);
      await busy(page);
      await expect(page.locator('.due-card')).toHaveAttribute('data-mode', 'limit');
      await page.evaluate((p) => {
        window.sprout!.setTime(p);
        window.sprout!.settleAmbience();
      }, phase);
      await sheetsSettled(page);
      const { count, low } = await textContrast(page);
      expect(count).toBeGreaterThan(40);
      expect(low).toEqual([]);
    });
  }
});

test.describe('section backdrops · hd', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('every text on the sheets reads at ≥ 4.5 : 1 · hd sunset, idle', async ({ page }) => {
    test.slow();
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.setTime('sunset');
      window.sprout!.settleAmbience();
    });
    await sheetsSettled(page);
    const { count, low } = await textContrast(page);
    expect(count).toBeGreaterThan(20);
    expect(low).toEqual([]);
  });
});

test.describe('section backdrops · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('each view of the calendar, empty or full, lies on its sheet; the lane stays outside; no sideways scroll', async ({ page }) => {
    await openUi(page);
    for (const state of ['empty', 'busy'] as const) {
      if (state === 'busy') await busy(page);
      for (const view of ['day', 'week', 'month'] as const) {
        await page.evaluate((v) => window.sprout!.calendar.setView(v), view);
        await sheetsSettled(page);
        const list = await sheets(page);
        const cal = list.find((s) => s.id === 'calendar')!;
        expect(cal.strength).toBe('firm');
        for (const c of cal.controls) expect(inside(c, cal.sheet, 2), `${state} ${view}: ${c.what}`).toBe(true);
        for (const s of list) for (const c of s.controls) expect(inside(c, s.sheet, 2), `${s.id}: ${c.what}`).toBe(true);
      }
    }
    // the washes reach past the sheets' right edges, never into a sideways scroll
    expect(await page.evaluate(() => ({ w: innerWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ w: 390, scroll: 390 });
    const w = await page.evaluate(() => window.sprout!.ui.wayfinding({ layout: true }));
    const list = await sheets(page);
    for (const st of w.stops) expect(st.x).toBeLessThan(list[0]!.sheet.left - 6);
    for (const p of w.points) for (const s of list) expect(p.x < s.sheet.left - 4 || p.y < s.sheet.top || p.y > s.sheet.bottom).toBe(true);
  });

  for (const phase of ['midday', 'night'] as const) {
    test(`every text on the sheets reads at ≥ 4.5 : 1 from its pixels · phone ${phase}`, async ({ page }) => {
      test.slow();
      await openUi(page);
      // two growing: the waiting card has its seal “Start” (three, on desktop, give “See them”)
      await busy(page, 2);
      await expect(page.locator('.due-card .seal.due-start')).toBeVisible();
      await page.evaluate((p) => {
        window.sprout!.setTime(p);
        window.sprout!.settleAmbience();
      }, phase);
      await sheetsSettled(page);
      const { count, low } = await textContrast(page);
      expect(count).toBeGreaterThan(40);
      expect(low).toEqual([]);
    });
  }
});
