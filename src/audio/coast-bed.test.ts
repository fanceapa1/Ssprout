import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { biquad } from './falls';
import { loopRate } from './oasis-bed';
import { CICADAS_S, COAST_RMS, SEA_S, WAVES_PER_LOOP, backShape, cicadaLoops, seaLoops, seaWaves, washShape } from './coast-bed';

// a 44.1 kHz context: the loops render at 14.7 kHz, so everything up to ~7 kHz is there
const SR = 44100;
const sea = seaLoops(createRng('coast-test'), SR);
const cicadas = cicadaLoops(createRng('coast-test'), SR);
const rate = loopRate(SR);

const rms = (d: Float32Array, from = 0, to = d.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i]! ** 2;
  return Math.sqrt(s / (to - from));
};
const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const filtered = (d: Float32Array, type: 'lowpass' | 'highpass' | 'bandpass', hz: number, q = 0.7) => {
  const f = biquad(type, hz, q, rate), out = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = f(d[i]!);
  return out;
};
const bandDb = (d: Float32Array, type: 'lowpass' | 'highpass' | 'bandpass', hz: number) =>
  20 * Math.log10(rms(filtered(d, type, hz), Math.round(rate * 0.2)));
/** Levels in dB over windows of `seconds`. */
function windows(d: Float32Array, seconds = 0.25): number[] {
  const w = Math.floor(rate * seconds), out: number[] = [];
  for (let i = 0; i + w <= d.length; i += w) out.push(20 * Math.log10(rms(d, i, i + w) + 1e-12));
  return out;
}
const loops = () => [sea.data[0], sea.data[1], cicadas.data[0], cicadas.data[1]];

