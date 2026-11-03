import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { completionPhrase, EPS, RECIPES, YO_SCALE, type Point, type RecipeName, type SoundSpec, type ToneVoice } from './recipes';

const names = Object.keys(RECIPES) as RecipeName[];

/** The notes of a one-voice song: [onset, attack seconds, peak] of each rise out of silence. */
function notes(env: readonly Point[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 1; i < env.length; i++) {
    if (env[i - 1]![1] <= EPS && env[i]![1] > EPS) out.push([env[i - 1]![0], env[i]![0] - env[i - 1]![0], env[i]![1]]);
  }
  return out;
}
const only = (spec: SoundSpec): ToneVoice => {
  expect(spec.voices).toHaveLength(1);
  const v = spec.voices[0]!;
  if (v.kind !== 'tone') throw new Error('expected a tone');
  return v;
};

function checkSpec(spec: SoundSpec) {
  expect(spec.voices.length).toBeGreaterThan(0);
  expect(spec.gain).toBeGreaterThan(0);
  expect(spec.gain).toBeLessThanOrEqual(0.12); // never loud
  expect(Math.abs(spec.pan)).toBeLessThanOrEqual(1);
  expect(spec.reverb).toBeGreaterThanOrEqual(0);
  expect(spec.reverb).toBeLessThanOrEqual(1);
  for (const v of spec.voices) {
    const pts = v.kind === 'tone' ? [...v.env, ...v.freq] : v.env;
    for (let i = 1; i < v.env.length; i++) expect(v.env[i]![0]).toBeGreaterThanOrEqual(v.env[i - 1]![0]);
    for (const [t, x] of pts) {
      expect(Number.isFinite(t) && t >= 0).toBe(true);
      expect(Number.isFinite(x) && x > 0).toBe(true); // exponential ramps need > 0
    }
    expect(v.env[0]![1]).toBeLessThan(0.01); // every voice starts silent (no clicks)
    expect(v.env[v.env.length - 1]![1]).toBeLessThan(0.01); // and ends silent
    expect(Math.max(...v.env.map((p) => p[1]))).toBeLessThanOrEqual(1);
    if (v.kind === 'tone') {
      for (const [, f] of v.freq) {
        expect(f).toBeGreaterThan(100);
        expect(f).toBeLessThan(12000);
      }
    }
  }
  expect(spec.duration).toBeCloseTo(Math.max(...spec.voices.map((v) => v.env[v.env.length - 1]![0])));
}

