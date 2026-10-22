import { recommendPlans } from '../core/plans';
import { isDateKey, isTimeOfDay, type OccurrenceView, type Repeat } from '../core/schedule';
import type { Scheduler } from '../core/schedule-controller';
import type { EditScope, ScheduleEdit } from '../core/schedule-reducer';
import { dayKey } from '../core/session-log';
import { GOAL_PRESETS, isValidGoalMinutes, MAX_GOAL_MINUTES, MIN_GOAL_MINUTES } from '../core/session';
import type { UIContext } from './context';
import { clear, h, setText, show } from './dom';
import { createSheet, type Sheet } from './sheet';

/**
 * The schedule editor (SPEC §13, ADR 0177): a washi sheet with a name, a date and a time, an
 * optional length and plan ("Choose when I start" by default) and a repeat. Plant and spot are not
 * chosen here. Editing an occurrence of a repeat asks "Only this one" or "This and the following"
 * (ADR 0171); a planned session today can also be started from here ("Start now").
 */

export interface ScheduleSheetDeps {
  scheduler: Scheduler;
  /** open the start flow prefilled from this occurrence (the waiting card's Start) */
  startNow(occurrence: OccurrenceView, opener: HTMLElement | null): void;
}

export interface ScheduleSheetState {
  mode: 'new' | 'edit' | null;
  /** the pending question: which occurrences a save or a removal applies to */
  ask: 'save' | 'remove' | null;
  occurrence: string | null;
}

export interface ScheduleSheet extends Sheet {
  openNew(at: { date: string; time: string }, opener?: HTMLElement | null): void;
  openEdit(occurrence: OccurrenceView, opener?: HTMLElement | null): void;
  state(): ScheduleSheetState;
}

