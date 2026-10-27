import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { MIN, openUi, reloadUi } from './ui-helpers';

/**
 * Calendar & scheduling (SPEC §13, ADRs 0170–0177): the Daily / Weekly / Monthly calendar in the
 * dock (daily by default, the choice remembered), scheduling from it, repeats, the waiting card at
 * the scheduled time with one-tap Start into the prefilled planting sheet, the link back (done),
 * missed, the limit of three, the soft notification, and the phone layout. Time moves with the dev
 * clock (`sprout.schedule.jumpToDue`, `jumpPast`, `advance`), never by sleeping.
 */

const cal = (page: Page) => page.locator('[data-section="calendar"] .calendar');
const calState = (page: Page) => page.evaluate(() => window.sprout!.calendar.state()!);
/** The app clock's local day, `offsetDays` calendar days on (not 24 h steps: a daylight-saving day is 23 or 25 h). */
const dayKeyIn = (page: Page, offsetDays = 0) =>
  page.evaluate((o) => {
    const now = new Date(window.sprout!.now());
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + o, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, offsetDays);

async function openCalendar(page: Page, query = ''): Promise<void> {
  await openUi(page, query);
  await page.evaluate(async () => {
    window.sprout!.calendar.setView('day');
    window.sprout!.calendar.go(window.sprout!.now());
    await window.sprout!.ui.scrollTo('calendar', { instant: true });
  });
  await expect(cal(page)).toBeVisible();
}

type Loc = ReturnType<Page['locator']>;

/** Choose a day in the schedule editor's painted day picker (ADR 0192): open it, turn to the month, tap the day. */
async function pickDay(sheet: Loc, date: string): Promise<void> {
  await sheet.locator('#sched-date').click();
  const panel = sheet.locator('#sched-date-panel');
  await expect(panel).toBeVisible();
  for (let i = 0; i < 24 && (await panel.locator(`button.pick-day[data-date="${date}"][data-other="false"]`).count()) === 0; i++) {
    await panel.getByRole('button', { name: 'Next month' }).click();
  }
  await panel.locator(`button.pick-day[data-date="${date}"][data-other="false"]`).click();
  await expect(panel).toBeHidden();
  await expect(sheet.locator('#sched-date')).toHaveAttribute('data-value', date);
}

/** Choose a time (`HH:MM`, minutes in fives) in the painted time picker, on either clock. */
async function pickTime(sheet: Loc, hhmm: string): Promise<void> {
  const [H, M] = hhmm.split(':').map(Number) as [number, number];
  await sheet.locator('#sched-time').click();
  const panel = sheet.locator('#sched-time-panel');
  await expect(panel).toBeVisible();
  const twelve = (await panel.locator('.pick-periods').count()) > 0;
  if (twelve) await panel.locator(`[data-period="${H >= 12 ? 'pm' : 'am'}"]`).click();
  await panel.locator(`[data-hour="${twelve ? ((H + 11) % 12) + 1 : H}"]`).click();
  await panel.locator(`[data-minute="${M}"]`).click();
  await panel.getByRole('button', { name: 'Done' }).click();
  await expect(sheet.locator('#sched-time')).toHaveAttribute('data-value', hhmm);
}

/** Add a schedule due at the next minute and jump the dev clock to it; returns its occurrence key. */
async function dueNow(page: Page, input: Record<string, unknown> = {}): Promise<string> {
  return page.evaluate((i) => {
    const s = window.sprout!.schedule.add(i);
    if (!s) throw new Error('schedule not added');
    const o = window.sprout!.schedule.jumpToDue(s.id);
    if (!o) throw new Error('no occurrence');
    return o.key;
  }, input);
}

test.describe('calendar', () => {
  test('daily by default; toggle views, navigate, and the choice is remembered', async ({ page }) => {
    await openCalendar(page);
    await expect(cal(page)).toHaveAttribute('data-view', 'day');
    await expect(cal(page).getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'true');
    const today = await dayKeyIn(page);
    expect((await calState(page)).date).toBe(today);

    // a day back and forth, then Today
    await cal(page).getByRole('button', { name: 'Next day' }).click();
    expect((await calState(page)).date).toBe(await dayKeyIn(page, 1));
    await cal(page).getByRole('button', { name: 'Previous day' }).click();
    await cal(page).getByRole('button', { name: 'Previous day' }).click();
    expect((await calState(page)).date).toBe(await dayKeyIn(page, -1));
    await cal(page).getByRole('button', { name: 'Today' }).click();
    expect((await calState(page)).date).toBe(today);

    // weekly: seven days, the week starting as the locale says
    await cal(page).getByRole('button', { name: 'Weekly' }).click();
    await expect(cal(page)).toHaveAttribute('data-view', 'week');
    let st = await calState(page);
    expect(st.days).toHaveLength(7);
    expect(st.days).toContain(today);
    expect(new Date(`${st.days[0]}T12:00`).getDay()).toBe(st.weekStartsOn);
    await expect(cal(page).locator('.cal-dayhead')).toHaveCount(7);
    const firstDay = st.days[0]!;
    await cal(page).getByRole('button', { name: 'Next week' }).click();
    st = await calState(page);
    expect(Math.round((new Date(`${st.days[0]}T12:00`).getTime() - new Date(`${firstDay}T12:00`).getTime()) / 86_400_000)).toBe(7);
    expect(st.days).not.toContain(today);

    // monthly: a grid of whole weeks; tapping a day opens it in the daily view
    await cal(page).getByRole('button', { name: 'Monthly' }).click();
    await expect(cal(page)).toHaveAttribute('data-view', 'month');
    const cells = cal(page).locator('.cal-day');
    expect((await cells.count()) % 7).toBe(0);
    await cal(page).getByRole('button', { name: 'Today' }).click();
    const tomorrow = await dayKeyIn(page, 1);
    await cal(page).locator(`.cal-day[data-date="${tomorrow}"]`).click();
    await expect(cal(page)).toHaveAttribute('data-view', 'day');
    expect((await calState(page)).date).toBe(tomorrow);

    // the last choice is remembered for this viewer
    await cal(page).getByRole('button', { name: 'Weekly' }).click();
    await reloadUi(page);
    await expect(cal(page)).toHaveAttribute('data-view', 'week');
  });

  test('schedule a session from the calendar; it shows, and a daily repeat shows on the following days', async ({ page }) => {
    await openCalendar(page);
    const tomorrow = await dayKeyIn(page, 1);
    await cal(page).getByRole('button', { name: 'Schedule a session' }).click();
    const sheet = page.locator('dialog[data-dialog="schedule"]');
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('What will you study?').fill('Biology ch. 4');
    await pickDay(sheet, tomorrow);
    await pickTime(sheet, '09:30');
    await sheet.locator('.sched-chip[data-length="50"]').click();
    await sheet.locator('.sched-chip[data-plan-id="pomodoro"]').click();
    await sheet.locator('.sched-chip[data-repeat="daily"]').click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();

    const [s] = await page.evaluate(() => window.sprout!.schedule.list());
    expect(s).toMatchObject({ name: 'Biology ch. 4', date: tomorrow, time: '09:30', lengthMinutes: 50, planId: 'pomodoro', repeat: 'daily' });

    // not today; tomorrow and the day after, at 9:30
    expect((await calState(page)).items.filter((i) => i.kind === 'scheduled')).toEqual([]);
    for (const offset of [1, 2, 3]) {
      await cal(page).getByRole('button', { name: 'Next day' }).click();
      const block = cal(page).locator('.cal-block[data-kind="scheduled"]');
      await expect(block).toHaveCount(1);
      await expect(block).toHaveAttribute('data-status', 'upcoming');
      await expect(block).toContainText('Biology ch. 4');
      expect((await calState(page)).date).toBe(await dayKeyIn(page, offset));
    }
    // the week shows one a day from tomorrow
    await cal(page).getByRole('button', { name: 'Weekly' }).click();
    const week = await calState(page);
    expect(week.items.filter((i) => i.kind === 'scheduled').map((i) => i.date)).toEqual(week.days.filter((d) => d >= tomorrow));
  });

  test('a tap on an empty time opens the editor at that time', async ({ page }) => {
    await openCalendar(page);
    await cal(page).getByRole('button', { name: 'Next day' }).click();
    const col = cal(page).locator('.cal-col').first();
    // bring 14:00 into the timeline's window, then tap a little after it
    await cal(page).locator('.cal-timeline').evaluate((el) => (el.scrollTop = (13 / 24) * el.scrollHeight));
    const box = (await col.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * (14.2 / 24));
    const sheet = page.locator('dialog[data-dialog="schedule"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('#sched-time')).toHaveAttribute('data-value', '14:00');
    await expect(sheet.locator('#sched-date')).toHaveAttribute('data-value', await dayKeyIn(page, 1));
    await expect(sheet.locator('.sched-chip[data-length="open"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('at the scheduled time a card waits with one-tap Start; the sheet is prefilled; the bloom marks it done', async ({ page }) => {
    await openCalendar(page);
    // a fixed hour: from about 23:05 the 50 min session blooms on the next day (devlog 61)
    await page.evaluate(() => {
      window.sprout!.advanceTo('10:00');
      window.sprout!.calendar.go(window.sprout!.now());
    });
    const key = await dueNow(page, { name: 'Essay draft', lengthMinutes: 50, planId: 'pomodoro' });

    // the card waits in the Study section and a slip on the garden; nothing starts on its own
    const card = page.locator('.due-card');
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('data-occurrence', key);
    await expect(card).toContainText('Essay draft');
    await expect(card).toContainText('50 min · Pomodoro');
    await expect(page.locator('.stage-ui .due-slip')).toBeVisible();
    expect(await page.evaluate(() => window.sprout!.sessions())).toEqual([]);
    await page.evaluate((ms) => window.sprout!.advance(ms), 5 * MIN);
    expect(await page.evaluate(() => window.sprout!.sessions())).toEqual([]);
    await expect(card).toHaveCount(1);

    // one tap: the planting sheet, prefilled with name, length and plan
    await card.getByRole('button', { name: 'Start “Essay draft”' }).click();
    const sheet = page.locator('dialog[data-dialog="planting"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('What are you studying?')).toHaveValue('Essay draft');
    await expect(sheet.locator('input.duration')).toHaveValue('50');
    await expect(sheet.locator('.plan-card[data-plan-id="pomodoro"]')).toHaveAttribute('aria-checked', 'true');
    expect((await page.evaluate(() => window.sprout!.ui.state().draft)).link).toBeTruthy();

    // the plant and the spot are chosen now
    await sheet.locator('.plant-card[data-species-id="fx-violet"]').click();
    await sheet.getByRole('button', { name: 'Choose a spot' }).click();
    await page.locator('button.marker[data-occupied="false"]').first().click();
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
    await expect(page.locator('.panel .task-name')).toHaveText('Essay draft');
    await expect(card).toHaveCount(0);
    expect((await page.evaluate((k) => window.sprout!.schedule.get(k), key))!.status).toBe('started');

    // the calendar shows the session, linked to the plan
    await page.evaluate(() => window.sprout!.calendar.go(window.sprout!.now()));
    const growing = cal(page).locator(`.cal-block[data-occurrence="${key}"]`);
    await expect(growing).toHaveAttribute('data-kind', 'growing');
    await expect(growing).toHaveAttribute('data-occurrence-status', 'started');

    // it blooms: done as planned
    await page.evaluate(() => window.sprout!.completeSession());
    await page.evaluate(() => window.sprout!.ui.refresh());
    const done = cal(page).locator(`.cal-block[data-occurrence="${key}"]`);
    await expect(done).toHaveAttribute('data-kind', 'session');
    await expect(done).toHaveAttribute('data-status', 'completed');
    await expect(done).toHaveAttribute('data-occurrence-status', 'done');
    expect((await page.evaluate((k) => window.sprout!.schedule.get(k), key))!.status).toBe('done');
    await expect(cal(page).locator('.cal-block[data-kind="scheduled"]')).toHaveCount(0);
  });

  test('not started within its window, it passes quietly into missed; "Not this time" lets one pass', async ({ page }) => {
    await openCalendar(page);
    // the window lasts an hour: from 23:00 on, passing it lands on tomorrow, whose day view has no
    // ghost of today's plan (devlog 41)
    await jumpTo(page, 10);
    const key = await dueNow(page, { name: 'Reading', lengthMinutes: 25 });
    await expect(page.locator('.due-card')).toHaveCount(1);
    await page.evaluate((k) => window.sprout!.schedule.jumpPast(k), key);
    await expect(page.locator('.due-card')).toHaveCount(0);
    await expect(page.locator('.stage-ui .due-slip')).toBeHidden();
    expect((await page.evaluate((k) => window.sprout!.schedule.get(k), key))!.status).toBe('missed');
    await page.evaluate(() => window.sprout!.calendar.go(window.sprout!.now()));
    const ghost = cal(page).locator(`.cal-block[data-id="${key}"]`);
    await expect(ghost).toHaveAttribute('data-status', 'missed');
    await expect(ghost).toContainText('passed');
    await expect(cal(page)).not.toContainText(/missed|streak|failed/i);

    const second = await dueNow(page, { name: 'Vocabulary' });
    const card = page.locator(`.due-card[data-occurrence="${second}"]`);
    await card.getByRole('button', { name: 'Not this time' }).click();
    await expect(card).toHaveCount(0);
    expect((await page.evaluate((k) => window.sprout!.schedule.get(k), second))!.status).toBe('dismissed');
  });

  test('with three sessions in progress the card says so gently and offers to switch', async ({ page }) => {
    await openCalendar(page);
    await page.evaluate(() => window.sprout!.startSessions(3, 25));
    await dueNow(page, { name: 'Physics' });
    const card = page.locator('.due-card');
    await expect(card).toHaveAttribute('data-mode', 'limit');
    await expect(card).toContainText('Three seedlings are already growing');
    await expect(card.getByRole('button', { name: /^Start/ })).toHaveCount(0);
    await card.getByRole('button', { name: 'See them' }).click();
    await expect(page.locator('dialog[data-dialog="planting"]')).toBeHidden();
    await expect(page.locator('.session-list .limit-note')).toBeVisible();
    await expect(page.locator('.session-list button.session-switch').first()).toBeFocused();
    // ending one lets the card offer Start again
    await page.evaluate(() => window.sprout!.cancel());
    await expect(card).toHaveAttribute('data-mode', 'start');
    await expect(card.getByRole('button', { name: 'Start “Physics”' })).toBeVisible();
  });

  test('edit only this one, or this and the following; remove', async ({ page }) => {
    await openCalendar(page);
    const today = await dayKeyIn(page);
    await page.evaluate((date) => window.sprout!.schedule.add({ name: 'Kanji', date, time: '20:00', repeat: 'daily' }), await dayKeyIn(page, 1));
    await cal(page).getByRole('button', { name: 'Next day' }).click();
    const sheet = page.locator('dialog[data-dialog="schedule"]');

    // only this one: tomorrow moves to 21:15, the day after keeps 20:00
    await cal(page).locator('.cal-block[data-kind="scheduled"]').click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('What will you study?')).toHaveValue('Kanji');
    await pickTime(sheet, '21:15');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet.locator('.sched-scope-q')).toHaveText('Change only this one, or this and the following?');
    await sheet.getByRole('button', { name: 'Only this one' }).click();
    await expect(sheet).toBeHidden();
    const times = await page.evaluate(
      ([a, b]) => window.sprout!.schedule.occurrences(a, b).map((o) => `${o.date} ${o.time}`),
      [today, await dayKeyIn(page, 4)],
    );
    expect(times).toEqual([`${await dayKeyIn(page, 1)} 21:15`, `${await dayKeyIn(page, 2)} 20:00`, `${await dayKeyIn(page, 3)} 20:00`]);

    // remove this and the following from the day after tomorrow
    await cal(page).getByRole('button', { name: 'Next day' }).click();
    await cal(page).locator('.cal-block[data-kind="scheduled"]').click();
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await sheet.getByRole('button', { name: 'This and the following' }).click();
    await expect(sheet).toBeHidden();
    await expect(cal(page).locator('.cal-block[data-kind="scheduled"]')).toHaveCount(0);
    const left = await page.evaluate(([a, b]) => window.sprout!.schedule.occurrences(a, b).map((o) => o.date), [today, await dayKeyIn(page, 9)]);
    expect(left).toEqual([await dayKeyIn(page, 1)]);
  });

  test('one quiet tip points at Schedule a session after a first bloom, and retires once a session is planned', async ({ page }) => {
    await openCalendar(page);
    const tips = () => page.evaluate(() => window.sprout!.ui.state().tips);
    expect(await tips()).not.toContain('schedule');
    await page.evaluate(() => {
      window.sprout!.start(25, { taskName: 'First', speciesId: 'fx-violet' });
      window.sprout!.completeSession();
    });
    await page.evaluate(() => window.sprout!.ui.scrollTo('calendar', { instant: true }));
    await expect.poll(tips).toEqual(['schedule']);
    await expect(page.locator('.tip')).toContainText('Plan a study time ahead');
    await page.evaluate(() => window.sprout!.schedule.add({ name: 'Next' }));
    await expect.poll(tips).not.toContain('schedule');
    expect(await page.evaluate(() => window.sprout!.state().tips.schedule)).toBe('seen');
  });

  test('past sessions show in the calendar: completed in their plant’s colour, ended early faintly', async ({ page }) => {
    await openCalendar(page);
    // 31 minutes of sessions: from 23:29 on they would end tomorrow, away from the day shown (devlog 41)
    await jumpTo(page, 10);
    await page.evaluate(() => {
      window.sprout!.start(25, { taskName: 'Bloomed', speciesId: 'fx-violet' });
      window.sprout!.completeSession();
      window.sprout!.start(25, { taskName: 'Ended', speciesId: 'fx-violet' });
      window.sprout!.advance(6 * 60_000);
      window.sprout!.cancel();
      window.sprout!.calendar.go(window.sprout!.now());
    });
    const bloomed = cal(page).locator('.cal-block[data-kind="session"][data-status="completed"]');
    await expect(bloomed).toContainText('Bloomed');
    await expect(bloomed).toContainText('Wood Violet');
    expect(await bloomed.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--wash'))).toContain('svg');
    await expect(cal(page).locator('.cal-block[data-status="cancelled"]')).toContainText('Ended');
    await expect(cal(page).locator('.cal-block[data-status="cancelled"]')).toContainText('ended early');
  });
});

test.describe('calendar · notification', () => {
  test('the scheduled time brings a soft notification while the page is in the background', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __vis: string; __notes: string[] };
      w.__vis = 'visible';
      w.__notes = [];
      Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => w.__vis });
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => w.__vis === 'hidden' });
      Document.prototype.hasFocus = () => w.__vis === 'visible';
      if (typeof ServiceWorkerRegistration !== 'undefined') {
        ServiceWorkerRegistration.prototype.showNotification = async (title: string) => void w.__notes.push(title);
      }
      class FakeNotification {
        static permission = 'granted';
        static requestPermission = () => Promise.resolve('granted');
        onclick = null;
        constructor(title: string) {
          w.__notes.push(title);
        }
        close() {}
      }
      Object.defineProperty(window, 'Notification', { configurable: true, value: FakeNotification });
    });
    await openCalendar(page);
    await page.evaluate(() => window.sprout!.setState({ settings: { ...window.sprout!.state().settings, notifications: 'granted' } }));
    await page.evaluate(() => ((window as unknown as { __vis: string }).__vis = 'hidden'));
    await dueNow(page, { name: 'Essay draft' });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __notes: string[] }).__notes)).toEqual(['It’s time for “Essay draft”.']);
    expect(await page.evaluate(() => window.sprout!.widget.lastNotification())).toEqual({ kind: 'scheduled', decision: 'notify' });
    await page.evaluate(() => ((window as unknown as { __vis: string }).__vis = 'visible'));
    await expect(page.locator('.due-card')).toContainText('Essay draft');
  });
});

