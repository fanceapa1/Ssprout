import { describe, expect, it } from 'vitest';
import { recommendPlans } from '../core/plans';
import { startPrefill } from '../core/schedule';
import { applyPrefill, clearPrefill } from './planting-sheet';
import type { PlantingDraft } from './types';

/** The waiting card's one-tap Start: what the planting draft is prefilled with (ADR 0173). */
const draft = (over: Partial<PlantingDraft> = {}): PlantingDraft => ({
  taskName: '',
  goalMinutes: 25,
  planId: 'unbroken',
  speciesId: 'fx-violet',
  slotId: 'meadow-1',
  ...over,
});
const link = { scheduleId: 's', date: '2026-10-23' };
const occ = (lengthMinutes: number | null, planId: string | null) => ({ scheduleId: 's', date: '2026-10-23', name: 'Essay draft', lengthMinutes, planId });

describe('applyPrefill', () => {
  it('name, length and plan from the schedule; plant and spot are chosen now; the link is kept', () => {
    const d = draft();
    applyPrefill(d, startPrefill(occ(50, 'pomodoro')), recommendPlans);
    expect(d).toEqual({ taskName: 'Essay draft', goalMinutes: 50, planId: 'pomodoro', speciesId: null, slotId: null, link });
  });

  it('a length without a plan: the sheet offers its first plan for that length', () => {
    const d = draft({ planId: 'pomodoro', goalMinutes: 60 });
    applyPrefill(d, startPrefill(occ(90, null)), recommendPlans);
    expect([d.goalMinutes, d.planId]).toEqual([90, null]);
  });

  it('length and plan left open: the remembered total and a still-offered plan stay', () => {
    const d = draft({ goalMinutes: 60, planId: 'long-focus' });
    applyPrefill(d, startPrefill(occ(null, null)), recommendPlans);
    expect([d.taskName, d.goalMinutes, d.planId]).toEqual(['Essay draft', 60, 'long-focus']);
  });

  it('a normal start afterwards drops the link and the scheduled name; without a link nothing changes', () => {
    const d = draft();
    applyPrefill(d, startPrefill(occ(50, null)), recommendPlans);
    clearPrefill(d);
    expect([d.link, d.taskName, d.goalMinutes]).toEqual([null, '', 50]);
    const plain = draft({ taskName: 'Mine' });
    clearPrefill(plain);
    expect(plain.taskName).toBe('Mine');
  });
});