const REPEAT_WORDS: Record<Repeat, string> = { none: 'Once', daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week' };

interface Form {
  name: string;
  date: string;
  time: string;
  length: number | null;
  planId: string | null;
  repeat: Repeat;
}

export function createScheduleSheet(ctx: UIContext, deps: ScheduleSheetDeps): ScheduleSheet {
  const { scheduler } = deps;
  const { clock } = ctx.deps;
  let mode: ScheduleSheetState['mode'] = null;
  let editing: OccurrenceView | null = null;
  let ask: ScheduleSheetState['ask'] = null;
  let form: Form = { name: '', date: dayKey(clock.now()), time: '09:00', length: null, planId: null, repeat: 'none' };
  let opener: HTMLElement | null = null;

  const sheet = createSheet(ctx, {
    name: 'schedule',
    title: 'Plan a session',
    subtitle: h('p.sheet-sub', {}, 'Name it and give it a time. The plant and its spot are chosen when you begin.'),
    className: 'schedule',
  });
  const titleEl = sheet.el.querySelector<HTMLElement>('.title')!;
  const subEl = sheet.el.querySelector<HTMLElement>('.sheet-sub')!;

  // ── fields ──
  const name = h('input.sched-input.sched-name', { id: 'sched-name', type: 'text', maxLength: 40, autocomplete: 'off', placeholder: 'What will you study?' });
  name.addEventListener('input', () => (form.name = name.value));
  const date = h('input.sched-input', { id: 'sched-date', type: 'date', required: true });
  date.addEventListener('input', () => (form.date = date.value));
  const time = h('input.sched-input', { id: 'sched-time', type: 'time', step: 300, required: true });
  time.addEventListener('input', () => (form.time = time.value));

  const lengthChips = h('div.sched-chips', { role: 'radiogroup', 'aria-label': 'Length' });
  const other = h('input.sched-input', {
    id: 'sched-length',
    type: 'number',
    min: MIN_GOAL_MINUTES,
    max: MAX_GOAL_MINUTES,
    step: 5,
    inputmode: 'numeric',
    'aria-label': 'Length in minutes',
  });
  other.addEventListener('change', () => {
    const v = Math.round(Number(other.value));
    form.length = Number.isFinite(v) && isValidGoalMinutes(v) ? v : form.length;
    if (!isValidGoalMinutes(v)) other.value = form.length ? String(form.length) : '';
    renderChoices();
  });
  const planChips = h('div.sched-chips', { role: 'radiogroup', 'aria-label': 'Plan' });
  const planRow = h('div.sched-row', {}, h('span.sched-label', { id: 'sched-plan-label' }, 'A plan for the time'), planChips);
  const repeatChips = h('div.sched-chips', { role: 'radiogroup', 'aria-label': 'Repeat' });
  const repeatHint = h('p.sched-hint');
  const error = h('p.sched-error', { role: 'alert' });

  // ── footer ──
  const save = h('button.seal.sched-save', { type: 'button', onclick: () => onSave() }, 'Save');
  const cancel = h('button.quiet', { type: 'button', onclick: () => sheet.close() }, 'Cancel');
  const startNow = h('button.quiet.sched-start', { type: 'button', onclick: () => editing && deps.startNow(editing, startNow) }, 'Start now');
  const remove = h('button.quiet.sched-remove', { type: 'button', onclick: () => askScope('remove') }, 'Remove');
  const scopeQ = h('p.sched-scope-q');
  const scopeThis = h('button.quiet.ink', { type: 'button', onclick: () => applyScope('this') }, 'Only this one');
  const scopeFollowing = h('button.quiet.ink', { type: 'button', onclick: () => applyScope('following') }, 'This and the following');
  const scopeKeep = h('button.quiet', { type: 'button', onclick: () => setAsk(null) }, 'Keep it');
  const scope = h('div.sched-scope', { role: 'group' }, scopeQ, scopeThis, scopeFollowing, scopeKeep);
  const foot = h('div.sched-foot', {}, remove, startNow, h('span.spacer'), cancel, save);

  sheet.body.append(
    h(
      'form.sched-form',
      { onsubmit: (e: Event) => (e.preventDefault(), onSave()) },
      h('div.sched-row', {}, h('label.sched-label', { for: 'sched-name' }, 'What will you study?'), name),
      h(
        'div.sched-row',
        {},
        h('span.sched-label', {}, 'When'),
        h('div.sched-when', {}, h('label.sched-field', {}, 'day', date), h('label.sched-field', {}, 'time', time)),
      ),
      h(
        'div.sched-row',
        {},
        h('span.sched-label', {}, 'How long'),
        lengthChips,
        h('p.sched-hint', {}, 'Leave it open to choose the time and the plan when you begin.'),
      ),
      planRow,
      h('div.sched-row', {}, h('span.sched-label', {}, 'Repeat'), repeatChips, repeatHint),
      error,
    ),
    scope,
    foot,
  );

  function chip(label: string, checked: boolean, onPick: () => void, attrs: Record<string, unknown> = {}): HTMLButtonElement {
    return h('button.sched-chip', { type: 'button', role: 'radio', 'aria-checked': String(checked), tabindex: checked ? 0 : -1, onclick: onPick, ...attrs }, label);
  }

  /** Arrow keys move within a chip group (like the planting sheet's plans). */
  function arrows(group: HTMLElement): void {
    group.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
      const chips = [...group.querySelectorAll<HTMLButtonElement>('.sched-chip')];
      const i = chips.findIndex((c) => c.getAttribute('aria-checked') === 'true');
      const n = chips[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
      if (n) {
        e.preventDefault();
        n.click();
      }
    });
  }
  arrows(lengthChips);
  arrows(planChips);
  arrows(repeatChips);

  function renderChoices(): void {
    clear(lengthChips);
    const preset = form.length === null || GOAL_PRESETS.includes(form.length);
    lengthChips.append(
      chip('Choose when I start', form.length === null, () => pickLength(null), { 'data-length': 'open' }),
      ...GOAL_PRESETS.map((m) => chip(`${m} min`, form.length === m, () => pickLength(m), { 'data-length': m })),
      h('label.sched-other', {}, 'or', other, 'min'),
    );
    if (!preset && form.length !== null) other.value = String(form.length);
    else if (document.activeElement !== other) other.value = '';

    clear(planChips);
    show(planRow, form.length !== null);
    if (form.length !== null) {
      const plans = recommendPlans(form.length);
      if (form.planId && !plans.some((p) => p.id === form.planId)) form.planId = null;
      planChips.append(
        chip('Choose when I start', form.planId === null, () => pickPlan(null), { 'data-plan-id': 'open' }),
        ...plans.map((p) => chip(p.name, form.planId === p.id, () => pickPlan(p.id), { 'data-plan-id': p.id })),
      );
    }

    clear(repeatChips);
    repeatChips.append(...(Object.keys(REPEAT_WORDS) as Repeat[]).map((r) => chip(REPEAT_WORDS[r], form.repeat === r, () => pickRepeat(r), { 'data-repeat': r })));
    const repeatChanged = editing !== null && editing.repeat !== 'none' && form.repeat !== editing.repeat && !editing.first;
    setText(repeatHint, repeatChanged ? 'A new repeat applies from this day on.' : form.repeat === 'weekly' ? 'On the same weekday each week.' : '');
    show(repeatHint, repeatHint.textContent !== '');
  }

  /** Re-render the chips; keep keyboard focus on the chosen chip of the group it was in. */
  function rerender(group: HTMLElement): void {
    const had = group.contains(document.activeElement);
    renderChoices();
    if (had) group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }
  function pickLength(m: number | null): void {
    form.length = m;
    if (m === null) form.planId = null;
    rerender(lengthChips);
  }
  function pickPlan(id: string | null): void {
    form.planId = id;
    rerender(planChips);
  }
  function pickRepeat(r: Repeat): void {
    form.repeat = r;
    rerender(repeatChips);
  }

  function setAsk(next: ScheduleSheetState['ask']): void {
    ask = next;
    show(scope, ask !== null);
    show(foot, ask === null);
    if (ask === null) return;
    const repeating = editing !== null && editing.repeat !== 'none';
    show(scopeThis, true);
    show(scopeFollowing, repeating);
    if (ask === 'remove') {
      setText(scopeQ, repeating ? `Remove only this one, or this and the following?` : `Remove “${editing?.name ?? ''}” from the calendar?`);
      setText(scopeThis, repeating ? 'Only this one' : 'Remove');
    } else {
      setText(scopeQ, 'Change only this one, or this and the following?');
      setText(scopeThis, 'Only this one');
    }
    ctx.changed();
    scopeThis.focus({ preventScroll: true });
  }

  function askScope(what: 'remove'): void {
    if (!editing) return;
    setAsk(what);
  }

  function readForm(): Form | null {
    form.name = name.value;
    form.date = date.value;
    form.time = time.value;
    if (!isDateKey(form.date)) return fail('Choose a day.');
    if (!isTimeOfDay(form.time)) return fail('Choose a time.');
    if (form.length !== null && !isValidGoalMinutes(form.length)) return fail(`A length between ${MIN_GOAL_MINUTES} and ${MAX_GOAL_MINUTES} minutes, in fives.`);
    setText(error, '');
    return form;
  }
  function fail(text: string): null {
    setText(error, text);
    return null;
  }

  /** The fields that differ from the occurrence being edited. */
  function diff(f: Form, o: OccurrenceView): ScheduleEdit {
    const e: ScheduleEdit = {};
    if (f.name.trim() !== o.name) e.name = f.name;
    if (f.date !== o.date) e.date = f.date;
    if (f.time !== o.time) e.time = f.time;
    if (f.length !== o.lengthMinutes) e.lengthMinutes = f.length;
    if (f.planId !== o.planId) e.planId = f.planId;
    if (f.repeat !== o.repeat) e.repeat = f.repeat;
    return e;
  }

  function onSave(): void {
    const f = readForm();
    if (!f) return;
    if (mode === 'new') {
      const s = scheduler.add({ name: f.name, date: f.date, time: f.time, lengthMinutes: f.length, planId: f.planId, repeat: f.repeat });
      if (!s) return void fail('That plan could not be saved.');
      ctx.announce(`Planned: ${s.name}.`);
      sheet.close();
      return;
    }
    if (!editing) return;
    const edit = diff(f, editing);
    if (Object.keys(edit).length === 0) return sheet.close();
    // a one-off, or a new repeat (always from this day on), needs no question
    if (editing.repeat === 'none' || edit.repeat !== undefined) return void commit(edit, 'following');
    setAsk('save');
  }

  function commit(edit: ScheduleEdit, s: EditScope): void {
    if (!editing) return;
    const ok = scheduler.edit({ scheduleId: editing.scheduleId, date: editing.date }, edit, s);
    if (!ok) return void fail('That change could not be saved.');
    ctx.announce('Plan changed.');
    sheet.close();
  }

  function applyScope(s: EditScope): void {
    if (!editing) return;
    if (ask === 'remove') {
      if (scheduler.remove({ scheduleId: editing.scheduleId, date: editing.date }, s)) ctx.announce('Removed from the calendar.');
      sheet.close();
      return;
    }
    const f = readForm();
    if (f) commit(diff(f, editing), s);
  }

  function fill(): void {
    name.value = form.name;
    date.value = form.date;
    time.value = form.time;
    setText(error, '');
    renderChoices();
    setAsk(null);
  }

  function openNew(at: { date: string; time: string }, from?: HTMLElement | null): void {
    mode = 'new';
    editing = null;
    opener = from ?? null;
    form = { name: '', date: at.date, time: at.time, length: null, planId: null, repeat: 'none' };
    setText(titleEl, 'Plan a session');
    setText(subEl, 'Name it and give it a time. The plant and its spot are chosen when you begin.');
    show(remove, false);
    show(startNow, false);
    fill();
    sheet.open(opener);
    name.focus({ preventScroll: true });
  }

  function openEdit(o: OccurrenceView, from?: HTMLElement | null): void {
    mode = 'edit';
    editing = o;
    opener = from ?? null;
    form = { name: o.name, date: o.date, time: o.time, length: o.lengthMinutes, planId: o.planId, repeat: o.repeat };
    setText(titleEl, o.status === 'missed' || o.status === 'dismissed' ? 'A plan that passed' : 'Your plan');
    setText(subEl, o.repeat === 'none' ? 'Change it, or remove it.' : `${REPEAT_WORDS[o.repeat]}. Change this one or all that follow.`);
    show(remove, true);
    const today = o.date === dayKey(clock.now());
    show(startNow, today && (o.status === 'upcoming' || o.status === 'due'));
    fill();
    sheet.open(opener);
  }

  sheet.el.addEventListener('close', () => {
    mode = null;
    editing = null;
    ask = null;
  });
  show(scope, false);

  return {
    ...sheet,
    openNew,
    openEdit,
    state: () => ({ mode, ask, occurrence: editing?.key ?? null }),
  };
}
