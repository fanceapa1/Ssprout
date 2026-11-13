import type { Rng } from '../core/rng';

/**
 * Pure sound recipes: each returns a `SoundSpec` — plain data describing oscillators, noise
 * bursts, pitch contours and envelopes. The Web Audio backend renders any spec generically and
 * the studio draws the same data as an ink sketch, so what you see is what you hear.
 * Times are seconds from the start of the sound; envelope values are relative (peak ≈ 1).
 */

export type Point = readonly [t: number, value: number];

export interface ToneVoice {
  kind: 'tone';
  wave: 'sine' | 'triangle';
  /** pitch contour [t, Hz] — exponential ramps between points */
  freq: Point[];
  /** amplitude envelope [t, gain] — exponential ramps between points (floored at EPS) */
  env: Point[];
  /** optional frequency modulation (breathy/whistled timbre) */
  fm?: { ratio: number; depth: number };
}

export interface NoiseVoice {
  kind: 'noise';
  filter: { type: 'bandpass' | 'highpass' | 'lowpass'; freq: number; q: number };
  env: Point[];
}

export type Voice = ToneVoice | NoiseVoice;

export interface SoundSpec {
  name: string;
  /** seconds until the last voice is silent */
  duration: number;
  /** output gain of the whole sound (the mix is normalised around these values) */
  gain: number;
  /** stereo position −1 … 1 */
  pan: number;
  /** reverb send 0 … 1 */
  reverb: number;
  /** distance low-pass (Hz), if any */
  lowpass?: number;
  voices: Voice[];
}

export const EPS = 1e-4;

/** Japanese yo pentatonic (D E G A B) from D5, two octaves, Hz. */
export const YO_SCALE: readonly number[] = [0, 2, 5, 7, 9].flatMap((s) => [s, s + 12]).sort((a, b) => a - b).map(
  (semi) => 587.33 * 2 ** (semi / 12),
);

const lastT = (pts: readonly Point[]) => pts[pts.length - 1]?.[0] ?? 0;

export function voiceEnd(v: Voice): number {
  return lastT(v.env);
}

function finish(spec: Omit<SoundSpec, 'duration'>): SoundSpec {
  return { ...spec, duration: Math.max(0, ...spec.voices.map(voiceEnd)) };
}

/** Shift a voice later by `dt` seconds. */
function delay<V extends Voice>(v: V, dt: number): V {
  const shift = (pts: Point[]): Point[] => pts.map(([t, x]) => [t + dt, x] as const);
  return v.kind === 'tone' ? ({ ...v, freq: shift(v.freq), env: shift(v.env) } as V) : ({ ...v, env: shift(v.env) } as V);
}

/** A short decaying envelope: fast attack, exponential decay. */
function pluck(attack: number, decay: number, peak = 1): Point[] {
  return [[0, EPS], [attack, peak], [attack + decay, EPS]];
}

// ---------------------------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------------------------

/** Pond plip: a soft sine whose pitch falls fast, sometimes with a fainter second drop. */
export function plip(rng: Rng, pan = 0): SoundSpec {
  const voices: Voice[] = [];
  const drops = rng.chance(0.3) ? 2 : 1;
  for (let i = 0; i < drops; i++) {
    const f0 = rng.range(700, 1400);
    const dur = rng.range(0.07, 0.12);
    const at = i === 0 ? 0 : rng.range(0.09, 0.16);
    const peak = i === 0 ? 1 : 0.45;
    voices.push(
      delay(
        {
          kind: 'tone',
          wave: 'sine',
          freq: [[0, f0], [dur, f0 * rng.range(0.42, 0.55)]],
          env: [[0, EPS], [0.003, peak], [dur * 0.6, peak * 0.25], [dur + 0.06, EPS]],
        },
        at,
      ),
    );
  }
  return finish({ name: 'plip', gain: 0.11, pan, reverb: 0.3, lowpass: 5000, voices });
}

/** Rain drip: higher, shorter plip with a tiny bright click. */
export function drip(rng: Rng, pan = 0): SoundSpec {
  const f0 = rng.range(1800, 3000);
  return finish({
    name: 'drip',
    gain: 0.05,
    pan,
    reverb: 0.2,
    voices: [
      { kind: 'tone', wave: 'sine', freq: [[0, f0], [0.05, f0 * 0.6]], env: pluck(0.002, 0.07) },
      { kind: 'noise', filter: { type: 'bandpass', freq: rng.range(2500, 4000), q: 2 }, env: pluck(0.001, 0.015, 0.5) },
    ],
  });
}

/**
 * Watering pour (the can tipped over the plant, ADR 0182): a soft trickle of about two seconds.
 * A low band of water noise swells in over a quarter second, wavers and thins away, with a dozen
 * small bubbles on top whose pitch rises (a bubble's ring rises as it shrinks). Every attack is
 * gentle and the loudest bubble stays under the stream, so it never spikes over the garden.
 */
