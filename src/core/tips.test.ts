import { describe, expect, it } from 'vitest';
import { createDefaultState, reducer, type Action, type GardenState } from './state';
import { makePlant, makePressed, makeSession, MIN, plan, T0 } from './testing';
import { activeTips, allTips, getTip, isRetired, TIP_IDS, TIPS, tipsRetiredBy } from './tips';

const ids = (state: GardenState, ctx?: Parameters<typeof activeTips>[1]) => activeTips(state, ctx).map((t) => t.id);
const run = (s: GardenState, ...a: Action[]) => a.reduce(reducer, s);

const idle = () => createDefaultState(T0);
const POMODORO = plan([25, -5, 25]);
const inSession = (over = {}) => ({ ...idle(), session: makeSession({ plan: POMODORO, ...over }) });
const startAction = (over: Partial<Extract<Action, { type: 'session/start' }>> = {}): Action => ({
  type: 'session/start',
  id: 's',
  taskName: 'Task',
  goalMinutes: 25,
  plan: plan([25]),
  speciesId: 'violet',
  slotId: 'meadow-1',
  seed: 1,
  now: T0,
  weather: 'sun',
  ...over,
});

describe('tip registry', () => {
  it('has the contract ids with short, kind copy', () => {
    expect(TIP_IDS).toEqual([
      'task',
      'duration',
      'plan',
      'placement',
      'swap',
      'notifications',
      'widget',
      'water',
      'switch',
      'pressed',
      'sound',
    ]);
    for (const t of TIPS) {
      expect(t.copy.length).toBeGreaterThan(10);
      expect(t.copy.length).toBeLessThan(110);
      expect(t.copy).not.toMatch(/!/); // calm: no exclamation marks
    }
    expect(getTip('duration')!.copy).toBe("Slide to choose how long you'll study. Longer sessions grow rarer plants.");
    expect(getTip('plan')!.copy).toBe('Breaks are watering moments — your plant will be glad of them.');
    expect(getTip('nope')).toBeUndefined();
  });
});

describe('activeTips', () => {
  it('idle: the start-flow tips, notifications and sound', () => {
    expect(ids(idle())).toEqual(['task', 'duration', 'plan', 'placement', 'notifications', 'sound']);
  });

  it('swap appears once there are plants to replace (or when the UI says so)', () => {
    expect(ids({ ...idle(), plants: [makePlant()] })).toContain('swap');
    expect(ids({ ...idle(), plants: [makePlant()] }, { swapAvailable: false })).not.toContain('swap');
  });

  it('notifications tip disappears once permission was asked', () => {
    const s = run(idle(), { type: 'settings/update', patch: { notifications: 'denied' } });
    expect(ids(s)).not.toContain('notifications');
  });

  it('during focus: widget (when supported) and sound', () => {
    expect(ids(inSession(), { now: T0 + MIN })).toEqual(['widget', 'sound']);
    expect(ids(inSession(), { now: T0 + MIN, widgetSupported: false })).toEqual(['sound']);
  });

  it('during a break: water', () => {
    expect(ids(inSession(), { now: T0 + 26 * MIN })).toEqual(['widget', 'water', 'sound']);
    expect(ids(inSession())).not.toContain('water'); // no `now` → unknown
  });

  it('pressed appears once the herbarium has something in it', () => {
    expect(ids({ ...idle(), pressed: [makePressed()] })).toContain('pressed');
  });

  it('retired tips are never active', () => {
    const s = run(idle(), { type: 'tip/retire', id: 'duration' }, { type: 'tip/retire', id: 'sound' });
    expect(ids(s)).toEqual(['task', 'plan', 'placement', 'notifications']);
    expect(isRetired(s, 'duration')).toBe(true);
  });

  it('allTips lists every tip with its retired flag', () => {
    const list = allTips(run(idle(), { type: 'tip/retire', id: 'swap' }));
    expect(list.map((t) => t.id)).toEqual(TIP_IDS);
    expect(list.filter((t) => t.retired).map((t) => t.id)).toEqual(['swap']);
  });
});

describe('tipsRetiredBy', () => {
  const step = (prev: GardenState, a: Action) => tipsRetiredBy(a, prev, reducer(prev, a));

  it('starting retires task, duration and placement', () => {
    expect(step(idle(), startAction())).toEqual(['task', 'duration', 'placement']);
  });

  it('starting with breaks also retires plan; into an occupied slot also swap', () => {
    expect(step(idle(), startAction({ plan: POMODORO, goalMinutes: 55 }))).toContain('plan');
    expect(step({ ...idle(), plants: [makePlant({ id: 'old' })] }, startAction())).toContain('swap');
  });

  it('watering retires water', () => {
    expect(step(inSession(), { type: 'session/water', blockIndex: 1, now: T0 + 26 * MIN })).toEqual(['water']);
  });

  it('toggling sound retires sound; answering permission retires notifications', () => {
    expect(step(idle(), { type: 'settings/update', patch: { muted: false } })).toEqual(['sound']);
    expect(step(idle(), { type: 'settings/update', patch: { notifications: 'granted' } })).toEqual(['notifications']);
  });

  it('nothing for no-op actions, already retired tips or unrelated actions', () => {
    expect(step(inSession(), startAction({ id: 't' }))).toEqual([]);
    const retired = run(idle(), { type: 'tip/retire', id: 'duration' });
    expect(step(retired, startAction())).toEqual(['task', 'placement']);
    expect(step(idle(), { type: 'fauna/seen', id: 'koi-1' })).toEqual([]);
  });
});
