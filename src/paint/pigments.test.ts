import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  PIGMENTS,
  chroma,
  darken,
  hexToRgb,
  jitter,
  lighten,
  lightness,
  mix,
  oklabToRgb,
  rgbToHex,
  rgbToOklab,
  rgba,
  saturate,
  shade,
} from './pigments';

describe('pigment parsing', () => {
  it('parses hex, short hex and palette names', () => {
    expect(hexToRgb('#4a443c')).toEqual({ r: 0x4a, g: 0x44, b: 0x3c });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('sumi')).toEqual(hexToRgb(PIGMENTS.sumi));
    expect(() => hexToRgb('nope')).toThrow();
  });

  it('round-trips through OKLab', () => {
    for (const p of Object.values(PIGMENTS)) expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(p))))).toBe(p);
  });

  it('formats rgba', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(rgba('#ff0000', 2)).toBe('rgba(255,0,0,1)');
  });
});

describe('the palette', () => {
  it('never uses pure black for ink', () => {
    expect(PIGMENTS.sumi).not.toBe('#000000');
    expect(lightness(PIGMENTS.sumi)).toBeGreaterThan(0.3);
  });

  it('is richer than v1 but stays watercolour, never neon (ADR 0144)', () => {
    const { vermilion, gold, cerulean, ultramarine, indigo, rose, crimson, ochre, apricot, violet, ...rest } = PIGMENTS;
    for (const p of Object.values(rest)) expect(chroma(p)).toBeLessThan(0.135);
    for (const p of [vermilion, crimson]) expect(chroma(p)).toBeLessThan(0.17);
    for (const p of [gold, cerulean, ultramarine, indigo, rose, ochre, apricot, violet]) expect(chroma(p)).toBeLessThan(0.145);
  });

  it('raised the chroma of greens, water, stones and flowers', () => {
    // v1 values (ADR 0144 raised each by ~1.3–1.6×)
    const v1: Record<string, string> = { sap: '#a9b386', sage: '#8d9a6c', celadon: '#a9c3bb', stone: '#9b978d', sakura: '#e8a7a9', iris: '#7b6ba8', bellflower: '#7f97c8' };
    for (const [name, old] of Object.entries(v1)) {
      const now = PIGMENTS[name as keyof typeof PIGMENTS];
      expect(chroma(now), name).toBeGreaterThan(chroma(old) * 1.25);
      // same family: lightness barely moves
      expect(Math.abs(lightness(now) - lightness(old)), name).toBeLessThan(0.04);
    }
  });
});

describe('pigment maths', () => {
  it('mix returns the endpoints and a perceptual midpoint', () => {
    expect(mix(PIGMENTS.sap, PIGMENTS.iris, 0)).toBe(PIGMENTS.sap);
    expect(mix(PIGMENTS.sap, PIGMENTS.iris, 1)).toBe(PIGMENTS.iris);
    const mid = lightness(mix('#000000', '#ffffff', 0.5));
    expect(mid).toBeCloseTo(0.5, 1);
  });

  it('lighten/darken move lightness monotonically and keep hue roughly', () => {
    const p = PIGMENTS.sage;
    expect(lightness(lighten(p, 0.3))).toBeGreaterThan(lightness(p));
    expect(lightness(darken(p, 0.3))).toBeLessThan(lightness(p));
    expect(lighten(p, 0)).toBe(p);
    expect(lightness(lighten(p, 1))).toBeGreaterThan(0.97);
    expect(chroma(lighten(p, 0.5))).toBeLessThan(chroma(p));
    const h = (q: string) => {
      const o = rgbToOklab(hexToRgb(q));
      return Math.atan2(o.b, o.a);
    };
    expect(Math.abs(h(darken(p, 0.3)) - h(p))).toBeLessThan(0.1);
  });

  it('saturate(0) is neutral grey', () => {
    expect(chroma(saturate(PIGMENTS.sakura, 0))).toBeLessThan(0.003);
  });

  it('shade is darker and cooler than the source', () => {
    const s = shade(PIGMENTS.sap, 0.4);
    expect(lightness(s)).toBeLessThan(lightness(PIGMENTS.sap));
    expect(rgbToOklab(hexToRgb(s)).b).toBeLessThan(rgbToOklab(hexToRgb(PIGMENTS.sap)).b);
  });

  it('jitter is seeded, small and varied', () => {
    const a = jitter(PIGMENTS.sage, createRng(1), 0.03);
    expect(jitter(PIGMENTS.sage, createRng(1), 0.03)).toBe(a);
    expect(Math.abs(lightness(a) - lightness(PIGMENTS.sage))).toBeLessThanOrEqual(0.031);
    const rng = createRng(2);
    const set = new Set(Array.from({ length: 20 }, () => jitter(PIGMENTS.sage, rng)));
    expect(set.size).toBeGreaterThan(10);
  });
});