export function pour(rng: Rng, pan = 0): SoundSpec {
  const len = rng.range(1.7, 2.2);
  const flow = rng.range(0.55, 0.7);
  const voices: Voice[] = [
    {
      kind: 'noise',
      filter: { type: 'bandpass', freq: rng.range(900, 1300), q: 0.9 },
      env: [
        [0, EPS],
        [0.28, flow],
        [len * 0.45, flow * rng.range(0.75, 0.9)],
        [len * 0.7, flow * rng.range(0.5, 0.65)],
        [len + 0.35, EPS],
      ],
    },
    // the airy top of the stream, quieter and shorter
    {
      kind: 'noise',
      filter: { type: 'highpass', freq: rng.range(2600, 3400), q: 0.7 },
      env: [
        [0, EPS],
        [0.32, flow * 0.32],
        [len * 0.6, flow * 0.22],
        [len + 0.1, EPS],
      ],
    },
  ];
  const bubbles = rng.int(10, 15);
  for (let i = 0; i < bubbles; i++) {
    // bubbles only once the stream is flowing, so nothing pokes out of the swell
    const at = 0.3 + rng.next() * (len - 0.5);
    const f0 = rng.range(480, 1150);
    const dur = rng.range(0.04, 0.08);
    // fainter as the can empties
    const peak = rng.range(0.22, 0.42) * (1 - (0.5 * at) / len);
    voices.push(
      delay(
        {
          kind: 'tone',
          wave: 'sine',
          freq: [
            [0, f0],
            [dur, f0 * rng.range(1.35, 1.7)],
          ],
          env: [
            [0, EPS],
            [0.006, peak],
            [dur, EPS],
          ],
        },
        at,
      ),
    );
  }
  return finish({ name: 'pour', gain: 0.06, pan, reverb: 0.25, lowpass: 5200, voices });
}

// ---------------------------------------------------------------------------------------------
// Birds and insects (all distant: low gain, distance low-pass, reverb)
// ---------------------------------------------------------------------------------------------

/** A small chirp: 1–3 quick whistled notes with up or down pitch sweeps. */
export function chirp(rng: Rng, pan = 0): SoundSpec {
  const voices: Voice[] = [];
  const notes = rng.int(1, 3);
  const base = rng.range(2800, 4400);
  let t = 0;
  for (let i = 0; i < notes; i++) {
    const dur = rng.range(0.05, 0.12);
    const f0 = base * rng.range(0.9, 1.1);
    const f1 = f0 * (rng.chance(0.5) ? rng.range(1.15, 1.4) : rng.range(0.7, 0.85));
    voices.push(
      delay(
        {
          kind: 'tone',
          wave: 'sine',
          freq: [[0, f0], [dur, f1]],
          env: [[0, EPS], [dur * 0.25, 1], [dur * 0.7, 0.6], [dur, EPS]],
          fm: { ratio: 0.5, depth: f0 * 0.015 },
        },
        t,
      ),
    );
    t += dur + rng.range(0.04, 0.12);
  }
  return finish({ name: 'chirp', gain: 0.045, pan, reverb: 0.35, lowpass: 6000, voices });
}

/**
 * Bush warbler (uguisu) "hō-hokekyo": a long rising-held whistle, a breath, then a quick
 * low "ho", a flicked "ke" and a falling "kyo". Rare, mostly in the morning.
 */
export function warbler(rng: Rng, pan = 0): SoundSpec {
  const f = rng.range(1050, 1300);
  const long = rng.range(1.0, 1.4);
  const ho: ToneVoice = {
    kind: 'tone',
    wave: 'sine',
    freq: [[0, f * 0.96], [long * 0.35, f * 1.06], [long, f * 1.08]],
    env: [[0, EPS], [long * 0.3, 0.65], [long - 0.15, 1], [long, EPS]],
    fm: { ratio: 0.25, depth: f * 0.01 },
  };
  const g = long + rng.range(0.1, 0.18);
  const ho2: ToneVoice = {
    kind: 'tone',
    wave: 'sine',
    freq: [[0, f * 1.05], [0.11, f * 0.9]],
    env: [[0, EPS], [0.02, 0.8], [0.11, EPS]],
  };
  const ke: ToneVoice = {
    kind: 'tone',
    wave: 'sine',
    freq: [[0, f * 1.9], [0.03, f * 2.4], [0.09, f * 1.7]],
    env: [[0, EPS], [0.015, 0.9], [0.09, EPS]],
  };
  const kyo: ToneVoice = {
    kind: 'tone',
    wave: 'sine',
    freq: [[0, f * 2.7], [0.08, f * 2.55], [0.38, f * 1.85]],
    env: [[0, EPS], [0.03, 1], [0.25, 0.55], [0.38, EPS]],
    fm: { ratio: 0.05, depth: f * 0.03 },
  };
  return finish({
    name: 'warbler',
    gain: 0.05,
    pan,
    reverb: 0.45,
    lowpass: 7000,
    voices: [ho, delay(ho2, g), delay(ke, g + 0.14), delay(kyo, g + 0.26)],
  });
}

