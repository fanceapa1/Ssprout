import { describe, expect, it } from 'vitest';
import { status } from './test-helpers';
import { titleFor } from './title';

describe('titleFor', () => {
  it('counts down while running', () => {
    expect(titleFor(status({ phase: 'running', remainingMs: (24 * 60 + 13) * 1000 }))).toBe('24:13 · Study Sprout');
  });

  it('rounds up so 0:00 appears only at the very end', () => {
    expect(titleFor(status({ phase: 'running', remainingMs: 59_001 }))).toBe('1:00 · Study Sprout');
    expect(titleFor(status({ phase: 'running', remainingMs: 1 }))).toBe('0:01 · Study Sprout');
    expect(titleFor(status({ phase: 'running', remainingMs: 0 }))).toBe('0:00 · Study Sprout');
  });

  it('shows hours for long sessions', () => {
    expect(titleFor(status({ phase: 'running', remainingMs: (3600 + 5 * 60 + 9) * 1000 }))).toBe('1:05:09 · Study Sprout');
  });

  it('paused, reward pending and idle', () => {
    expect(titleFor(status({ phase: 'paused', remainingMs: 1000 }))).toBe('Paused · Study Sprout');
    expect(titleFor(status({ phase: 'reward' }))).toBe('Ready to bloom · Study Sprout');
    expect(titleFor(status({ phase: 'idle' }))).toBe('Study Sprout');
  });

  it('uses a custom base title', () => {
    expect(titleFor(status({ phase: 'paused' }), 'Garden')).toBe('Paused · Garden');
    expect(titleFor(status(), 'Garden')).toBe('Garden');
  });
});
