import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { biquad } from './falls';
import { MURMUR_S, OASIS_RMS, PALMS_S, SEGUIA_BLEND, TRICKLE_S, frondGust, loopRate, palmsLoops, seguiaLoops } from './oasis-bed';

// a 44.1 kHz context: the loops render at 14.7 kHz, so everything up to ~7 kHz is there
const SR = 44100;
const seguia = seguiaLoops(createRng('oasis-test'), SR);
const palms = palmsLoops(createRng('oasis-test'), SR);

const rms = (d: Float32Array, from = 0, to = d.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i]! ** 2;
  return Math.sqrt(s / (to - from));
};
const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/** Level in dB of a loop through a filter (after a 0.2 s settle). */
function bandDb(d: Float32Array, rate: number, type: 'lowpass' | 'highpass' | 'bandpass', hz: number): number {
  const f = biquad(type, hz, 0.7, rate), out = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = f(d[i]!);
  return 20 * Math.log10(rms(out, Math.round(rate * 0.2)));
}
/** Quarter-second levels in dB. */
function windows(d: Float32Array, rate: number): number[] {
  const w = Math.floor(rate / 4), out: number[] = [];
  for (let i = 0; i + w <= d.length; i += w) out.push(20 * Math.log10(rms(d, i, i + w)));
  return out;
}
const loops = () => [seguia.trickle.data[0], seguia.trickle.data[1], seguia.murmur, palms.data[0], palms.data[1]];

describe('the oasis beds (oasis-bed.ts, ADR 0303)', () => {
  it('are deterministic, the right length and rate, at their RMS and bounded', () => {
    expect(seguiaLoops(createRng('oasis-test'), SR).trickle.data[0]).toEqual(seguia.trickle.data[0]);
    expect(palmsLoops(createRng('oasis-test'), SR).data[1]).toEqual(palms.data[1]);
    const rate = loopRate(SR);
    expect(rate).toBe(14700);
    expect([seguia.trickle.rate, seguia.murmurRate, palms.rate]).toEqual([rate, rate, rate]);
    expect(seguia.trickle.data[0].length).toBe(TRICKLE_S * rate);
    expect(seguia.murmur.length).toBe(MURMUR_S * rate);
    expect(palms.data[0].length).toBe(PALMS_S * rate);
    for (const d of loops()) {
      expect(rms(d)).toBeCloseTo(OASIS_RMS, 3);
      expect(peak(d)).toBeLessThan(1);
      expect(d.every(Number.isFinite)).toBe(true);
    }
    // the stereo loops are wide: their two channels are different noise
    for (const [l, r] of [seguia.trickle.data, palms.data]) {
      let dot = 0;
      for (let i = 0; i < l.length; i++) dot += l[i]! * r[i]!;
      expect(Math.abs(dot / l.length / OASIS_RMS ** 2)).toBeLessThan(0.05);
    }
  });

  it('the trickle is small water, the murmur low and soft, the fronds dry and bright', () => {
    const [trickle] = seguia.trickle.data, rate = seguia.trickle.rate;
    // the trickle lives in the bubbles' 0.6–2.4 kHz, with little rumble under it
    expect(bandDb(trickle, rate, 'bandpass', 1200) - bandDb(trickle, rate, 'lowpass', 150)).toBeGreaterThan(10);
    // the oued's murmur is the opposite: low, nothing bright
    expect(bandDb(seguia.murmur, rate, 'lowpass', 400) - bandDb(seguia.murmur, rate, 'highpass', 2500)).toBeGreaterThan(20);
    // the fronds rustle high: a papery band over 2 kHz, almost nothing low
    expect(bandDb(palms.data[0], rate, 'highpass', 2000) - bandDb(palms.data[0], rate, 'lowpass', 300)).toBeGreaterThan(20);
    // the trickle sits under the fronds' brightness, the murmur blends in under the trickle
    expect(bandDb(trickle, rate, 'highpass', 3500)).toBeLessThan(bandDb(palms.data[0], rate, 'highpass', 3500));
    expect(SEGUIA_BLEND.murmur).toBeLessThan(SEGUIA_BLEND.trickle);
  });

  it('loop without a click: the seam is no bigger a step than any other sample', () => {
    for (const d of loops()) {
      const steps = new Float64Array(d.length - 1);
      for (let i = 1; i < d.length; i++) steps[i - 1] = Math.abs(d[i]! - d[i - 1]!);
      const sorted = Array.from(steps).sort((a, b) => a - b);
      expect(Math.abs(d[0]! - d[d.length - 1]!)).toBeLessThan(sorted[Math.floor(sorted.length * 0.999)]!);
      const w = Math.round(loopRate(SR) * 0.05);
      expect(Math.abs(20 * Math.log10(rms(d, 0, w) / rms(d, d.length - w)))).toBeLessThan(3);
    }
  });

  it('the seguia flows steadily; the palms gust slowly, never in jumps', () => {
    const water = windows(seguia.trickle.data[0], seguia.trickle.rate);
    expect(Math.max(...water) - Math.min(...water)).toBeLessThan(7);
    for (let i = 1; i < water.length; i++) expect(Math.abs(water[i]! - water[i - 1]!)).toBeLessThan(2.5);
    const fronds = windows(palms.data[0], palms.rate);
    // lulls and gusts: a wide, slow swing
    expect(Math.max(...fronds) - Math.min(...fronds)).toBeGreaterThan(7);
    for (let i = 1; i < fronds.length; i++) expect(Math.abs(fronds[i]! - fronds[i - 1]!)).toBeLessThan(2.5);
  });

  it('the gust envelope runs from a lull at 0.2 to a gust at 1, and lulls last longer than gusts', () => {
    const gust = frondGust(createRng(3));
    const values = Array.from({ length: 4096 }, (_, i) => gust(i / 4096));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
    expect(values.filter((v) => v < 0.5).length).toBeGreaterThan(values.filter((v) => v > 0.7).length);
  });
});