/** Swallows crossing: a quick twitter of 4–7 tiny high chirps. */
export function swallow(rng: Rng, pan = 0): SoundSpec {
  const voices: Voice[] = [];
  const n = rng.int(4, 7);
  let t = 0;
  for (let i = 0; i < n; i++) {
    const dur = rng.range(0.03, 0.06);
    const f0 = rng.range(3500, 5500);
    const f1 = f0 * (i % 2 === 0 ? rng.range(1.1, 1.3) : rng.range(0.75, 0.9));
    voices.push(
      delay({ kind: 'tone', wave: 'sine', freq: [[0, f0], [dur, f1]], env: [[0, EPS], [dur * 0.3, 1], [dur, EPS]] }, t),
    );
    t += dur + rng.range(0.05, 0.12);
  }
  return finish({ name: 'swallow', gain: 0.03, pan, reverb: 0.3, lowpass: 8000, voices });
}

/** Night cricket: 2–4 chirps, each a train of 3–5 tiny pulses on a high sine. */
export function cricket(rng: Rng, pan = 0): SoundSpec {
  const f = rng.range(4200, 4800);
  const chirps = rng.int(2, 4);
  const pulses = rng.int(3, 5);
  const period = rng.range(0.022, 0.03);
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let c = 0; c < chirps; c++) {
    for (let p = 0; p < pulses; p++) {
      const s = t + p * period;
      // hold silence up to each pulse so the exponential ramps never swell across gaps
      if (s > 0) env.push([s, EPS]);
      env.push([s + 0.003, 1], [s + period * 0.55, EPS]);
    }
    t += pulses * period + rng.range(0.25, 0.4);
  }
  const end = lastT(env);
  return finish({
    name: 'cricket',
    gain: 0.018,
    pan,
    reverb: 0.25,
    voices: [{ kind: 'tone', wave: 'sine', freq: [[0, f], [end, f * 0.99]], env }],
  });
}

// ---------------------------------------------------------------------------------------------
// The waterfall (ADR 0283): a soft splash, the dipper's song, the kajika frog's evening trill
// ---------------------------------------------------------------------------------------------

/** A soft splash in the pool: a rounded slap of water noise, a little spatter, 1–3 low bubbles. */
export function splash(rng: Rng, pan = 0): SoundSpec {
  const len = rng.range(0.22, 0.38);
  const voices: Voice[] = [
    {
      kind: 'noise',
      filter: { type: 'bandpass', freq: rng.range(650, 1050), q: 0.8 },
      env: [[0, EPS], [0.012, 1], [0.06, 0.4], [len, EPS]],
    },
    { kind: 'noise', filter: { type: 'highpass', freq: rng.range(2200, 3000), q: 0.7 }, env: [[0, EPS], [0.008, 0.3], [len * 0.55, EPS]] },
  ];
  const bubbles = rng.int(1, 3);
  for (let i = 0; i < bubbles; i++) {
    const f0 = rng.range(380, 760);
    const dur = rng.range(0.05, 0.09);
    voices.push(delay({
      kind: 'tone',
      wave: 'sine',
      freq: [[0, f0], [dur, f0 * rng.range(1.25, 1.5)]],
      env: [[0, EPS], [0.008, rng.range(0.25, 0.4)], [dur, EPS]],
    }, rng.range(0.03, len * 0.7)));
  }
  return finish({ name: 'splash', gain: 0.05, pan, reverb: 0.3, lowpass: 4500, voices });
}

/**
 * Brown dipper (kawagarasu): a sweet, rippling warble over the falls. One whistled voice: 9–15
 * quick notes rippling up and down around ~3.2 kHz, now and then a short trill; the phrase swells
 * and fades. Every note eases in (≥ 12 ms), so nothing is sharp.
 */
