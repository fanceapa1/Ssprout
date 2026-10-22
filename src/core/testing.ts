import type { PlanBlock, StudyPlan } from './plans';
import type { ActiveSession, PlantInstance, PressedFlower } from './state';

/** Test fixtures for core state (imported by tests only). */

export const MIN = 60_000;
export const T0 = 1_700_000_000_000;

const f = (minutes: number): PlanBlock => ({ kind: 'focus', minutes });
const b = (minutes: number): PlanBlock => ({ kind: 'break', minutes });

/** Build a plan from a compact shape: positive = focus, negative = break. `[25, -5, 25]` */
export function plan(shape: number[], id = 'test-plan'): StudyPlan {
  return { id, name: id, blocks: shape.map((m) => (m >= 0 ? f(m) : b(-m))) };
}

export function makeSession(over: Partial<ActiveSession> = {}): ActiveSession {
  const p = over.plan ?? plan([25]);
  const total = p.blocks.reduce((s, x) => s + x.minutes, 0);
  return {
    id: 's1',
    taskName: 'Biology ch. 4',
    goalMs: total * MIN,
    plan: p,
    speciesId: 'violet',
    slotId: 'meadow-1',
    seed: 42,
    displacedPlantId: null,
    startedAt: T0,
    pausedAt: null,
    pausedTotalMs: 0,
    skippedMs: 0,
    weather: 'sun',
    waterings: [],
    focusWaterings: 0,
    ...over,
  };
}

export function makePlant(over: Partial<PlantInstance> = {}): PlantInstance {
  return {
    id: 'p1',
    speciesId: 'violet',
    slotId: 'meadow-1',
    seed: 7,
    plantedAt: T0 - 30 * MIN,
    sessionMinutes: 25,
    taskName: 'Old task',
    completedAt: T0 - 5 * MIN,
    ...over,
  };
}

export function makePressed(over: Partial<PressedFlower> = {}): PressedFlower {
  return { speciesId: 'clover', seed: 3, plantedAt: T0, removedAt: T0 + 5, taskName: 'Pressed task', ...over };
}