test.describe('calendar · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('one column, nothing wider than the screen, views and the card reachable', async ({ page }) => {
    await openCalendar(page);
    await page.evaluate(() => window.sprout!.schedule.demo());
    await page.evaluate(() => window.sprout!.ui.scrollTo('calendar', { instant: true }));
    for (const view of ['Daily', 'Weekly', 'Monthly'] as const) {
      await cal(page).getByRole('button', { name: view }).click();
      const over = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - window.innerWidth,
        cal: Math.round(document.querySelector('.calendar')!.getBoundingClientRect().right - window.innerWidth),
      }));
      expect(over.doc, `${view}: page wider than the screen`).toBeLessThanOrEqual(0);
      expect(over.cal, `${view}: calendar wider than the screen`).toBeLessThanOrEqual(0);
    }
    await expect(cal(page).locator('.cal-day')).not.toHaveCount(0);
    const tap = await cal(page).getByRole('button', { name: 'Schedule a session' }).boundingBox();
    expect(tap!.height).toBeGreaterThanOrEqual(44);
    // the waiting card sits in the Study section, inside the screen
    await dueNow(page, { name: 'On the bus' });
    await page.evaluate(() => window.sprout!.ui.scrollTo('session', { instant: true }));
    const card = page.locator('.due-card').first();
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});