export function dipper(rng: Rng, pan = 0): SoundSpec {
  const base = rng.range(2900, 3500);
  const n = rng.int(9, 15);
  const phase = rng.range(0, Math.PI * 2);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const amp = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n);
    const f0 = base * (1 + 0.11 * Math.sin(i * 0.95 + phase)) * rng.range(0.96, 1.04);
    if (rng.chance(0.22)) {
      // a trill: 3–4 tiny pulses on one held pitch
      const pulses = rng.int(3, 4);
      freq.push([t, f0], [t + pulses * 0.028, f0 * 1.03]);
      for (let p = 0; p < pulses; p++) {
        const s = t + p * 0.028;
        if (s > 0) env.push([s, EPS]);
        env.push([s + 0.008, amp * 0.8], [s + 0.022, EPS]);
      }
      t += pulses * 0.028;
    } else {
      const dur = rng.range(0.05, 0.085);
      freq.push([t, f0], [t + dur, f0 * (i % 2 === 0 ? rng.range(1.12, 1.22) : rng.range(0.82, 0.9))]);
      if (t > 0) env.push([t, EPS]);
      env.push([t + Math.max(0.012, dur * 0.3), amp], [t + dur * 0.75, amp * 0.5], [t + dur, EPS]);
      t += dur;
    }
    t += rng.range(0.025, 0.06);
  }
  return finish({
    name: 'dipper',
    gain: 0.032,
    pan,
    reverb: 0.3,
    lowpass: 7000,
    voices: [{ kind: 'tone', wave: 'sine', freq, env, fm: { ratio: 0.5, depth: base * 0.012 } }],
  });
}

/**
 * Kajika frog (カジカガエル) at dusk: a soft, rising, accelerating trill of 7–10 whistled notes, each
 * a small upward slide, the gaps closing from ~0.5 s to ~0.15 s; it swells, then thins away.
 */
export function kajika(rng: Rng, pan = 0): SoundSpec {
  const base = rng.range(1900, 2300);
  const n = rng.int(7, 10);
  const gap0 = rng.range(0.42, 0.55), gap1 = rng.range(0.13, 0.17);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const dur = 0.13 - 0.06 * k;
    const f0 = base * (1 + 0.08 * Math.min(1, k * 1.6));
    const amp = Math.min(1, 0.45 + k * 1.1) * (k > 0.7 ? 1 - (k - 0.7) * 1.3 : 1);
    freq.push([t, f0], [t + dur * 0.8, f0 * 1.14], [t + dur, f0 * 1.11]);
    if (t > 0) env.push([t, EPS]);
    env.push([t + dur * 0.35, amp], [t + dur, EPS]);
    t += dur + gap0 + (gap1 - gap0) * k;
  }
  return finish({
    name: 'kajika',
    gain: 0.03,
    pan,
    reverb: 0.45,
    lowpass: 6000,
    voices: [{ kind: 'tone', wave: 'sine', freq, env, fm: { ratio: 0.25, depth: base * 0.008 } }],
  });
}

// ---------------------------------------------------------------------------------------------
// The Ksar oasis (ADR 0303): doves and buntings by day, a bee-eater overhead, a midday insect
// shimmer, and after dark a gecko's clicks and a distant frog chorus from the basin
// ---------------------------------------------------------------------------------------------

/** Ups and downs of a pulse train: each pulse eases to `peak` and falls back to `floor`. */
function pulses(env: Point[], t: number, n: number, period: number, peak: (i: number) => number, floor = EPS): number {
  if (t > 0) env.push([t, EPS]);
  for (let i = 0; i < n; i++) {
    const s = t + i * period;
    if (i > 0) env.push([s, floor]);
    env.push([s + period * 0.35, peak(i)], [s + period * 0.85, floor]);
  }
  env.push([t + n * period, EPS]);
  return t + n * period;
}

/** Relative pitch and length of the laughing dove's five notes: up to the third, then down. */
export const DOVE_NOTES: readonly (readonly [pitch: number, length: number])[] = [
  [1, 0.12], [1.05, 0.11], [1.16, 0.17], [1.12, 0.16], [0.97, 0.26],
];

/**
 * Laughing dove: a soft, bubbling five-note laugh, "oo-oo-OO-oo-ooo", low (430–540 Hz), the
 * pitch climbing to the third note and sinking on the long last one. A slow FM wobble makes
 * the hoot bubble. Now and then the bird says it twice.
 */
export function dove(rng: Rng, pan = 0): SoundSpec {
  const base = rng.range(430, 540);
  const twice = rng.chance(0.3);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let phrase = 0; phrase < (twice ? 2 : 1); phrase++) {
    const soft = phrase === 0 ? 1 : 0.75;
    for (const [i, [pitch, length]] of DOVE_NOTES.entries()) {
      const f = base * pitch * rng.range(0.985, 1.015), dur = length * rng.range(0.9, 1.1);
      const amp = soft * (i === 2 ? 1 : i === 4 ? 0.8 : 0.7);
      freq.push([t, f * 1.02], [t + dur * 0.3, f * 1.03], [t + dur, f * 0.93]);
      if (t > 0) env.push([t, EPS]);
      env.push([t + Math.max(0.03, dur * 0.3), amp], [t + dur * 0.75, amp * 0.45], [t + dur, EPS]);
      t += dur + rng.range(0.05, 0.08);
    }
    t += rng.range(0.8, 1.1);
  }
  const hoot: ToneVoice = { kind: 'tone', wave: 'sine', freq, env, fm: { ratio: 0.06, depth: base * 0.025 } };
  // a faint second harmonic for the breathy body of the coo
  const body: ToneVoice = { kind: 'tone', wave: 'sine', freq: freq.map(([at, f]) => [at, f * 2] as const), env: env.map(([at, v]) => [at, Math.max(EPS, v * 0.18)] as const) };
  return finish({ name: 'dove', gain: 0.07, pan, reverb: 0.35, lowpass: 2200, voices: [hoot, body] });
}

