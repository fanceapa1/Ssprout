import { addDays, parseDate, timeOfDay } from '../core/schedule';
import { dayKey } from '../core/session-log';
import { CHEVRON, chevronSvg } from './calendar-art';
import { monthGrid, noonOf } from './calendar-model';
import { clear, fragment, h, setText } from './dom';

/**
 * Painted day and time pickers for the schedule editor (ADR 0193). Native `<input type=date|time>`
 * follow the operating system's locale (dd/mm/yyyy, a 24-hour clock) while the calendar follows the
 * browser's language (12 hours in en-US): here both speak the calendar's own `Intl` formats, so a
 * planned "4:30 PM" reads the same in the editor and in the calendar.
 *
 * Each picker is a field (a button showing the value) that unfolds a panel inline, under its row —
 * no floating popover to position or clip inside a scrolling sheet:
 * - the day: a month grid (`role=grid`); arrows move by day and week, Home / End to the week's ends,
 *   PageUp / PageDown by month (with Shift by year), Enter or Space chooses, Esc folds it back;
 * - the time: hour, minutes (in fives) and, on a 12-hour clock, AM / PM as radio groups of paper
 *   chips (arrows move and choose), "Done" or Esc folds it back.
 * Focus returns to the field; every control is a real button with a spoken name.
 */

// ── pure ─────────────────────────────────────────────────────────────────────────────────────

export interface PickerFormat {
  /** "Friday, 24 October" */
  day: Intl.DateTimeFormat;
  /** "Friday, 24 October 2026" (another year, and spoken names) */
  dayYear: Intl.DateTimeFormat;
  /** the calendar's time: "4:30 PM" / "16:30" */
  time: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
  /** a 12-hour clock (h11 / h12) */
  twelve: boolean;
  /** the locale's words for morning and afternoon ("AM", "PM") */
  periods: [string, string];
  /** what stands between hours and minutes (":" or ".") */
  sep: string;
}

/** The calendar's formats for a locale (default: the browser's). */
export function pickerFormat(locale?: string): PickerFormat {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
  const time = f({ hour: 'numeric', minute: '2-digit' });
  const twelve = uses12h(locale);
  const am = new Date(2026, 0, 1, 9, 30);
  const pm = new Date(2026, 0, 1, 21, 30);
  const period = (d: Date) => time.formatToParts(d).find((p) => p.type === 'dayPeriod')?.value ?? (d.getHours() < 12 ? 'AM' : 'PM');
  const parts = time.formatToParts(am);
  const hi = parts.findIndex((p) => p.type === 'hour');
  const sep = parts[hi + 1]?.type === 'literal' ? parts[hi + 1]!.value.trim() || ':' : ':';
  return {
    day: f({ weekday: 'long', day: 'numeric', month: 'long' }),
    dayYear: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time,
    month: f({ month: 'long', year: 'numeric' }),
    weekday: f({ weekday: 'short' }),
    weekdayLong: f({ weekday: 'long' }),
    twelve,
    periods: twelve ? [period(am), period(pm)] : ['AM', 'PM'],
    sep,
  };
}

/** Does the locale's clock run 12 hours (with AM / PM)? The calendar asks the same question. */
export function uses12h(locale?: string): boolean {
  const f = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
  const cycle = f.resolvedOptions().hourCycle;
  if (cycle) return cycle === 'h11' || cycle === 'h12';
  return f.formatToParts(new Date(2026, 0, 1, 15)).some((p) => p.type === 'dayPeriod');
}

/** "Friday, 24 October", with the year when it is not this year's. */
export function dayLabel(date: string, today: string, f: PickerFormat): string {
  const t = noonOf(date);
  if (!Number.isFinite(t)) return date;
  return (date.slice(0, 4) === today.slice(0, 4) ? f.day : f.dayYear).format(t);
}

/** "HH:MM" in the calendar's words ("4:30 PM" or "16:30"). */
export function timeLabel(hhmm: string, f: PickerFormat): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return f.time.format(new Date(2026, 0, 1, Number(m[1]), Number(m[2])));
}

export interface TimeParts {
  /** the hour as shown: 1–12 on a 12-hour clock, else 0–23 */
  hour: number;
  minute: number;
  pm: boolean;
}

