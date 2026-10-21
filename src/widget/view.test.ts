import { describe, expect, it } from 'vitest';
import type { ActiveSession, PendingReward } from '../core/state';
import { status } from './test-helpers';
import { widgetView } from './view';

const session: ActiveSession = {
  id: 'session-abc',
  goalMs: 25 * 60_000,
  startedAt: 0,
  pausedAt: null,
  pausedTotalMs: 0,
  weather: 'sun',
};
const reward: PendingReward = { sessionId: 'session-abc', goalMinutes: 25, tier: 2, options: [], chosen: null, completedAt: 1 };

describe('widgetView', () => {
  it('idle: no time, "No session running", open-garden action', () => {
    expect(widgetView(status())).toEqual({
      mode: 'idle',
      time: '',
      state: 'No session running',
      growth: 0,
      bloom: false,
      action: { kind: 'open', label: 'Open garden' },
      seed: 'idle',
    });
  });

  it('running: remaining time, growth = progress, pause action, seeded by session', () => {
    const v = widgetView(status({ phase: 'running', session, remainingMs: (24 * 60 + 13) * 1000, progress: 0.3 }));
    expect(v).toMatchObject({ mode: 'running', time: '24:13', growth: 0.3, bloom: false, seed: 'session-abc' });
    expect(v.action).toEqual({ kind: 'pause', label: 'Pause' });
  });

  it('paused: "paused" and a resume action', () => {
    const v = widgetView(status({ phase: 'paused', session: { ...session, pausedAt: 5 }, remainingMs: 600_000, progress: 0.6 }));
    expect(v).toMatchObject({ mode: 'paused', time: '10:00', state: 'paused', growth: 0.6 });
    expect(v.action.kind).toBe('resume');
  });

  it('complete: bloom, the return line and an open-garden action', () => {
    const v = widgetView(status({ phase: 'reward', pendingReward: reward }));
    expect(v).toMatchObject({
      mode: 'complete',
      time: '0:00',
      state: 'complete — return to your garden',
      growth: 1,
      bloom: true,
      seed: 'session-abc',
    });
    expect(v.action).toEqual({ kind: 'open', label: 'Open garden' });
  });

  it('clamps progress', () => {
    expect(widgetView(status({ phase: 'running', session, progress: 3 })).growth).toBe(1);
    expect(widgetView(status({ phase: 'running', session, progress: Number.NaN })).growth).toBe(0);
  });
});
