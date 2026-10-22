import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import type { GardenState, Settings } from '../core/state';
import {
  createNotifier,
  decideNotification,
  NOTIFICATION_TAG,
  notificationText,
  reconcileSetting,
  shouldAsk,
  type NotificationEnv,
  type NotificationPayload,
  type PermissionState,
} from './notifications';
import { fakeBus, fakeController, status } from './test-helpers';

describe('decideNotification', () => {
  const base = { supported: true, permission: 'granted' as const, setting: 'granted' as const, attended: false, alreadyNotified: false };

  it('notifies when granted, not attended and not yet notified', () => {
    expect(decideNotification(base)).toBe('notify');
    // the browser permission is what matters; an 'unasked' setting does not block
    expect(decideNotification({ ...base, setting: 'unasked' })).toBe('notify');
  });

  it('respects missing support, permission and opt-out', () => {
    expect(decideNotification({ ...base, supported: false })).toBe('unsupported');
    expect(decideNotification({ ...base, permission: 'default' })).toBe('not-granted');
    expect(decideNotification({ ...base, permission: 'denied' })).toBe('not-granted');
    expect(decideNotification({ ...base, setting: 'denied' })).toBe('opted-out');
  });

  it('stays quiet when the page is visible and focused (the in-page flow shows it)', () => {
    expect(decideNotification({ ...base, attended: true })).toBe('attended');
  });

  it('never notifies twice for one moment', () => {
    expect(decideNotification({ ...base, alreadyNotified: true })).toBe('duplicate');
  });
});

describe('reconcileSetting / shouldAsk', () => {
  it('mirrors a browser answer into the setting', () => {
    expect(reconcileSetting('unasked', 'granted')).toBe('granted');
    expect(reconcileSetting('granted', 'granted')).toBeNull();
    expect(reconcileSetting('denied', 'granted')).toBeNull(); // in-app opt-out wins
    expect(reconcileSetting('unasked', 'denied')).toBe('denied');
    expect(reconcileSetting('granted', 'denied')).toBe('denied');
    expect(reconcileSetting('denied', 'denied')).toBeNull();
  });

  it('a permission reset in the browser re-arms the question; an in-app denial is kept', () => {
    expect(reconcileSetting('granted', 'default')).toBe('unasked');
    expect(reconcileSetting('unasked', 'default')).toBeNull();
    expect(reconcileSetting('denied', 'default')).toBeNull();
    expect(reconcileSetting('unasked', 'unsupported')).toBeNull();
  });

  it('asks only while unasked, undecided and not yet asked on this page', () => {
    expect(shouldAsk('unasked', 'default', false)).toBe(true);
    expect(shouldAsk('unasked', 'default', true)).toBe(false);
    expect(shouldAsk('unasked', 'granted', false)).toBe(false);
    expect(shouldAsk('denied', 'default', false)).toBe(false);
    expect(shouldAsk('unasked', 'unsupported', false)).toBe(false);
  });
});

describe('notificationText', () => {
  it('names the plant and the task', () => {
    expect(notificationText('break', 'Japanese Iris', 'Biology')).toMatchObject({ title: 'Time for a break — your Japanese Iris is thirsty.' });
    expect(notificationText('focus', 'Japanese Iris', 'Biology ch. 4')).toMatchObject({ title: 'Back to focus — Biology ch. 4.' });
    expect(notificationText('complete', 'Japanese Iris', 'Biology')).toEqual({
      title: 'Your session is complete',
      body: 'Your Japanese Iris has bloomed — return to your garden.',
    });
  });
});

/** A scriptable NotificationEnv. */
function fakeEnv(initial: PermissionState = 'default') {
  let perm = initial;
  let attended = false;
  const shown: NotificationPayload[] = [];
  let resolveRequest: ((p: PermissionState) => void) | null = null;
  const env: NotificationEnv & {
    shown: NotificationPayload[];
    requests: number;
    prepared: number;
    setAttended(v: boolean): void;
    answer(p: PermissionState): void;
    inGesture: boolean;
    requestedOutsideGesture: boolean;
  } = {
    supported: true,
    shown,
    requests: 0,
    prepared: 0,
    inGesture: false,
    requestedOutsideGesture: false,
    permission: () => perm,
    request() {
      env.requests++;
      if (!env.inGesture) env.requestedOutsideGesture = true;
      return new Promise((res) => {
        resolveRequest = (p) => {
          perm = p;
          res(p);
        };
      });
    },
    answer(p) {
      resolveRequest?.(p);
    },
    attended: () => attended,
    setAttended(v) {
      attended = v;
    },
    prepare() {
      env.prepared++;
    },
    async show(n) {
      shown.push(n);
      return 'service-worker';
    },
    appUrl: () => 'https://example.test/Ssprout/?dev',
    icon: (kind) => `icon:${kind}`,
  };
  return env;
}

