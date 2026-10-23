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

export type RecipeName = 'plip' | 'drip' | 'pour' | 'chirp' | 'warbler' | 'swallow' | 'cricket' | 'rin' | 'completion';

export const RECIPES: Readonly<Record<RecipeName, (rng: Rng, pan?: number) => SoundSpec>> = {
  plip,
  drip,
  pour,
  chirp,
  warbler,
  swallow,
  cricket,
  rin: rinBowl,
  completion,
};
