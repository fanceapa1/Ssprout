import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { gardenScene } from '../scene/geometry';

/**
 * A garden switch gets the new engine's light ready in parts (ADR 0337): `prepare` waits for the
 * paint cache's answers, then paints what is missing one part per idle callback, then the sprite
 * groups the old engine had built, one per idle callback. A fake light stands in for the plates.
 */

const light = vi.hoisted(() => ({ have: new Set<string>(), looking: true, parts: [] as string[], field: false }));
vi.mock('./cast', () => ({
  createCastLight: () => ({
    update: () => true,
    canvas: { width: 1, height: 1 },
    has: (p: string) => light.have.has(p),
    prepare: () => {},
    setDetail: () => {},
    paintDetailStep: () => false,
    detail: () => null,
    version: () => 0,
    stats: () => ({ plates: light.have.size, composes: 0, paintMs: 0, detail: null, detailMs: 0 }),
    missing: (s: { weights: Record<string, number> }) => Object.keys(s.weights).filter((p) => s.weights[p]! > 0.002 && !light.have.has(p)),
    lookup: () => {},
    looking: (p: string) => light.looking && !light.have.has(p),
    paintPart: (p: string) => {
      light.parts.push(light.field ? `plate:${p}` : 'field');
      if (light.field) light.have.add(p);
      light.field = true;
    },
  }),
}));

import { createAmbience } from './ambience';
import { only, pinnedState } from './daylight';

class FakeCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    const target = { createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop: () => {} }) };
    return new Proxy(target, { get: (t, k) => (k in t ? t[k as keyof typeof t] : () => {}), set: () => true });
  }
}

/** idle callbacks queued, run one at a time by the test */
const idle: (() => void)[] = [];
/** run the next idle callback once `prepare` has asked for one */
async function step(): Promise<void> {
  await vi.waitFor(() => expect(idle.length).toBe(1));
  idle.shift()!();
}

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => idle.push(fn));
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  light.have.clear();
  light.looking = true;
  light.parts.length = 0;
  light.field = false;
  idle.length = 0;
});

const night = pinnedState(only('night'));

describe('prepare: the light of a switched garden, in parts (ADR 0337)', () => {
  it('takes the plates the paint cache gives without painting anything', async () => {
    const e = createAmbience({ scene: gardenScene, seed: 'parts' });
    const done = e.prepare(night);
    let resolved = false;
    void done.then(() => (resolved = true));
    await Promise.resolve();
    expect(resolved).toBe(false);
    light.have.add('night'); // the lookup answered with the plate
    await done;
    expect(light.parts).toEqual([]);
    expect(idle).toEqual([]);
  });

  it('after a miss paints one part per idle callback: the wash field, then the plate', async () => {
    const e = createAmbience({ scene: gardenScene, seed: 'parts' });
    const done = e.prepare(night);
    light.looking = false; // the lookup missed
    await step();
    expect(light.parts).toEqual(['field']);
    await step();
    expect(light.parts).toEqual(['field', 'plate:night']);
    await done;
    expect(idle).toEqual([]);
  });

  it('then builds the sprite groups the old engine had, one per idle callback', async () => {
    light.have.add('night');
    const e = createAmbience({ scene: gardenScene, seed: 'parts-sprites' });
    const done = e.prepare(night, ['flame', 'motes']);
    await step();
    expect(e.sprites()).toEqual(['flame']);
    await step();
    await done;
    expect([...e.sprites()].sort()).toEqual(['flame', 'motes']);
  });
});