/** Rects of the week's blocks, their time and title lines and their "now" seal, per day column. */
function weekBlocks(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.cal-cols[data-days="7"] .cal-col')].map((col) => ({
      date: col.dataset.date!,
      blocks: [...col.querySelectorAll<HTMLElement>('.cal-block')].map((b) => {
        const r = (el: Element | null) => {
          if (!el) return null;
          const x = el.getBoundingClientRect();
          return { left: x.left, top: x.top, right: x.right, bottom: x.bottom, width: x.width, height: x.height };
        };
        const time = b.querySelector('.cal-block-time');
        return {
          id: b.dataset.id!,
          box: r(b)!,
          time: r(time),
          timeText: time?.textContent ?? '',
          timeShown: !!time && getComputedStyle(time).display !== 'none',
          title: r(b.querySelector('.cal-block-title')),
          dot: r(b.querySelector('.cal-block-mark')),
        };
      }),
    })),
  );
}

test.describe('calendar · week layout (ADR 0183)', () => {
  test.use({ locale: 'en-US', viewport: { width: 1440, height: 900 } });

  test('concurrent blocks share the column, the seal never covers words, a narrow block reads whole on hover', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      window.sprout!.schedule.demo();
      // three seedlings growing at once, from the planned time on: the busiest moment of the week
      window.sprout!.startSessions(3, 50);
      window.sprout!.calendar.setView('week');
      window.sprout!.calendar.go(window.sprout!.now());
      await window.sprout!.ui.scrollTo('calendar', { instant: true });
      await window.sprout!.ui.dockReady();
    });
    const days = await weekBlocks(page);
    expect(days).toHaveLength(7);
    const problems: string[] = [];
    const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    let count = 0;
    for (const d of days) {
      for (const [i, a] of d.blocks.entries()) {
        count++;
        // every block shows its time ("4:10", no AM/PM in a narrow week column)
        if (!a.timeShown) problems.push(`${d.date} ${a.id}: time hidden`);
        if (/AM|PM/.test(a.timeText)) problems.push(`${d.date} ${a.id}: long time "${a.timeText}"`);
        // the seal sits before the time, inside the block, clear of the title
        if (a.dot) {
          if (a.title && overlap(a.dot, a.title) > 0) problems.push(`${d.date} ${a.id}: seal over the title`);
          if (a.dot.left < a.box.left - 0.5 || a.dot.right > a.box.right + 0.5) problems.push(`${d.date} ${a.id}: seal outside`);
        }
        for (const b of d.blocks.slice(i + 1)) {
          // blocks share the column side by side: never drawn over each other (2 px of soft edges allowed)
          if (overlap(a.box, b.box) > 2 * Math.min(a.box.height, b.box.height)) problems.push(`${d.date}: ${a.id} over ${b.id}`);
        }
      }
    }
    expect(count).toBeGreaterThan(10);
    expect(problems).toEqual([]);

    // today has a plan and three sessions at once: the narrowest blocks; hovered, one grows to read
    const narrow = cal(page).locator('.cal-col[data-today="true"] .cal-block[data-narrow]').first();
    await expect(narrow).toBeVisible();
    const before = (await narrow.boundingBox())!;
    await narrow.hover();
    await expect.poll(async () => (await narrow.boundingBox())!.width).toBeGreaterThan(Math.max(before.width + 20, 150));
    const grown = (await narrow.boundingBox())!;
    const timeline = (await cal(page).locator('.cal-timeline').boundingBox())!;
    // it stays inside the timeline (the end of the week grows to the left)
    expect(grown.x).toBeGreaterThanOrEqual(timeline.x - 1);
    expect(grown.x + grown.width).toBeLessThanOrEqual(timeline.x + timeline.width + 1);
  });

  test('the week starts on Sunday in en-US', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.calendar.setView('week'));
    const st = await calState(page);
    expect(st.weekStartsOn).toBe(0);
    expect(new Date(`${st.days[0]}T12:00`).getDay()).toBe(0);
    await expect(cal(page).locator('.cal-dayhead-name').first()).toHaveText('Sun');
  });
});

