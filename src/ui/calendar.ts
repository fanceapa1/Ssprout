import './calendar.css';
import { timeOfDay, type OccurrenceView } from '../core/schedule';
import type { Scheduler } from '../core/schedule-controller';
import { dayKey, focusedMinutes } from '../core/session-log';
import { installCalendarArt, CHEVRON, chevronSvg, washBackground, washTone } from './calendar-art';
import {
  CALENDAR_VIEWS,
  calendarItems,
  dayFraction,
  dayMarks,
  daysOf,
  FOLLOW,
  followTarget,
  formatMinutes,
  glideScroll,
  itemsOnDay,
  layoutColumns,
  localeWeekStart,
  MIN_BLOCK_MS,
  minuteAt,
  monthGrid,
  noonOf,
  openingMinute,
  shiftAnchor,
  shortTime,
  viewRange,
  type CalendarItem,
  type CalendarView,
} from './calendar-model';
import type { UIContext } from './context';
import { fragment, h, setText } from './dom';
import { keyDirection } from './smooth-scroll';

/**
 * The Calendar section of the dock (SPEC §13, ADR 0175): a Daily / Weekly / Monthly toggle (daily
 * by default, the last choice remembered per viewer), prev / Today / next, and a painted view of
 * what was studied, what is growing and what is planned. Day and week are an hour timeline with
 * soft washes in each plant's colour; the month is a grid of quiet pigment dabs. A tap on an empty
 * time (or "Schedule a session") opens the schedule editor; a planned block opens it to edit.
 *
 * Today's day view follows now (ADR 0192): while the tab stays open the now line moves and the
 * window glides on before now leaves it, and past midnight it turns to the new day — unless the
 * gardener scrolled the hours themselves; then it stays put until "Today" or another day is opened.
 */

export interface CalendarDeps {
  scheduler: Scheduler;
  /** open the schedule editor for a new session at a date and time, or for an occurrence */
  edit(target: { date: string; time: string } | { occurrence: OccurrenceView }, opener: HTMLElement | null): void;
  /** per-viewer storage for the chosen view (default: localStorage, guarded) */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** first day of the week (default: from the locale, else Monday) */
  weekStartsOn?: number;
}

export interface CalendarItemState {
  id: string;
  kind: CalendarItem['kind'];
  status: string;
  date: string;
  title: string;
  occurrence: string | null;
  occurrenceStatus: string | null;
}

export interface CalendarState {
  view: CalendarView;
  /** the anchor day, `YYYY-MM-DD` */
  date: string;
  weekStartsOn: number;
  title: string;
  /** the days on screen */
  days: string[];
  items: CalendarItemState[];
  /** today's day window follows now (until the gardener scrolls it, ADR 0192) */
  follow: boolean;
}

export interface Calendar {
  readonly el: HTMLElement;
  render(): void;
  setView(view: CalendarView): void;
  /** show the day containing `date` (a key or epoch ms), keeping the view */
  go(date: string | number): void;
  state(): CalendarState;
  dispose(): void;
}

export const VIEW_KEY = 'studysprout:calendar-view';
const VIEW_WORDS: Record<CalendarView, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const UNIT: Record<CalendarView, string> = { day: 'day', week: 'week', month: 'month' };
const MIN = 60_000;

const defaultStorage = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

function readView(storage: Pick<Storage, 'getItem'> | null): CalendarView {
  try {
    const v = storage?.getItem(VIEW_KEY);
    return (CALENDAR_VIEWS as readonly string[]).includes(v ?? '') ? (v as CalendarView) : 'day';
  } catch {
    return 'day';
  }
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o);
const F = {
  time: fmt({ hour: 'numeric', minute: '2-digit' }),
  hour: fmt({ hour: 'numeric' }),
  dayTitle: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  dayShort: fmt({ day: 'numeric', month: 'long' }),
  month: fmt({ month: 'long', year: 'numeric' }),
  weekday: fmt({ weekday: 'short' }),
  weekdayNarrow: fmt({ weekday: 'narrow' }),
  dayNum: fmt({ day: 'numeric' }),
  full: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
};

/** "19 – 25 October" (or across months). */
function weekTitle(days: string[]): string {
  const a = new Date(noonOf(days[0]!));
  const b = new Date(noonOf(days[days.length - 1]!));
  const range = (F.dayShort as Intl.DateTimeFormat & { formatRange?(x: Date, y: Date): string }).formatRange;
  return typeof range === 'function' ? range.call(F.dayShort, a, b) : `${F.dayShort.format(a)} – ${F.dayShort.format(b)}`;
}

