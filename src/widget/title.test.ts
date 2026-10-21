import { describe, expect, it } from 'vitest';
import { titleFor } from './title';

const tl = (blockRemainingMs: number) => ({ blockRemainingMs });

describe('titleFor', () => {
  it('counts down the focus block', () => {
    expect(titleFor({ phase: 'focus', timeline: tl((24 * 60 + 13) * 1000) })).toBe('24:13 · Study Sprout');
  });

  it('marks breaks', () => {
    expect(titleFor({ phase: 'break', timeline: tl((4 * 60 + 12) * 1000) })).toBe('Break 4:12 · Study Sprout');
  });

  it('rounds up so 0:00 appears only at the very end', () => {
    expect(titleFor({ phase: 'focus', timeline: tl(59_001) })).toBe('1:00 · Study Sprout');
    expect(titleFor({ phase: 'focus', timeline: tl(1) })).toBe('0:01 · Study Sprout');
    expect(titleFor({ phase: 'focus', timeline: tl(0) })).toBe('0:00 · Study Sprout');
    expect(titleFor({ phase: 'focus', timeline: null })).toBe('0:00 · Study Sprout');
  });

  it('shows hours for long blocks', () => {
    expect(titleFor({ phase: 'focus', timeline: tl((3600 + 5 * 60 + 9) * 1000) })).toBe('1:05:09 · Study Sprout');
  });

  it('paused, bloomed and idle', () => {
    expect(titleFor({ phase: 'paused', timeline: tl(1000) })).toBe('Paused · Study Sprout');
    expect(titleFor({ phase: 'idle', timeline: null, bloomed: true })).toBe('Bloomed · Study Sprout');
    expect(titleFor({ phase: 'idle', timeline: null })).toBe('Study Sprout');
    // a running session always wins over an old unseen bloom
    expect(titleFor({ phase: 'focus', timeline: tl(60_000), bloomed: true })).toBe('1:00 · Study Sprout');
  });

  it('uses a custom base title', () => {
    expect(titleFor({ phase: 'paused', timeline: null }, 'Garden')).toBe('Paused · Garden');
    expect(titleFor({ phase: 'idle', timeline: null }, 'Garden')).toBe('Garden');
  });
});