test.describe('calendar · week start elsewhere', () => {
  test.use({ locale: 'en-GB' });

  test('the week starts on Monday in en-GB (the locale decides, deliberately)', async ({ page }) => {
    await openUi(page);
    await page.evaluate(() => window.sprout!.calendar.setView('week'));
    const st = await calState(page);
    expect(st.weekStartsOn).toBe(1);
    expect(new Date(`${st.days[0]}T12:00`).getDay()).toBe(1);
    await expect(cal(page).locator('.cal-dayhead-name').first()).toHaveText('Mon');
    // and the month grid follows the same week
    await page.evaluate(() => window.sprout!.calendar.setView('month'));
    const first = await cal(page).locator('.cal-day').first().getAttribute('data-date');
    expect(new Date(`${first}T12:00`).getDay()).toBe(1);
  });
});

/** Jump the dev clock forward to the next `hour`:00 local time (today or tomorrow, daylight saving included). */
const jumpTo = (page: Page, hour: number) => page.evaluate((t) => window.sprout!.advanceTo(t), `${String(hour).padStart(2, '0')}:00`);
/** The hours' scroller has stopped moving (no glide in progress) for a few frames. */
const hoursAtRest = (page: Page) =>
  page.evaluate(async () => {
    const tl = document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline');
    if (!tl) return true;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const a = tl.scrollTop;
    for (let i = 0; i < 6; i++) await frame();
    return a === tl.scrollTop;
  });
