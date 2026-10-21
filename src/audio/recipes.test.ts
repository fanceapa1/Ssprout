import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { completionPhrase, RECIPES, YO_SCALE, type RecipeName, type SoundSpec } from './recipes';

const names = Object.keys(RECIPES) as RecipeName[];

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
});