/**
 * House bunting: a short, bright, sparrow-like song of 5–8 quick down-slurred notes around
 * 3–4 kHz, the phrase stepping down a little and the last notes quicker. About a second long.
 */
export function bunting(rng: Rng, pan = 0): SoundSpec {
  const n = rng.int(5, 8);
  let f = rng.range(3600, 4300);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const last = i >= n - 2;
    const dur = last ? rng.range(0.05, 0.07) : rng.range(0.07, 0.1);
    const amp = i === 0 ? 0.7 : last ? 0.75 : 1;
    freq.push([t, f * 1.08], [t + dur * 0.4, f], [t + dur, f * rng.range(0.78, 0.86)]);
    if (t > 0) env.push([t, EPS]);
    env.push([t + Math.max(0.012, dur * 0.3), amp], [t + dur * 0.7, amp * 0.5], [t + dur, EPS]);
    t += dur + (last ? rng.range(0.03, 0.045) : rng.range(0.045, 0.07));
    f *= rng.range(0.97, 0.99);
  }
  return finish({
    name: 'bunting', gain: 0.04, pan, reverb: 0.3, lowpass: 7000,
    voices: [{ kind: 'tone', wave: 'sine', freq, env, fm: { ratio: 0.5, depth: f * 0.01 } }],
  });
}

/** Blue-cheeked bee-eater overhead: 1–3 rolling, burred "prrüp" calls around 2.6 kHz. */
export function beeEater(rng: Rng, pan = 0): SoundSpec {
  const calls = rng.int(1, 3);
  const base = rng.range(2400, 2900);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let c = 0; c < calls; c++) {
    const n = rng.int(6, 9), period = rng.range(0.022, 0.028);
    const f = base * rng.range(0.97, 1.03);
    freq.push([t, f * 0.92], [t + n * period * 0.6, f * 1.06], [t + n * period, f * 0.98]);
    // the burr: the note dips to a fifth between pulses rather than stopping
    t = pulses(env, t, n, period, (i) => 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n), 0.2);
    t += rng.range(0.25, 0.4);
  }
  return finish({
    name: 'beeeater', gain: 0.03, pan, reverb: 0.4, lowpass: 6000,
    voices: [{ kind: 'tone', wave: 'sine', freq, env, fm: { ratio: 0.25, depth: base * 0.01 } }],
  });
}

/**
 * Midday insect shimmer: a faint, raspy buzz high in the palms (5–6.5 kHz, a ~70 Hz FM rasp
 * and a narrow band of noise), swelling in over 1.2–2 s, holding, and fading over ~2 s.
 */
export function cicada(rng: Rng, pan = 0): SoundSpec {
  const f = rng.range(5000, 6500);
  const rise = rng.range(1.2, 2), hold = rng.range(1.5, 3), fall = rng.range(1.5, 2.4);
  const shape = (peak: number): Point[] => [[0, EPS], [rise, peak], [rise + hold * 0.5, peak * rng.range(0.75, 0.9)], [rise + hold, peak], [rise + hold + fall, EPS]];
  return finish({
    name: 'cicada', gain: 0.012, pan, reverb: 0.3,
    voices: [
      { kind: 'tone', wave: 'sine', freq: [[0, f], [rise + hold + fall, f * 0.985]], env: shape(1), fm: { ratio: 70 / f, depth: f * 0.05 } },
      { kind: 'noise', filter: { type: 'bandpass', freq: f, q: 4 }, env: shape(0.35) },
    ],
  });
}

/**
 * Böhme's gecko on the warm wall after dark: 3–8 dry clicks, "tchk-tchk-tchk", a little faster
 * then slower and fading. Each click a quick falling tick at 2.2–3 kHz with a tiny noise burst.
 */
