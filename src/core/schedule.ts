import { findPlan } from './plans';
import { isValidGoalMinutes, MINUTE_MS, normalizeTaskName } from './session';
import { dayKey, type TimeRange } from './session-log';
import type { SessionLogEntry } from './state';

/**
 * Scheduled study sessions (SPEC §13, ADRs 0170–0175): a plan to study at a local date and time,
 * with a name and optionally a length and a study plan (both may be left open and chosen when it
 * starts). Plant and spot are never chosen here: they are chosen at start, so no spot is held for
 * days (ADR 0005).
 *
 * The repeat model is **a rule plus per-occurrence notes** (ADR 0171): a schedule is one rule
 * (`date`, `time`, `repeat`, `until`) and a map of notes keyed by the occurrence's date (skipped,
 * let pass, started as a session, or edited for that day only). Occurrences are never stored;
 * `expandSchedules` lists them on the fly for any range. Dates and times are the gardener's
 * **local wall time** (`YYYY-MM-DD`, `HH:MM`), so a 9:00 daily stays at 9:00 across a DST change.
 *
 * Everything here is pure: time enters as arguments.
 */

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
export const REPEATS: readonly Repeat[] = ['none', 'daily', 'weekdays', 'weekly'];

/** What is noted about one occurrence (keyed by its date in `Schedule.notes`). */
export interface OccurrenceNote {
  /** removed ("only this one") */
  skipped?: true;
  /** let pass from the waiting card ("Not this time") */
  dismissed?: true;
  /** started: the session it became (the calendar shows it done once that session blooms) */
  sessionId?: string;
  /** edited for this day only */
  name?: string;
  time?: string;
  /** `null`: left open for this day (overrides a series length) */
  lengthMinutes?: number | null;
  planId?: string | null;
}

export interface Schedule {
  id: string;
  /** the task name the session will carry (≤ 40, empty → "Study session") */
  name: string;
  /** first occurrence, local `YYYY-MM-DD` (weekly repeats fall on its weekday) */
  date: string;
  /** local `HH:MM` */
  time: string;
  /** total minutes (10–180, step 5), or null: chosen at start */
  lengthMinutes: number | null;
  /** a plan id for `lengthMinutes` (recommendPlans), or null: chosen at start */
  planId: string | null;
  repeat: Repeat;
  /** the series ends before this local date (exclusive); null: open-ended */
  until: string | null;
  /** per-occurrence notes, keyed by the occurrence's original date */
  notes: Record<string, OccurrenceNote>;
  createdAt: number;
}

/** The fields a gardener fills in (the rest is supplied by the scheduler). */
export interface ScheduleInput {
  name: string;
  date: string;
  time: string;
  lengthMinutes?: number | null;
  planId?: string | null;
  repeat?: Repeat;
}

/** Points at one occurrence: the schedule and the occurrence's original date. */
export interface OccurrenceRef {
  scheduleId: string;
  date: string;
}

export interface Occurrence extends OccurrenceRef {
  /** `scheduleId@date`, stable */
  key: string;
  /** local start, epoch ms */
  at: number;
  /** `at` + the length (or `OPEN_LENGTH_MINUTES` when open), epoch ms — for drawing */
  end: number;
  name: string;
  time: string;
  lengthMinutes: number | null;
  planId: string | null;
  repeat: Repeat;
  /** the first occurrence of its series ("this and following" then means the whole series) */
  first: boolean;
  note: OccurrenceNote | null;
}

export type OccurrenceStatus =
  /** before its time */
  | 'upcoming'
  /** its time has come and it is waiting for one-tap Start (ADR 0172) */
  | 'due'
  /** its grace window passed without a start: quietly missed */
  | 'missed'
  /** let pass from the waiting card */
  | 'dismissed'
  /** started; the session is still in progress */
  | 'started'
  /** started and bloomed */
  | 'done'
  /** started, then ended without a bloom */
  | 'ended';

export interface OccurrenceView extends Occurrence {
  status: OccurrenceStatus;
  /** due until this moment (epoch ms), then missed */
  dueUntil: number;
}

export const OPEN_LENGTH_MINUTES = 30;
/** Grace after the planned length before an occurrence counts as missed (ADR 0172). */
export const GRACE_AFTER_MINUTES = 30;
/** The longest a scheduled occurrence can stay due: 180 + 30 minutes. */
export const MAX_DUE_MS = (180 + GRACE_AFTER_MINUTES) * MINUTE_MS;

