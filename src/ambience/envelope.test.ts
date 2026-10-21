import { describe, expect, it } from 'vitest';
import { createEnvelope, ENVELOPE, isSettled, settleEnvelope, stepEnvelope, targetsFor, type EnvelopeState, type Levels } from './envelope';

/** Run the envelope for `seconds` at 60 fps, returning samples of one channel. */
function run(state: EnvelopeState, targets: Levels, seconds: number, channel: keyof Levels, dt = 1 / 60) {
  const samples: number[] = [];
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    s = stepEnvelope(s, targets, dt);
    samples.push(s.value[channel]);
  }
  return { state: s, samples };
}

const at = (samples: number[], seconds: number, dt = 1 / 60) => samples[Math.round(seconds / dt) - 1]!;

describe('targetsFor', () => {
  it('idle shows no weather and no motes, but the garden still moves', () => {
    expect(targetsFor('idle', 'rain')).toEqual({ sun: 0, rain: 0, mist: 0, motes: 0, motion: 1, boost: 0 });
  });
  it('focus: the session weather at full, motes, full motion, wind boost', () => {
    expect(targetsFor('focus', 'sun')).toEqual({ sun: 1, rain: 0, mist: 0, motes: 1, motion: 1, boost: 1 });
  });
  it('break softens the weather and stops the motes', () => {
    const t = targetsFor('break', 'mist');
    expect(t.mist).toBe(ENVELOPE.breakLevel);
    expect(t.motes).toBe(0);
    expect(t.motion).toBeLessThan(1);
    expect(t.motion).toBeGreaterThan(0.5);
  });
  it('paused: a faint still trace (held breath)', () => {
    const t = targetsFor('paused', 'rain');
    expect(t.rain).toBe(ENVELOPE.pausedLevel);
    expect(t.motion).toBe(0);
    expect(t.motes).toBe(0);
  });
  it('dev preview shows a weather without a session and overrides the session weather', () => {
    expect(targetsFor('idle', null, { preview: 'mist' }).mist).toBe(1);
    const t = targetsFor('focus', 'sun', { preview: 'rain' });
    expect(t.rain).toBe(1);
    expect(t.sun).toBe(0);
    expect(targetsFor('idle', null, { preview: 'mist' }).motes).toBe(0);
  });
  it('reduced motion keeps the weather but freezes motion and drops motes', () => {
    const t = targetsFor('focus', 'rain', { reducedMotion: true });
    expect(t.rain).toBe(1);
    expect(t.motion).toBe(0);
    expect(t.motes).toBe(0);
  });
});

describe('stepEnvelope', () => {
  it('session start: crossfades in over 3–5 s, smoothly and without overshoot', () => {
    const { samples } = run(createEnvelope({ motion: 1 }), targetsFor('focus', 'rain'), 6, 'rain');
    expect(at(samples, 0.5)).toBeLessThan(0.2); // eases in, not a jump
    expect(at(samples, 2)).toBeGreaterThan(0.3);
    expect(at(samples, 2)).toBeLessThan(0.8);
    expect(at(samples, 3)).toBeLessThan(0.97);
    expect(at(samples, 4)).toBeGreaterThan(0.97);
    expect(at(samples, 5)).toBeGreaterThan(0.99);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! - 1e-12); // monotonic
      expect(samples[i]!).toBeLessThanOrEqual(1);
      expect(samples[i]! - samples[i - 1]!).toBeLessThan(0.02); // no frame-to-frame jump
    }
  });

  it('session end: fades out over 3–5 s', () => {
    const { samples } = run(settleEnvelope(targetsFor('focus', 'sun')), targetsFor('idle', null), 6, 'sun');
    expect(at(samples, 0.5)).toBeGreaterThan(0.8);
    expect(at(samples, 3)).toBeGreaterThan(0.03);
    expect(at(samples, 4.5)).toBeLessThan(0.02);
    for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 1e-12);
  });

  it('pause: motion eases to stillness over ~3 s and the weather dims to a trace', () => {
    const from = settleEnvelope(targetsFor('focus', 'mist'));
    const paused = targetsFor('paused', 'mist');
    const motion = run(from, paused, 5, 'motion').samples;
    expect(at(motion, 0.3)).toBeGreaterThan(0.85); // not abrupt
    expect(at(motion, 1.5)).toBeGreaterThan(0.1);
    expect(at(motion, 3)).toBeLessThan(0.025);
    const mist = run(from, paused, 6, 'mist');
    expect(mist.state.value.mist).toBeCloseTo(ENVELOPE.pausedLevel, 2);
  });

  it('resume returns to full weather and motion', () => {
    const from = settleEnvelope(targetsFor('paused', 'rain'));
    const { state } = run(from, targetsFor('focus', 'rain'), 5, 'rain');
    expect(state.value.rain).toBeGreaterThan(0.99);
    expect(state.value.motion).toBeGreaterThan(0.99);
  });

  it('break: weather softens to the break level, then returns for the next focus block', () => {
    const focus = settleEnvelope(targetsFor('focus', 'sun'));
    const brk = run(focus, targetsFor('break', 'sun'), 5, 'sun');
    expect(brk.state.value.sun).toBeCloseTo(ENVELOPE.breakLevel, 2);
    expect(brk.state.value.motes).toBeLessThan(0.02);
    const back = run(brk.state, targetsFor('focus', 'sun'), 5, 'sun');
    expect(back.state.value.sun).toBeGreaterThan(0.99);
  });

  it('weather change crossfades: one fades out while the other fades in', () => {
    const from = settleEnvelope(targetsFor('focus', 'sun'));
    let s = from;
    const to = targetsFor('focus', 'rain');
    for (let i = 0; i < 120; i++) s = stepEnvelope(s, to, 1 / 60); // 2 s
    expect(s.value.sun).toBeGreaterThan(0.1);
    expect(s.value.sun).toBeLessThan(0.9);
    expect(s.value.rain).toBeGreaterThan(0.1);
    expect(s.value.rain).toBeLessThan(0.9);
  });

  it('is frame-rate independent', () => {
    const t = targetsFor('focus', 'rain');
    const fine = run(createEnvelope(), t, 2, 'rain', 1 / 120).state.value.rain;
    const coarse = run(createEnvelope(), t, 2, 'rain', 1 / 10).state.value.rain;
    expect(coarse).toBeCloseTo(fine, 3);
  });

  it('dt = 0 (frozen frame) changes nothing; settles exactly', () => {
    const s = createEnvelope();
    const t = targetsFor('focus', 'mist');
    expect(stepEnvelope(s, t, 0)).toBe(s);
    const { state } = run(s, t, 20, 'mist');
    expect(isSettled(state, t)).toBe(true);
    expect(isSettled(s, t)).toBe(false);
  });
});
