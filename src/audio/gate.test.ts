import { describe, expect, it } from 'vitest';
import { gateStep, initialGate, isAudible, type GateInput, type GateState } from './gate';

function run(start: GateState, inputs: GateInput[]) {
  let state = start;
  const log: string[][] = [];
  for (const input of inputs) {
    const r = gateStep(state, input);
    state = r.state;
    log.push(r.commands);
  }
  return { state, log };
}

describe('audio gate', () => {
  it('starts muted and locked: nothing is audible', () => {
    expect(isAudible(initialGate(true))).toBe(false);
    expect(isAudible(initialGate(false))).toBe(false); // still needs a gesture
  });

  it('unmuting before unlock starts nothing', () => {
    const { state, log } = run(initialGate(true), [{ type: 'mute', muted: false }]);
    expect(log).toEqual([[]]);
    expect(isAudible(state)).toBe(false);
  });

  it('unlock while unmuted creates, resumes and fades in', () => {
    const { state, log } = run(initialGate(false), [{ type: 'unlock' }]);
    expect(log).toEqual([['ensure-context', 'resume', 'fade-in']]);
    expect(isAudible(state)).toBe(true);
  });

  it('unlock while muted wakes the context for the gesture, then lets it sleep', () => {
    const { log } = run(initialGate(true), [{ type: 'unlock' }]);
    expect(log).toEqual([['ensure-context', 'resume', 'suspend-after-fade']]);
  });

  it('mute/unmute after unlock fades out and in (never abrupt)', () => {
    const { log } = run(initialGate(true), [
      { type: 'unlock' },
      { type: 'mute', muted: false },
      { type: 'mute', muted: true },
      { type: 'mute', muted: true },
    ]);
    expect(log.slice(1)).toEqual([['resume', 'fade-in'], ['fade-out', 'suspend-after-fade'], []]);
  });

  it('repeated unlocks only re-resume (no second fade-in)', () => {
    const { log } = run(initialGate(false), [{ type: 'unlock' }, { type: 'unlock' }]);
    expect(log[1]).toEqual(['ensure-context', 'resume']);
  });

  it('dispose closes once and ignores everything afterwards', () => {
    const { state, log } = run(initialGate(false), [
      { type: 'unlock' },
      { type: 'dispose' },
      { type: 'unlock' },
      { type: 'mute', muted: true },
      { type: 'dispose' },
    ]);
    expect(log.slice(1)).toEqual([['close'], [], [], []]);
    expect(isAudible(state)).toBe(false);
  });
});
