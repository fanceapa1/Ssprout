import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { FALLS_BLEND, FALLS_RMS, PLUNGE_S, SPRAY_S, fallsLoops } from './falls';
import { whiteNoise } from './noise';

const SR = 22050;
const loops = fallsLoops(createRng('falls-test'), SR);

const rms = (d: Float32Array, from = 0, to = d.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i]! ** 2;
  return Math.sqrt(s / (to - from));
};
const peak = (d: Float32Array) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const db = (x: number) => 10 * Math.log10(x);

/** Welch power spectrum: averaged |FFT|² of Hann windows, bin width SR / size. */
function spectrum(d: Float32Array, size = 4096): Float64Array {
  const power = new Float64Array(size / 2);
  let frames = 0;
  for (let start = 0; start + size <= d.length; start += size / 2, frames++) {
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = d[start + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const a = (-2 * Math.PI) / len;
      for (let i = 0; i < size; i += len) {
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(a * k), wi = Math.sin(a * k);
          const xr = re[i + k + len / 2]! * wr - im[i + k + len / 2]! * wi;
          const xi = re[i + k + len / 2]! * wi + im[i + k + len / 2]! * wr;
          re[i + k + len / 2] = re[i + k]! - xr; im[i + k + len / 2] = im[i + k]! - xi;
          re[i + k] = re[i + k]! + xr; im[i + k] = im[i + k]! + xi;
        }
      }
    }
    for (let k = 0; k < size / 2; k++) power[k] = power[k]! + re[k]! ** 2 + im[k]! ** 2;
  }
  return power.map((p) => p / frames);
}
/** Total power between two frequencies. */
const band = (p: Float64Array, lo: number, hi: number, size = 4096) => {
  let s = 0;
  for (let k = Math.ceil((lo * size) / SR); k < Math.min(p.length, (hi * size) / SR); k++) s += p[k]!;
  return s;
};
/** Power per octave in dB, from 31 Hz up to Nyquist. */
const octaves = (p: Float64Array) => {
  const out: number[] = [];
  for (let f = 31.25; f < SR / 2; f *= 2) out.push(db(band(p, f, 2 * f)));
  return out;
};
/** What the backend sounds for one channel: plunge plus spray, at their blend, spray wrapping. */
function blend(seconds: number, ch: 0 | 1 = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  const spray = loops.spray[ch];
  for (let i = 0; i < out.length; i++) {
    out[i] = loops.plunge[i % loops.plunge.length]! * FALLS_BLEND.plunge + spray[i % spray.length]! * FALLS_BLEND.spray;
  }
  return out;
}

describe('waterfall bed (falls.ts)', () => {
  it('is deterministic, the right length, at its RMS and bounded', () => {
    const again = fallsLoops(createRng('falls-test'), SR);
    expect(again.plunge).toEqual(loops.plunge);
    expect(again.spray[1]).toEqual(loops.spray[1]);
    expect(loops.plunge.length).toBe(PLUNGE_S * SR);
    expect(loops.spray[0].length).toBe(SPRAY_S * SR);
    for (const d of [loops.plunge, ...loops.spray]) {
      expect(rms(d)).toBeCloseTo(FALLS_RMS, 3);
      expect(peak(d)).toBeLessThan(1);
      expect(d.every(Number.isFinite)).toBe(true);
    }
    // the two spray channels are different noise (a wide image, not a centred mono hiss)
    let dot = 0;
    for (let i = 0; i < loops.spray[0].length; i++) dot += loops.spray[0][i]! * loops.spray[1][i]!;
    expect(Math.abs(dot / loops.spray[0].length / FALLS_RMS ** 2)).toBeLessThan(0.05);
  });

  it('the plunge is a low rumble and roar, the spray a bright hiss', () => {
    const p = spectrum(loops.plunge), s = spectrum(loops.spray[0]);
    expect(db(band(p, 30, 250) / band(p, 3000, 9000))).toBeGreaterThan(25);
    expect(db(band(p, 250, 1500) / band(p, 3000, 9000))).toBeGreaterThan(15);
    expect(db(band(s, 3000, 9000) / band(s, 30, 250))).toBeGreaterThan(25);
  });

  it('together: a broad roar tilting down from the rumble, the hiss present but under it', () => {
    const levels = octaves(spectrum(blend(26)));
    const top = Math.max(...levels);
    // octaves from 31 Hz: 31, 63, 125, 250, 500, 1k, 2k, 4k, 8k
    expect(levels.indexOf(top)).toBeLessThanOrEqual(2);
    for (let o = 2; o <= 6; o++) expect(levels[o]!).toBeGreaterThan(top - 12);
    expect(levels[7]!).toBeLessThan(top - 4);
    expect(levels[7]!).toBeGreaterThan(top - 14);
    expect(levels[8]!).toBeLessThan(top - 12);
    // white noise read the same way rises octave by octave: the bed is nothing like it
    const white = octaves(spectrum(whiteNoise(createRng(1), SR * 26)));
    expect(white.indexOf(Math.max(...white))).toBeGreaterThanOrEqual(7);
  });

  it('loops without a click: the seam is no bigger a step than any other sample', () => {
    for (const d of [loops.plunge, ...loops.spray]) {
      const steps = new Float64Array(d.length - 1);
      for (let i = 1; i < d.length; i++) steps[i - 1] = Math.abs(d[i]! - d[i - 1]!);
      const sorted = Array.from(steps).sort((a, b) => a - b);
      const p999 = sorted[Math.floor(sorted.length * 0.999)]!;
      expect(Math.abs(d[0]! - d[d.length - 1]!)).toBeLessThan(p999);
      // no level step either: 50 ms either side of the seam match within 3 dB
      const w = Math.round(SR * 0.05);
      expect(Math.abs(20 * Math.log10(rms(d, 0, w) / rms(d, d.length - w)))).toBeLessThan(3);
    }
  });

  it('breathes slowly: half-second levels move a little, never pump', () => {
    const d = blend(26);
    const w = SR / 2, levels: number[] = [];
    for (let i = 0; i + w <= d.length; i += w) levels.push(20 * Math.log10(rms(d, i, i + w)));
    const mean = levels.reduce((s, v) => s + v, 0) / levels.length;
    const sd = Math.sqrt(levels.reduce((s, v) => s + (v - mean) ** 2, 0) / levels.length);
    expect(sd).toBeGreaterThan(0.4);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(8);
    // neighbouring windows never jump: the swell is slow
    for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i]! - levels[i - 1]!)).toBeLessThan(2.5);
  });
});
