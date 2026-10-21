import { describe, expect, it } from 'vitest';
import { createManualClock, createSpeedClock, realClock } from './clock';

describe('realClock', () => {
  it('returns epoch milliseconds', () => {
    const t = realClock.now();
    expect(Math.abs(t - Date.now())).toBeLessThan(1000);
  });
});

describe('createManualClock', () => {
  it('only moves when told to', () => {
    const c = createManualClock(100);
    expect(c.now()).toBe(100);
    c.advance(50);
    expect(c.now()).toBe(150);
    c.set(10);
    expect(c.now()).toBe(10);
  });
});

describe('createSpeedClock', () => {
  it('starts at the base time and runs `speed` times faster', () => {
    const base = createManualClock(1_000);
    const c = createSpeedClock(60, base);
    expect(c.now()).toBe(1_000);
    base.advance(1_000);
    expect(c.now()).toBe(1_000 + 60_000);
  });

  it('speed 1 tracks the base clock', () => {
    const base = createManualClock(5);
    const c = createSpeedClock(1, base);
    base.advance(123);
    expect(c.now()).toBe(128);
  });

  it('setSpeed continues from the current virtual time without jumping', () => {
    const base = createManualClock(0);
    const c = createSpeedClock(10, base);
    base.advance(100); // virtual 1000
    c.setSpeed(2);
    expect(c.now()).toBe(1_000);
    expect(c.speed).toBe(2);
    base.advance(100); // +200
    expect(c.now()).toBe(1_200);
  });

  it('speed 0 freezes time', () => {
    const base = createManualClock(0);
    const c = createSpeedClock(0, base);
    base.advance(10_000);
    expect(c.now()).toBe(0);
  });

  it('rejects invalid speeds', () => {
    expect(() => createSpeedClock(-1)).toThrow(RangeError);
    expect(() => createSpeedClock(Number.NaN)).toThrow(RangeError);
    const c = createSpeedClock(1);
    expect(() => c.setSpeed(Infinity)).toThrow(RangeError);
  });
});