export function gecko(rng: Rng, pan = 0): SoundSpec {
  const n = rng.int(3, 8);
  const f = rng.range(2200, 3000);
  const voices: Voice[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const amp = 1 - 0.4 * (i / Math.max(1, n - 1));
    voices.push(delay({ kind: 'tone', wave: 'triangle', freq: [[0, f * 1.1], [0.03, f * 0.85]], env: [[0, EPS], [0.003, amp], [0.03, EPS]] }, t));
    voices.push(delay({ kind: 'noise', filter: { type: 'bandpass', freq: f * 1.4, q: 3 }, env: [[0, EPS], [0.002, amp * 0.5], [0.016, EPS]] }, t));
    t += rng.range(0.09, 0.13) * (1 + 0.25 * Math.abs(i - n / 2) / n);
  }
  return finish({ name: 'gecko', gain: 0.03, pan, reverb: 0.3, lowpass: 6000, voices });
}

/**
 * A distant Sahara frog chorus from the basin: two or three frogs, each a rattling, laughing
 * croak of 6–12 pulses at ~12 a second on a low (650–950 Hz) reedy note, overlapping.
 */
export function frogs(rng: Rng, pan = 0): SoundSpec {
  const voices: Voice[] = [];
  const count = rng.int(2, 3);
  let start = 0;
  for (let k = 0; k < count; k++) {
    const n = rng.int(6, 12), period = rng.range(0.075, 0.09), f = rng.range(650, 950);
    const env: Point[] = [[0, EPS]];
    const end = pulses(env, 0, n, period, (i) => (0.6 + 0.4 * Math.sin((Math.PI * (i + 0.5)) / n)) * (k === 0 ? 1 : 0.7));
    voices.push(delay({ kind: 'tone', wave: 'triangle', freq: [[0, f], [end * 0.4, f * 1.05], [end, f * 0.95]], env, fm: { ratio: 0.5, depth: f * 0.04 } }, start));
    start += rng.range(0.4, 0.9);
  }
  return finish({ name: 'frogs', gain: 0.035, pan, reverb: 0.55, lowpass: 1800, voices });
}

// ---------------------------------------------------------------------------------------------
// The Greek coast (ADR 0376): the caique's ropes, a far gull, goat bells on the cliff, a chapel
// bell at sunset, and the Scops owl's note through the night
// ---------------------------------------------------------------------------------------------

const side = (centre: number, pan: number) => Math.max(-1, Math.min(1, centre + pan));

/**
 * The moored caique (left of the cove): two or three soft slaps of water on the hull, and the
 * mooring rope creaking once as the boat rides up: a slow stick-slip of a few dozen ticks.
 */
export function caique(rng: Rng, pan = 0): SoundSpec {
  const voices: Voice[] = [];
  const slaps = rng.int(2, 3);
  let t = 0;
  for (let i = 0; i < slaps; i++) {
    const amp = i === 0 ? 1 : rng.range(0.55, 0.85), f = rng.range(150, 220);
    voices.push(delay({ kind: 'noise', filter: { type: 'bandpass', freq: rng.range(320, 480), q: 1.2 }, env: [[0, EPS], [0.012, amp], [0.05, amp * 0.3], [0.18, EPS]] }, t));
    voices.push(delay({ kind: 'tone', wave: 'sine', freq: [[0, f], [0.14, f * 0.7]], env: [[0, EPS], [0.015, amp * 0.5], [0.16, EPS]] }, t));
    t += rng.range(0.6, 1.2);
  }
  const at = rng.range(0.3, 1.2), n = rng.int(22, 34), period = rng.range(0.022, 0.03), f = rng.range(190, 300);
  const env: Point[] = [[0, EPS]];
  const end = pulses(env, 0, n, period, (i) => 0.25 + 0.75 * Math.sin((Math.PI * (i + 0.5)) / n) ** 0.7, 0.12);
  voices.push(delay({ kind: 'tone', wave: 'triangle', freq: [[0, f], [end * 0.6, f * 1.25], [end, f * 1.1]], env: env.map(([x, v]) => [x, v * 0.55] as const) }, at));
  return finish({ name: 'caique', gain: 0.03, pan: side(-0.45, pan), reverb: 0.3, lowpass: 2000, voices });
}

/**
 * A yellow-legged gull far over the water: two to four mewing "kyow" notes, each rising fast
 * then falling, nasal (a triangle with a faint octave), the later ones a little lower and shorter.
 */
export function gull(rng: Rng, pan = 0): SoundSpec {
  const n = rng.int(2, 4);
  let f = rng.range(1150, 1350), t = 0;
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  for (let i = 0; i < n; i++) {
    const dur = (i === 0 ? rng.range(0.32, 0.4) : rng.range(0.24, 0.32)) * (1 - 0.06 * i), amp = i === 0 ? 1 : 0.8 - 0.1 * i;
    freq.push([t, f * 0.9], [t + dur * 0.25, f * 1.35], [t + dur, f * 0.95]);
    if (t > 0) env.push([t, EPS]);
    env.push([t + dur * 0.2, amp], [t + dur * 0.6, amp * 0.7], [t + dur, EPS]);
    t += dur + rng.range(0.15, 0.3);
    f *= rng.range(0.94, 0.98);
  }
  const body: ToneVoice = { kind: 'tone', wave: 'triangle', freq, env, fm: { ratio: 0.04, depth: f * 0.03 } };
  const octave: ToneVoice = { kind: 'tone', wave: 'sine', freq: freq.map(([at, hz]) => [at, hz * 2] as const), env: env.map(([at, v]) => [at, Math.max(EPS, v * 0.2)] as const) };
  return finish({ name: 'gull', gain: 0.016, pan, reverb: 0.5, lowpass: 3000, voices: [body, octave] });
}