/** Where now sits in the hours' window: 0 at its top, 1 at its bottom. */
const nowInWindow = (page: Page) =>
  page.evaluate(() => {
    const tl = document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline')!;
    const line = tl.querySelector<HTMLElement>('.cal-now');
    if (!line) return null;
    const t = tl.getBoundingClientRect();
    return (line.getBoundingClientRect().top - t.top) / t.height;
  });
const hoursTop = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline')!.scrollTop);

/** Open today's day view on the calendar section, as "Today" would; it follows now. */
async function showToday(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.sprout!.calendar.setView('day');
    window.sprout!.calendar.go(window.sprout!.now());
    await window.sprout!.ui.scrollTo('calendar', { instant: true });
  });
  await expect(cal(page)).toBeVisible();
  expect((await calState(page)).follow).toBe(true);
}

test.describe('calendar · the day follows now (ADR 0191)', () => {
  async function openAt(page: Page, hour: number): Promise<void> {
    await openUi(page);
    // the jump starts a glide when the day view was already following; it may still be gliding
    // when the view is drawn afresh (that no longer stops the following: ADR 0210, devlog 33)
    await jumpTo(page, hour);
    await showToday(page);
  }

  test('while the tab stays open the now line and the window keep up, gliding', async ({ page }) => {
    await openAt(page, 9);
    const top0 = await hoursTop(page);
    const at0 = (await nowInWindow(page))!;
    expect(at0).toBeGreaterThan(0);
    expect(at0).toBeLessThan(0.5);
    // a few hours later (a long-open tab): the window has moved on with now
    await page.evaluate(() => window.sprout!.advance(5 * 3_600_000));
    await expect.poll(() => hoursTop(page)).toBeGreaterThan(top0 + 50);
    await expect.poll(async () => (await nowInWindow(page))!).toBeLessThan(0.5);
    expect((await nowInWindow(page))!).toBeGreaterThan(0);
    expect((await calState(page)).follow).toBe(true);
  });

  test('once the gardener scrolls the hours, the view stays where they put it (the now line still moves)', async ({ page }) => {
    await openAt(page, 9);
    const tl = cal(page).locator('.cal-timeline');
    const box = (await tl.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -200);
    await expect.poll(async () => (await calState(page)).follow).toBe(false);
    // the wheel's own scroll animation settles where the gardener put it
    await expect.poll(() => hoursAtRest(page)).toBe(true);
    const top = await hoursTop(page);
    const line0 = await page.evaluate(() => document.querySelector<HTMLElement>('.cal-now')!.style.top);
    await page.evaluate(() => window.sprout!.advance(5 * 3_600_000));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await hoursTop(page)).toBe(top);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>('.cal-now')!.style.top)).not.toBe(line0);
    // "Today" follows again
    await cal(page).getByRole('button', { name: 'Today' }).click();
    await expect.poll(async () => (await calState(page)).follow).toBe(true);
  });

  test('past midnight the day view turns to the new day, still following', async ({ page }) => {
    await openAt(page, 23);
    const before = (await calState(page)).date;
    await page.evaluate(() => window.sprout!.advance(90 * 60_000));
    await expect.poll(async () => (await calState(page)).date).not.toBe(before);
    expect((await calState(page)).date).toBe(await dayKeyIn(page));
    expect((await calState(page)).follow).toBe(true);
    const at = (await nowInWindow(page))!;
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(0.5);
  });
});

