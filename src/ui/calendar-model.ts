import { addDays, parseDate, type OccurrenceStatus, type OccurrenceView } from '../core/schedule';
import { dayKey, dayRange, entriesBetween, monthRange, weekRange, type TimeRange } from '../core/session-log';
import { inProgressSessions, type GardenState } from '../core/state';

/**
 * What the calendar shows, as pure data (ADR 0175): the visible range of a view, the items in it
 * (past sessions from the log, sessions still growing, scheduled occurrences — a started
 * occurrence merged into its session), the overlap layout of the day and week timelines, and the
 * month grid with its quiet marks. No DOM; `calendar.ts` draws it.
 */

export type CalendarView = 'day' | 'week' | 'month';
export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week', 'month'];

const MIN = 60_000;

/**
 * Blocks are drawn at least this long, so a 5-minute session can still be read: one line in a day,
 * two (time over title) in a week's narrow columns. The overlap layout uses the same length, so
 * blocks that *look* concurrent share the column side by side instead of drawing over each other
 * (ADR 0183).
 */
export const MIN_BLOCK_MS: Readonly<Record<'day' | 'week', number>> = { day: 26 * MIN, week: 44 * MIN };

/**
 * A start time for a week's narrow blocks: "4:10" rather than "4:10 PM" (the hour rail beside it
 * already says morning or afternoon); 24-hour locales are unchanged.
 */
export function shortTime(t: number | Date, f: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })): string {
  return f
    .formatToParts(t)
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();
}


export type ItemStatus =
  /** a past session that bloomed */
  | 'completed'
  /** a past session ended early (drawn very faintly) */
  | 'cancelled'
  /** in progress and running now */
  | 'growing'
  /** in progress, waiting (paused or left for another) */
  | 'waiting'
  | OccurrenceStatus;

export interface CalendarItem {
  /** session id, or the occurrence key */
  id: string;
  kind: 'session' | 'growing' | 'scheduled';
  status: ItemStatus;
  /** epoch ms */
  start: number;
  end: number;
  title: string;
  /** the plant (sessions); null for scheduled occurrences (chosen at start) */
  speciesId: string | null;
  seed: number | null;
  /** focused minutes (sessions) or the planned length (scheduled; null when open) */
  minutes: number | null;
  planName: string | null;
  /** the occurrence (scheduled), or the one this session was started from */
  occurrence: OccurrenceView | null;
}

/** The days a view covers: a day, a week (from `weekStartsOn`), or the whole weeks of a month grid. */
export function viewRange(view: CalendarView, t: number, weekStartsOn = 1): TimeRange {
  if (view === 'day') return dayRange(t);
  if (view === 'week') return weekRange(t, weekStartsOn);
  const m = monthRange(t);
  return { from: weekRange(m.from, weekStartsOn).from, to: weekRange(m.to - 1, weekStartsOn).to };
}

/** The anchor moved one view back (−1) or forward (+1): a day, a week, or a month (calendar maths). */
export function shiftAnchor(view: CalendarView, t: number, dir: number): number {
  const d = new Date(t);
  if (view === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir, 12).getTime();
  if (view === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * dir, 12).getTime();
  return new Date(d.getFullYear(), d.getMonth() + dir, 1, 12).getTime();
}

/** Local noon of a date key (a safe anchor inside that day). */
export function noonOf(date: string): number {
  const p = parseDate(date);
  return p ? new Date(p[0], p[1] - 1, p[2], 12).getTime() : NaN;
}

/** The date keys of a range's days, in order. */
export function daysOf(range: TimeRange): string[] {
  const out: string[] = [];
  const last = dayKey(range.to - 1);
  for (let d = dayKey(range.from), i = 0; d <= last && i < 60; d = addDays(d, 1), i++) out.push(d);
  return out;
}

