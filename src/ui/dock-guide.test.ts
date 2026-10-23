import { describe, expect, it } from 'vitest';
import { TIPS } from '../core/tips';
import { GUIDE, guideLines, type GuideInput } from './dock-guide';

/** The dock's helper lines (ADR 0201). */
const base: GuideInput = { panel: 'idle', confirming: false, due: null, sessions: 0, watered: false, plant: 'empty', calendar: 'day' };
const line = (o: Partial<GuideInput>) => guideLines({ ...base, ...o });

describe('dock helper lines', () => {
  it('Study says what to do next in every state', () => {
    expect(line({}).session).toBe(GUIDE.idle);
    expect(line({ sessions: 2 }).session).toBe(GUIDE.waiting);
    expect(line({ panel: 'focus', sessions: 1 }).session).toBe(GUIDE.focus);
    expect(line({ panel: 'break', sessions: 1 }).session).toBe(GUIDE.break);
    expect(line({ panel: 'break', sessions: 1, watered: true }).session).toBe(GUIDE.watered);
    expect(line({ panel: 'paused', sessions: 1 }).session).toBe(GUIDE.paused);
    expect(line({ panel: 'longPause', sessions: 1 }).session).toBe(GUIDE.longPause);
    expect(line({ panel: 'focus', sessions: 1, confirming: true }).session).toBe(GUIDE.ending);
  });

  it('a planned session that is due speaks first; at the limit only when nothing runs', () => {
    expect(line({ due: 'start' }).session).toBe(GUIDE.due);
    expect(line({ due: 'start', panel: 'focus', sessions: 1 }).session).toBe(GUIDE.due);
    expect(line({ due: 'limit', sessions: 3 }).session).toBe(GUIDE.dueFull);
    expect(line({ due: 'limit', panel: 'focus', sessions: 3 }).session).toBe(GUIDE.focus);
    // the long pause question is never talked over
    expect(line({ due: 'start', panel: 'longPause', sessions: 1 }).session).toBe(GUIDE.longPause);
  });

  it('Your plant, the calendar and the tools follow their own state', () => {
    expect(line({ plant: 'growing' }).plant).toBe(GUIDE.growing);
    expect(line({ plant: 'bloom' }).plant).toBe(GUIDE.bloom);
    expect(line({ plant: 'empty' }).plant).toBe(GUIDE.empty);
    expect(line({ calendar: 'day' }).calendar).toBe(GUIDE.calendarDay);
    expect(line({ calendar: 'week' }).calendar).toBe(GUIDE.calendarWeek);
    expect(line({ calendar: 'month' }).calendar).toBe(GUIDE.calendarMonth);
    expect(line({ calendar: null }).calendar).toBe(GUIDE.calendarDay);
    expect(line({}).tools).toBe(GUIDE.tools);
  });

  it('stays short and quiet: one sentence or two, no exclamation marks, no guilt, no tip repeated', () => {
    const tips = Object.values(TIPS).map((t) => t.copy);
    for (const text of Object.values(GUIDE)) {
      expect(text.length).toBeLessThanOrEqual(84);
      expect(text).not.toMatch(/!/);
      expect(text).not.toMatch(/\b(streak|miss(ed)?|late|behind|lost|failed?|should)\b/i);
      expect(text.endsWith('.')).toBe(true);
      for (const tip of tips) expect(text).not.toBe(tip);
    }
  });
});