test.describe('calendar · a daylight-saving day (ADR 0210)', () => {
  // the clocks go back on Sunday 25 Oct 2026 (02:00 BST → 01:00 GMT): a 25-hour day
  test.use({ timezoneId: 'Europe/London' });

  /**
   * Jump the dev clock forward to `hhmm` on the next autumn change, the last Sunday of October
   * (25 Oct 2026; a later run lands on a later year's), built from the date so it is the wall time.
   * Returns that day's key and its length in hours.
   */
  const toAutumnChange = (page: Page, hhmm: string) =>
    page.evaluate((t) => {
      const [h, m] = t.split(':').map(Number) as [number, number];
      const now = window.sprout!.now();
      for (let y = new Date(now).getFullYear(); ; y++) {
        const day = 31 - new Date(y, 9, 31, 12).getDay();
        const at = new Date(y, 9, day, h, m).getTime();
        if (at < now) continue;
        window.sprout!.advance(at - now);
        const hours = (new Date(y, 9, day + 1).getTime() - new Date(y, 9, day).getTime()) / 3_600_000;
        return { date: `${y}-10-${day}`, hours };
      }
    }, hhmm);

  /** The now line, the hour labels and the window, in the page. */
  const face = (page: Page) =>
    page.evaluate(() => {
      const tl = document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline')!;
      const grid = tl.querySelector<HTMLElement>('.cal-grid')!;
      const line = tl.querySelector<HTMLElement>('.cal-now')!;
      const at = new Date(window.sprout!.now());
      // the 9 o'clock label sits at 9/24 of the face, as the now line at 9:00 should
      const nine = tl.querySelectorAll<HTMLElement>('.cal-hour')[8]!;
      return {
        nineAt: (parseFloat(nine.style.top) / 100) * 24,
        // the hour the now line is drawn at on the face, and the hour the clock reads
        lineAt: (parseFloat(line.style.top) / 100) * 24,
        clockAt: at.getHours() + at.getMinutes() / 60 + at.getSeconds() / 3600,
        clockHour: at.getHours(),
        // now's distance below the window's top, against the 90-minute lead it opens with (px)
        below: line.getBoundingClientRect().top - tl.getBoundingClientRect().top,
        lead: (grid.offsetHeight * 90) / 1440,
      };
    });

  async function openOnTheChange(page: Page, hhmm: string): Promise<string> {
    await openUi(page);
    const day = await toAutumnChange(page, hhmm);
    expect(day.hours).toBe(25);
    await showToday(page);
    expect((await calState(page)).date).toBe(day.date);
    return day.date;
  }

  test('the day opens at the hour the clock reads, with the now line on that hour', async ({ page }) => {
    await openOnTheChange(page, '09:00');
    const f = await face(page);
    expect(f.clockHour).toBe(9);
    expect(f.nineAt).toBe(9);
    expect(f.lineAt).toBeCloseTo(f.clockAt, 1); // 9:00, not 9:36 (10 h of a 25 h day)
    // opened an hour and a half before now, as on any other day (not 8:30 for 10 h after midnight)
    expect(Math.abs(f.below - f.lead)).toBeLessThan(3);
  });

  test('later in the day the now line stays on the clock’s hour and the window keeps up', async ({ page }) => {
    await openOnTheChange(page, '09:00');
    const top0 = await hoursTop(page);
    await page.evaluate(() => window.sprout!.advance(5 * 3_600_000));
    await expect.poll(() => hoursTop(page)).toBeGreaterThan(top0 + 50);
    await expect.poll(() => hoursAtRest(page)).toBe(true);
    const f = await face(page);
    expect(f.clockHour).toBe(14);
    expect(f.lineAt).toBeCloseTo(f.clockAt, 1);
    expect(Math.abs(f.below - f.lead)).toBeLessThan(3);
    expect((await calState(page)).follow).toBe(true);
  });

  test('following survives the hours being redrawn while they glide', async ({ page }) => {
    await openOnTheChange(page, '07:00');
    const top0 = await hoursTop(page);
    // six hours on, now has left the comfortable band and the window glides; a few frames in, the
    // view is drawn afresh (as "Today" does)
    const midGlide = await page.evaluate(async () => {
      const tl = () => document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline')!;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const task = () => new Promise((r) => setTimeout(r, 0));
      window.sprout!.advance(6 * 3_600_000);
      const from = tl().scrollTop;
      for (let i = 0; i < 60 && tl().scrollTop === from; i++) await frame(); // it eases in
      await task(); // between frames: the old timeline's last glide step has a scroll event pending
      const moved = tl().scrollTop !== from;
      window.sprout!.calendar.go(window.sprout!.now());
      return moved;
    });
    expect(midGlide).toBe(true);
    await expect.poll(() => hoursAtRest(page)).toBe(true);
    expect((await calState(page)).follow).toBe(true);
    const f1 = await face(page);
    expect(f1.lineAt).toBeCloseTo(f1.clockAt, 1);
    expect(Math.abs(f1.below - f1.lead)).toBeLessThan(3);
    // a plain redraw (the minute's, a refresh) mid-glide too
    const top1 = await hoursTop(page);
    await page.evaluate(async () => {
      const tl = () => document.querySelector<HTMLElement>('[data-section="calendar"] .cal-timeline')!;
      window.sprout!.advance(6 * 3_600_000);
      const from = tl().scrollTop;
      for (let i = 0; i < 60 && tl().scrollTop === from; i++) await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 0));
      window.sprout!.ui.refresh();
    });
    await expect.poll(() => hoursAtRest(page)).toBe(true);
    expect((await calState(page)).follow).toBe(true);
    // and it kept up: the window moved on (to the end of the day) with now (19:00) in it
    expect(top1).toBeGreaterThan(top0 + 50);
    expect(await hoursTop(page)).toBeGreaterThan(top1 + 50);
    const f2 = await face(page);
    expect(f2.clockHour).toBe(19);
    expect(f2.lineAt).toBeCloseTo(f2.clockAt, 1);
    const at = (await nowInWindow(page))!;
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(1);
  });

  test('only the gardener’s own scroll stops following: a wheel, or a key on the hours', async ({ page }) => {
    await openOnTheChange(page, '09:00');
    const tl = cal(page).locator('.cal-timeline');
    const box = (await tl.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(async () => (await calState(page)).follow).toBe(false);
    await expect.poll(() => hoursAtRest(page)).toBe(true);
    await cal(page).getByRole('button', { name: 'Today' }).click();
    await expect.poll(async () => (await calState(page)).follow).toBe(true);
    await tl.focus();
    await page.keyboard.press('PageDown');
    await expect.poll(async () => (await calState(page)).follow).toBe(false);
  });
});

