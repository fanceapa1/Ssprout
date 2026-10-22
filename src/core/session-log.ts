import type { PlantInstance, SessionLogEntry } from './state';

/**
 * The session log (ADR 0151): the history of ended sessions, for the calendar (phase 8) and
 * anything else that looks back. `GardenState.log` is append-only and oldest first; entries are
 * written by the reducer on `session/complete` and `session/cancel` (`logEntry` in state.ts).
 *
 * Queries are pure. Ranges are half-open `[from, to)` in epoch ms; the day / week / month helpers
 * use the **local** calendar of the runtime (the user's own days), like the plant labels.
 * An entry belongs to a range when its wall-clock span `[startedAt, endedAt]` overlaps it, so a
 * session across midnight shows on both days; `dayKey(entry.startedAt)` is "the day it started"
 * (SPEC §3 plant labels) when a single day is needed.
 */

export type LogOutcome = SessionLogEntry['outcome'];

export interface TimeRange {
  /** inclusive, epoch ms */
  from: number;
  /** exclusive, epoch ms */
  to: number;
}

export interface LogQuery {
  /** only this outcome (default: both) */
  outcome?: LogOutcome;
}

/**
 * Entries whose span `[startedAt, endedAt)` overlaps `[from, to)`, in log order (oldest first).
 * A session ending exactly at midnight is not on the next day; an instant one counts where it is.
 */
export function entriesBetween(log: readonly SessionLogEntry[], range: TimeRange, q: LogQuery = {}): SessionLogEntry[] {
  return log.filter(
    (e) => (q.outcome === undefined || e.outcome === q.outcome) && e.startedAt < range.to && Math.max(e.endedAt, e.startedAt + 1) > range.from,
  );
}

/** The local day containing `t`. */
export function dayRange(t: number): TimeRange {
  const d = new Date(t);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { from, to };
}

/** The local week containing `t`, starting on `weekStartsOn` (0 = Sunday, 1 = Monday, default). */
export function weekRange(t: number, weekStartsOn = 1): TimeRange {
  const d = new Date(t);
  const back = (d.getDay() - weekStartsOn + 7) % 7;
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back + 7).getTime();
  return { from, to };
}

/** The local calendar month containing `t`. */
export function monthRange(t: number): TimeRange {
  const d = new Date(t);
  return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
}

export const entriesOnDay = (log: readonly SessionLogEntry[], t: number, q?: LogQuery) => entriesBetween(log, dayRange(t), q);
export const entriesInWeek = (log: readonly SessionLogEntry[], t: number, q?: LogQuery & { weekStartsOn?: number }) =>
  entriesBetween(log, weekRange(t, q?.weekStartsOn), q);
export const entriesInMonth = (log: readonly SessionLogEntry[], t: number, q?: LogQuery) => entriesBetween(log, monthRange(t), q);

/** `YYYY-MM-DD` of the local day containing `t`. */
export function dayKey(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Entries grouped by the local day they started on (`dayKey`), keys in chronological order. */
export function groupByDay(entries: readonly SessionLogEntry[]): Map<string, SessionLogEntry[]> {
  const out = new Map<string, SessionLogEntry[]>();
  for (const e of [...entries].sort((a, b) => a.startedAt - b.startedAt)) {
    const k = dayKey(e.startedAt);
    const list = out.get(k);
    if (list) list.push(e);
    else out.set(k, [e]);
  }
  return out;
}

/** Sum of `focusedMinutes` (by default completed and cancelled alike). */
export function focusedMinutes(entries: readonly SessionLogEntry[], q: LogQuery = {}): number {
  return entries.reduce((n, e) => (q.outcome === undefined || e.outcome === q.outcome ? n + e.focusedMinutes : n), 0);
}

/**
 * History reconstructed from finished plants (the v1 → v2 migration; v1 kept no log). The plan
 * was not stored, so `plan` is null and `focusedMinutes` is the session total (its breaks are
 * unknown). Cancelled sessions and plants already pressed left nothing to rebuild from.
 */
export function backfillLog(plants: readonly PlantInstance[]): SessionLogEntry[] {
  return plants
    .map<SessionLogEntry>((p) => ({
      id: p.id,
      outcome: 'completed',
      taskName: p.taskName,
      speciesId: p.speciesId,
      slotId: p.slotId,
      seed: p.seed,
      plan: null,
      goalMinutes: p.sessionMinutes,
      focusedMinutes: p.sessionMinutes,
      startedAt: p.plantedAt,
      endedAt: Math.max(p.completedAt, p.plantedAt),
      backfilled: true,
    }))
    .sort((a, b) => a.endedAt - b.endedAt);
}
