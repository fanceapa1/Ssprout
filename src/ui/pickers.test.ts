// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDayPicker,
  createTimePicker,
  dayLabel,
  hoursFor,
  joinTime,
  minutesFor,
  pickerFormat,
  splitTime,
  stepDay,
  timeLabel,
  uses12h,
} from './pickers';

/** The schedule editor's painted day and time pickers (ADR 0193). */

describe('picker formats follow the calendar’s locale', () => {
  it('a 12-hour clock in en-US, 24 hours in en-GB and de-DE', () => {
    expect(uses12h('en-US')).toBe(true);
    expect(uses12h('en-GB')).toBe(false);
    expect(uses12h('de-DE')).toBe(false);
  });

  it('labels a time exactly as the calendar does', () => {
    const us = pickerFormat('en-US');
    const gb = pickerFormat('en-GB');
    const calendar = (locale: string, h: number, m: number) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, h, m));
    expect(timeLabel('16:30', us)).toBe(calendar('en-US', 16, 30));
    expect(timeLabel('16:30', us)).toMatch(/4:30\s?PM/);
    expect(timeLabel('16:30', gb)).toBe(calendar('en-GB', 16, 30));
    expect(timeLabel('16:30', gb)).toBe('16:30');
    expect(us.periods).toEqual(['AM', 'PM']);
    expect(us.sep).toBe(':');
  });

  it('labels a day by its weekday and date, with the year only when it is another year', () => {
    const gb = pickerFormat('en-GB');
    expect(dayLabel('2026-10-24', '2026-10-23', gb)).toBe('Saturday 24 October');
    expect(dayLabel('2027-01-04', '2026-10-23', gb)).toBe(new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(2027, 0, 4, 12)));
    expect(dayLabel('2027-01-04', '2026-10-23', gb)).toContain('2027');
    expect(dayLabel('2026-10-24', '2026-10-23', pickerFormat('en-US'))).toBe('Saturday, October 24');
  });
});