/** A goat bell's partials (sheet metal: inharmonic, damped): [ratio, gain, decay s]. */
export const GOAT_BELL_PARTIALS: readonly (readonly [number, number, number])[] = [
  [1, 1, 0.5], [1.58, 0.6, 0.35], [2.31, 0.35, 0.25], [3.1, 0.18, 0.18],
];

/**
 * Goat bells on the far cliff (right of the cove): two or three dull clanks at uneven gaps, from
 * one or two goats, each a clapper tick and a handful of damped inharmonic partials.
 */
export function goatBells(rng: Rng, pan = 0): SoundSpec {
  const bells = [rng.range(420, 620), rng.range(380, 560)];
  const voices: Voice[] = [];
  const n = rng.int(2, 3);
  let t = 0;
  for (let i = 0; i < n; i++) {
    const f0 = bells[rng.chance(0.65) ? 0 : 1]!, amp = rng.range(0.6, 1), damp = rng.range(0.7, 1.2);
    for (const [ratio, g, decay] of GOAT_BELL_PARTIALS) {
      const f = f0 * ratio * rng.range(0.99, 1.01);
      voices.push(delay({ kind: 'tone', wave: 'sine', freq: [[0, f], [decay * damp, f]], env: pluck(0.004, decay * damp, g * amp) }, t));
    }
    voices.push(delay({ kind: 'noise', filter: { type: 'bandpass', freq: 1800, q: 1.5 }, env: pluck(0.001, 0.02, 0.3 * amp) }, t));
    t += rng.range(0.4, 1.4);
  }
  return finish({ name: 'goatbell', gain: 0.022, pan: side(0.45, pan), reverb: 0.55, lowpass: 2400, voices });
}

/** A small chapel bell's partials (hum, prime, minor third, fifth, nominal): [ratio, gain, decay s]. */
export const CHAPEL_PARTIALS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.4, 5], [1, 0.65, 3.6], [1.19, 0.45, 2.6], [1.5, 0.25, 1.8], [2, 0.4, 1.6],
];

/**
 * The village chapel's bell across the bay at sunset (far left): three slow, unhurried strokes,
 * softened by the distance (a slow attack, nothing above 1.8 kHz).
 */
export function chapelBell(rng: Rng, pan = 0): SoundSpec {
  const f0 = rng.range(520, 600);
  const voices: Voice[] = [];
  for (let i = 0; i < 3; i++) {
    const at = i * rng.range(2.6, 3.2), amp = i === 2 ? 0.8 : 1;
    for (const [ratio, g, decay] of CHAPEL_PARTIALS) {
      const f = f0 * ratio * rng.range(0.998, 1.002);
      voices.push(delay({ kind: 'tone', wave: 'sine', freq: [[0, f], [decay, f]], env: pluck(0.015, decay, g * amp) }, at));
    }
  }
  return finish({ name: 'chapel', gain: 0.016, pan: side(-0.55, pan), reverb: 0.6, lowpass: 1800, voices });
}

/**
 * The Scops owl: a spell of one soft, clear, slightly plaintive note ("tiu", ~1.2 kHz, a quarter
 * second, easing down at its end) every 2.3–2.9 s, 8–15 times, easing in and out; distant.
 */
export function scops(rng: Rng, pan = 0): SoundSpec {
  const f = rng.range(1120, 1300), period = rng.range(2.3, 2.9), n = rng.int(8, 15);
  const freq: Point[] = [];
  const env: Point[] = [[0, EPS]];
  let t = 0;
  for (let i = 0; i < n; i++, t += period * rng.range(0.98, 1.02)) {
    const dur = rng.range(0.2, 0.26);
    const amp = Math.min(1, 0.55 + 0.25 * i, 0.55 + 0.25 * (n - 1 - i));
    freq.push([t, f * 0.96], [t + 0.05, f], [t + dur * 0.7, f * 0.995], [t + dur, f * 0.93]);
    if (t > 0) env.push([t, EPS]);
    env.push([t + 0.045, amp], [t + dur * 0.7, amp * 0.8], [t + dur, EPS]);
  }
  const note: ToneVoice = { kind: 'tone', wave: 'sine', freq, env };
  const breath: ToneVoice = { kind: 'tone', wave: 'sine', freq: freq.map(([at, hz]) => [at, hz * 2] as const), env: env.map(([at, v]) => [at, Math.max(EPS, v * 0.08)] as const) };
  return finish({ name: 'scops', gain: 0.014, pan, reverb: 0.5, lowpass: 2500, voices: [note, breath] });
}