/** The month grid of the month containing `t`: rows of seven date keys (whole weeks). */
export function monthGrid(t: number, weekStartsOn = 1): string[][] {
  const days = daysOf(viewRange('month', t, weekStartsOn));
  const rows: string[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

/**
 * Every item overlapping `range`: logged sessions, sessions in progress, and occurrences. An
 * occurrence started as a session is merged into that session's item (when it is in the range).
 */
export function calendarItems(
  state: Pick<GardenState, 'log' | 'session' | 'waiting'>,
  occurrences: readonly OccurrenceView[],
  range: TimeRange,
  now: number,
): CalendarItem[] {
  const bySession = new Map<string, OccurrenceView>();
  for (const o of occurrences) if (o.note?.sessionId) bySession.set(o.note.sessionId, o);
  const items: CalendarItem[] = [];
  for (const e of entriesBetween(state.log, range)) {
    items.push({
      id: e.id,
      kind: 'session',
      status: e.outcome,
      start: e.startedAt,
      end: Math.max(e.endedAt, e.startedAt + MIN),
      title: e.taskName,
      speciesId: e.speciesId,
      seed: e.seed,
      minutes: e.focusedMinutes,
      planName: e.plan?.name ?? null,
      occurrence: bySession.get(e.id) ?? null,
    });
  }
  for (const s of inProgressSessions(state)) {
    const running = state.session === s && s.pausedAt === null;
    const end = Math.max(running ? now : (s.pausedAt ?? now), s.startedAt + MIN);
    if (!(s.startedAt < range.to && end > range.from)) continue;
    items.push({
      id: s.id,
      kind: 'growing',
      status: running ? 'growing' : 'waiting',
      start: s.startedAt,
      end,
      title: s.taskName,
      speciesId: s.speciesId,
      seed: s.seed,
      minutes: Math.round(s.goalMs / MIN),
      planName: s.plan.name,
      occurrence: bySession.get(s.id) ?? null,
    });
  }
  const shown = new Set(items.map((i) => i.id));
  for (const o of occurrences) {
    if (o.note?.sessionId && shown.has(o.note.sessionId)) continue;
    items.push({
      id: o.key,
      kind: 'scheduled',
      status: o.status,
      start: o.at,
      end: o.end,
      title: o.name,
      speciesId: null,
      seed: null,
      minutes: o.lengthMinutes,
      planName: null,
      occurrence: o,
    });
  }
  return items.sort((a, b) => a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : 1));
}

/** Items overlapping the local day `date`. */
export function itemsOnDay(items: readonly CalendarItem[], date: string): CalendarItem[] {
  const r = dayRange(noonOf(date));
  return items.filter((i) => i.start < r.to && i.end > r.from);
}

export interface Placed<T> {
  item: T;
  /** column within its cluster of overlapping items */
  col: number;
  /** columns in that cluster */
  cols: number;
}

/**
 * Side-by-side layout for overlapping blocks in a timeline: clusters of transitively overlapping
 * items share a column count; each item takes the first column free at its start. Items shorter
 * than `minMs` are treated as `minMs` long (they are drawn at least that tall).
 */
export function layoutColumns<T extends { start: number; end: number }>(items: readonly T[], minMs = 0): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const p of cluster) p.cols = colEnds.length;
    cluster = [];
    colEnds = [];
  };
  for (const item of sorted) {
    const end = Math.max(item.end, item.start + minMs);
    if (item.start >= clusterEnd) {
      close();
      clusterEnd = -Infinity;
    }
    let col = colEnds.findIndex((e) => e <= item.start);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    const placed: Placed<T> = { item, col, cols: 1 };
    cluster.push(placed);
    out.push(placed);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return out;
}

/** Where a timeline block sits in its day, as fractions of the day's height (0–1). */
export function dayFraction(start: number, end: number, date: string, minMs = 0): { top: number; height: number } {
  const r = dayRange(noonOf(date));
  const span = r.to - r.from;
  const a = Math.max(start, r.from);
  const b = Math.min(Math.max(end, start + minMs), r.to);
  return { top: (a - r.from) / span, height: Math.max(0, b - a) / span };
}

/** The quiet marks of one day in the month grid. */
export interface DayMarks {
  date: string;
  /** one per bloom that started that day, in time order: species colours for the dabs */
  blooms: Array<{ speciesId: string; seed: number }>;
  /** sessions ended early (not drawn as dabs) */
  cancelled: number;
  /** focused minutes of every session that started that day */
  minutes: number;
  /** occurrences still to come or waiting (rings), and the ones that passed (faint rings) */
  planned: number;
  passed: number;
  /** a session in progress started that day */
  growing: boolean;
}

