import { describe, expect, it } from 'vitest';
import { gardenScene } from '../scene/geometry';
import { pointInPolygon } from '../paint/geometry';
import { awayFromShore, lanternReflection, paintGradeWash, pondMask, type WashField } from './lighting';
import { gradeAt, NAMED_HOURS } from './timeofday';

const scale = 0.1; // 160 × 100 px
const w = 160;
const h = 100;
const field = (over: Partial<WashField> = {}): WashField => ({
  w,
  h,
  scale,
  mottle: () => 0.5,
  bloom: () => 0.3,
  edge: () => 0.5,
  pond: pondMask(gardenScene.pond, w, h, scale),
  lantern: gardenScene.pavilion.lantern,
  reflection: lanternReflection(gardenScene),
  ...over,
});
const paint = (hour: number, over?: Partial<WashField>) => {
  const out = new Uint8ClampedArray(w * h * 4);
  paintGradeWash(out, gradeAt(hour), field(over));
  return out;
};
const alphaAt = (out: Uint8ClampedArray, wx: number, wy: number) => out[(Math.floor(wy * scale) * w + Math.floor(wx * scale)) * 4 + 3]!;
const meanAlpha = (out: Uint8ClampedArray) => {
  let s = 0;
  for (let i = 3; i < out.length; i += 4) s += out[i]!;
  return s / (w * h);
};

describe('paintGradeWash', () => {
  it('noon is (almost) untouched paper; night is the heaviest wash', () => {
    const noon = meanAlpha(paint(NAMED_HOURS.noon));
    const morning = meanAlpha(paint(NAMED_HOURS.morning));
    const dusk = meanAlpha(paint(NAMED_HOURS.dusk));
    const night = meanAlpha(paint(NAMED_HOURS.night));
    expect(noon).toBeLessThan(15);
    expect(morning).toBeGreaterThan(noon);
    expect(dusk).toBeGreaterThan(morning);
    expect(night).toBeGreaterThan(dusk);
  });

  it('the sky deepens first and the foreground stays lighter at night', () => {
    const out = paint(NAMED_HOURS.night);
    expect(alphaAt(out, 200, 40)).toBeGreaterThan(alphaAt(out, 200, 960));
  });

  it('the lantern reserves paper around itself at night, warm-tinted', () => {
    const out = paint(NAMED_HOURS.night);
    const L = gardenScene.pavilion.lantern;
    const inside = alphaAt(out, L.x, L.y);
    const outside = alphaAt(out, L.x - 200, L.y);
    expect(inside).toBeLessThan(outside * 0.5);
    const i = (Math.floor(L.y * scale) * w + Math.floor(L.x * scale)) * 4;
    expect(out[i]!).toBeGreaterThan(out[i + 2]!); // warm: red over blue
  });

  it('the lantern light lies on the water', () => {
    const refl = lanternReflection(gardenScene)!;
    expect(refl).not.toBeNull();
    const lit = alphaAt(paint(NAMED_HOURS.night), refl.x, refl.y);
    const dark = alphaAt(paint(NAMED_HOURS.night, { reflection: null }), refl.x, refl.y);
    expect(lit).toBeLessThan(dark);
  });

  it('noise mottles the wash (not a flat gradient)', () => {
    const flat = paint(NAMED_HOURS.night);
    const mottled = paint(NAMED_HOURS.night, { mottle: (x, y) => 0.5 + 0.5 * Math.sin(x * 0.3) * Math.cos(y * 0.2) });
    let diff = 0;
    for (let i = 3; i < flat.length; i += 4) diff += Math.abs(flat[i]! - mottled[i]!);
    expect(diff / (w * h)).toBeGreaterThan(3);
  });

  it('evening glow warms and thins the wash toward the low sun', () => {
    const out = paint(NAMED_HOURS.evening);
    const g = gradeAt(NAMED_HOURS.evening);
    const sunX = g.glowX * 1600;
    const sunY = g.glowY * 1000;
    expect(alphaAt(out, sunX, sunY)).toBeLessThan(alphaAt(out, 1500, sunY));
  });
});

describe('pondMask / lanternReflection', () => {
  it('masks the pond', () => {
    const m = pondMask(gardenScene.pond, w, h, scale);
    expect(m[Math.floor(560 * scale) * w + Math.floor(800 * scale)]).toBe(1);
    expect(m[Math.floor(100 * scale) * w + Math.floor(100 * scale)]).toBe(0);
  });

  it('mirrors the lantern when that lands on the water, else spills from the nearest shore', () => {
    const mirrored = lanternReflection({ ...gardenScene, pavilion: { ...gardenScene.pavilion, lantern: { x: 800, y: 520 } }, waterline: 560 });
    expect(mirrored).toEqual({ x: 800, y: 600 });
    const spill = lanternReflection(gardenScene)!;
    expect(spill.x).toBeGreaterThan(900); // toward the lantern side (right)
  });
});

describe('awayFromShore', () => {
  it('moves a point hugging the shore onto open water, leaves open water alone', () => {
    const pond = gardenScene.pond;
    const right = pond.reduce((a, q) => (q.x > a.x ? q : a));
    const edge = { x: right.x - 3, y: right.y }; // the pond's right end, right at its rim
    const moved = awayFromShore(edge, pond);
    expect(moved.x).toBeLessThan(edge.x);
    expect(pointInPolygon(moved, pond)).toBe(true);
    expect(awayFromShore({ x: 800, y: 580 }, pond)).toEqual({ x: 800, y: 580 });
  });
});
