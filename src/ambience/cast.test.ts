import { describe, expect, it } from 'vitest';
import { gardenScene } from '../scene/geometry';
import { GARDEN_SKY_LAYOUT } from '../scenery/japanese-garden/sky';
import { WATERFALL } from '../scenery/waterfall';
import { blendWeights, only, pinnedState } from './daylight';
import { rockShadow } from './cast';
import { castShadow, type CastShadow, type SunSide } from './sky-layout';

const state = (p: Parameters<typeof only>[0]) => pinnedState(only(p));
const sided = (s: 1 | -1) => ({ ...GARDEN_SKY_LAYOUT, sunSide: { sunrise: s, sunset: s } satisfies SunSide });
const LOW = ['sunrise', 'sunset'] as const;
const ROCKS = [...gardenScene.rocks, ...WATERFALL.geometry.rocks];
const ALTITUDES = [-4, 0, 3, 9, 20];

describe('boulder shadows (S10c)', () => {
  it('with the sun on the other side, a boulder casts the exact mirror of its shadow', () => {
    for (const p of LOW) {
      for (const alt of ALTITUDES) {
        const s = { ...state(p), sunAltitude: alt };
        // sun side +1 (sun on the right) throws the shadow left; −1 throws it right
        const left = castShadow(s, sided(1));
        const right = castShadow(s, sided(-1));
        expect(left.dx).toBe(-right.dx);
        for (const r of ROCKS) {
          const l = rockShadow(r, left);
          const g = rockShadow(r, right);
          expect(l.cx - r.x).toBeCloseTo(-(g.cx - r.x), 9);
          expect([l.cy, l.rx, l.ry]).toEqual([g.cy, g.rx, g.ry]);
          expect(l.rotation).toBe(-g.rotation);
          expect(l.fade).toBe(Math.PI - g.fade!);
        }
      }
    }
  });

  it('lies almost flat, tilting a little toward the viewer away from the sun, on either side', () => {
    for (const p of LOW) {
      for (const sh of [castShadow(state(p), sided(1)), castShadow(state(p), sided(-1))]) {
        const o = rockShadow(ROCKS[0]!, sh);
        expect(Math.abs(o.rotation)).toBeLessThan(0.05);
        // the far end (away from the sun) dips toward the viewer: its tilt has the shadow's sign
        expect(Math.sign(o.rotation)).toBe(Math.sign(sh.dx));
      }
    }
  });

  it("keeps the right-falling shadow as it was, to the bit (the garden's sunset)", () => {
    const shadows: CastShadow[] = [state('sunset'), pinnedState(blendWeights('midday', 'sunset', 0.3)), pinnedState(blendWeights('sunset', 'night', 0.6))].map((s) => castShadow(s));
    for (const sh of shadows) {
      expect(sh.dx).toBeGreaterThan(0);
      const long = Math.abs(sh.dx) > 0.6;
      for (const r of gardenScene.rocks) {
        // the pre-S10c tilt: `angle * 0.15`, angle = atan2(dy, dx)
        expect(rockShadow(r, sh).rotation).toBe(long ? Math.atan2(sh.dy, sh.dx) * 0.15 : 0);
      }
    }
  });

  it('a short shadow (midday, night) is an untilted pool with no fade', () => {
    for (const p of ['midday', 'night'] as const) {
      const o = rockShadow(ROCKS[0]!, castShadow(state(p)));
      expect([o.rotation, o.fade]).toEqual([0, null]);
    }
  });
});
