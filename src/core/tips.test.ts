import { describe, expect, it } from 'vitest';
import { createDefaultState, reducer, type Action, type GardenState } from './state';
import { activeTips, allTips, getTip, isRetired, TIP_IDS, TIPS, tipsRetiredBy } from './tips';

const MIN = 60_000;
const ids = (state: GardenState, ctx?: Parameters<typeof activeTips>[1]) => activeTips(state, ctx).map((t) => t.id);
const run = (s: GardenState, ...a: Action[]) => a.reduce(reducer, s);

const idle = () => createDefaultState(0);
const running = () => run(idle(), { type: 'session/start', goalMinutes: 10, now: 0, id: 's', weather: 'sun' });
const placing = (base = idle()) =>
  run(
    base,
    { type: 'session/start', goalMinutes: 10, now: 0, id: 's', weather: 'sun' },
    { type: 'session/complete', now: 10 * MIN, options: ['a'], tier: 1 },
    { type: 'reward/choose', speciesId: 'a' },
  );
const plant = { id: 'p', speciesId: 'b', slotId: 'x', seed: 1, plantedAt: 0, sessionMinutes: 10 };

describe('tip registry', () => {
  it('has the seven contract ids with short, kind copy', () => {
    expect(TIP_IDS).toEqual(['duration', 'notifications', 'widget', 'placement', 'swap', 'pressed', 'sound']);
    for (const t of TIPS) {
      expect(t.copy.length).toBeGreaterThan(10);
      expect(t.copy.length).toBeLessThan(110);
      expect(t.copy).not.toMatch(/!/); // calm: no exclamation marks
    }
    expect(getTip('duration')!.copy).toBe("Slide to choose how long you'll study. Longer sessions grow rarer plants.");
    expect(getTip('nope')).toBeUndefined();
  });
});

describe('activeTips', () => {
  it('idle: duration, notifications, sound', () => {
    expect(ids(idle())).toEqual(['duration', 'notifications', 'sound']);
  });

  it('notifications tip disappears once permission was asked', () => {
    const s = run(idle(), { type: 'settings/update', patch: { notifications: 'denied' } });
    expect(ids(s)).not.toContain('notifications');
  });

  it('running: widget (when supported) and sound', () => {
    expect(ids(running())).toEqual(['widget', 'sound']);
    expect(ids(running(), { widgetSupported: false })).toEqual(['sound']);
  });

  it('placing: placement, swap when a swap is possible', () => {
    expect(ids(placing())).toEqual(['placement', 'sound']);
    expect(ids(placing({ ...idle(), plants: [plant] }))).toEqual(['placement', 'swap', 'sound']);
    expect(ids(placing({ ...idle(), plants: [plant] }), { swapAvailable: false })).toEqual(['placement', 'sound']);
  });

  it('pressed appears once the herbarium has something in it', () => {
    const s = { ...idle(), pressed: [{ speciesId: 'b', seed: 1, plantedAt: 0, removedAt: 1 }] };
    expect(ids(s)).toContain('pressed');
  });

  it('retired tips are never active', () => {
    const s = run(idle(), { type: 'tip/retire', id: 'duration' }, { type: 'tip/retire', id: 'sound' });
    expect(ids(s)).toEqual(['notifications']);
    expect(isRetired(s, 'duration')).toBe(true);
  });

  it('allTips lists every tip with its retired flag', () => {
    const s = run(idle(), { type: 'tip/retire', id: 'swap' });
    const list = allTips(s);
    expect(list.map((t) => t.id)).toEqual(TIP_IDS);
    expect(list.filter((t) => t.retired).map((t) => t.id)).toEqual(['swap']);
  });
});

describe('tipsRetiredBy', () => {
  const step = (prev: GardenState, a: Action) => tipsRetiredBy(a, prev, reducer(prev, a));

  it('starting a session retires duration', () => {
    expect(step(idle(), { type: 'session/start', goalMinutes: 10, now: 0, id: 's', weather: 'sun' })).toEqual([
      'duration',
    ]);
  });

  it('placing retires placement; a swap also retires swap', () => {
    const place: Action = { type: 'plant/place', slotId: 'y', id: 'n', seed: 1, now: 0 };
    expect(step(placing(), place)).toEqual(['placement']);
    const swap: Action = { type: 'plant/place', slotId: 'x', id: 'n', seed: 1, now: 0 };
    expect(step(placing({ ...idle(), plants: [plant] }), swap)).toEqual(['placement', 'swap']);
  });

  it('toggling sound retires sound; answering permission retires notifications', () => {
    expect(step(idle(), { type: 'settings/update', patch: { muted: false } })).toEqual(['sound']);
    expect(step(idle(), { type: 'settings/update', patch: { notifications: 'granted' } })).toEqual(['notifications']);
  });

  it('nothing for no-op actions or already retired tips', () => {
    expect(step(running(), { type: 'session/start', goalMinutes: 10, now: 0, id: 't', weather: 'sun' })).toEqual([]);
    const retired = run(idle(), { type: 'tip/retire', id: 'duration' });
    expect(step(retired, { type: 'session/start', goalMinutes: 10, now: 0, id: 's', weather: 'sun' })).toEqual([]);
    expect(step(idle(), { type: 'fauna/seen', id: 'koi-1' })).toEqual([]);
  });
});
