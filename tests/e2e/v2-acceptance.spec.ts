import type { Locator, Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';
import { MIN, openUi } from './ui-helpers';

/**
 * v2 acceptance (ADR 0005 and the owner's later requests; docs/TESTING.md › v2 acceptance): the
 * checks the acceptance table found missing. Each one drives the production build through the
 * `?dev` API or the real UI and waits on readiness signals (`ready`, `plantsReady`, `settle`,
 * `freeze`, `expect.poll`), never on wall-clock time.
 */

const sessions = (page: Page) => page.evaluate(() => window.sprout!.sessions());
const seedlings = (page: Page) => page.evaluate(() => window.sprout!.plants.state().seedlings.map((s) => s.id));

/** Every tip id but `keep` marked as learned, so only the tip under test can show. */
async function onlyTip(page: Page, keep: string) {
  await page.evaluate((k) => {
    const ids = ['task', 'duration', 'plan', 'placement', 'swap', 'notifications', 'widget', 'water', 'switch', 'pressed', 'schedule', 'sound'];
    const tips: Record<string, 'seen'> = {};
    for (const id of ids) if (id !== k) tips[id] = 'seen';
    window.sprout!.setState({ tips });
    window.sprout!.ui.refresh();
  }, keep);
}

test.describe('v2 acceptance · parallel sessions', () => {
  test('cancelling one session leaves the others untouched: their time, spots and seedlings', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.startSessions(3, 25, 60_000);
      window.sprout!.ui.refresh();
    });
    await page.evaluate((ms) => window.sprout!.advance(ms), 4 * MIN);
    await page.evaluate(() => window.sprout!.plantsReady());
    const before = await sessions(page);
    expect(before.map((s) => [s.taskName, s.active])).toEqual([
      ['Task 1', false],
      ['Task 2', false],
      ['Task 3', true],
    ]);
    expect(await seedlings(page)).toEqual(expect.arrayContaining(before.map((s) => s.id)));

    // end the active one through the dock, with its gentle confirmation
    const panel = page.locator('.panel');
    await panel.getByRole('button', { name: 'End', exact: true }).click();
    await panel.locator('.confirm-cancel').getByRole('button', { name: 'End' }).click();
    await expect(panel).toHaveAttribute('data-view', 'idle');
    await expect(page.locator('.session-list .session-row')).toHaveCount(2);

    const after = await sessions(page);
    const kept = before.slice(0, 2);
    expect(after.map((s) => s.id)).toEqual(kept.map((s) => s.id));
    after.forEach((s, i) => {
      expect(s).toMatchObject({ slotId: kept[i]!.slotId, speciesId: kept[i]!.speciesId, elapsedMs: kept[i]!.elapsedMs, running: false });
      expect(s.growth).toBeCloseTo(kept[i]!.growth, 6);
    });
    // only the cancelled seedling withers; the others still grow in their spots
    await expect.poll(() => seedlings(page)).toEqual(expect.arrayContaining(kept.map((s) => s.id)));
    expect(await seedlings(page)).not.toContain(before[2]!.id);
    expect(await page.evaluate(() => window.sprout!.log().map((e) => [e.taskName, e.outcome]))).toEqual([['Task 3', 'cancelled']]);

    // a waiting one can be ended too, and the last one is still untouched
    await page.evaluate((id) => window.sprout!.cancel(id), kept[0]!.id);
    const last = await sessions(page);
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ id: kept[1]!.id, elapsedMs: kept[1]!.elapsedMs, slotId: kept[1]!.slotId });
    await expect(page.locator('.session-list .session-row')).toHaveCount(1);
    // and nothing resumes on its own
    await page.evaluate((ms) => window.sprout!.advance(ms), 10 * MIN);
    expect((await sessions(page))[0]!.elapsedMs).toBe(kept[1]!.elapsedMs);
  });

  test('the switch tip: one quiet note by Switch while another session waits, retired by switching', async ({ page }) => {
    await openUi(page);
    await onlyTip(page, 'switch');
    await page.evaluate(() => {
      window.sprout!.startSessions(1, 25);
      window.sprout!.ui.refresh();
      window.sprout!.ui.scrollTo('session', { instant: true });
    });
    // one session: nothing to switch to, no note
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    expect((await page.evaluate(() => window.sprout!.ui.state())).tips).toEqual([]);

    await page.evaluate(() => {
      window.sprout!.startSessions(1, 25);
      window.sprout!.ui.refresh();
      window.sprout!.ui.scrollTo('session', { instant: true });
    });
    const tip = page.locator('.tip[data-tip-id="switch"]');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Several seedlings can grow at once');
    await expect(page.locator('.tip')).toHaveCount(1);
    // the note sits by the Switch it explains
    const switchBtn = page.locator('.session-list button[data-anchor="switch"]').first();
    const [t, b] = [(await tip.boundingBox())!, (await switchBtn.boundingBox())!];
    expect(Math.hypot(t.x + t.width / 2 - (b.x + b.width / 2), t.y + t.height / 2 - (b.y + b.height / 2))).toBeLessThan(400);

    await switchBtn.click();
    await expect.poll(() => page.evaluate(() => window.sprout!.state().tips.switch)).toBe('seen');
    await expect(tip).toHaveCount(0);
    // listed as learned under the hints
    await page.locator('.menu').getByRole('button', { name: 'Hints' }).click();
    await expect(page.locator('dialog[data-dialog="hints"] .hint[data-tip-id="switch"]')).toHaveAttribute('data-retired', 'true');
  });
});