describe('the coast beds (coast-bed.ts, ADR 0376)', () => {
  it('are deterministic, the right length and rate, at their RMS, bounded and wide', () => {
    expect(seaLoops(createRng('coast-test'), SR).data[1]).toEqual(sea.data[1]);
    expect(cicadaLoops(createRng('coast-test'), SR).data[0]).toEqual(cicadas.data[0]);
    expect(seaLoops(createRng('another'), SR).data[0]).not.toEqual(sea.data[0]);
    expect([sea.rate, cicadas.rate]).toEqual([14700, 14700]);
    expect(sea.data[0].length).toBe(SEA_S * rate);
    expect(cicadas.data[0].length).toBe(CICADAS_S * rate);
    for (const d of loops()) {
      expect(peak(d)).toBeLessThan(1);
      expect(d.every(Number.isFinite)).toBe(true);
    }
    expect(Math.hypot(rms(sea.data[0]), rms(sea.data[1])) / Math.SQRT2).toBeCloseTo(COAST_RMS, 3);
    expect(rms(cicadas.data[0])).toBeCloseTo(COAST_RMS, 3);
    for (const [l, r] of [sea.data, cicadas.data]) {
      let dot = 0;
      for (let i = 0; i < l.length; i++) dot += l[i]! * r[i]!;
      // the sea's two sides share their waves' swell, but not their water: never one mono signal
      expect(dot / l.length / (rms(l) * rms(r))).toBeLessThan(0.6);
    }
  });

  it('a wave every 6–10 s, of varying weight, its backwash after its wash', () => {
    const waves = seaWaves(createRng('coast-test').fork('sea').fork('waves'));
    expect(waves).toHaveLength(WAVES_PER_LOOP);
    const gaps = waves.map((w, i) => ((waves[(i + 1) % waves.length]!.at - w.at + SEA_S) % SEA_S));
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(6 - 1e-9);
      expect(g).toBeLessThanOrEqual(10 + 1e-9);
    }
    expect(gaps.reduce((s, g) => s + g, 0)).toBeCloseTo(SEA_S, 6);
    const weights = waves.map((w) => w.weight);
    expect(Math.min(...weights)).toBeGreaterThanOrEqual(0.55);
    expect(Math.max(...weights) - Math.min(...weights)).toBeGreaterThan(0.15);
    for (const w of waves) {
      const at = (f: (w: typeof waves[number], d: number) => number) => {
        let best = 0, when = 0;
        for (let d = 0; d < 10; d += 0.01) if (f(w, d) > best) { best = f(w, d); when = d; }
        return when;
      };
      // the wash runs up slowly (no slap), the stones draw back a couple of seconds later
      expect(at(washShape)).toBeGreaterThanOrEqual(1.2);
      expect(at(backShape) - at(washShape)).toBeGreaterThan(1.5);
      expect(washShape(w, 0)).toBe(0);
    }
  });

  it('the sea breathes slowly: soft swells of several dB, no jumps, and the pebbles rattle as each wave draws back', () => {
    const [l] = sea.data;
    const level = windows(l);
    expect(Math.max(...level) - Math.min(...level)).toBeGreaterThan(4);
    expect(Math.max(...level) - Math.min(...level)).toBeLessThan(16);
    for (let i = 1; i < level.length; i++) expect(Math.abs(level[i]! - level[i - 1]!)).toBeLessThan(2.5);
    // the rattle (over 2.5 kHz) peaks after the wash (0.3–1.5 kHz) of each wave
    const wash = windows(filtered(l, 'bandpass', 700, 0.5)), stones = windows(filtered(filtered(l, 'highpass', 2500), 'highpass', 2500));
    const waves = seaWaves(createRng('coast-test').fork('sea').fork('waves'));
    let later = 0;
    for (const w of waves) {
      const from = Math.round(w.at * 4), span = 6 * 4;
      const idx = (a: number[]) => {
        let best = -Infinity, at = 0;
        for (let k = 0; k < span; k++) { const v = a[(from + k) % a.length]!; if (v > best) { best = v; at = k; } }
        return at;
      };
      if (idx(stones) > idx(wash)) later++;
    }
    expect(later).toBeGreaterThanOrEqual(WAVES_PER_LOOP - 1);
  });

  it('the sea is low and soft; the cicadas a narrow band around 4 kHz with nothing shrill above it', () => {
    const [s] = sea.data, [c] = cicadas.data;
    expect(bandDb(s, 'lowpass', 1200) - bandDb(s, 'highpass', 3000)).toBeGreaterThan(6);
    expect(bandDb(c, 'bandpass', 4100) - bandDb(c, 'lowpass', 1500)).toBeGreaterThan(15);
    expect(bandDb(c, 'bandpass', 4100) - bandDb(c, 'highpass', 6800)).toBeGreaterThan(10);
  });

  it('the cicadas pulse quickly but drift only slowly', () => {
    const [c] = cicadas.data;
    const fine = windows(c, 0.02);
    const mean = fine.reduce((s, v) => s + v, 0) / fine.length;
    const spread = Math.sqrt(fine.reduce((s, v) => s + (v - mean) ** 2, 0) / fine.length);
    expect(spread).toBeGreaterThan(0.8);
    const slow = windows(c, 0.5);
    for (let i = 1; i < slow.length; i++) expect(Math.abs(slow[i]! - slow[i - 1]!)).toBeLessThan(2);
    expect(Math.max(...slow) - Math.min(...slow)).toBeGreaterThan(1.5);
  });

  it('loop without a click: the seam is no bigger a step than any other sample', () => {
    for (const d of loops()) {
      const steps = new Float64Array(d.length - 1);
      for (let i = 1; i < d.length; i++) steps[i - 1] = Math.abs(d[i]! - d[i - 1]!);
      const sorted = Array.from(steps).sort((a, b) => a - b);
      expect(Math.abs(d[0]! - d[d.length - 1]!)).toBeLessThan(sorted[Math.floor(sorted.length * 0.999)]!);
      const w = Math.round(rate * 0.05);
      expect(Math.abs(20 * Math.log10(rms(d, 0, w) / rms(d, d.length - w)))).toBeLessThan(3);
    }
  });
});