// ---------------------------------------------------------------------------------------------
// Chimes (never loud; long reverb tail)
// ---------------------------------------------------------------------------------------------

/** Inharmonic partials of a small rin bowl: [ratio, gain, decay s]. */
export const RIN_PARTIALS: readonly (readonly [number, number, number])[] = [
  [1, 1, 4.2],
  [2.74, 0.42, 2.4],
  [5.1, 0.18, 1.2],
  [8.2, 0.07, 0.6],
];

/** Bloom chime: a small rin bowl struck softly, with a slow beat on the fundamental. */
export function rinBowl(rng: Rng, pan = 0): SoundSpec {
  const f0 = rng.pick(YO_SCALE.slice(2, 7)) / 2;
  const voices: Voice[] = RIN_PARTIALS.map(([ratio, g, decay]) => {
    const f = f0 * ratio * rng.range(0.997, 1.003);
    return { kind: 'tone' as const, wave: 'sine' as const, freq: [[0, f], [decay, f]], env: pluck(0.004, decay, g) };
  });
  // a detuned twin of the fundamental → gentle beating, like a real bowl
  voices.push({
    kind: 'tone',
    wave: 'sine',
    freq: [[0, f0 + rng.range(0.6, 1.2)], [4, f0 + 0.9]],
    env: pluck(0.006, 3.8, 0.5),
  });
  // the soft mallet touch
  voices.push({ kind: 'noise', filter: { type: 'bandpass', freq: f0 * 4, q: 1.2 }, env: pluck(0.001, 0.02, 0.25) });
  return finish({ name: 'rin', gain: 0.075, pan, reverb: 0.55, voices });
}

/** A kalimba-like plucked note: sine fundamental, a short bright tine partial and a soft thunk. */
export function kalimbaNote(freq: number, decay: number, peak = 1): Voice[] {
  return [
    { kind: 'tone', wave: 'sine', freq: [[0, freq], [decay, freq]], env: pluck(0.003, decay, peak) },
    { kind: 'tone', wave: 'sine', freq: [[0, freq * 5.4], [0.2, freq * 5.4]], env: pluck(0.002, 0.18, peak * 0.12) },
    { kind: 'noise', filter: { type: 'lowpass', freq: 1400, q: 0.7 }, env: pluck(0.001, 0.012, peak * 0.2) },
  ];
}

/** Scale-degree patterns for the completion phrase (indices into YO_SCALE): gently rising. */
export const PHRASES: readonly (readonly number[])[] = [
  [0, 2, 4],
  [1, 3, 4],
  [2, 4, 5],
  [0, 3, 4],
  [2, 4],
  [1, 4],
];

/** The completion phrase's frequencies (2–3 notes from the yo pentatonic). */
export function completionPhrase(rng: Rng): number[] {
  return rng.pick(PHRASES).map((i) => YO_SCALE[i]!);
}

/** Session complete: a short 2–3 note pentatonic kalimba phrase, last note held. */
export function completion(rng: Rng, pan = 0): SoundSpec {
  const notes = completionPhrase(rng);
  const gap = rng.range(0.3, 0.38);
  const voices = notes.flatMap((f, i) => {
    const lastNote = i === notes.length - 1;
    return kalimbaNote(f, lastNote ? 2.6 : 1.4, lastNote ? 1 : 0.8).map((v) => delay(v, i * gap));
  });
  return finish({ name: 'completion', gain: 0.07, pan, reverb: 0.5, voices });
}

export type RecipeName = 'plip' | 'drip' | 'pour' | 'chirp' | 'warbler' | 'swallow' | 'cricket' | 'splash' | 'dipper' | 'kajika' |
  'dove' | 'bunting' | 'beeeater' | 'cicada' | 'gecko' | 'frogs' | 'caique' | 'gull' | 'goatbell' | 'chapel' | 'scops' | 'rin' | 'completion';

export const RECIPES: Readonly<Record<RecipeName, (rng: Rng, pan?: number) => SoundSpec>> = {
  plip,
  drip,
  pour,
  chirp,
  warbler,
  swallow,
  cricket,
  splash,
  dipper,
  kajika,
  dove,
  bunting,
  beeeater: beeEater,
  cicada,
  gecko,
  frogs,
  caique,
  gull,
  goatbell: goatBells,
  chapel: chapelBell,
  scops,
  rin: rinBowl,
  completion,
};