test.describe('v2 acceptance · one primary action', () => {
  /** A session paused past 30 minutes ("Still with us?") when a planned session comes due. */
  async function longPauseWithDue(page: Page) {
    await openUi(page);
    await page.evaluate(() => {
      const s = window.sprout!;
      s.start(25, { speciesId: 'fx-violet', slotId: s.placementOptions('fx-violet')[0]!.id, taskName: 'Botany' });
      s.pause();
    });
    await page.evaluate((ms) => window.sprout!.advance(ms), 31 * MIN);
    const panel = page.locator('.panel');
    await expect(panel).toHaveAttribute('data-view', 'longPause');
    await page.evaluate(() => {
      window.sprout!.schedule.add({ name: 'Kanji' });
      window.sprout!.schedule.jumpToDue();
      window.sprout!.ui.refresh();
      window.sprout!.ui.scrollTo('session', { instant: true });
    });
    await expect(page.locator('.due-card')).toHaveCount(1);
    await expect(panel).toHaveAttribute('data-view', 'longPause');
  }

  test('a planned session due during a long pause: its Start is the one marked primary', async ({ page }) => {
    await longPauseWithDue(page);
    const primary = page.locator('[data-section="session"] [data-primary="true"]:visible');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAccessibleName('Start “Kanji”');
  });

  test('a planned session due during a long pause: only one vermilion seal in Study, and Resume is the seal again once the card goes', async ({ page }) => {
    // the look follows `data-primary`: the long pause's Resume steps back to an ink slip
    await longPauseWithDue(page);
    const seals = page.locator('[data-section="session"] button.seal:visible');
    await expect(seals).toHaveCount(1);
    await expect(seals).toHaveAccessibleName('Start “Kanji”');
    const resume = page.locator('.panel button.long-resume');
    await expect(resume).toHaveClass(/\bquiet\b/);
    await expect(resume).toHaveClass(/\bink\b/);

    await page.locator('.due-card').getByRole('button', { name: 'Not this time' }).click();
    await expect(page.locator('.due-card')).toHaveCount(0);
    await expect(resume).toHaveAttribute('data-primary', 'true');
    await expect(resume).toHaveClass(/\bseal\b/);
    await expect(resume).not.toHaveClass(/\bquiet\b/);
    await expect(seals).toHaveCount(1);
  });
});

