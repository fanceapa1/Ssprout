import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createSimplex2D } from '../paint/noise';
import { settleEnvelope, targetsFor } from './envelope';
import type { Emitter } from './motes';
import { createSim, LEAF_GLINT, stepSim, warmSim, type SimInputs } from './sim';
import { sunBands, sunGlazeAt, sunGround } from './sprites';
import { wind } from './wind';

/**
 * The sun weather as a watercolourist paints it (ADR 0194): a thin warm glaze with soft diagonal
 * bands of light lifted out of it, nothing over the sky, warm glints on the leaves that face the sun.
 */

const layout = { pondTop: 340 };
const bands = sunBands(createRng('ambience').fork('sun'), layout);
const all: Array<[number, number]> = bands.map((_, i) => [i, 1]);
const noise = createSimplex2D(createRng('n'));

/** a point on the axis of band `i`, `t` of the way along it */
function onBand(i: number, t: number): { x: number; y: number } {
  const b = bands[i]!;
  return { x: b.x0 + Math.sin(b.angle) * b.length * t, y: b.y0 + Math.cos(b.angle) * b.length * t };
}

describe('the sun’s glaze', () => {
  it('lies on the garden, and hardly at all over the sky', () => {
    expect(sunGround(40, layout)).toBeLessThan(0.2);
    expect(sunGround(layout.pondTop + 100, layout)).toBeCloseTo(1, 5);
    for (let x = 0; x <= 1600; x += 50) expect(sunGlazeAt(x, 30, bands, all, layout, noise)).toBeLessThan(0.2);
  });

  it('is lifted where the light falls: paler on a band than beside it', () => {
    for (const i of [0, 1, 2, 3]) {
      const p = onBand(i, 0.45);
      const b = bands[i]!;
      const beside = { x: p.x + Math.cos(b.angle) * b.width * 1.6, y: p.y - Math.sin(b.angle) * b.width * 1.6 };
      const on = sunGlazeAt(p.x, p.y, bands, [[i, 1]], layout);
      const off = sunGlazeAt(beside.x, beside.y, bands, [[i, 1]], layout);
      expect(on, `band ${i}`).toBeLessThan(off * 0.4);
    }
  });

  it('falls diagonally from the upper left: lower on the band is further right', () => {
    for (const b of bands) {
      expect(b.angle).toBeGreaterThan(0.4);
      expect(b.angle).toBeLessThan(0.9);
    }
    const a = onBand(1, 0.2);
    const c = onBand(1, 0.6);
    expect(c.y).toBeGreaterThan(a.y);
    expect(c.x).toBeGreaterThan(a.x + 100);
  });

  it('pools a little at a band’s edge, as lifted pigment does', () => {
    const i = 2;
    const b = bands[i]!;
    const p = onBand(i, 0.45);
    const at = (k: number) => {
      const half = (b.width / 2) * (0.8 + 0.4 * 0.45);
      return sunGlazeAt(p.x + Math.cos(b.angle) * half * k, p.y - Math.sin(b.angle) * half * k, bands, [[i, 1]], layout);
    };
    expect(at(1.05)).toBeGreaterThan(at(2));
    expect(at(0)).toBeLessThan(at(2));
  });

  it('a lift of a half lifts less than a whole one (the two groups take turns)', () => {
    const p = onBand(0, 0.45);
    expect(sunGlazeAt(p.x, p.y, bands, [[0, 0.5]], layout)).toBeGreaterThan(sunGlazeAt(p.x, p.y, bands, [[0, 1]], layout));
  });
});

describe('sunlight caught on leaves', () => {
  const emitters: Emitter[] = [
    { x: 400, y: 700, w: 60, h: 80, weight: 1 },
    { x: 1100, y: 760, w: 40, h: 50, weight: 1 },
  ];
  const sim = () => createSim(createRng('leaf'), { pond: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], area: { x: 0, y: 0, w: 1600, h: 1000 }, eave: null });
  const input = (weather: 'sun' | 'rain', phase: 'focus' | 'paused' = 'focus'): SimInputs => ({ levels: settleEnvelope(targetsFor(phase, weather)).value, wind, emitters });

  it('glint on the sunlit (upper left) side of the crowns, only in sun', () => {
    const s = sim();
    warmSim(s, 20, input('sun'));
    expect(s.leafGlints.length).toBeGreaterThan(0);
    expect(s.leafGlints.length).toBeLessThanOrEqual(LEAF_GLINT.max);
    for (const g of s.leafGlints) {
      const e = emitters.find((m) => Math.abs(m.x - g.x) <= m.w)!;
      expect(e).toBeDefined();
      expect(g.x).toBeLessThanOrEqual(e.x + 0.15 * e.w + 1e-9);
      expect(g.y).toBeLessThan(e.y - 0.4 * e.h);
    }
    const r = sim();
    warmSim(r, 20, input('rain'));
    expect(r.leafGlints).toHaveLength(0);
  });

  it('hold still while paused (a held breath)', () => {
    const s = sim();
    warmSim(s, 20, input('sun'));
    const before = s.leafGlints.map((g) => g.age);
    stepSim(s, 1, input('sun', 'paused'));
    expect(s.leafGlints.map((g) => g.age)).toEqual(before);
  });
});