export function splitTime(hhmm: string, twelve: boolean): TimeParts {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  const H = m ? Math.min(23, Number(m[1])) : 9;
  const minute = m ? Math.min(59, Number(m[2])) : 0;
  return { hour: twelve ? ((H + 11) % 12) + 1 : H, minute, pm: H >= 12 };
}

export function joinTime(p: TimeParts, twelve: boolean): string {
  const H = twelve ? (p.hour % 12) + (p.pm ? 12 : 0) : p.hour;
  return timeOfDay(H * 60 + p.minute);
}

/** The hours offered: 12, 1 … 11 on a 12-hour clock (as a clock face reads), else 0 … 23. */
export function hoursFor(twelve: boolean): number[] {
  return twelve ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : Array.from({ length: 24 }, (_, i) => i);
}

/** The minutes offered (a time between steps keeps its own minute as an extra chip). */
export function minutesFor(step = 5, keep?: number): number[] {
  const out = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  if (keep !== undefined && !out.includes(keep)) {
    out.push(keep);
    out.sort((a, b) => a - b);
  }
  return out;
}

/** The day a grid key moves to (null: not a moving key). Weeks start on `weekStartsOn`. */
export function stepDay(date: string, key: string, weekStartsOn: number, shift = false): string | null {
  const p = parseDate(date);
  if (!p) return null;
  const weekday = new Date(p[0], p[1] - 1, p[2], 12).getDay();
  const intoWeek = (weekday - weekStartsOn + 7) % 7;
  const months = (n: number) => {
    const last = new Date(p[0], p[1] - 1 + n + 1, 0).getDate();
    return dayKey(new Date(p[0], p[1] - 1 + n, Math.min(p[2], last), 12).getTime());
  };
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -7);
    case 'ArrowDown':
      return addDays(date, 7);
    case 'Home':
      return addDays(date, -intoWeek);
    case 'End':
      return addDays(date, 6 - intoWeek);
    case 'PageUp':
      return months(shift ? -12 : -1);
    case 'PageDown':
      return months(shift ? 12 : 1);
    default:
      return null;
  }
}

// ── DOM ──────────────────────────────────────────────────────────────────────────────────────

interface FieldParts {
  field: HTMLButtonElement;
  text: HTMLElement;
  panel: HTMLElement;
}

/** A field that unfolds a panel below it (a disclosure). */
function fieldParts(id: string, label: string, panelLabel: string): FieldParts {
  const text = h('span.pick-value', { id: `${id}-value` });
  const field = h(
    `button.pick-field`,
    { id, type: 'button', 'aria-expanded': 'false', 'aria-controls': `${id}-panel`, 'aria-labelledby': `${id}-label ${id}-value` },
    h('span.pick-label', { id: `${id}-label` }, label),
    text,
    fragment(chevronSvg(CHEVRON.down)),
  );
  const panel = h('div.pick-panel', { id: `${id}-panel`, role: 'group', 'aria-label': panelLabel, hidden: true });
  return { field, text, panel };
}

export interface Picker {
  /** the field (a button) */
  readonly field: HTMLButtonElement;
  /** the panel it unfolds (place it where it should open) */
  readonly panel: HTMLElement;
  get value(): string;
  set(value: string): void;
  open(): void;
  close(focusField?: boolean): void;
  isOpen(): boolean;
}

export interface PickerOptions {
  id: string;
  /** the field's visible label ("day", "time") */
  label: string;
  onChange(value: string): void;
  /** before the panel opens (fold another picker) */
  onOpen?(): void;
  format?: PickerFormat;
}

function escapeCloses(panel: HTMLElement, close: () => void): void {
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // fold the picker, not the sheet around it
    e.preventDefault();
    e.stopPropagation();
    close();
  });
}