test.describe('v2 acceptance · camera', () => {
  test('a double tap zooms in about the point; two taps apart do not; the browser’s dblclick after it adds nothing', async ({ page }) => {
    await openUi(page);
    const sky = await page.evaluate(() => window.sprout!.camera.toClient({ x: 800, y: 200 }));
    /** Touch taps dispatched in one task (well inside the 320 ms double-tap window, no waiting). */
    const taps = (points: Array<{ x: number; y: number }>, thenDblClick = false) =>
      page.evaluate(
        ({ pts, dbl }) => {
          const c = document.querySelector<HTMLCanvasElement>('#garden')!;
          const ev = (type: string, x: number, y: number) =>
            new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true });
          for (const p of pts) {
            c.dispatchEvent(ev('pointerdown', p.x, p.y));
            window.dispatchEvent(ev('pointerup', p.x, p.y));
          }
          if (dbl) c.dispatchEvent(new MouseEvent('dblclick', { clientX: pts[0]!.x, clientY: pts[0]!.y, bubbles: true, cancelable: true }));
        },
        { pts: points, dbl: thenDblClick },
      );
    const zoom = async () => {
      await page.evaluate(() => window.sprout!.camera.settle());
      return (await page.evaluate(() => window.sprout!.camera.state())).pose.zoom;
    };

    // two taps far apart are two single taps
    await taps([sky, { x: sky.x + 120, y: sky.y + 40 }]);
    expect(await zoom()).toBeCloseTo(1, 5);
    // a double tap zooms in 2×, about the tapped point; the dblclick the browser also sends is ignored
    await taps([sky, { x: sky.x + 3, y: sky.y + 2 }], true);
    expect(await zoom()).toBeCloseTo(2, 1);
    const at = await page.evaluate(() => window.sprout!.camera.toClient({ x: 800, y: 200 }));
    expect(Math.hypot(at.x - sky.x, at.y - sky.y)).toBeLessThan(12);
    expect((await page.evaluate(() => window.sprout!.camera.state())).reason).toBe('user');
  });

  test('a finished plant’s card names the plant it replaced, now pressed; a seedling’s, the plant stepping aside', async ({ page }) => {
    await openUi(page);
    const [first, second] = await page.evaluate(async () => {
      const s = window.sprout!;
      s.camera.autoFocus(false);
      const slot = s.placementOptions('white-clover')[0]!.id;
      s.start(25, { speciesId: 'white-clover', slotId: slot, taskName: 'Kanji' });
      s.completeSession();
      const growing = s.start(25, { speciesId: 'white-clover', slotId: slot, taskName: 'Essay' })!;
      await s.plants.settle();
      return [slot, growing.id];
    });
    expect(first).toBeTruthy();
    const card = page.locator('[data-ui="plant-card"]');
    expect(await page.evaluate((id) => window.sprout!.camera.openCard(id), second)).toBe(true);
    await expect(card).toHaveAttribute('data-kind', 'growing');
    await expect(card.locator('.plant-story-replaced')).toHaveText('A white clover (“Kanji”) steps aside for it; if you end this session, it comes back.');
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();

    const bloomed = await page.evaluate(async () => {
      const p = window.sprout!.completeSession()!;
      await window.sprout!.plants.settle();
      return p.id;
    });
    expect(await page.evaluate(() => window.sprout!.state().pressed.map((p) => p.taskName))).toEqual(['Kanji']);
    expect(await page.evaluate((id) => window.sprout!.camera.openCard(id), bloomed)).toBe(true);
    await expect(card).toHaveAttribute('data-kind', 'finished');
    await expect(card.locator('.plant-story-replaced')).toHaveText('It took the place of a white clover (“Kanji”), now pressed in your herbarium.');
  });
});

