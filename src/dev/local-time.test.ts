import { describe, expect, it } from 'vitest';
import { msUntilLocalTime, parseLocalTime } from './local-time';

const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m).getTime();
const clock = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('local time jumps (dev)', () => {
  it('parses HH:MM and refuses anything else', () => {
    expect(parseLocalTime('00:30')).toBe(30);
    expect(parseLocalTime('9:05')).toBe(545);
    expect(parseLocalTime('23:59')).toBe(1439);
    for (const bad of ['24:00', '12:60', 'noon', '1230', '']) expect(() => parseLocalTime(bad)).toThrow(RangeError);
  });

  it('lands on the next HH:MM: later today when still ahead, else tomorrow, never backwards', () => {
    for (const [from, to, expected] of [
      [at(9), '16:10', '23 16:10'],
      [at(17), '16:10', '24 16:10'],
      [at(23, 50), '00:30', '24 00:30'],
      [at(0, 30), '23:50', '23 23:50'],
    ] as const) {
      const ms = msUntilLocalTime(from, to);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(clock(from + ms)).toBe(expected);
    }
    expect(msUntilLocalTime(at(16, 10), '16:10')).toBe(0);
  });
});