/** The day: a field and a month grid. */
export function createDayPicker(opts: PickerOptions & { today: () => string; weekStartsOn: number }): Picker {
  const f = opts.format ?? pickerFormat();
  const { field, text, panel } = fieldParts(opts.id, opts.label, 'Choose a day');
  let value = opts.today();
  /** the day with keyboard focus in the grid (its month is the one shown) */
  let focusDay = value;

  const title = h('span.pick-month-title', { id: `${opts.id}-month`, 'aria-live': 'polite' });
  const prev = h('button.pick-step', { type: 'button', 'aria-label': 'Previous month', onclick: () => moveTo(stepDay(focusDay, 'PageUp', opts.weekStartsOn)!, false) }, fragment(chevronSvg(CHEVRON.prev)));
  const next = h('button.pick-step', { type: 'button', 'aria-label': 'Next month', onclick: () => moveTo(stepDay(focusDay, 'PageDown', opts.weekStartsOn)!, false) }, fragment(chevronSvg(CHEVRON.next)));
  const grid = h('table.pick-grid', { role: 'grid', 'aria-labelledby': `${opts.id}-month` });
  panel.classList.add('pick-days');
  panel.append(h('div.pick-month', {}, prev, title, next), grid);

  function renderGrid(): void {
    const today = opts.today();
    const anchor = noonOf(focusDay);
    const month = new Date(anchor).getMonth();
    setText(title, f.month.format(anchor));
    clear(grid);
    const weeks = monthGrid(anchor, opts.weekStartsOn);
    const head = h('tr');
    for (const d of weeks[0]!) {
      const t = noonOf(d);
      head.append(h('th', { scope: 'col', abbr: f.weekdayLong.format(t) }, f.weekday.format(t)));
    }
    grid.append(h('thead', {}, head));
    const body = h('tbody');
    for (const row of weeks) {
      const tr = h('tr');
      for (const d of row) {
        const t = noonOf(d);
        const btn = h(
          'button.pick-day',
          {
            type: 'button',
            tabindex: d === focusDay ? 0 : -1,
            'data-date': d,
            'data-other': String(new Date(t).getMonth() !== month),
            'data-past': String(d < today),
            'aria-label': f.dayYear.format(t),
            'aria-current': d === today ? 'date' : undefined,
            onclick: () => choose(d),
          },
          String(new Date(t).getDate()),
        );
        tr.append(h('td', { role: 'gridcell', 'aria-selected': String(d === value) }, btn));
      }
      body.append(tr);
    }
    grid.append(body);
  }

  function dayButton(d: string): HTMLButtonElement | null {
    return grid.querySelector<HTMLButtonElement>(`button[data-date="${d}"]`);
  }

  /** move the grid's focus to `d` (redrawing the month when it leaves it) */
  function moveTo(d: string, focus = true): void {
    focusDay = d;
    const shown = dayButton(d);
    if (!shown || shown.dataset.other === 'true') renderGrid();
    for (const b of grid.querySelectorAll<HTMLButtonElement>('button.pick-day')) b.tabIndex = b.dataset.date === d ? 0 : -1;
    if (focus) dayButton(d)?.focus({ preventScroll: true });
  }

  function choose(d: string): void {
    api.set(d);
    opts.onChange(d);
    api.close(true);
  }

  grid.addEventListener('keydown', (e) => {
    const to = stepDay(focusDay, e.key, opts.weekStartsOn, e.shiftKey);
    if (!to) return;
    e.preventDefault();
    e.stopPropagation(); // the page's smooth scroll must not take the arrows
    moveTo(to);
  });
  escapeCloses(panel, () => api.close(true));
  field.addEventListener('click', () => (api.isOpen() ? api.close(false) : api.open()));
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !api.isOpen()) {
      e.preventDefault();
      api.open();
    }
  });

  const api: Picker = {
    field,
    panel,
    get value() {
      return value;
    },
    set(v) {
      if (!parseDate(v)) return;
      value = v;
      field.dataset.value = v;
      setText(text, dayLabel(v, opts.today(), f));
      if (api.isOpen()) renderGrid();
    },
    open() {
      opts.onOpen?.();
      focusDay = value;
      renderGrid();
      panel.hidden = false;
      field.setAttribute('aria-expanded', 'true');
      dayButton(focusDay)?.focus({ preventScroll: false });
    },
    close(focusField = false) {
      if (panel.hidden) return;
      panel.hidden = true;
      field.setAttribute('aria-expanded', 'false');
      if (focusField) field.focus({ preventScroll: true });
    },
    isOpen: () => !panel.hidden,
  };
  api.set(value);
  return api;
}