test.describe('v2 acceptance · hover language beyond Pause and End (ADR 0204)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const style = (l: Locator, prop: string, pseudo?: string) =>
    l.evaluate((el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p!), [prop, pseudo] as const);
  const LIFT = '0px -1px';

  test('seals, sprout marks, tools, corner and zoom chips, calendar words, the pill and sheet cards each answer the pointer', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));

    // seal: lifts, and its vermilion deepens
    const start = page.locator('.panel button.plant-session');
    await expect(start).toHaveClass(/\bseal\b/);
    expect(await style(start, 'translate')).toBe('none');
    await start.hover();
    await expect.poll(() => style(start, 'translate')).toBe(LIFT);
    await expect.poll(() => style(start, 'filter')).toMatch(/saturate\(1\.06\)/);
    // sprout mark: its leaves open
    await expect.poll(() => style(start.locator('.sprout-mark .leaf').first(), 'transform')).not.toBe('none');

    // a tool in the dock: its slip (::before) lifts, the words stay
    const tool = page.locator('.tool-list button.tool').first();
    await tool.scrollIntoViewIfNeeded();
    await tool.hover();
    await expect.poll(() => style(tool, 'translate', '::before')).toBe(LIFT);
    expect(await style(tool, 'translate')).toBe('none');

    // calendar view words: the ink deepens and a stroke draws in under the word
    const weekly = page.locator('.cal-view', { hasText: 'Weekly' });
    await weekly.scrollIntoViewIfNeeded();
    expect(await style(weekly, 'transform', '::after')).toMatch(/matrix\(0,/);
    await weekly.hover();
    await expect.poll(() => style(weekly, 'transform', '::after')).toBe('matrix(1, 0, 0, 1, 0, 0)');

    // on the painting: a corner chip and a zoom chip lift their slip; the idle pill tints
    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    await expect.poll(() => page.evaluate(() => window.sprout!.ui.state().pillAside)).toBe(false);
    const corner = page.locator('.menu button.icon-btn').first();
    await corner.hover();
    await expect.poll(() => style(corner, 'translate', '::before')).toBe(LIFT);
    const zoomIn = page.locator('[data-zoom="in"]');
    await zoomIn.hover();
    await expect.poll(() => style(zoomIn, 'translate', '::before')).toBe(LIFT);
    const pillStart = page.locator('.pill .pill-start');
    const restBg = await style(pillStart, 'background-color');
    await pillStart.hover();
    await expect.poll(() => style(pillStart, 'background-color')).not.toBe(restBg);

    // the planting sheet: plan cards and quick picks lift
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    const plan = sheet.locator('.plan-card').first();
    await plan.hover();
    await expect.poll(() => style(plan, 'translate')).toBe(LIFT);
    const preset = sheet.locator('.preset').first();
    await preset.hover();
    await expect.poll(() => style(preset, 'translate')).toBe(LIFT);
    const card = sheet.locator('.plant-card:not([data-locked="true"])').first();
    await card.hover();
    await expect.poll(() => style(card, 'translate', '::before')).toBe(LIFT);
  });

  /** Focus `l` from the keyboard (Shift+Tab, Tab), so `:focus-visible` applies, with the pointer away. */
  async function keyFocus(page: Page, l: Locator) {
    await l.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await l.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(l).toBeFocused();
    expect(await l.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  }

  test('keyboard focus shows the hover state: a seal, a calendar word, a corner chip, a quick pick', async ({ page }) => {
    await openUi(page);
    const start = page.locator('.panel button.plant-session');
    await keyFocus(page, start);
    await expect.poll(() => style(start, 'translate')).toBe(LIFT);
    await expect.poll(() => style(start.locator('.sprout-mark .leaf').first(), 'transform')).not.toBe('none');

    const weekly = page.locator('.cal-view', { hasText: 'Weekly' });
    await keyFocus(page, weekly);
    await expect.poll(() => style(weekly, 'transform', '::after')).toBe('matrix(1, 0, 0, 1, 0, 0)');

    await page.evaluate(() => window.sprout!.ui.scrollTo(0, { instant: true }));
    const corner = page.locator('.menu button.icon-btn').first();
    await keyFocus(page, corner);
    await expect.poll(() => style(corner, 'translate', '::before')).toBe(LIFT);

    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const preset = page.locator('dialog[data-dialog="planting"] .preset').first();
    await keyFocus(page, preset);
    await expect.poll(() => style(preset, 'translate')).toBe(LIFT);
  });

  test('keyboard focus lifts the dock tools and the sheet’s plan and plant cards too (known gap)', async ({ page }) => {
    // Known gap (docs/TESTING.md › v2 acceptance): ADR 0204 gives every family the hover state on
    // :focus-visible, but hover.css lists no focus rule for `.tool::before`, `.plan-card` or
    // `.plant-card::before`; these show only the focus ring. Expected to fail until fixed.
    test.fail();
    await openUi(page);
    const tool = page.locator('.tool-list button.tool').first();
    await keyFocus(page, tool);
    await expect.poll(() => style(tool, 'translate', '::before'), { timeout: 2_000 }).toBe(LIFT);
    await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
    const plan = page.locator('dialog[data-dialog="planting"] .plan-card').first();
    await keyFocus(page, plan);
    await expect.poll(() => style(plan, 'translate'), { timeout: 2_000 }).toBe(LIFT);
  });
});

