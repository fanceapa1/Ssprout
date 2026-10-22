import {
  noteProblem,
  occursOn,
  pruneNotes,
  scheduleProblem,
  withNote,
  type OccurrenceNote,
  type Schedule,
} from './schedule';
import { normalizeTaskName } from './session';

/**
 * Schedule actions (ADR 0171): pure, validated, and like every reducer in core a no-op returning
 * the same reference when invalid. Ids and times come in the action (the scheduler supplies them).
 */

/** The rule's editable fields. */
export type SchedulePatch = Partial<Pick<Schedule, 'name' | 'date' | 'time' | 'lengthMinutes' | 'planId' | 'repeat' | 'until'>>;

export type ScheduleAction =
  /** add a schedule (validated; the id must be new) */
  | { type: 'schedule/add'; schedule: Schedule }
  /** edit the whole series (notes on dates the new rule no longer has are dropped) */
  | { type: 'schedule/update'; id: string; patch: SchedulePatch }
  | { type: 'schedule/remove'; id: string }
  /** replace the note of one occurrence (`date` must be one the rule has); null clears it */
  | { type: 'schedule/note'; id: string; date: string; note: OccurrenceNote | null }
  /**
   * "This and following": the series ends before `date` and a new one (`newId`) carries the
   * patch from `date` on, with the notes from `date` on. At the series' first date it is an update.
   */
  | { type: 'schedule/split'; id: string; date: string; newId: string; now: number; patch: SchedulePatch };

export type ScheduleActionType = ScheduleAction['type'];

export const isScheduleAction = (a: { type: string }): a is ScheduleAction => a.type.startsWith('schedule/');

/** Apply a patch to a rule: name normalised, an open length opens the plan, a stale plan opens. */
export function patchSchedule(s: Schedule, patch: SchedulePatch): Schedule {
  const next: Schedule = { ...s };
  if (patch.name !== undefined) next.name = normalizeTaskName(patch.name);
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.time !== undefined) next.time = patch.time;
  if (patch.repeat !== undefined) next.repeat = patch.repeat;
  if (patch.until !== undefined) next.until = patch.until;
  if (patch.lengthMinutes !== undefined) next.lengthMinutes = patch.lengthMinutes;
  if (patch.planId !== undefined) next.planId = patch.planId;
  else if (patch.lengthMinutes !== undefined && patch.lengthMinutes !== s.lengthMinutes) next.planId = null;
  if (next.lengthMinutes === null) next.planId = null;
  next.notes = pruneNotes(next);
  return next;
}

const valid = (s: Schedule): boolean => scheduleProblem(s) === null;

function split(list: readonly Schedule[], i: number, s: Schedule, a: Extract<ScheduleAction, { type: 'schedule/split' }>): Schedule[] | null {
  if (!occursOn(s, a.date) || a.date <= s.date) return null;
  if (typeof a.newId !== 'string' || a.newId.length === 0 || list.some((x) => x.id === a.newId)) return null;
  if (typeof a.now !== 'number' || !Number.isFinite(a.now)) return null;
  const before: Record<string, OccurrenceNote> = {};
  const after: Record<string, OccurrenceNote> = {};
  for (const [d, n] of Object.entries(s.notes)) (d < a.date ? before : after)[d] = n;
  const head: Schedule = { ...s, until: a.date, notes: before };
  const start = a.patch.date ?? a.date;
  const tail = patchSchedule({ ...s, id: a.newId, date: a.date, notes: start === a.date ? after : {}, createdAt: a.now }, { ...a.patch, until: a.patch.until ?? s.until });
  if (tail.until !== null && tail.until <= tail.date) return null;
  if (!valid(head) || !valid(tail)) return null;
  const out = [...list];
  out.splice(i, 1, head, tail);
  return out;
}

/** The schedules after `action` (the same array when nothing changed or the action is invalid). */
export function reduceSchedules(list: readonly Schedule[], action: ScheduleAction): readonly Schedule[] {
  if (action.type === 'schedule/add') {
    const s = action.schedule;
    if (!s || !valid(s) || list.some((x) => x.id === s.id)) return list;
    return [...list, { ...s, notes: { ...s.notes } }];
  }
  const i = list.findIndex((x) => x.id === action.id);
  const s = list[i];
  if (!s) return list;
  switch (action.type) {
    case 'schedule/remove':
      return list.filter((x) => x !== s);
    case 'schedule/update': {
      const next = patchSchedule(s, action.patch ?? {});
      if (!valid(next)) return list;
      const out = [...list];
      out[i] = next;
      return out;
    }
    case 'schedule/note': {
      if (!occursOn(s, action.date)) return list;
      if (action.note !== null && noteProblem(action.note) !== null) return list;
      const notes = withNote(s.notes, action.date, action.note);
      if (JSON.stringify(notes) === JSON.stringify(s.notes)) return list;
      const out = [...list];
      out[i] = { ...s, notes };
      return out;
    }
    case 'schedule/split': {
      if (action.date === s.date) return reduceSchedules(list, { type: 'schedule/update', id: s.id, patch: action.patch });
      return split(list, i, s, action) ?? list;
    }
    default:
      return list;
  }
}