describe('sound recipes', () => {
  it.each(names)('%s produces a valid, quiet spec for many seeds', (name) => {
    for (let seed = 1; seed <= 40; seed++) checkSpec(RECIPES[name](createRng(seed), 0.3));
  });

  it('is deterministic per seed and varies between seeds', () => {
    for (const name of names) {
      expect(RECIPES[name](createRng(5))).toEqual(RECIPES[name](createRng(5)));
      expect(RECIPES[name](createRng(5))).not.toEqual(RECIPES[name](createRng(6)));
    }
  });

  it('keeps short sounds short and the chimes long and reverberant', () => {
    const rng = createRng(1);
    expect(RECIPES.plip(rng).duration).toBeLessThan(0.35);
    expect(RECIPES.chirp(rng).duration).toBeLessThan(0.7);
    expect(RECIPES.warbler(rng).duration).toBeLessThan(2.6);
    expect(RECIPES.rin(rng).duration).toBeGreaterThan(3);
    expect(RECIPES.rin(rng).reverb).toBeGreaterThan(0.4);
  });

  it('the watering pour is a gentle two-second trickle: soft swell, no spike, rising bubbles', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spec = RECIPES.pour(createRng(seed));
      expect(spec.duration).toBeGreaterThan(1.6);
      expect(spec.duration).toBeLessThan(2.8);
      expect(spec.gain).toBeLessThanOrEqual(0.07);
      const noise = spec.voices.filter((v) => v.kind === 'noise');
      const tones = spec.voices.filter((v) => v.kind === 'tone');
      // the stream swells in over a quarter second or more: no click, no burst
      for (const v of noise) expect(v.env[1]![0]).toBeGreaterThanOrEqual(0.25);
      const stream = Math.max(...noise[0]!.env.map((p) => p[1]));
      expect(tones.length).toBeGreaterThanOrEqual(10);
      for (const v of tones) {
        if (v.kind !== 'tone') continue;
        // each bubble stays under the stream and rises in pitch
        expect(Math.max(...v.env.map((p) => p[1]))).toBeLessThan(stream);
        expect(v.freq[v.freq.length - 1]![1]).toBeGreaterThan(v.freq[0]![1]);
        // and only once the stream has swelled in
        expect(v.env[0]![0]).toBeGreaterThanOrEqual(0.28);
      }
    }
  });

  it('the plip’s pitch falls fast', () => {
    const tone = RECIPES.plip(createRng(3)).voices[0]!;
    if (tone.kind !== 'tone') throw new Error('expected a tone');
    const [start, end] = [tone.freq[0]!, tone.freq[tone.freq.length - 1]!];
    expect(end[1]).toBeLessThan(start[1] * 0.6);
    expect(end[0]).toBeLessThan(0.15);
  });

  it('the warbler opens with a long held note, then three quick ones', () => {
    const spec = RECIPES.warbler(createRng(2));
    const lengths = spec.voices.map((v) => v.env[v.env.length - 1]![0] - v.env[0]![0]);
    expect(lengths[0]).toBeGreaterThan(0.9);
    expect(lengths.slice(1).every((l) => l < 0.5)).toBe(true);
    expect(spec.voices).toHaveLength(4);
  });

  it('the completion phrase is 2–3 notes from the yo pentatonic', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const notes = completionPhrase(createRng(seed));
      expect(notes.length).toBeGreaterThanOrEqual(2);
      expect(notes.length).toBeLessThanOrEqual(3);
      for (const f of notes) expect(YO_SCALE).toContain(f);
    }
    expect(YO_SCALE[0]).toBeCloseTo(587.33);
  });

  it('a splash is short and soft: rounded attack, low bubbles under the slap', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spec = RECIPES.splash(createRng(seed));
      expect(spec.duration).toBeLessThan(0.45);
      expect(spec.gain).toBeLessThanOrEqual(0.05);
      for (const v of spec.voices) expect(v.env[1]![0]).toBeGreaterThanOrEqual(0.008);
      for (const v of spec.voices) if (v.kind === 'tone') expect(Math.max(...v.freq.map((p) => p[1]))).toBeLessThan(1200);
    }
  });

  it('the dipper warbles: 9–15 quick eased notes rippling around 3 kHz, swelling then fading', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spec = RECIPES.dipper(createRng(seed));
      const v = only(spec);
      const song = notes(v.env);
      expect(spec.duration).toBeGreaterThan(0.8);
      expect(spec.duration).toBeLessThan(2.2);
      expect(song.length).toBeGreaterThanOrEqual(9);
      for (const [, attack] of song) expect(attack).toBeGreaterThanOrEqual(0.0079);
      const pitches = v.freq.map((p) => p[1]);
      expect(Math.min(...pitches)).toBeGreaterThan(1900);
      expect(Math.max(...pitches)).toBeLessThan(4800);
      // rippling: the pitch turns up and down many times, not one sweep
      let turns = 0;
      for (let i = 2; i < pitches.length; i++) if ((pitches[i]! - pitches[i - 1]!) * (pitches[i - 1]! - pitches[i - 2]!) < 0) turns++;
      expect(turns).toBeGreaterThanOrEqual(6);
      const peaks = song.map((n) => n[2]);
      expect(Math.max(...peaks)).toBeGreaterThan(peaks[0]!);
      expect(Math.max(...peaks)).toBeGreaterThan(peaks[peaks.length - 1]!);
    }
  });

  it('the kajika trills: notes come faster and climb, softly, then thin away', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spec = RECIPES.kajika(createRng(seed));
      const v = only(spec);
      const song = notes(v.env);
      expect(song.length).toBeGreaterThanOrEqual(7);
      expect(song.length).toBeLessThanOrEqual(10);
      expect(spec.duration).toBeLessThan(4.6);
      const gaps = song.slice(1).map((n, i) => n[0] - song[i]![0]);
      for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
      expect(gaps[0]! / gaps[gaps.length - 1]!).toBeGreaterThan(2);
      for (const [, attack] of song) expect(attack).toBeGreaterThanOrEqual(0.02);
      const onsetPitch = (t: number) => v.freq.find((p) => p[0] >= t - 1e-9)![1];
      expect(onsetPitch(song[song.length - 1]![0])).toBeGreaterThan(onsetPitch(song[0]![0]) * 1.04);
      expect(song[song.length - 1]![2]).toBeLessThan(Math.max(...song.map((n) => n[2])));
    }
  });
});
