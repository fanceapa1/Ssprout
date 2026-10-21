import { describe, expect, it } from 'vitest';
import { planSegments, planSummary, xAtMinutes } from './plan-line';

const F = (minutes: number) => ({ kind: 'focus' as const, minutes });
const B = (minutes: number) => ({ kind: 'break' as const, minutes });

describe('plan line geometry', () => {
  it('spans the full width and keeps breaks readable', () => {
    const segs = planSegments([F(25), B(5), F(25), B(5), F(25), B(5)].slice(0, 5), 300);
    expect(segs).toHaveLength(5);
    expect(segs[0]!.x0).toBe(0);
    expect(segs[4]!.x1).toBeCloseTo(300);
    for (const s of segs.filter((s) => s.kind === 'break')) expect(s.x1 - s.x0).toBeGreaterThanOrEqual(14);
    // equal focus blocks get equal widths
    expect(segs[0]!.x1 - segs[0]!.x0).toBeCloseTo(segs[2]!.x1 - segs[2]!.x0);
  });

  it('an unbroken plan is one segment', () => {
    expect(planSegments([F(50)], 200)).toEqual([{ index: 0, kind: 'focus', x0: 0, x1: 200, m0: 0, m1: 50 }]);
    expect(planSegments([], 200)).toEqual([]);
  });

  it('maps elapsed minutes to x piecewise', () => {
    const segs = planSegments([F(50), B(10), F(50)], 300);
    expect(xAtMinutes(segs, 0)).toBe(0);
    expect(xAtMinutes(segs, 25)).toBeCloseTo(segs[0]!.x1 / 2);
    expect(xAtMinutes(segs, 55)).toBeCloseTo((segs[1]!.x0 + segs[1]!.x1) / 2);
    expect(xAtMinutes(segs, 999)).toBeCloseTo(300);
  });

  it('summarises plans', () => {
    expect(planSummary([F(50)])).toBe('50 min, unbroken');
    expect(planSummary([F(25), B(5), F(25), B(5), F(25)])).toBe('3 × 25 min · 5-min breaks');
    expect(planSummary([F(65), B(20), F(65)])).toBe('65 · break 20 · 65');
  });
});