// ---------------------------------------------------------------------------------------------
// Local calendar maths (DST-safe: dates move by calendar days, never by 24 h)
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `[y, m (1–12), d]` of a valid `YYYY-MM-DD`, else null. */
export function parseDate(key: string): [number, number, number] | null {
  const m = DATE_RE.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(y, mo - 1, d, 12);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return [y, mo, d];
}

export const isDateKey = (v: unknown): v is string => typeof v === 'string' && parseDate(v) !== null;
export const isTimeOfDay = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v);

/** Minutes after local midnight of an `HH:MM`. */
export function timeMinutes(time: string): number {
  const m = TIME_RE.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** `HH:MM` for minutes after midnight (wrapped into the day). */
export function timeOfDay(minutes: number): string {
  const v = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Epoch ms of a local date and time. A time inside a spring-forward gap lands just after it. */
export function localTime(date: string, time: string): number {
  const p = parseDate(date);
  if (!p) return NaN;
  const t = timeMinutes(time);
  return new Date(p[0], p[1] - 1, p[2], Math.floor(t / 60), t % 60).getTime();
}

/** The date `n` calendar days after `date`. */
export function addDays(date: string, n: number): string {
  const p = parseDate(date);
  if (!p) return date;
  return dayKey(new Date(p[0], p[1] - 1, p[2] + n, 12).getTime());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  const p = parseDate(date);
  return p ? new Date(p[0], p[1] - 1, p[2], 12).getDay() : 0;
}

/** Whole calendar days from `a` to `b` (DST-safe). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  if (!pa || !pb) return 0;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

// ---------------------------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------------------------

/** The rule alone: does the series have an occurrence on `date` (notes not considered)? */
export function occursOn(s: Pick<Schedule, 'date' | 'repeat' | 'until'>, date: string): boolean {
  if (date < s.date) return false;
  if (s.until !== null && date >= s.until) return false;
  switch (s.repeat) {
    case 'none':
      return date === s.date;
    case 'daily':
      return true;
    case 'weekdays': {
      const w = weekdayOf(date);
      return w >= 1 && w <= 5;
    }
    case 'weekly':
      return weekdayOf(date) === weekdayOf(s.date);
    default:
      return false;
  }
}

export const occurrenceKey = (scheduleId: string, date: string): string => `${scheduleId}@${date}`;

/** One occurrence of `s` on `date` (the rule and notes applied), or null (none, or skipped). */
export function occurrenceOn(s: Schedule, date: string): Occurrence | null {
  if (!occursOn(s, date)) return null;
  const note = s.notes[date] ?? null;
  if (note?.skipped) return null;
  const time = note?.time ?? s.time;
  const lengthMinutes = note && 'lengthMinutes' in note ? (note.lengthMinutes ?? null) : s.lengthMinutes;
  const planId = note && 'planId' in note ? (note.planId ?? null) : lengthMinutes === s.lengthMinutes ? s.planId : null;
  const at = localTime(date, time);
  return {
    scheduleId: s.id,
    date,
    key: occurrenceKey(s.id, date),
    at,
    end: at + (lengthMinutes ?? OPEN_LENGTH_MINUTES) * MINUTE_MS,
    name: note?.name ?? s.name,
    time,
    lengthMinutes,
    planId: lengthMinutes === null ? null : planId,
    repeat: s.repeat,
    first: date === s.date,
    note,
  };
}

/**
 * Every occurrence of `s` whose span `[at, end)` overlaps `range` (half-open, epoch ms), oldest
 * first. Skipped ones are left out. Walks calendar days, so it is DST-safe and cheap for the
 * ranges a calendar shows.
 */
export function expandSchedule(s: Schedule, range: TimeRange): Occurrence[] {
  if (!(range.to > range.from)) return [];
  const out: Occurrence[] = [];
  // an occurrence late the day before may run into the range; start a day early
  let date = addDays(dayKey(range.from), -1);
  if (date < s.date) date = s.date;
  const last = dayKey(range.to - 1);
  for (let guard = 0; date <= last && guard < 4000; guard++, date = addDays(date, 1)) {
    if (s.until !== null && date >= s.until) break;
    const o = occurrenceOn(s, date);
    if (o && o.at < range.to && Math.max(o.end, o.at + 1) > range.from) out.push(o);
    if (s.repeat === 'none') break;
  }
  return out;
}

/** Occurrences of every schedule overlapping `range`, by start time (then key). */
export function expandSchedules(list: readonly Schedule[], range: TimeRange): Occurrence[] {
  return list.flatMap((s) => expandSchedule(s, range)).sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// Due, missed, done
// ---------------------------------------------------------------------------------------------

/** The end of an occurrence's grace window: its length (30 min when open) plus 30 min (ADR 0172). */
export function dueUntil(o: Pick<Occurrence, 'at' | 'lengthMinutes'>): number {
  return o.at + ((o.lengthMinutes ?? OPEN_LENGTH_MINUTES) + GRACE_AFTER_MINUTES) * MINUTE_MS;
}

export interface StatusContext {
  now: number;
  /** ids of the sessions in progress */
  inProgress: ReadonlySet<string>;
  /** the session log (to tell a linked session's outcome) */
  log: readonly Pick<SessionLogEntry, 'id' | 'outcome'>[];
}

/** Where an occurrence stands (pure; derived, never stored — so it is right after a closed tab). */
export function occurrenceStatus(o: Pick<Occurrence, 'at' | 'lengthMinutes' | 'note'>, ctx: StatusContext): OccurrenceStatus {
  const linked = o.note?.sessionId;
  if (linked) {
    if (ctx.inProgress.has(linked)) return 'started';
    const e = ctx.log.find((x) => x.id === linked);
    return e?.outcome === 'completed' ? 'done' : 'ended';
  }
  if (o.note?.dismissed) return 'dismissed';
  if (ctx.now < o.at) return 'upcoming';
  return ctx.now < dueUntil(o) ? 'due' : 'missed';
}

/** Occurrences with their status, for drawing a range. */
export function viewOccurrences(list: readonly Schedule[], range: TimeRange, ctx: StatusContext): OccurrenceView[] {
  return expandSchedules(list, range).map((o) => ({ ...o, status: occurrenceStatus(o, ctx), dueUntil: dueUntil(o) }));
}

/** The occurrences waiting for one-tap Start right now, oldest first. */
export function dueOccurrences(list: readonly Schedule[], ctx: StatusContext): OccurrenceView[] {
  return viewOccurrences(list, { from: ctx.now - MAX_DUE_MS, to: ctx.now + 1 }, ctx).filter((o) => o.status === 'due');
}

/** The next occurrence starting at or after `now` that is still upcoming (dev, tips), or null. */
export function nextOccurrence(list: readonly Schedule[], now: number, horizonDays = 400): Occurrence | null {
  const found = expandSchedules(list, { from: now, to: now + horizonDays * 86_400_000 }).filter((o) => o.at >= now && !o.note?.sessionId && !o.note?.dismissed);
  return found[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Prefill (the waiting card's one-tap Start, ADR 0173)
// ---------------------------------------------------------------------------------------------

export interface StartPrefill {
  taskName: string;
  /** null: the gardener chooses the time at start */
  goalMinutes: number | null;
  /** null: the gardener chooses the plan at start */
  planId: string | null;
  /** the occurrence a session started from it links back to */
  link: OccurrenceRef;
}

/** What the start flow is prefilled with for an occurrence. */
export function startPrefill(o: Pick<Occurrence, 'scheduleId' | 'date' | 'name' | 'lengthMinutes' | 'planId'>): StartPrefill {
  const goal = o.lengthMinutes !== null && isValidGoalMinutes(o.lengthMinutes) ? o.lengthMinutes : null;
  return {
    taskName: o.name,
    goalMinutes: goal,
    planId: goal !== null && o.planId !== null && findPlan(goal, o.planId) ? o.planId : null,
    link: { scheduleId: o.scheduleId, date: o.date },
  };
}

// ---------------------------------------------------------------------------------------------
// Validation (shared by the reducer and persistence)
// ---------------------------------------------------------------------------------------------

/** Why a length/plan pair is invalid, or null. A plan needs a length it is recommended for. */
export function lengthPlanProblem(lengthMinutes: unknown, planId: unknown): string | null {
  if (lengthMinutes !== null && (typeof lengthMinutes !== 'number' || !isValidGoalMinutes(lengthMinutes))) {
    return 'length must be 10–180 minutes in steps of 5, or open';
  }
  if (planId === null) return null;
  if (typeof planId !== 'string' || planId.length === 0) return 'plan must be a plan id or open';
  if (lengthMinutes === null) return 'a plan needs a length';
  return findPlan(lengthMinutes as number, planId) ? null : `no plan "${planId}" for ${String(lengthMinutes)} minutes`;
}

/** Why a schedule is invalid, or null (notes are checked too). */
export function scheduleProblem(s: Schedule): string | null {
  if (typeof s.id !== 'string' || s.id.length === 0) return 'id';
  if (typeof s.name !== 'string' || s.name.length === 0 || s.name.length > 40) return 'name';
  if (!isDateKey(s.date)) return 'date';
  if (!isTimeOfDay(s.time)) return 'time';
  if (!REPEATS.includes(s.repeat)) return 'repeat';
  if (s.until !== null && (!isDateKey(s.until) || s.until <= s.date)) return 'until';
  if (typeof s.createdAt !== 'number' || !Number.isFinite(s.createdAt)) return 'createdAt';
  const lp = lengthPlanProblem(s.lengthMinutes, s.planId);
  if (lp) return lp;
  if (typeof s.notes !== 'object' || s.notes === null) return 'notes';
  for (const [date, note] of Object.entries(s.notes)) {
    if (!isDateKey(date)) return `notes.${date}`;
    const p = noteProblem(note);
    if (p) return `notes.${date}: ${p}`;
  }
  return null;
}

/** Why an occurrence note is invalid, or null. */
export function noteProblem(n: OccurrenceNote): string | null {
  if (typeof n !== 'object' || n === null) return 'not an object';
  if (n.skipped !== undefined && n.skipped !== true) return 'skipped';
  if (n.dismissed !== undefined && n.dismissed !== true) return 'dismissed';
  if (n.sessionId !== undefined && (typeof n.sessionId !== 'string' || n.sessionId.length === 0)) return 'sessionId';
  if (n.name !== undefined && (typeof n.name !== 'string' || n.name.length === 0 || n.name.length > 40)) return 'name';
  if (n.time !== undefined && !isTimeOfDay(n.time)) return 'time';
  if ('lengthMinutes' in n || 'planId' in n) {
    const p = lengthPlanProblem(n.lengthMinutes ?? null, n.planId ?? null);
    if (p) return p;
  }
  return null;
}

/** A schedule from what the gardener filled in (name normalised); null when invalid. */
export function makeSchedule(id: string, input: ScheduleInput, createdAt: number): Schedule | null {
  const lengthMinutes = input.lengthMinutes ?? null;
  const s: Schedule = {
    id,
    name: normalizeTaskName(input.name),
    date: input.date,
    time: input.time,
    lengthMinutes,
    planId: lengthMinutes === null ? null : (input.planId ?? null),
    repeat: input.repeat ?? 'none',
    until: null,
    notes: {},
    createdAt,
  };
  return scheduleProblem(s) === null ? s : null;
}

/** Notes kept only where the (new) rule still has an occurrence. */
export function pruneNotes(s: Schedule): Record<string, OccurrenceNote> {
  const out: Record<string, OccurrenceNote> = {};
  for (const [date, note] of Object.entries(s.notes)) if (occursOn(s, date)) out[date] = note;
  return out;
}

const cleanNote = (n: OccurrenceNote): OccurrenceNote | null => {
  const out: OccurrenceNote = {};
  if (n.skipped) out.skipped = true;
  if (n.dismissed) out.dismissed = true;
  if (n.sessionId) out.sessionId = n.sessionId;
  if (n.name !== undefined) out.name = n.name;
  if (n.time !== undefined) out.time = n.time;
  if ('lengthMinutes' in n) out.lengthMinutes = n.lengthMinutes ?? null;
  if ('planId' in n) out.planId = n.planId ?? null;
  return Object.keys(out).length > 0 ? out : null;
};

/** `notes` with the note for `date` replaced (null or empty removes it). */
export function withNote(notes: Record<string, OccurrenceNote>, date: string, note: OccurrenceNote | null): Record<string, OccurrenceNote> {
  const next = { ...notes };
  const clean = note ? cleanNote(note) : null;
  if (clean) next[date] = clean;
  else delete next[date];
  return next;
}