/** The time: a field and chips for the hour, the minutes (in fives) and AM / PM. */
export function createTimePicker(opts: PickerOptions & { step?: number }): Picker {
  const f = opts.format ?? pickerFormat();
  const step = opts.step ?? 5;
  const { field, text, panel } = fieldParts(opts.id, opts.label, 'Choose a time');
  let value = '09:00';
  panel.classList.add('pick-times');
  if (f.twelve) panel.classList.add('is-twelve');

  const hours = h('div.pick-chips.pick-hours', { role: 'radiogroup', 'aria-label': 'Hour' });
  const minutes = h('div.pick-chips.pick-minutes', { role: 'radiogroup', 'aria-label': 'Minutes' });
  const periods = h('div.pick-chips.pick-periods', { role: 'radiogroup', 'aria-label': `${f.periods[0]} or ${f.periods[1]}` });
  const done = h('button.quiet.pick-done', { type: 'button', onclick: () => api.close(true) }, 'Done');
  panel.append(
    h('div.pick-group', {}, h('span.pick-group-label', { 'aria-hidden': 'true' }, 'hour'), hours),
    h('div.pick-group', {}, h('span.pick-group-label', { 'aria-hidden': 'true' }, 'minutes'), minutes),
    ...(f.twelve ? [h('div.pick-group', {}, periods)] : []),
    h('div.pick-foot', {}, done),
  );

  function chip(label: string, checked: boolean, pick: () => void, attrs: Record<string, unknown> = {}): HTMLButtonElement {
    return h('button.pick-chip', { type: 'button', role: 'radio', 'aria-checked': String(checked), tabindex: checked ? 0 : -1, onclick: pick, ...attrs }, label);
  }

  function update(p: Partial<TimeParts>): void {
    const cur = splitTime(value, f.twelve);
    const next = joinTime({ ...cur, ...p }, f.twelve);
    api.set(next);
    opts.onChange(next);
  }

  function renderChips(): void {
    const p = splitTime(value, f.twelve);
    const pad = (n: number) => String(n).padStart(2, '0');
    clear(hours);
    for (const hr of hoursFor(f.twelve)) hours.append(chip(f.twelve ? String(hr) : pad(hr), hr === p.hour, () => update({ hour: hr }), { 'data-hour': hr }));
    clear(minutes);
    for (const m of minutesFor(step, p.minute)) minutes.append(chip(`${f.sep}${pad(m)}`, m === p.minute, () => update({ minute: m }), { 'data-minute': m, 'aria-label': pad(m) }));
    clear(periods);
    if (f.twelve) {
      periods.append(
        chip(f.periods[0], !p.pm, () => update({ pm: false }), { 'data-period': 'am' }),
        chip(f.periods[1], p.pm, () => update({ pm: true }), { 'data-period': 'pm' }),
      );
    }
  }

  /** Arrow keys move within a group and choose (radio buttons), keeping focus on the chosen chip. */
  for (const group of [hours, minutes, periods]) {
    group.addEventListener('keydown', (e) => {
      const chips = [...group.querySelectorAll<HTMLButtonElement>('.pick-chip')];
      const i = chips.findIndex((c) => c.getAttribute('aria-checked') === 'true');
      let n: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % chips.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + chips.length) % chips.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = chips.length - 1;
      if (n === null) return;
      e.preventDefault();
      e.stopPropagation();
      chips[n]!.click();
    });
  }
  escapeCloses(panel, () => api.close(true));
  field.addEventListener('click', () => (api.isOpen() ? api.close(false) : api.open()));
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !api.isOpen()) {
      e.preventDefault();
      api.open();
    }
  });

  const api: Picker = {
    field,
    panel,
    get value() {
      return value;
    },
    set(v) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return;
      const had = panel.contains(document.activeElement) ? (document.activeElement?.closest('.pick-chips') as HTMLElement | null) : null;
      value = v;
      field.dataset.value = v;
      setText(text, timeLabel(v, f));
      renderChips();
      had?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    },
    open() {
      opts.onOpen?.();
      renderChips();
      panel.hidden = false;
      field.setAttribute('aria-expanded', 'true');
      hours.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: false });
    },
    close(focusField = false) {
      if (panel.hidden) return;
      panel.hidden = true;
      field.setAttribute('aria-expanded', 'false');
      if (focusField) field.focus({ preventScroll: true });
    },
    isOpen: () => !panel.hidden,
  };
  api.set(value);
  return api;
}