export function dayMarks(items: readonly CalendarItem[], date: string): DayMarks {
  const marks: DayMarks = { date, blooms: [], cancelled: 0, minutes: 0, planned: 0, passed: 0, growing: false };
  for (const i of items) {
    if (dayKey(i.start) !== date) continue;
    if (i.kind === 'session') {
      marks.minutes += i.minutes ?? 0;
      if (i.status === 'completed' && i.speciesId) marks.blooms.push({ speciesId: i.speciesId, seed: i.seed ?? 0 });
      else if (i.status === 'cancelled') marks.cancelled++;
    } else if (i.kind === 'growing') marks.growing = true;
    else if (i.status === 'upcoming' || i.status === 'due') marks.planned++;
    else if (i.status === 'missed' || i.status === 'dismissed') marks.passed++;
  }
  return marks;
}

/**
 * Minutes after midnight a timeline of `dates` should open at: on today, in waking hours (6:00 on),
 * an hour and a half before now; otherwise half an hour before the first item; else 8:00.
 * Clamped so the window stays inside the day.
 */
export function openingMinute(items: readonly CalendarItem[], dates: string | readonly string[], now: number, windowMinutes = 8 * 60): number {
  const list = typeof dates === 'string' ? [dates] : dates;
  const max = Math.max(0, 1440 - windowMinutes);
  const clamp = (m: number) => Math.min(max, Math.max(0, Math.round(m)));
  const today = list.find((d) => {
    const r = dayRange(noonOf(d));
    return now >= r.from && now < r.to;
  });
  if (today) {
    const m = (now - dayRange(noonOf(today)).from) / MIN;
    if (m >= 6 * 60) return clamp(m - 90);
  }
  let first = Infinity;
  for (const d of list) {
    const from = dayRange(noonOf(d)).from;
    for (const i of itemsOnDay(items, d)) first = Math.min(first, Math.max(0, (i.start - from) / MIN));
  }
  return Number.isFinite(first) ? clamp(first - 30) : clamp(8 * 60);
}

/**
 * The comfortable band of a following day window (ADR 0192), as fractions of the window's height:
 * while "now" stays between `from` and `to` the window rests; when it drifts out (time passing, a
 * long-open tab, the dev clock), the window glides so now sits `lead` minutes below its top again
 * (the same hour and a half the day opens with).
 */
export const FOLLOW = { from: 0.04, to: 0.72, leadMinutes: 90, glideMs: 1400 } as const;

/**
 * Where a day window that follows now should scroll to (px), or null to stay where it is.
 * `nowY` is now's offset in the scroller's content, `top` / `view` / `max` its scrollTop,
 * clientHeight and furthest scrollTop, `lead` the lead in px.
 */
export function followTarget(nowY: number, top: number, view: number, max: number, lead: number, band: { from: number; to: number } = FOLLOW): number | null {
  if (!(view > 0)) return null;
  if (nowY >= top + view * band.from && nowY <= top + view * band.to) return null;
  const to = Math.min(Math.max(0, max), Math.max(0, nowY - lead));
  return Math.abs(to - top) < 1 ? null : to;
}

/** An eased glide (sine in-out) from `from` to `to` at `t` of `duration` ms. */
export function glideScroll(from: number, to: number, t: number, duration: number): number {
  if (t >= duration || duration <= 0) return to;
  const k = Math.max(0, t) / duration;
  return from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * k));
}

/** The minute of the day under a tap at fraction `y` (0–1) of the timeline, snapped to 30 minutes. */
export function minuteAt(y: number, step = 30): number {
  const m = Math.floor((Math.min(0.9999, Math.max(0, y)) * 1440) / step) * step;
  return Math.min(1440 - step, m);
}

/**
 * The first day of the week for a locale (0 = Sunday, 1 = Monday …), from `Intl.Locale` week info
 * where the runtime has it; Monday otherwise.
 */
export function localeWeekStart(locale?: string): number {
  try {
    const Loc = (Intl as unknown as { Locale?: new (tag: string) => object }).Locale;
    if (!Loc || !locale) return 1;
    const l = new Loc(locale) as { getWeekInfo?: () => { firstDay?: number }; weekInfo?: { firstDay?: number } };
    const first = l.getWeekInfo?.()?.firstDay ?? l.weekInfo?.firstDay;
    return typeof first === 'number' && first >= 1 && first <= 7 ? first % 7 : 1;
  } catch {
    return 1;
  }
}

/** "50 min", "1 h", "2 h 05" — quiet and short. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}
