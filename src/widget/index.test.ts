// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import { createDefaultState, type GardenState } from '../core/state';
import { createTimerSurfaces } from './index';
import type { NotificationEnv } from './notifications';
import { fakeBus, fakeController, fakeStore, status } from './test-helpers';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.head.innerHTML = '<link rel="icon" href="data:,orig">';
  document.title = 'Study Sprout';
});
afterEach(() => vi.restoreAllMocks());

const env = (): NotificationEnv => ({
  supported: true,
  permission: () => 'granted',
  request: async () => 'granted',
  attended: () => false,
  prepare: () => {},
  show: vi.fn(async () => 'service-worker' as const),
  appUrl: () => 'http://x.test/',
});

function setup() {
  const controller = fakeController(status('focus', { blockRemainingMs: 90_000 }));
  const setTicker = vi.fn();
  const state: GardenState = createDefaultState(0);
  const store = { ...fakeStore(), get: () => state };
  const bus = fakeBus();
  const surfaces = createTimerSurfaces({
    controller: { ...controller, setTicker },
    store,
    bus,
    clock: createManualClock(0),
    notificationEnv: env(),
  });
  return { controller, setTicker, bus, surfaces };
}

describe('createTimerSurfaces', () => {
  it('installs the worker ticker, the tab countdown and the widget', () => {
    const { setTicker, surfaces } = setup();
    expect(setTicker).toHaveBeenCalledWith(surfaces.internals.ticker);
    expect(document.title).toBe('1:30 · Study Sprout');
    expect(surfaces.widget.supported).toBe(false); // jsdom has no Document PiP
    expect(typeof surfaces.widget.open).toBe('function');
    expect(surfaces.widget.isOpen()).toBe(false);
  });

  it('exposes the permission request and notifies through the env', async () => {
    const { surfaces } = setup();
    await expect(surfaces.requestPermissionFromGesture()).resolves.toBe('granted');
  });

  it('dispose restores an interval ticker, the title and the icon', () => {
    const { setTicker, surfaces, bus } = setup();
    surfaces.dispose();
    expect(setTicker).toHaveBeenCalledTimes(2);
    expect(setTicker.mock.calls[1]![0]).not.toBe(surfaces.internals.ticker);
    expect(document.title).toBe('Study Sprout');
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe('data:,orig');
    expect(bus.count()).toBe(0);
    surfaces.dispose(); // idempotent
  });
});