function setup(env: NotificationEnv, setting: Settings['notifications'] = 'unasked') {
  const clock = createManualClock(1_800_000_000_000);
  const settings: Pick<Settings, 'notifications'> = { notifications: setting };
  const store = { get: () => ({ settings }) as unknown as GardenState };
  const controller = fakeController(status());
  const updateSettings = vi.fn((patch: Partial<Settings>) => {
    if (patch.notifications) settings.notifications = patch.notifications;
    return true;
  });
  const bus = fakeBus();
  const notifier = createNotifier({
    controller: { ...controller, updateSettings },
    store,
    bus,
    clock,
    env,
    speciesName: (id) => (id === 'japanese-iris' ? 'Japanese Iris' : undefined),
  });
  /** a click on "Begin": the controller starts the session and emits session:start in the click */
  const clickBegin = () => {
    controller.set(status('focus', {}, { speciesId: 'japanese-iris' }));
    (env as ReturnType<typeof fakeEnv>).inGesture = true;
    try {
      bus.emit('session:start', { session: controller.status().session });
    } finally {
      (env as ReturnType<typeof fakeEnv>).inGesture = false;
    }
  };
  return { clock, settings, controller, updateSettings, bus, notifier, clickBegin };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createNotifier · permission flow', () => {
  it('asks at the first session:start, synchronously inside the click, and stores a grant', async () => {
    const env = fakeEnv('default');
    const { settings, clickBegin } = setup(env);
    clickBegin();
    expect(env.requests).toBe(1);
    expect(env.requestedOutsideGesture).toBe(false);
    env.answer('granted');
    await flush();
    expect(settings.notifications).toBe('granted');
    expect(env.prepared).toBeGreaterThan(0); // service worker registered once granted
  });

  it('stores a denial and never asks again', async () => {
    const env = fakeEnv('default');
    const { settings, clickBegin } = setup(env);
    clickBegin();
    env.answer('denied');
    await flush();
    expect(settings.notifications).toBe('denied');
    clickBegin();
    expect(env.requests).toBe(1);
  });

  it('a dismissed prompt leaves the setting unasked and is not repeated on this page', async () => {
    const env = fakeEnv('default');
    const { settings, clickBegin } = setup(env);
    clickBegin();
    env.answer('default');
    await flush();
    expect(settings.notifications).toBe('unasked');
    clickBegin();
    expect(env.requests).toBe(1);
  });

  it('does not prompt when the browser already decided; mirrors the answer instead', () => {
    const granted = fakeEnv('granted');
    const a = setup(granted);
    expect(a.settings.notifications).toBe('granted'); // synced at creation
    a.clickBegin();
    expect(granted.requests).toBe(0);

    const denied = fakeEnv('denied');
    const b = setup(denied);
    expect(b.settings.notifications).toBe('denied');
    b.clickBegin();
    expect(denied.requests).toBe(0);
  });

  it('requestPermissionFromGesture shares one pending prompt', async () => {
    const env = fakeEnv('default');
    const { notifier, settings, clickBegin } = setup(env);
    const p1 = notifier.requestPermissionFromGesture();
    const p2 = notifier.requestPermissionFromGesture();
    expect(p1).toBe(p2);
    expect(env.requests).toBe(1);
    env.answer('granted');
    await expect(p1).resolves.toBe('granted');
    expect(settings.notifications).toBe('granted');
    // the UI asked first, so session:start does not ask again
    clickBegin();
    expect(env.requests).toBe(1);
  });

  it('an explicit request stores the browser answer even over an in-app opt-out', async () => {
    const env = fakeEnv('granted');
    const { notifier, settings } = setup(env, 'denied');
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('granted');
    expect(settings.notifications).toBe('granted');
    expect(env.requests).toBe(0);
  });

  it('a throwing request falls back to the current permission', async () => {
    const env = fakeEnv('default');
    env.request = () => {
      throw new Error('blocked');
    };
    const { notifier } = setup(env);
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('default');
  });

  it('reports unsupported browsers without touching settings', async () => {
    const env = { ...fakeEnv('default'), supported: false };
    const { notifier, settings, clickBegin } = setup(env);
    clickBegin();
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('unsupported');
    expect(settings.notifications).toBe('unasked');
  });
});