describe('time parts', () => {
  it('splits and joins on a 12-hour clock (12 AM is midnight, 12 PM noon)', () => {
    expect(splitTime('00:05', true)).toEqual({ hour: 12, minute: 5, pm: false });
    expect(splitTime('12:00', true)).toEqual({ hour: 12, minute: 0, pm: true });
    expect(splitTime('16:30', true)).toEqual({ hour: 4, minute: 30, pm: true });
    expect(joinTime({ hour: 12, minute: 5, pm: false }, true)).toBe('00:05');
    expect(joinTime({ hour: 12, minute: 0, pm: true }, true)).toBe('12:00');
    expect(joinTime({ hour: 4, minute: 30, pm: true }, true)).toBe('16:30');
    for (let m = 0; m < 1440; m += 35) {
      const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      expect(joinTime(splitTime(hhmm, true), true)).toBe(hhmm);
      expect(joinTime(splitTime(hhmm, false), false)).toBe(hhmm);
    }
  });

  it('offers the hours as a clock reads them, and minutes in fives (keeping an odd one)', () => {
    expect(hoursFor(true)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(hoursFor(false)).toHaveLength(24);
    expect(minutesFor(5)).toHaveLength(12);
    expect(minutesFor(5, 17)).toContain(17);
    expect(minutesFor(5, 17)).toHaveLength(13);
  });
});

describe('moving in the month grid', () => {
  it('arrows by day and week, Home / End to the week’s ends, PageUp / PageDown by month (Shift: year)', () => {
    // Friday 23 October 2026; weeks from Monday (1) or Sunday (0)
    expect(stepDay('2026-10-23', 'ArrowRight', 1)).toBe('2026-10-24');
    expect(stepDay('2026-10-23', 'ArrowLeft', 1)).toBe('2026-10-22');
    expect(stepDay('2026-10-23', 'ArrowDown', 1)).toBe('2026-10-30');
    expect(stepDay('2026-10-23', 'ArrowUp', 1)).toBe('2026-10-16');
    expect(stepDay('2026-10-23', 'Home', 1)).toBe('2026-10-19');
    expect(stepDay('2026-10-23', 'End', 1)).toBe('2026-10-25');
    expect(stepDay('2026-10-23', 'Home', 0)).toBe('2026-10-18');
    expect(stepDay('2026-10-23', 'End', 0)).toBe('2026-10-24');
    expect(stepDay('2026-10-23', 'PageDown', 1)).toBe('2026-11-23');
    expect(stepDay('2026-10-31', 'PageDown', 1)).toBe('2026-11-30');
    expect(stepDay('2026-10-23', 'PageUp', 1, true)).toBe('2025-10-23');
    expect(stepDay('2026-10-23', 'Tab', 1)).toBeNull();
  });
});

describe('the pickers in the page', () => {
  afterEach(() => document.body.replaceChildren());
  const key = (el: Element, k: string, shift = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true, cancelable: true }));

  it('the day: the field opens a grid, arrows move, Enter chooses, focus returns to the field', () => {
    const picked: string[] = [];
    const p = createDayPicker({ id: 'd', label: 'day', today: () => '2026-10-23', weekStartsOn: 1, format: pickerFormat('en-GB'), onChange: (v) => picked.push(v) });
    document.body.append(p.field, p.panel);
    expect(p.field.textContent).toContain('Friday 23 October');
    expect(p.field.getAttribute('aria-expanded')).toBe('false');
    p.field.click();
    expect(p.isOpen()).toBe(true);
    expect(p.field.getAttribute('aria-expanded')).toBe('true');
    const focused = () => document.activeElement as HTMLElement;
    expect(focused().dataset.date).toBe('2026-10-23');
    expect(focused().getAttribute('aria-current')).toBe('date');
    expect(p.panel.querySelector('td[aria-selected="true"] button')?.getAttribute('data-date')).toBe('2026-10-23');
    key(focused(), 'ArrowDown');
    key(focused(), 'ArrowDown');
    expect(focused().dataset.date).toBe('2026-11-06'); // into November: the month turned
    expect(p.panel.querySelector('.pick-month-title')?.textContent).toBe('November 2026');
    focused().click();
    expect(picked).toEqual(['2026-11-06']);
    expect(p.value).toBe('2026-11-06');
    expect(p.isOpen()).toBe(false);
    expect(document.activeElement).toBe(p.field);
    expect(p.field.dataset.value).toBe('2026-11-06');
  });

  it('Esc folds the grid back without choosing, and does not reach the sheet', () => {
    const picked: string[] = [];
    const p = createDayPicker({ id: 'd', label: 'day', today: () => '2026-10-23', weekStartsOn: 1, onChange: (v) => picked.push(v) });
    document.body.append(p.field, p.panel);
    let reached = false;
    document.body.addEventListener('keydown', () => (reached = true));
    p.open();
    key(document.activeElement!, 'ArrowRight');
    key(document.activeElement!, 'Escape');
    expect(p.isOpen()).toBe(false);
    expect(picked).toEqual([]);
    expect(reached).toBe(false);
    expect(document.activeElement).toBe(p.field);
  });

  it('the time: hour, minutes and AM / PM as radio groups; arrows choose', () => {
    const picked: string[] = [];
    const p = createTimePicker({ id: 't', label: 'time', format: pickerFormat('en-US'), onChange: (v) => picked.push(v) });
    document.body.append(p.field, p.panel);
    p.set('16:30');
    expect(p.field.textContent).toMatch(/4:30\s?PM/);
    p.open();
    const groups = [...p.panel.querySelectorAll('[role="radiogroup"]')].map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Hour', 'Minutes', 'AM or PM']);
    expect((document.activeElement as HTMLElement).dataset.hour).toBe('4');
    key(document.activeElement!, 'ArrowRight');
    expect(p.value).toBe('17:30');
    expect((document.activeElement as HTMLElement).dataset.hour).toBe('5');
    (p.panel.querySelector('[data-period="am"]') as HTMLButtonElement).click();
    expect(p.value).toBe('05:30');
    (p.panel.querySelector('[data-minute="45"]') as HTMLButtonElement).click();
    expect(p.value).toBe('05:45');
    expect(picked).toEqual(['17:30', '05:30', '05:45']);
    expect(p.panel.querySelectorAll('[aria-checked="true"]')).toHaveLength(3);
  });

  it('on a 24-hour clock there is no AM / PM and the hours run 00 … 23', () => {
    const p = createTimePicker({ id: 't', label: 'time', format: pickerFormat('en-GB'), onChange: () => undefined });
    document.body.append(p.field, p.panel);
    p.set('16:30');
    expect(p.field.textContent).toContain('16:30');
    expect(p.panel.querySelector('.pick-periods')).toBeNull();
    expect(p.panel.querySelectorAll('.pick-hours .pick-chip')).toHaveLength(24);
  });
});
