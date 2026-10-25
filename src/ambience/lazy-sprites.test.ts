import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD_H, WORLD_W } from '../render/viewport';
import { gardenScene } from '../scene/geometry';

/**
 * The ambience builds its sprites and light plates on first use (ADR 0232): nothing heavy when the
 * engine is made, no sun glaze at night or without sun weather, the light plates on the first frame
 * that lights the garden. Node has no canvas: a counting fake stands in for OffscreenCanvas, and the
 * light plates are a stub (their painting has its own tests).
 */

const castCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('./cast', () => ({
  createCastLight: () => {
    castCalls.n++;
    return {
      update: () => true,
      canvas: { width: 1, height: 1 },
      has: () => true,
      prepare: () => {},
      setDetail: () => {},
      paintDetailStep: () => false,
      detail: () => null,
      version: () => 0,
      stats: () => ({ plates: 1, composes: 1, paintMs: 0, detail: null, detailMs: 0 }),
    };
  },
}));

import { createAmbience } from './ambience';
import { pinnedState, only, type DayPhase } from './daylight';
import { buildSprites, builtSprites, SUN_SCALE } from './sprites';

/** canvases made so far, by size */
const made: string[] = [];

/** a 2D context that accepts every call */
function fakeContext(): unknown {
  const target = {
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k as keyof typeof t] : () => {}),
    set: () => true,
  });
}

class FakeCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {
    made.push(`${width}x${height}`);
  }
  getContext() {
    return fakeContext();
  }
}

const SUN_SIZE = `${Math.ceil(WORLD_W * SUN_SCALE)}x${Math.ceil(WORLD_H * SUN_SCALE)}`;
const layout = { pondTop: 340, pondBottom: 640 };

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  made.length = 0;
  castCalls.n = 0;
});

describe('buildSprites', () => {
  it('paints nothing until a group is used, then only that group', () => {
    const s = buildSprites('lazy', layout);
    expect(made).toEqual([]);
    expect(builtSprites(s)).toEqual([]);
    void s.flame;
    expect(builtSprites(s)).toEqual(['flame']);
    expect(made).toHaveLength(1);
    expect(made).not.toContain(SUN_SIZE);
  });

  it('builds a group once, and the sun only when it is asked for', () => {
    const s = buildSprites('lazy', layout);
    const rain = s.rain;
    expect(s.rain).toBe(rain);
    expect(made).not.toContain(SUN_SIZE);
    void s.sun;
    expect(made.filter((m) => m === SUN_SIZE)).toHaveLength(2);
    void s.sun;
    expect(made.filter((m) => m === SUN_SIZE)).toHaveLength(2);
    expect(builtSprites(s)).toEqual(['sun', 'rain']);
  });
});

describe('createAmbience: lazy sprites and light plates', () => {
  const frame = (phase: DayPhase, dt = 0) => ({ dt, phase: 'idle' as const, weather: null, emitters: [], light: pinnedState(only(phase)) });
  const drawAll = (a: ReturnType<typeof createAmbience>) => {
    const ctx = fakeContext() as CanvasRenderingContext2D;
    a.drawWater(ctx);
    a.drawAir(ctx);
    a.drawLighting(ctx, 1);
  };

  it('makes no sprite and no light plate when the engine is made', () => {
    // a scene object of its own: sprites and plates are shared per scene + seed
    const a = createAmbience({ scene: { ...gardenScene }, seed: 'lazy-make' });
    expect(made).toEqual([]);
    expect(castCalls.n).toBe(0);
    expect(a.debug().sprites).toEqual([]);
    expect(a.lightDetail()).toBeNull();
  });

  it('builds the light plates on the first frame, and no sun at night without sun weather', () => {
    const a = createAmbience({ scene: { ...gardenScene }, seed: 'lazy-night' });
    a.update(frame('night'));
    expect(castCalls.n).toBe(1);
    for (let i = 0; i < 30; i++) {
      a.update(frame('night', 0.1));
      drawAll(a);
    }
    expect(a.debug().sprites).not.toContain('sun');
    expect(made).not.toContain(SUN_SIZE);
    // the lantern burns at night: its flame is the one sprite the night needs
    expect(a.debug().sprites).toContain('flame');
  });

  it('builds the sun glaze once sun weather shows', () => {
    const a = createAmbience({ scene: { ...gardenScene }, seed: 'lazy-sun' });
    a.update(frame('midday'));
    drawAll(a);
    expect(a.debug().sprites).not.toContain('sun');
    a.preview = 'sun';
    a.settle();
    a.update(frame('midday'));
    drawAll(a);
    expect(a.debug().sprites).toContain('sun');
    expect(made.filter((m) => m === SUN_SIZE)).toHaveLength(2);
  });
});
