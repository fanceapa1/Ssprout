import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import { createSessionController } from '../core/controller';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer, type GardenState } from '../core/state';
import {
  createNotifier,
  decideNotification,
  NOTIFICATION_BODY,
  NOTIFICATION_TAG,
  NOTIFICATION_TITLE,
  reconcileSetting,
  shouldAsk,
  type NotificationEnv,
  type NotificationPayload,
  type PermissionState,
} from './notifications';

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

  it('never notifies twice for one session', () => {
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

/** A scriptable NotificationEnv. */
function fakeEnv(initial: PermissionState = 'default', answer: PermissionState = 'granted') {
  let perm = initial;
  let attended = false;
  const shown: NotificationPayload[] = [];
  let resolveRequest: ((p: PermissionState) => void) | null = null;
  const env: NotificationEnv & {
    shown: NotificationPayload[];
    requests: number;
    prepared: number;
    setAttended(v: boolean): void;
    setPermission(p: PermissionState): void;
    answer(p?: PermissionState): void;
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
          perm = p === 'default' ? 'default' : p;
          res(p);
        };
      });
    },
    answer(p = answer) {
      resolveRequest?.(p);
    },
    attended: () => attended,
    setAttended(v) {
      attended = v;
    },
    setPermission(p) {
      perm = p;
    },
    prepare() {
      env.prepared++;
    },
    async show(n) {
      shown.push(n);
      return 'service-worker';
    },
    appUrl: () => 'https://example.test/Ssprout/?dev',
    icon: () => 'data:image/png;base64,AAAA',
  };
  return env;
}

function setup(env: ReturnType<typeof fakeEnv>, state?: Partial<GardenState>) {
  const clock = createManualClock(1_800_000_000_000);
  const store = createStore({ ...createDefaultState(clock.now()), ...state }, reducer);
  const bus = createEventBus();
  const manualTicker = { start: () => () => {} };
  const controller = createSessionController({ store, clock, bus, species: [], seed: 3, ticker: manualTicker });
  const notifier = createNotifier({ controller, store, bus, clock, env });
  /** a click on "Begin": start() runs inside the gesture */
  const clickBegin = (min = 10) => {
    env.inGesture = true;
    try {
      return controller.start(min);
    } finally {
      env.inGesture = false;
    }
  };
  const complete = () => {
    clock.advance((store.get().session?.goalMs ?? 0) + 1);
    return controller.check();
  };
  return { clock, store, bus, controller, notifier, clickBegin, complete };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createNotifier · permission flow', () => {
  it('asks at the first session:start, synchronously inside the click, and stores a grant', async () => {
    const env = fakeEnv('default');
    const { store, clickBegin } = setup(env);
    clickBegin();
    expect(env.requests).toBe(1);
    expect(env.requestedOutsideGesture).toBe(false);
    env.answer('granted');
    await flush();
    expect(store.get().settings.notifications).toBe('granted');
    expect(env.prepared).toBeGreaterThan(0); // service worker registered once granted
    expect(store.get().tips.notifications).toBe('seen'); // the tip retires itself
  });

  it('stores a denial and never asks again', async () => {
    const env = fakeEnv('default');
    const { store, controller, clickBegin } = setup(env);
    clickBegin();
    env.answer('denied');
    await flush();
    expect(store.get().settings.notifications).toBe('denied');
    controller.cancel();
    clickBegin();
    expect(env.requests).toBe(1);
  });

  it('a dismissed prompt leaves the setting unasked and is not repeated on this page', async () => {
    const env = fakeEnv('default');
    const { store, controller, clickBegin } = setup(env);
    clickBegin();
    env.answer('default');
    await flush();
    expect(store.get().settings.notifications).toBe('unasked');
    controller.cancel();
    clickBegin();
    expect(env.requests).toBe(1);
  });

  it('does not prompt when the browser already decided; mirrors the answer instead', () => {
    const granted = fakeEnv('granted');
    const a = setup(granted);
    expect(a.store.get().settings.notifications).toBe('granted'); // synced at creation
    a.clickBegin();
    expect(granted.requests).toBe(0);

    const denied = fakeEnv('denied');
    const b = setup(denied);
    expect(b.store.get().settings.notifications).toBe('denied');
    b.clickBegin();
    expect(denied.requests).toBe(0);
  });

  it('requestPermissionFromGesture shares one pending prompt', async () => {
    const env = fakeEnv('default');
    const { notifier, store } = setup(env);
    const p1 = notifier.requestPermissionFromGesture();
    const p2 = notifier.requestPermissionFromGesture();
    expect(p1).toBe(p2);
    expect(env.requests).toBe(1);
    env.answer('granted');
    await expect(p1).resolves.toBe('granted');
    expect(store.get().settings.notifications).toBe('granted');
    // the UI calling it first means session:start does not ask again
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('granted');
    expect(env.requests).toBe(1);
  });

  it('an explicit request stores the browser answer even over an in-app opt-out', async () => {
    const env = fakeEnv('granted');
    const { notifier, store, controller } = setup(env);
    controller.updateSettings({ notifications: 'denied' });
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('granted');
    expect(store.get().settings.notifications).toBe('granted');
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
    const { notifier, store, clickBegin } = setup(env as ReturnType<typeof fakeEnv>);
    clickBegin();
    await expect(notifier.requestPermissionFromGesture()).resolves.toBe('unsupported');
    expect(store.get().settings.notifications).toBe('unasked');
  });
});

describe('createNotifier · completion', () => {
  it('notifies on completion when the page is not attended', async () => {
    const env = fakeEnv('granted');
    const { clickBegin, complete, notifier, clock } = setup(env);
    const session = clickBegin()!;
    expect(complete()).toBe(true);
    expect(notifier.lastDecision()).toBe('notify');
    expect(env.shown).toEqual([
      {
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
        tag: NOTIFICATION_TAG,
        icon: 'data:image/png;base64,AAAA',
        timestamp: clock.now(),
        data: { url: 'https://example.test/Ssprout/?dev', sessionId: session.id },
      },
    ]);
    expect(NOTIFICATION_TITLE).toBe('Your session is complete');
    expect(NOTIFICATION_BODY).toBe('Something is ready to bloom in your garden.');
  });

  it('does not notify while the page is visible and focused', () => {
    const env = fakeEnv('granted');
    env.setAttended(true);
    const { clickBegin, complete, notifier } = setup(env);
    clickBegin();
    complete();
    expect(notifier.lastDecision()).toBe('attended');
    expect(env.shown).toEqual([]);
  });

  it('respects denied permission and an in-app opt-out', () => {
    const env = fakeEnv('denied');
    const a = setup(env);
    a.clickBegin();
    a.complete();
    expect(a.notifier.lastDecision()).toBe('not-granted');

    const granted = fakeEnv('granted');
    const b = setup(granted);
    b.controller.updateSettings({ notifications: 'denied' });
    b.clickBegin();
    b.complete();
    expect(b.notifier.lastDecision()).toBe('opted-out');
    expect(granted.shown).toEqual([]);
  });

  it('stops listening after dispose', () => {
    const env = fakeEnv('granted');
    const { clickBegin, complete, notifier } = setup(env);
    notifier.dispose();
    clickBegin();
    complete();
    expect(env.shown).toEqual([]);
  });

  it('show failures are swallowed', async () => {
    const env = fakeEnv('granted');
    env.show = vi.fn(async () => 'failed' as const);
    const { clickBegin, complete } = setup(env);
    clickBegin();
    expect(() => complete()).not.toThrow();
    await flush();
    expect(env.show).toHaveBeenCalledTimes(1);
  });
});