test.describe('calendar · the editor speaks the calendar’s clock (ADR 0192)', () => {
  for (const locale of ['en-US', 'en-GB']) {
    test.describe(locale, () => {
      test.use({ locale });

      test(`day and time read as the calendar reads them (${locale}), by keyboard alone`, async ({ page }) => {
        await openCalendar(page);
        await cal(page).getByRole('button', { name: 'Schedule a session' }).click();
        const sheet = page.locator('dialog[data-dialog="schedule"]');
        await expect(sheet).toBeVisible();
        await sheet.getByLabel('What will you study?').fill('Essay');
        // the fields are buttons named by their label and value
        const day = sheet.getByRole('button', { name: /^day / });
        const time = sheet.getByRole('button', { name: /^time / });
        await expect(day).toHaveAttribute('aria-expanded', 'false');

        // keyboard: open the day, one week on, choose
        await day.focus();
        await page.keyboard.press('Enter');
        await expect(day).toHaveAttribute('aria-expanded', 'true');
        await expect(sheet.locator('#sched-date-panel [role="grid"]')).toBeVisible();
        const start = (await day.getAttribute('data-value'))!;
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(day).toHaveAttribute('aria-expanded', 'false');
        await expect(day).toBeFocused();
        const chosen = (await day.getAttribute('data-value'))!;
        const weekOn = await page.evaluate((d) => {
          const [y, m, dd] = d.split('-').map(Number);
          const t = new Date(y!, m! - 1, dd! + 7, 12);
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        }, start);
        expect(chosen).toBe(weekOn);

        // keyboard: open the time, the hour group takes focus; Escape folds it, not the sheet
        await time.focus();
        await page.keyboard.press('Enter');
        await expect(sheet.getByRole('radiogroup', { name: 'Hour' })).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Escape');
        await expect(time).toHaveAttribute('aria-expanded', 'false');
        await expect(sheet).toBeVisible();
        const hhmm = (await time.getAttribute('data-value'))!;

        // the field says it exactly as the calendar's own formatter does
        const expected = await page.evaluate((v) => {
          const [hr, mi] = v.split(':').map(Number);
          return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hr!, mi!));
        }, hhmm);
        await expect(time.locator('.pick-value')).toHaveText(expected);
        const twelve = locale === 'en-US';
        expect(/AM|PM/.test(expected)).toBe(twelve);
        expect(await sheet.locator('#sched-time-panel .pick-periods').count()).toBe(twelve ? 1 : 0);
        // …and the calendar's hours agree on the clock
        const rail = await cal(page).locator('.cal-hour').first().textContent();
        expect(/AM|PM/.test(rail ?? '')).toBe(twelve);

        await sheet.getByRole('button', { name: 'Save' }).click();
        await expect(sheet).toBeHidden();
        const [s] = await page.evaluate(() => window.sprout!.schedule.list());
        expect(s).toMatchObject({ name: 'Essay', date: chosen, time: hhmm });
      });
    });
  }
});