// ---------------------------------------------------------------------------------------------
// Edits as actions (pure): "only this one" versus "this and following" (ADR 0171)
// ---------------------------------------------------------------------------------------------

export type EditScope = 'this' | 'following';

/** What an edit form returns: fields left undefined are unchanged; `null` length/plan = open. */
export interface ScheduleEdit {
  name?: string;
  date?: string;
  time?: string;
  lengthMinutes?: number | null;
  planId?: string | null;
  repeat?: Schedule['repeat'];
}

const patchOf = (e: ScheduleEdit): SchedulePatch => {
  const p: SchedulePatch = {};
  if (e.name !== undefined) p.name = e.name;
  if (e.date !== undefined) p.date = e.date;
  if (e.time !== undefined) p.time = e.time;
  if (e.lengthMinutes !== undefined) p.lengthMinutes = e.lengthMinutes;
  if (e.planId !== undefined) p.planId = e.planId;
  if (e.repeat !== undefined) p.repeat = e.repeat;
  return p;
};

/**
 * The actions for editing the occurrence of `s` on `date`:
 * - a one-off, or "this and following" from the first occurrence: the whole rule changes;
 * - "this and following" later on: the series is split there;
 * - "only this one": a note overrides name, time, length and plan for that day; a move to another
 *   day skips this one and adds a one-off on the new day; a new repeat applies to the following.
 */
export function planEdit(s: Schedule, date: string, edit: ScheduleEdit, scope: EditScope, ids: { newId: string; now: number }): ScheduleAction[] {
  const repeatChanged = edit.repeat !== undefined && edit.repeat !== s.repeat;
  const following = scope === 'following' || repeatChanged;
  if (s.repeat === 'none' || (following && date === s.date)) {
    return [{ type: 'schedule/update', id: s.id, patch: patchOf(edit) }];
  }
  if (following) return [{ type: 'schedule/split', id: s.id, date, newId: ids.newId, now: ids.now, patch: patchOf(edit) }];
  const current = s.notes[date] ?? {};
  if (edit.date !== undefined && edit.date !== date) {
    const length = edit.lengthMinutes !== undefined ? edit.lengthMinutes : 'lengthMinutes' in current ? (current.lengthMinutes ?? null) : s.lengthMinutes;
    const plan = edit.planId !== undefined ? edit.planId : 'planId' in current ? (current.planId ?? null) : length === s.lengthMinutes ? s.planId : null;
    const moved: Schedule = {
      id: ids.newId,
      name: normalizeTaskName(edit.name ?? current.name ?? s.name),
      date: edit.date,
      time: edit.time ?? current.time ?? s.time,
      lengthMinutes: length,
      planId: length === null ? null : plan,
      repeat: 'none',
      until: null,
      notes: {},
      createdAt: ids.now,
    };
    return [
      { type: 'schedule/note', id: s.id, date, note: { ...current, skipped: true } },
      { type: 'schedule/add', schedule: moved },
    ];
  }
  const note: OccurrenceNote = { ...current };
  if (edit.name !== undefined) note.name = normalizeTaskName(edit.name);
  if (edit.time !== undefined) note.time = edit.time;
  if (edit.lengthMinutes !== undefined) {
    note.lengthMinutes = edit.lengthMinutes;
    if (edit.planId === undefined) note.planId = null;
  }
  if (edit.planId !== undefined) note.planId = edit.lengthMinutes === null ? null : edit.planId;
  return [{ type: 'schedule/note', id: s.id, date, note }];
}

/** The actions for removing the occurrence of `s` on `date`: only it, or it and the following. */
export function planRemove(s: Schedule, date: string, scope: EditScope): ScheduleAction[] {
  if (s.repeat === 'none' || (scope === 'following' && date === s.date)) return [{ type: 'schedule/remove', id: s.id }];
  if (scope === 'following') return [{ type: 'schedule/update', id: s.id, patch: { until: date } }];
  return [{ type: 'schedule/note', id: s.id, date, note: { ...(s.notes[date] ?? {}), skipped: true } }];
}