describe('createNotifier · session moments', () => {
  it('break, back to focus and bloom, while the page is not attended', () => {
    const env = fakeEnv('granted');
    const { controller, bus, notifier, clock, clickBegin } = setup(env);
    clickBegin();
    controller.set(status('break', { blockIndex: 1, block: { kind: 'break', minutes: 10 } }, { speciesId: 'japanese-iris' }));
    bus.emit('session:break', { sessionId: 'session-test' });
    controller.set(status('focus', { blockIndex: 2 }, { speciesId: 'japanese-iris' }));
    bus.emit('session:focus', { sessionId: 'session-test' });
    controller.set(status()); // the session is gone by the time completion is announced
    bus.emit('session:complete', { sessionId: 'session-test' });
    expect(env.shown.map((n) => n.title)).toEqual([
      'Time for a break — your Japanese Iris is thirsty.',
      'Back to focus — Biology ch. 4.',
      'Your session is complete',
    ]);
    expect(env.shown[2]).toEqual({
      title: 'Your session is complete',
      body: 'Your Japanese Iris has bloomed — return to your garden.',
      tag: NOTIFICATION_TAG,
      icon: 'icon:complete',
      timestamp: clock.now(),
      data: { url: 'https://example.test/Ssprout/?dev', sessionId: 'session-test', kind: 'complete' },
    });
    expect(new Set(env.shown.map((n) => n.tag)).size).toBe(1);
    expect(notifier.lastDecision()).toEqual({ kind: 'complete', decision: 'notify' });
  });

  it('does not notify while the page is visible and focused', () => {
    const env = fakeEnv('granted');
    env.setAttended(true);
    const { bus, notifier, clickBegin } = setup(env);
    clickBegin();
    bus.emit('session:complete', {});
    expect(notifier.lastDecision()).toEqual({ kind: 'complete', decision: 'attended' });
    expect(env.shown).toEqual([]);
  });

  it('the same block is announced once', () => {
    const env = fakeEnv('granted');
    const { controller, bus, clickBegin } = setup(env);
    clickBegin();
    controller.set(status('break', { blockIndex: 1 }));
    bus.emit('session:break', {});
    bus.emit('session:break', {});
    bus.emit('session:complete', { sessionId: 'x' });
    bus.emit('session:complete', { sessionId: 'x' });
    expect(env.shown).toHaveLength(2);
  });

  it('respects denied permission and an in-app opt-out', () => {
    const env = fakeEnv('denied');
    const a = setup(env);
    a.clickBegin();
    a.bus.emit('session:complete', {});
    expect(a.notifier.lastDecision()?.decision).toBe('not-granted');

    const granted = fakeEnv('granted');
    const b = setup(granted, 'denied');
    b.clickBegin();
    b.bus.emit('session:complete', {});
    expect(b.notifier.lastDecision()?.decision).toBe('opted-out');
    expect(granted.shown).toEqual([]);
  });

  it('stops listening after dispose', () => {
    const env = fakeEnv('granted');
    const { bus, notifier, clickBegin } = setup(env);
    notifier.dispose();
    clickBegin();
    bus.emit('session:complete', {});
    expect(env.shown).toEqual([]);
    expect(bus.count()).toBe(0);
  });

  it('show failures are swallowed', async () => {
    const env = fakeEnv('granted');
    env.show = vi.fn(async () => 'failed' as const);
    const { bus, clickBegin } = setup(env);
    clickBegin();
    expect(() => bus.emit('session:complete', {})).not.toThrow();
    await flush();
    expect(env.show).toHaveBeenCalledTimes(1);
  });
});

describe('createNotifier · scheduled sessions (ADR 0174)', () => {
  const due = (key: string, name = 'Biology ch. 4') => ({ occurrence: { key, name, scheduleId: 's', date: '2026-10-23' } });

  it('a scheduled session’s time comes while the page is in the background: one soft notification', () => {
    const env = fakeEnv('granted');
    const { bus, notifier, clock } = setup(env, 'granted');
    bus.emit('schedule:due', due('s@2026-10-23'));
    bus.emit('schedule:due', due('s@2026-10-23'));
    expect(env.shown).toEqual([
      {
        title: 'It’s time for “Biology ch. 4”.',
        body: 'Whenever you are ready, a card in your garden will start it.',
        tag: NOTIFICATION_TAG,
        icon: 'icon:scheduled',
        timestamp: clock.now(),
        data: { url: 'https://example.test/Ssprout/?dev', sessionId: 's@2026-10-23', kind: 'scheduled' },
      },
    ]);
    expect(notifier.lastDecision()).toEqual({ kind: 'scheduled', decision: 'duplicate' });
    bus.emit('schedule:due', due('s@2026-10-24', 'Essay'));
    expect(env.shown.map((n) => n.title)).toEqual(['It’s time for “Biology ch. 4”.', 'It’s time for “Essay”.']);
  });

  it('stays quiet while the page is attended, and follows permission and opt-out', () => {
    const env = fakeEnv('granted');
    env.setAttended(true);
    const a = setup(env, 'granted');
    a.bus.emit('schedule:due', due('k1'));
    expect(a.notifier.lastDecision()).toEqual({ kind: 'scheduled', decision: 'attended' });
    const b = setup(fakeEnv('granted'), 'denied');
    b.bus.emit('schedule:due', due('k1'));
    expect(b.notifier.lastDecision()).toEqual({ kind: 'scheduled', decision: 'opted-out' });
    expect(env.shown).toEqual([]);
  });

  it('ignores a malformed payload', () => {
    const env = fakeEnv('granted');
    const { bus, notifier } = setup(env, 'granted');
    bus.emit('schedule:due', {});
    expect(notifier.lastDecision()).toBeNull();
  });
});