test.describe('calendar · a phone’s day with sessions side by side', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('three sessions in progress share the column with short times, and one grows to read whole when focused', async ({ page }) => {
    await openCalendar(page);
    await page.evaluate(async () => {
      window.sprout!.startSessions(3);
      window.sprout!.calendar.go(window.sprout!.now());
      await window.sprout!.ui.scrollTo('calendar', { instant: true });
    });
    const narrow = cal(page).locator('.cal-block[data-narrow]');
    await expect(narrow).toHaveCount(3);
    for (const b of await narrow.all()) {
      await expect(b).toHaveAttribute('tabindex', '0');
      expect(await b.locator('.cal-block-time').textContent()).not.toMatch(/AM|PM/);
    }
    const last = narrow.last();
    await expect(last).toHaveAttribute('data-flip', 'true');
    const before = (await last.boundingBox())!;
    await last.focus();
    await expect.poll(async () => (await last.boundingBox())!.width).toBeGreaterThan(before.width * 1.5);
    const grown = (await last.boundingBox())!;
    const tl = (await cal(page).locator('.cal-timeline').boundingBox())!;
    expect(grown.x).toBeGreaterThanOrEqual(tl.x - 1);
    expect(grown.x + grown.width).toBeLessThanOrEqual(tl.x + tl.width + 1);
    await expect(last.locator('.cal-block-meta')).toBeVisible();
  });
});

test.describe('calendar · keyboard focus survives the minute’s redraw', () => {
  test('a focused block or the focused hours keep focus when the calendar redraws', async ({ page }) => {
    await openCalendar(page);
    await page.evaluate(() => window.sprout!.schedule.demo());
    await page.evaluate(() => window.sprout!.calendar.setView('week'));
    const block = cal(page).locator('div.cal-block[tabindex="0"]').first();
    await block.focus();
    const id = await block.getAttribute('data-id');
    // the clock moves on a minute: the calendar is drawn again
    await page.evaluate(() => window.sprout!.advance(60_000));
    await expect(cal(page).locator(`.cal-block[data-id="${id}"]`)).toBeFocused();
    await cal(page).locator('.cal-timeline').focus();
    await page.evaluate(() => window.sprout!.advance(60_000));
    await expect(cal(page).locator('.cal-timeline')).toBeFocused();
  });
});

test.describe('calendar · a planned slip on a phone’s garden', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the slip above the pill and the zoom chips never overlap, zoomed in', async ({ page }) => {
    await openUi(page);
    await page.evaluate(async () => {
      const s = window.sprout!;
      s.schedule.demo();
      s.startSessions(2);
      await s.camera.settle();
    });
    const slip = page.locator('.stage-ui .due-slip');
    await expect(slip).toBeVisible();
    await expect(page.locator('.zoom-whole')).toBeVisible();
    const a = (await slip.boundingBox())!;
    for (const chip of await page.locator('.zoom-controls button:visible').all()) {
      const b = (await chip.boundingBox())!;
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, await chip.getAttribute('aria-label') ?? 'chip').toBe(false);
    }
  });
});
