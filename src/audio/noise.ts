import type { Rng } from '../core/rng';

/**
 * Pure sample generators for the shared noise buffers and the procedural reverb impulse.
 * Seeded (no Math.random); each buffer is generated once per AudioContext and reused.
 */

/** Scale so the peak absolute sample equals `peak`. */
export function normalise(data: Float32Array, peak = 0.9): Float32Array {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max > 0) {
    const k = peak / max;
    for (let i = 0; i < data.length; i++) data[i] = data[i]! * k;
  }
  return data;
}

/**
 * Crossfade the last `fade` samples into the first ones so a looping buffer has no click.
 * The returned buffer is `fade` samples shorter.
 */
export function makeLoopable(data: Float32Array, fade: number): Float32Array {
  const n = data.length - fade;
  if (fade <= 0 || n <= fade) return data;
  const out = data.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const a = i / fade; // 0 → 1
    // equal-power crossfade: the tail (which continues past the end) fades into the head
    out[i] = data[i]! * Math.sin((a * Math.PI) / 2) + data[n + i]! * Math.cos((a * Math.PI) / 2);
  }
  return out;
}

export function whiteNoise(rng: Rng, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = rng.next() * 2 - 1;
  return out;
}

/** Pink noise (−3 dB/oct), Paul Kellet's refined filter. */
export function pinkNoise(rng: Rng, length: number): Float32Array {
  const out = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const w = rng.next() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  return normalise(out);
}

/** Brown noise (−6 dB/oct): leaky integrated white noise (the leak keeps it centred). */
export function brownNoise(rng: Rng, length: number): Float32Array {
  const out = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (rng.next() * 2 - 1)) * 0.998;
    out[i] = last;
  }
  return normalise(out);
}

/**
 * Stereo reverb impulse: decorrelated noise with an exponential decay (−60 dB at `seconds`)
 * that also darkens over time (one-pole low-pass closing), like a small wooden room/garden.
 */
export function impulseResponse(rng: Rng, sampleRate: number, seconds = 2.6, preDelay = 0.012): [Float32Array, Float32Array] {
  const length = Math.max(1, Math.round(sampleRate * seconds));
  const pre = Math.round(sampleRate * preDelay);
  const channels: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)];
  for (const ch of channels) {
    let lp = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / sampleRate;
      const decay = Math.exp((-6.9 * t) / seconds);
      // low-pass coefficient: bright at first, dull at the end
      const k = 0.65 - 0.55 * Math.min(1, t / seconds);
      lp += k * (rng.next() * 2 - 1 - lp);
      ch[i] = lp * decay;
    }
    normalise(ch, 0.5);
  }
  return channels;
}
