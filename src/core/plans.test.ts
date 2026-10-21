import { describe, expect, it } from 'vitest';
import {
  findPlan,
  focusMinutes,
  hasBreaks,
  planMinutes,
  planProblem,
  recommendPlans,
  unbrokenPlan,
  type PlanBlock,
} from './plans';

const ALL_TOTALS = Array.from({ length: 35 }, (_, i) => 10 + i * 5); // 10…180
const shape = (blocks: PlanBlock[]) => blocks.map((b) => (b.kind === 'focus' ? `${b.minutes}` : `(${b.minutes})`)).join(' ');
const byId = (total: number) => Object.fromEntries(recommendPlans(total).map((p) => [p.id, shape(p.blocks)]));

describe('recommendPlans', () => {
  it.each(ALL_TOTALS)('%i min: sums exactly, ends with focus, unbroken first, valid blocks', (total) => {
    const plans = recommendPlans(total);
    expect(plans[0]!.id).toBe('unbroken');
    expect(plans[0]!.blocks).toEqual([{ kind: 'focus', minutes: total }]);
    for (const p of plans) {
      expect(planMinutes(p)).toBe(total);
      expect(p.blocks.at(-1)!.kind).toBe('focus');
      expect(p.blocks[0]!.kind).toBe('focus');
      expect(planProblem(p, total)).toBeNull();
      for (const b of p.blocks) {
        expect(b.minutes).toBeGreaterThanOrEqual(5);
        expect(b.minutes % 5).toBe(0);
      }
      // no two breaks in a row
      p.blocks.forEach((b, i) => {
        if (b.kind === 'break') expect(p.blocks[i + 1]!.kind).toBe('focus');
      });
    }
    expect(new Set(plans.map((p) => p.id)).size).toBe(plans.length);
    expect(new Set(plans.map((p) => shape(p.blocks))).size).toBe(plans.length);
  });

  it('offers only Unbroken below 30 minutes', () => {
    for (const t of [10, 15, 20, 25]) expect(recommendPlans(t).map((p) => p.id)).toEqual(['unbroken']);
  });

  it('offers 2–4 plans from 30 minutes on', () => {
    for (const t of ALL_TOTALS.filter((t) => t >= 30)) {
      const n = recommendPlans(t).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it('every non-unbroken plan has at least one break', () => {
    for (const t of ALL_TOTALS) for (const p of recommendPlans(t).slice(1)) expect(hasBreaks(p)).toBe(true);
  });

  it('has the expected shapes for typical totals', () => {
    expect(byId(30)).toEqual({ unbroken: '30', pomodoro: '15 (5) 10' });
    expect(byId(50)).toEqual({ unbroken: '50', pomodoro: '25 (5) 20' });
    expect(byId(60)).toEqual({ unbroken: '60', pomodoro: '30 (5) 25', 'long-focus': '25 (10) 25' });
    expect(byId(90)).toEqual({
      unbroken: '90',
      pomodoro: '30 (5) 25 (5) 25',
      'long-focus': '40 (10) 40',
      'deep-work': '50 (15) 25',
    });
    expect(byId(150)).toEqual({
      unbroken: '150',
      pomodoro: '30 (5) 25 (5) 25 (5) 25 (5) 25',
      'long-focus': '45 (10) 45 (10) 40',
      'two-deep': '65 (20) 65',
    });
    expect(byId(180)['two-deep']).toBe('80 (20) 80');
  });

  it('uses the contract plan ids and human names', () => {
    const ids = new Set(ALL_TOTALS.flatMap((t) => recommendPlans(t).map((p) => p.id)));
    expect([...ids].sort()).toEqual(['deep-work', 'long-focus', 'pomodoro', 'two-deep', 'unbroken']);
    expect(recommendPlans(150).map((p) => p.name)).toEqual(['Unbroken', 'Pomodoro', 'Long focus', 'Two deep blocks']);
  });

  it('snaps off-grid totals first', () => {
    expect(planMinutes(recommendPlans(62)[1]!)).toBe(60);
    expect(planMinutes(recommendPlans(500)[0]!)).toBe(180);
    expect(planMinutes(recommendPlans(1)[0]!)).toBe(10);
  });

  it('returns fresh objects each call', () => {
    const a = recommendPlans(60);
    a[0]!.blocks[0]!.minutes = 1;
    expect(recommendPlans(60)[0]!.blocks[0]!.minutes).toBe(60);
  });
});

describe('plan helpers', () => {
  it('findPlan finds an offered plan or nothing', () => {
    expect(findPlan(60, 'long-focus')?.blocks).toHaveLength(3);
    expect(findPlan(25, 'pomodoro')).toBeUndefined();
    expect(findPlan(60, 'nope')).toBeUndefined();
  });

  it('focusMinutes / planMinutes / hasBreaks / unbrokenPlan', () => {
    const p = findPlan(60, 'long-focus')!;
    expect(planMinutes(p)).toBe(60);
    expect(focusMinutes(p)).toBe(50);
    expect(hasBreaks(p)).toBe(true);
    expect(hasBreaks(unbrokenPlan(40))).toBe(false);
    expect(unbrokenPlan(40)).toEqual({ id: 'unbroken', name: 'Unbroken', blocks: [{ kind: 'focus', minutes: 40 }] });
  });

  it.each([
    ['not an object', null],
    ['no id', { id: '', name: 'x', blocks: [{ kind: 'focus', minutes: 30 }] }],
    ['no name', { id: 'x', name: '', blocks: [{ kind: 'focus', minutes: 30 }] }],
    ['no blocks', { id: 'x', name: 'x', blocks: [] }],
    ['bad kind', { id: 'x', name: 'x', blocks: [{ kind: 'nap', minutes: 30 }] }],
    ['zero minutes', { id: 'x', name: 'x', blocks: [{ kind: 'focus', minutes: 0 }, { kind: 'focus', minutes: 30 }] }],
    ['NaN minutes', { id: 'x', name: 'x', blocks: [{ kind: 'focus', minutes: Number.NaN }] }],
    ['ends with a break', { id: 'x', name: 'x', blocks: [{ kind: 'focus', minutes: 25 }, { kind: 'break', minutes: 5 }] }],
    ['wrong sum', { id: 'x', name: 'x', blocks: [{ kind: 'focus', minutes: 25 }] }],
  ])('planProblem rejects %s', (_n, plan) => {
    expect(planProblem(plan, 30)).toEqual(expect.any(String));
  });
});
