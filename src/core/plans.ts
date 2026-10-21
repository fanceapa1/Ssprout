import { clampGoalMinutes } from './session';

/**
 * Study plans (SPEC §2 step 3, ADR 0036): how a session's total time is divided into focus
 * blocks and breaks. Breaks are *inside* the total. Pure.
 */

export type PlanBlock = { kind: 'focus' | 'break'; minutes: number };
export interface StudyPlan {
  id: string;
  name: string;
  blocks: PlanBlock[];
}

export type PlanId = 'unbroken' | 'pomodoro' | 'long-focus' | 'deep-work' | 'two-deep';

const STEP = 5;
const focus = (minutes: number): PlanBlock => ({ kind: 'focus', minutes });
const rest = (minutes: number): PlanBlock => ({ kind: 'break', minutes });

/** Split `total` minutes into `n` focus blocks on the 5-minute grid, larger blocks first. */
function splitFocus(total: number, n: number): number[] {
  const units = Math.round(total / STEP);
  const base = Math.floor(units / n);
  const extra = units % n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) * STEP);
}

/** focus · break · focus · … · focus with `n` focus blocks sharing what the breaks leave. */
function cycles(total: number, n: number, breakMinutes: number): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  splitFocus(total - breakMinutes * (n - 1), n).forEach((m, i) => {
    if (i > 0) blocks.push(rest(breakMinutes));
    blocks.push(focus(m));
  });
  return blocks;
}

export function unbrokenPlan(totalMinutes: number): StudyPlan {
  return { id: 'unbroken', name: 'Unbroken', blocks: [focus(totalMinutes)] };
}

interface PlanRecipe {
  id: PlanId;
  name: string;
  /** inclusive total-minute range this plan is offered for */
  min: number;
  max: number;
  build(total: number): PlanBlock[];
}

/**
 * Recipes in display order. Windows: <30 only Unbroken · 30–55 +Pomodoro · 60–70 +Long focus ·
 * 75–115 +Deep work · 120+ Two deep blocks replaces Deep work (never more than 4 plans).
 */
const RECIPES: readonly PlanRecipe[] = [
  { id: 'unbroken', name: 'Unbroken', min: 10, max: 180, build: (t) => [focus(t)] },
  // ~25-minute focus blocks with 5-minute breaks
  { id: 'pomodoro', name: 'Pomodoro', min: 30, max: 180, build: (t) => cycles(t, Math.max(2, Math.floor((t + 5) / 30)), 5) },
  // ~50-minute focus blocks with 10-minute breaks (60 → 25 · 10 · 25)
  { id: 'long-focus', name: 'Long focus', min: 60, max: 180, build: (t) => cycles(t, Math.max(2, Math.round((t + 10) / 60)), 10) },
  // one long block, a 15-minute break, a shorter closing block (90 → 50 · 15 · 25)
  {
    id: 'deep-work',
    name: 'Deep work',
    min: 75,
    max: 115,
    build: (t) => {
      const first = Math.round(((t - 15) * 2) / 3 / STEP) * STEP;
      return [focus(first), rest(15), focus(t - 15 - first)];
    },
  },
  // two equal blocks around a 20-minute break (150 → 65 · 20 · 65)
  { id: 'two-deep', name: 'Two deep blocks', min: 120, max: 180, build: (t) => cycles(t, 2, 20) },
];

const signature = (blocks: readonly PlanBlock[]) => blocks.map((b) => `${b.kind[0]}${b.minutes}`).join(' ');

/**
 * 2–4 plans for a total (only Unbroken below 30 min). Every plan sums exactly to the total, ends
 * with a focus block, and 'unbroken' is always first. Off-grid totals are snapped first
 * (`clampGoalMinutes`), so the sums match the session's goal.
 */
export function recommendPlans(totalMinutes: number): StudyPlan[] {
  const total = clampGoalMinutes(totalMinutes);
  const seen = new Set<string>();
  const out: StudyPlan[] = [];
  for (const r of RECIPES) {
    if (total < r.min || total > r.max) continue;
    const blocks = r.build(total);
    const sig = signature(blocks);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: r.id, name: r.name, blocks });
  }
  return out;
}

/** The recommended plan with this id for this total, if offered. */
export function findPlan(totalMinutes: number, planId: string): StudyPlan | undefined {
  return recommendPlans(totalMinutes).find((p) => p.id === planId);
}

export const planMinutes = (plan: Pick<StudyPlan, 'blocks'>): number => plan.blocks.reduce((sum, b) => sum + b.minutes, 0);

export const focusMinutes = (plan: Pick<StudyPlan, 'blocks'>): number =>
  plan.blocks.reduce((sum, b) => sum + (b.kind === 'focus' ? b.minutes : 0), 0);

export const hasBreaks = (plan: Pick<StudyPlan, 'blocks'>): boolean => plan.blocks.some((b) => b.kind === 'break');

/**
 * Why a plan is unusable for a session of `totalMinutes`, or null when it is fine: non-empty
 * id/name, ≥ 1 block, every block a known kind with finite minutes > 0, sums to the total,
 * ends with focus.
 */
export function planProblem(plan: unknown, totalMinutes: number): string | null {
  if (typeof plan !== 'object' || plan === null) return 'plan must be an object';
  const p = plan as Partial<StudyPlan>;
  if (typeof p.id !== 'string' || p.id === '') return 'plan id must be a non-empty string';
  if (typeof p.name !== 'string' || p.name === '') return 'plan name must be a non-empty string';
  if (!Array.isArray(p.blocks) || p.blocks.length === 0) return 'plan needs at least one block';
  for (const b of p.blocks as unknown[]) {
    const block = b as Partial<PlanBlock> | null;
    if (!block || (block.kind !== 'focus' && block.kind !== 'break')) return 'block kind must be focus or break';
    if (typeof block.minutes !== 'number' || !Number.isFinite(block.minutes) || block.minutes <= 0) {
      return 'block minutes must be a positive number';
    }
  }
  const blocks = p.blocks as PlanBlock[];
  if (blocks[blocks.length - 1]!.kind !== 'focus') return 'plan must end with a focus block';
  if (planMinutes({ blocks }) !== totalMinutes) return `plan blocks must sum to ${totalMinutes} min`;
  return null;
}