test.describe('v2 acceptance · the look in numbers', () => {
  test('bigger, higher-contrast type: base ≥ 20 px at weight ≥ 500, headings ≥ 24 px, every dock text ≥ 4.5:1 on the paper', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => {
      window.sprout!.startSessions(2, 50);
      window.sprout!.schedule.demo();
      window.sprout!.ui.refresh();
    });
    await page.evaluate(() => window.sprout!.ui.dockReady());
    const type = await page.evaluate(() => {
      const root = getComputedStyle(document.querySelector('.ui-root')!);
      const parse = (c: string) => {
        const p = /rgba?\(([^)]+)\)/.exec(c)![1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
        return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
      };
      const lin = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--ui-paper').trim();
      const n = parseInt(hex.slice(1), 16);
      const paper = { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
      const vHex = getComputedStyle(document.documentElement).getPropertyValue('--ui-vermilion').trim();
      const v = parseInt(vHex.slice(1), 16);
      const vermilion = { r: v >> 16, g: (v >> 8) & 255, b: v & 255 };
      const low: string[] = [];
      let count = 0;
      const walk = document.createTreeWalker(document.querySelector('.dock')!, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!t.textContent?.trim()) continue;
        const el = t.parentElement!;
        if (el.closest('[hidden], .visually-hidden, svg, [aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.getBoundingClientRect().width === 0) continue;
        // a missed plan is shown faintly on purpose (no guilt, ADR 0172): it is not body text
        if (el.closest('[data-occurrence-status="missed"], [data-outcome="cancelled"]')) continue;
        let opacity = 1;
        for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
        const c = parse(cs.color);
        const a = c.a * opacity;
        // a seal's cream label sits on its vermilion; everything else on the paper
        const ground = el.closest('.seal') ? vermilion : paper;
        const seen = { r: c.r * a + ground.r * (1 - a), g: c.g * a + ground.g * (1 - a), b: c.b * a + ground.b * (1 - a) };
        const [x, y] = [lum(seen), lum(ground)];
        const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        count++;
        if (ratio < 4.5) low.push(`${ratio.toFixed(2)} ${el.className} “${t.textContent.trim().slice(0, 24)}”`);
      }
      const headings = [...document.querySelectorAll<HTMLElement>('.dock .dock-title')].map((h) => parseFloat(getComputedStyle(h).fontSize));
      return { base: parseFloat(root.fontSize), weight: Number(root.fontWeight), headings, count, low };
    });
    expect(type.base).toBeGreaterThanOrEqual(20);
    expect(type.weight).toBeGreaterThanOrEqual(500);
    expect(type.headings.length).toBeGreaterThanOrEqual(4);
    for (const size of type.headings) expect(size).toBeGreaterThanOrEqual(24);
    expect(type.count).toBeGreaterThan(40);
    expect(type.low).toEqual([]);
  });

  test('plants are 1.25× the species box at their slot, and paint past the box a v1 plant had', async ({ page }) => {
    await openDev(page, 'fixtures');
    // fixture species sizes (src/dev/fixture-species.ts), world units at slot scale 1
    const SIZES: Record<string, { w: number; h: number }> = { 'fx-violet': { w: 46, h: 40 }, 'fx-hydrangea': { w: 100, h: 90 }, 'fx-cherry': { w: 220, h: 260 } };
    const ratios = await page.evaluate((sizes) => {
      const s = window.sprout!;
      const slots = new Map(s.slots().map((x) => [x.id, x]));
      const out: Array<{ id: string; slot: string; w: number; h: number }> = [];
      for (const [id, size] of Object.entries(sizes)) {
        for (const o of s.placementOptions(id)) {
          const b = s.plants.boundsFor(id, o.id)!;
          const k = slots.get(o.id)!.scale;
          out.push({ id, slot: o.id, w: b.w / (size.w * k), h: b.h / (size.h * k) });
        }
      }
      return out;
    }, SIZES);
    expect(new Set(ratios.map((r) => r.id)).size).toBe(3);
    for (const r of ratios) {
      expect(r.w, `${r.id} in ${r.slot}`).toBeCloseTo(1.25, 6);
      expect(r.h, `${r.id} in ${r.slot}`).toBeCloseTo(1.25, 6);
    }

    // the sprites really are painted at that size: a seeded garden of real plants has painted
    // pixels (found by the plant hit-test) outside the box the same plant had at 1× (anchored alike)
    await page.evaluate(async () => {
      window.sprout!.reset();
      window.sprout!.seed(4);
      window.sprout!.addPlants(20);
      await window.sprout!.plants.settle();
    });
    const beyond = await page.evaluate(() => {
      const s = window.sprout!;
      let n = 0;
      const slots = new Map(s.slots().map((x) => [x.id, x]));
      for (const p of s.state().plants) {
        const b = s.plants.bounds(p.id)!;
        // the 1× box: the same box scaled by 0.8 about the slot point, where the species anchor sits
        const a = slots.get(p.slotId)!;
        const v1 = { x: a.x + (b.x - a.x) * 0.8, y: a.y + (b.y - a.y) * 0.8, w: b.w * 0.8, h: b.h * 0.8 };
        let outside = false;
        const N = 40;
        for (let i = 0; i <= N && !outside; i++) {
          for (let j = 0; j <= N && !outside; j++) {
            const pt = { x: b.x + (b.w * i) / N, y: b.y + (b.h * j) / N };
            if (pt.x >= v1.x && pt.x <= v1.x + v1.w && pt.y >= v1.y && pt.y <= v1.y + v1.h) continue;
            if (s.plants.hitTest(pt, 0)?.id === p.id) outside = true;
          }
        }
        if (outside) n++;
      }
      return { n, of: s.state().plants.length };
    });
    expect(beyond.of).toBe(20);
    expect(beyond.n).toBeGreaterThanOrEqual(3);
  });

  test('more saturated colour: the painted garden’s OKLab chroma clears fixed floors at midday and stays watercolour', async ({ page }) => {
    await openDev(page);
    await page.evaluate(async () => {
      window.sprout!.seed(4);
      window.sprout!.addPlants(20);
      await window.sprout!.plantsReady();
    });
    const chroma = (phase: string) =>
      page.evaluate(async (p) => {
        window.sprout!.setTime(p as never);
        window.sprout!.settleAmbience();
        await window.sprout!.freeze();
        const c = document.querySelector<HTMLCanvasElement>('#garden')!;
        // the garden below the sky, inside the dissolving margins
        const x0 = Math.floor(c.width * 0.05);
        const { data } = c.getContext('2d')!.getImageData(x0, Math.floor(c.height * 0.3), c.width - 2 * x0, Math.floor(c.height * 0.65));
        const lin = (v: number) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        const all: number[] = [];
        for (let i = 0; i < data.length; i += 4 * 37) {
          const [r, g, b] = [lin(data[i]!), lin(data[i + 1]!), lin(data[i + 2]!)];
          const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
          const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
          const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
          all.push(Math.hypot(1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s));
        }
        all.sort((a, b) => a - b);
        return { mean: all.reduce((a, b) => a + b, 0) / all.length, p90: all[Math.floor(all.length * 0.9)]!, max: all[all.length - 1]! };
      }, phase);
    const midday = await chroma('midday');
    // measured on the v2 build (seed 4, 20 plants): mean 0.047, p90 0.063
    expect(midday.mean).toBeGreaterThan(0.04);
    expect(midday.p90).toBeGreaterThan(0.055);
    // still watercolour, never neon
    expect(midday.p90).toBeLessThan(0.12);
    // tied to the day: night takes colour out
    const night = await chroma('night');
    expect(night.mean).toBeLessThan(midday.mean * 0.7);
  });
});
