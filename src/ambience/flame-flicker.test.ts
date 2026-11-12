import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gardenScene } from '../scene/geometry';

/**
 * The lantern flame flickers with the ambience's own time: frame time since the last settle, so
 * a settled still frame draws the same flame however long the engine ran. Node has no canvas: a
 * fake stands in for OffscreenCanvas, and the light plates are a stub.
 */

vi.mock('./cast', () => ({
  createCastLight: () => ({
    update: () => true,
    canvas: { width: 1, height: 1 },
    has: () => true,
    prepare: () => {},
    setDetail: () => {},
    paintDetailStep: () => false,
    detail: () => null,
    version: () => 0,
    stats: () => ({ plates: 1, composes: 1, paintMs: 0, detail: null, detailMs: 0 }),
  }),
}));

import { createAmbience, flameFlicker } from './ambience';
import { pinnedState, only } from './daylight';

/** a 2D context that accepts every call; `flames` gets the alpha of each draw in 'screen' (the flame) */
function recordingContext(flames: number[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const target: Record<string, unknown> = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    drawImage: () => {
      if (state.globalCompositeOperation === 'screen') flames.push(state.globalAlpha as number);
    },
  };
  return new Proxy(target, {
    get: (t, k) => (typeof k === 'string' && k in state ? state[k] : typeof k === 'string' && k in t ? t[k] : () => {}),
    set: (_, k, v) => {
      state[k as string] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

class FakeCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return recordingContext([]);
  }
}

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const night = (dt = 0) => ({ dt, phase: 'idle' as const, weather: null, emitters: [], light: pinnedState(only('night')) });
type Engine = ReturnType<typeof createAmbience>;

/** the flame's alpha in a drawn lighting layer */
function flameAlpha(a: Engine): number {
  const flames: number[] = [];
  a.drawLighting(recordingContext(flames), 1);
  expect(flames.length).toBeGreaterThan(0);
  return flames[0]!;
}

describe('flameFlicker', () => {
  it('stays between 0.88 and 1 and is 0.94 at time 0', () => {
    expect(flameFlicker(0)).toBeCloseTo(0.94, 10);
    for (let t = 0; t < 60; t += 0.07) {
      expect(flameFlicker(t)).toBeGreaterThanOrEqual(0.88);
      expect(flameFlicker(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe('createAmbience: the flame time', () => {
  it('runs with frame time while live', () => {
    const a = createAmbience({ scene: gardenScene, seed: 'flame-live' });
    a.update(night());
    expect(a.debug().flame).toBe(0);
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      a.update(night(0.1));
      seen.add(flameAlpha(a));
    }
    expect(a.debug().flame).toBeCloseTo(2, 10);
    expect(seen.size).toBeGreaterThan(5);
  });

  it("starts over on settle, so a settled still frame is a fresh engine's", () => {
    const fresh = createAmbience({ scene: gardenScene, seed: 'flame-a' });
    fresh.update(night());
    const want = flameAlpha(fresh);

    const ran = createAmbience({ scene: gardenScene, seed: 'flame-b' });
    ran.update(night());
    for (let i = 0; i < 37; i++) ran.update(night(1 / 60 + i * 0.003));
    expect(ran.debug().flame).toBeGreaterThan(0);
    expect(flameAlpha(ran)).not.toBe(want);
    ran.settle();
    // the settle frame may come with a real dt: the flame still starts at 0
    ran.update(night(0.033));
    expect(ran.debug().flame).toBe(0);
    expect(flameAlpha(ran)).toBe(want);
    // a still frame (dt 0) keeps it
    ran.update(night());
    expect(flameAlpha(ran)).toBe(want);
  });

  it('does not move with reduced motion', () => {
    const a = createAmbience({ scene: gardenScene, seed: 'flame-still', reducedMotion: true });
    a.update(night());
    const want = flameAlpha(a);
    for (let i = 0; i < 10; i++) a.update(night(0.1));
    expect(a.debug().flame).toBe(0);
    expect(flameAlpha(a)).toBe(want);
  });
});