const hash = (s: string): number => {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(x);
};

export function createCalendar(ctx: UIContext, deps: CalendarDeps): Calendar {
  const { store, clock, getSpecies } = ctx.deps;
  const { scheduler } = deps;
  installCalendarArt();
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const weekStartsOn =
    deps.weekStartsOn ?? localeWeekStart(typeof navigator === 'undefined' ? undefined : navigator.language);

  let view: CalendarView = readView(storage);
  let anchor = noonOf(dayKey(clock.now()));
  let current: CalendarState = { view, date: dayKey(anchor), weekStartsOn, title: '', days: [], items: [], follow: false };
  /** the view/day the timeline was last opened at (it scrolls to a sensible window only then) */
  let openedFor = '';
  /** today's day window keeps up with now (ADR 0192) */
  let follow = false;
  /** where we last put the hours' scroll (a scroll elsewhere is the gardener's) */
  let lastSet = 0;
  /** a gentle glide of the hours in progress */
  let glide: { from: number; to: number; start: number } | null = null;
  let glideRaf: number | null = null;
  const reduced = () => ctx.deps.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ── header ─────────────────────────────────────────────────────────────────────────────
  const viewButtons = CALENDAR_VIEWS.map((v) =>
    h('button.cal-view', { type: 'button', 'data-view': v, 'aria-pressed': String(v === view), onclick: () => setView(v) }, VIEW_WORDS[v]),
  );
  const prev = h('button.cal-step', { type: 'button', onclick: () => step(-1) }, fragment(chevronSvg(CHEVRON.prev)));
  const next = h('button.cal-step', { type: 'button', onclick: () => step(1) }, fragment(chevronSvg(CHEVRON.next)));
  const todayBtn = h('button.quiet.cal-today', { type: 'button', onclick: () => go(clock.now()) }, 'Today');
  const title = h('h3.cal-title', { 'aria-live': 'polite' });
  const add = h(
    'button.quiet.cal-add',
    { type: 'button', 'data-anchor': 'schedule-add', onclick: () => newAt(addDefault(), add) },
    h('span.cal-add-seal', { 'aria-hidden': 'true' }),
    'Schedule a session',
  );
  const head = h(
    'div.cal-head',
    {},
    h('div.cal-views', { role: 'group', 'aria-label': 'Calendar view' }, ...viewButtons),
    h('div.cal-nav', {}, prev, todayBtn, next),
    add,
  );
  const summary = h('p.cal-summary');
  const body = h('div.cal-body');
  const el = h('div.calendar', { 'data-view': view }, head, h('div.cal-caption', {}, title, summary), body);

  /** Today at the next half hour, or the anchor day at 9:00. */
  function addDefault(): { date: string; time: string } {
    const now = clock.now();
    const today = dayKey(now);
    const date = view === 'day' ? dayKey(anchor) : today;
    if (date !== today) return { date, time: '09:00' };
    const d = new Date(now);
    const m = Math.min(23 * 60 + 30, Math.ceil((d.getHours() * 60 + d.getMinutes() + 1) / 30) * 30);
    return { date, time: timeOfDay(m) };
  }

  function newAt(at: { date: string; time: string }, opener: HTMLElement | null): void {
    deps.edit(at, opener);
  }

  function setView(v: CalendarView): void {
    if (v === view) return;
    view = v;
    openedFor = '';
    try {
      storage?.setItem(VIEW_KEY, v);
    } catch {
      /* private mode: the choice lasts for this page */
    }
    render();
    ctx.changed();
  }

  function go(date: string | number): void {
    anchor = noonOf(typeof date === 'number' ? dayKey(date) : date);
    openedFor = ''; // asked for a day: open its window afresh (today's follows now again)
    render();
  }

  function step(dir: number): void {
    anchor = shiftAnchor(view, anchor, dir);
    render();
  }

  // ── items ──────────────────────────────────────────────────────────────────────────────
  function blockLabel(i: CalendarItem): string {
    const when = `${F.time.format(i.start)}`;
    const plant = i.speciesId ? (getSpecies(i.speciesId)?.name ?? 'a plant') : null;
    switch (i.status) {
      case 'completed':
        return `${i.title}, ${when}, ${formatMinutes(i.minutes ?? 0)} — ${plant} bloomed${i.occurrence ? ', as planned' : ''}`;
      case 'cancelled':
        return `${i.title}, ${when}, ended early`;
      case 'growing':
        return `${i.title}, since ${when} — ${plant} growing now`;
      case 'waiting':
        return `${i.title}, since ${when} — ${plant} waiting`;
      case 'due':
        return `${i.title}, planned for ${when} — its time has come`;
      case 'missed':
      case 'dismissed':
        return `${i.title}, planned for ${when}, passed`;
      default:
        return `${i.title}, planned for ${when}${i.minutes ? `, ${formatMinutes(i.minutes)}` : ''}`;
    }
  }

  function metaOf(i: CalendarItem): string {
    if (i.kind === 'scheduled') {
      if (i.status === 'missed' || i.status === 'dismissed') return 'passed';
      if (i.status === 'due') return 'now';
      if (i.status === 'ended') return 'ended early';
      return i.minutes ? formatMinutes(i.minutes) : 'time open';
    }
    const plant = i.speciesId ? (getSpecies(i.speciesId)?.name ?? '') : '';
    if (i.status === 'cancelled') return 'ended early';
    if (i.status === 'growing') return `${plant} · growing`;
    if (i.status === 'waiting') return `${plant} · waiting`;
    return `${plant} · ${formatMinutes(i.minutes ?? 0)}`;
  }

  /** Roughly how big things are on screen (for washes painted near their size). */
  let metrics = { colPx: 900, hourPx: 56 };
  function measure(days: number): void {
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    const px = (name: string, fallback: number) => {
      const v = parseFloat(cs?.getPropertyValue(name) ?? '');
      return Number.isFinite(v) && v > 0 ? v : fallback;
    };
    const width = el.clientWidth || 960;
    const rail = px('--cal-rail', 58);
    metrics = { colPx: Math.max(30, (width - rail) / days - 6), hourPx: px('--cal-hour', 56) };
  }

  function block(i: CalendarItem, date: string, col: number, cols: number, days: readonly string[]): HTMLElement {
    const week = days.length > 1;
    const minMs = MIN_BLOCK_MS[week ? 'week' : 'day'];
    const f = dayFraction(i.start, i.end, date, minMs);
    const len = (i.end - i.start) / MIN;
    const size = len < 40 ? 's' : len < 80 ? 'm' : 'l';
    const interactive = i.kind === 'scheduled';
    const variant = hash(i.id);
    // position as custom properties: CSS places the block, and lets a narrow one grow while
    // hovered or focused (to the left when it sits at the end of the week)
    const style: Record<string, string> = {
      '--t': `${(f.top * 100).toFixed(4)}%`,
      '--h': `${(f.height * 100).toFixed(4)}%`,
      '--l': `${((col / cols) * 100).toFixed(3)}%`,
      '--w': `${(100 / cols).toFixed(3)}%`,
    };
    const w = metrics.colPx / cols;
    const hpx = (Math.max(minMs, i.end - i.start) / (60 * MIN)) * metrics.hourPx;
    if (i.speciesId) {
      const color = getSpecies(i.speciesId)?.bloomColor ?? '#8b9c5a';
      style['--wash'] = washBackground(color, variant, i.status === 'cancelled' ? 'faint' : i.kind === 'growing' ? 'growing' : 'bloom', w, hpx);
    } else {
      const ghost = i.status === 'missed' || i.status === 'dismissed' || i.status === 'ended';
      style['--plan'] = washBackground('', variant, ghost ? 'ghost' : 'plan', w, hpx);
    }
    const attrs: Record<string, unknown> = {
      style,
      'data-kind': i.kind,
      'data-status': i.status,
      'data-id': i.id,
      'data-size': size,
      'data-occurrence': i.occurrence?.key,
      'data-occurrence-status': i.occurrence && i.kind !== 'scheduled' ? i.occurrence.status : undefined,
      'data-narrow': week && cols > 1 ? 'true' : undefined,
      // the last days of a week grow leftwards when expanded, so they stay inside the timeline
      'data-flip': week && days.length - 1 - days.indexOf(date) < 2 ? 'true' : undefined,
      'aria-label': blockLabel(i),
      title: blockLabel(i),
    };
    // the seal for "now" (due, growing) sits in the line before the time, never over the words
    const dot = i.status === 'due' || i.status === 'growing' ? h('span.cal-block-dot', { 'aria-hidden': 'true' }) : null;
    const content = [
      h(
        'span.cal-block-line',
        { 'aria-hidden': 'true' },
        h('span.cal-block-time', {}, dot, week ? shortTime(i.start, F.time) : F.time.format(i.start)),
        h('span.cal-block-title', {}, i.title),
      ),
      h('span.cal-block-meta', { 'aria-hidden': 'true' }, metaOf(i)),
      i.occurrence && i.kind !== 'scheduled' ? h('span.cal-block-planned', { 'aria-hidden': 'true' }, i.occurrence.status === 'done' ? 'as planned' : 'planned') : null,
    ];
    if (interactive) {
      const occ = i.occurrence!;
      const b = h('button.cal-block', { ...attrs, type: 'button' }, ...content);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        deps.edit({ occurrence: occ }, b);
      });
      return b;
    }
    // in a week, a block can be focused to read it whole (it grows like on hover)
    return h('div.cal-block', { ...attrs, role: 'img', tabindex: week ? 0 : undefined }, ...content);
  }

  /** One day column of the timeline. */
  function column(date: string, items: CalendarItem[], now: number, days: readonly string[]): HTMLElement {
    const col = h('div.cal-col', { 'data-date': date, 'data-today': String(date === dayKey(now)) });
    const placed = layoutColumns(items, MIN_BLOCK_MS[days.length > 1 ? 'week' : 'day']);
    for (const p of placed) col.appendChild(block(p.item, date, p.col, p.cols, days));
    if (date === dayKey(now)) {
      const f = dayFraction(now, now, date);
      col.appendChild(h('div.cal-now', { style: { top: `${(f.top * 100).toFixed(4)}%` }, 'aria-hidden': 'true' }));
    }
    col.addEventListener('click', (e) => {
      if (e.target !== col) return;
      const r = col.getBoundingClientRect();
      const y = r.height > 0 ? (e.clientY - r.top) / r.height : 0;
      newAt({ date, time: timeOfDay(minuteAt(y)) }, add);
    });
    return col;
  }

  function hoursRail(): HTMLElement {
    const rail = h('div.cal-hours', { 'aria-hidden': 'true' });
    for (let hr = 1; hr < 24; hr++) {
      rail.appendChild(h('span.cal-hour', { style: { top: `${((hr / 24) * 100).toFixed(4)}%` } }, F.hour.format(new Date(2026, 0, 1, hr))));
    }
    return rail;
  }

  function timeline(days: string[], items: CalendarItem[], now: number): HTMLElement {
    const scroller = h('div.cal-timeline', { tabindex: 0, role: 'group', 'aria-label': days.length === 1 ? 'Hours of the day' : 'Hours of the week' });
    // the gardener moving the hours themselves: the window stops following now (ADR 0192)
    const mine = () => {
      follow = false;
      stopGlide();
    };
    scroller.addEventListener('wheel', mine, { passive: true });
    scroller.addEventListener('touchmove', mine, { passive: true });
    scroller.addEventListener('keydown', (e) => {
      if (keyDirection(e.key, e.shiftKey) !== 0) mine();
    });
    scroller.addEventListener(
      'scroll',
      () => {
        if (glide === null && Math.abs(scroller.scrollTop - lastSet) > 2) follow = false;
      },
      { passive: true },
    );
    const cols = h('div.cal-cols', { 'data-days': days.length });
    for (const d of days) cols.appendChild(column(d, itemsOnDay(items, d), now, days));
    scroller.appendChild(h('div.cal-grid', {}, hoursRail(), cols));
    return scroller;
  }

  function weekHead(days: string[], now: number): HTMLElement {
    const row = h('div.cal-weekhead');
    row.appendChild(h('span.cal-weekhead-gap', { 'aria-hidden': 'true' }));
    for (const d of days) {
      const t = noonOf(d);
      row.appendChild(
        h(
          'button.cal-dayhead',
          { type: 'button', 'data-date': d, 'data-today': String(d === dayKey(now)), 'aria-label': `Open ${F.full.format(t)}`, onclick: () => openDay(d) },
          h('span.cal-dayhead-name', {}, F.weekday.format(t)),
          h('span.cal-dayhead-num', {}, F.dayNum.format(t)),
        ),
      );
    }
    return row;
  }

  function openDay(date: string): void {
    anchor = noonOf(date);
    if (view !== 'day') setView('day');
    else render();
    body.querySelector<HTMLElement>('.cal-timeline')?.focus({ preventScroll: true });
  }

  function month(items: CalendarItem[], now: number): HTMLElement {
    const grid = monthGrid(anchor, weekStartsOn);
    const thisMonth = new Date(anchor).getMonth();
    const wrap = h('div.cal-month');
    const names = h('div.cal-weekdays', { 'aria-hidden': 'true' });
    for (const d of grid[0]!) names.appendChild(h('span', {}, F.weekday.format(noonOf(d))));
    wrap.appendChild(names);
    const weeks = h('div.cal-weeks');
    for (const row of grid) {
      for (const d of row) {
        const t = noonOf(d);
        const marks = dayMarks(items, d);
        const other = new Date(t).getMonth() !== thisMonth;
        const dabs = h('span.cal-dabs', { 'aria-hidden': 'true' });
        marks.blooms.slice(0, 5).forEach((b, i) => {
          const [r, g, bl] = washTone(getSpecies(b.speciesId)?.bloomColor ?? '#8b9c5a');
          dabs.appendChild(h('span.cal-dab', { style: { '--dab': `rgb(${r}, ${g}, ${bl})`, '--tilt': `${((b.seed % 7) - 3) * 9 + i * 5}deg` } }));
        });
        if (marks.blooms.length > 5) dabs.appendChild(h('span.cal-dab-more', {}, `+${marks.blooms.length - 5}`));
        if (marks.growing) dabs.appendChild(h('span.cal-dab.is-growing'));
        for (let i = 0; i < Math.min(3, marks.planned); i++) dabs.appendChild(h('span.cal-ring'));
        for (let i = 0; i < Math.min(3, marks.passed); i++) dabs.appendChild(h('span.cal-ring.is-passed'));
        const parts = [
          F.full.format(t),
          marks.blooms.length ? `${marks.blooms.length} bloomed` : '',
          marks.minutes ? `${formatMinutes(marks.minutes)} studied` : '',
          marks.planned ? `${marks.planned} planned` : '',
        ].filter(Boolean);
        weeks.appendChild(
          h(
            'button.cal-day',
            {
              type: 'button',
              'data-date': d,
              'data-today': String(d === dayKey(now)),
              'data-other': String(other),
              'data-blooms': marks.blooms.length,
              'aria-label': parts.join(', '),
              onclick: () => openDay(d),
            },
            h('span.cal-daynum', {}, F.dayNum.format(t)),
            dabs,
            h('span.cal-mins', {}, marks.minutes ? formatMinutes(marks.minutes) : ''),
          ),
        );
      }
    }
    wrap.appendChild(weeks);
    return wrap;
  }

  // ── following now (ADR 0192) ──────────────────────────────────────────────────────────────
  function minuteOfDay(t: number): number {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
  /** now's offset in the hours' scroller (px), from the grid's own box */
  function nowOffset(tl: HTMLElement, now: number): number {
    const grid = tl.querySelector<HTMLElement>('.cal-grid');
    const top = grid?.offsetTop ?? 0;
    const height = grid?.offsetHeight || tl.scrollHeight;
    return top + (minuteOfDay(now) / 1440) * height;
  }
  function nowInWindow(tl: HTMLElement, now: number): boolean {
    const y = nowOffset(tl, now);
    return y >= tl.scrollTop && y <= tl.scrollTop + tl.clientHeight;
  }
  /** glide the window on when now is about to leave it */
  function keepUp(tl: HTMLElement, now: number): void {
    const grid = tl.querySelector<HTMLElement>('.cal-grid');
    const lead = ((grid?.offsetHeight || tl.scrollHeight) * FOLLOW.leadMinutes) / 1440;
    const to = followTarget(nowOffset(tl, now), tl.scrollTop, tl.clientHeight, tl.scrollHeight - tl.clientHeight, lead);
    if (to === null) return;
    if (glide && Math.abs(glide.to - to) < 1) return;
    if (reduced() || typeof requestAnimationFrame !== 'function') {
      stopGlide();
      tl.scrollTop = to;
      lastSet = tl.scrollTop;
      return;
    }
    glide = { from: tl.scrollTop, to, start: typeof performance === 'undefined' ? Date.now() : performance.now() };
    glideRaf ??= requestAnimationFrame(stepGlide);
  }
  function stepGlide(ts: number): void {
    glideRaf = null;
    const tl = body.querySelector<HTMLElement>('.cal-timeline');
    if (!glide || !tl) return void (glide = null);
    const y = glideScroll(glide.from, glide.to, ts - glide.start, FOLLOW.glideMs);
    tl.scrollTop = y;
    lastSet = tl.scrollTop;
    if (y === glide.to) glide = null;
    else glideRaf = requestAnimationFrame(stepGlide);
  }
  function stopGlide(): void {
    glide = null;
    if (glideRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(glideRaf);
    glideRaf = null;
  }

  // ── render ─────────────────────────────────────────────────────────────────────────────
  function render(): void {
    const now = clock.now();
    // following today past midnight: turn to the new day, still following
    let rolled = false;
    if (follow && view === 'day' && dayKey(anchor) !== dayKey(now) && dayKey(anchor) < dayKey(now)) {
      anchor = noonOf(dayKey(now));
      openedFor = '';
      rolled = true;
    }
    const state = store.get();
    const range = viewRange(view, anchor, weekStartsOn);
    const occurrences = scheduler.occurrences(range);
    const items = calendarItems(state, occurrences, range, now);
    const days = view === 'month' ? daysOf(range) : view === 'week' ? daysOf(range) : [dayKey(anchor)];

    el.dataset.view = view;
    for (const b of viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    prev.setAttribute('aria-label', `Previous ${UNIT[view]}`);
    next.setAttribute('aria-label', `Next ${UNIT[view]}`);
    const text = view === 'day' ? F.dayTitle.format(anchor) : view === 'week' ? weekTitle(days) : F.month.format(anchor);
    setText(title, text);
    const inView = view === 'month' ? items.filter((i) => new Date(i.start).getMonth() === new Date(anchor).getMonth()) : items;
    const sessions = inView.filter((i) => i.kind === 'session');
    const bloomed = sessions.filter((i) => i.status === 'completed').length;
    const minutes = focusedMinutes(state.log.filter((e) => sessions.some((s) => s.id === e.id)));
    const planned = inView.filter((i) => i.kind === 'scheduled' && (i.status === 'upcoming' || i.status === 'due')).length;
    const bits = [
      bloomed ? `${bloomed} ${bloomed === 1 ? 'bloom' : 'blooms'}` : '',
      minutes ? `${formatMinutes(minutes)} studied` : '',
      planned ? `${planned} planned` : '',
    ].filter(Boolean);
    setText(summary, bits.join(' · '));

    measure(view === 'week' ? 7 : 1);
    const timelineBefore = body.querySelector<HTMLElement>('.cal-timeline');
    const keepScroll = timelineBefore?.scrollTop ?? 0;
    body.replaceChildren();
    if (view === 'month') body.appendChild(month(items, now));
    else {
      if (view === 'week') body.appendChild(weekHead(days, now));
      const tl = timeline(days, items, now);
      body.appendChild(tl);
      if (items.length === 0) body.appendChild(h('p.cal-empty', {}, view === 'day' ? 'A quiet day. Tap a time to plan a session.' : 'A quiet week. Tap a time to plan a session.'));
      const openKey = `${view}|${days[0]}`;
      const isToday = view === 'day' && days[0] === dayKey(now);
      const fit = () => {
        if (openedFor !== openKey) {
          // a day follows now; a week opens on its earliest work
          stopGlide();
          const m = rolled ? Math.max(0, minuteOfDay(now) - FOLLOW.leadMinutes) : openingMinute(items, days, view === 'day' ? now : NaN);
          tl.scrollTop = (m / 1440) * tl.scrollHeight;
          lastSet = tl.scrollTop;
          if (tl.scrollHeight > 0) {
            openedFor = openKey;
            follow = isToday && nowInWindow(tl, now);
          }
        } else {
          tl.scrollTop = keepScroll;
          lastSet = tl.scrollTop;
          if (follow && isToday) keepUp(tl, now);
        }
      };
      fit();
      if (tl.scrollHeight === 0 && typeof requestAnimationFrame === 'function') requestAnimationFrame(fit);
    }

    current = {
      view,
      date: dayKey(anchor),
      weekStartsOn,
      title: text,
      days,
      follow,
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        status: i.status,
        date: dayKey(i.start),
        title: i.title,
        occurrence: i.occurrence?.key ?? null,
        occurrenceStatus: i.occurrence?.status ?? null,
      })),
    };
  }

  // the now line moves and growing blocks lengthen; time comes from the clock, this only re-reads it
  let lastMinute = Math.floor(clock.now() / MIN);
  const timer = setInterval(() => {
    const m = Math.floor(clock.now() / MIN);
    if (m === lastMinute) return;
    lastMinute = m;
    if (el.isConnected) render();
  }, 15_000);

  render();
  return {
    el,
    render,
    setView,
    go,
    state: () => ({ ...current, follow }),
    dispose() {
      clearInterval(timer);
      stopGlide();
    },
  };
}
