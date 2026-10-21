import { describe, expect, it } from 'vitest';
import { drawFavicon, FAVICON_STEPS, faviconKey, faviconModel, ringFraction } from './favicon';
import { recordingContext } from './test-helpers';

const at = (progress: number) => ({ progress });

describe('faviconModel', () => {
  it('idle → no custom icon; an unseen bloom → complete', () => {
    expect(faviconModel({ phase: 'idle', timeline: null })).toEqual({ kind: 'none' });
    expect(faviconModel({ phase: 'idle', timeline: null, bloomed: true })).toEqual({ kind: 'complete' });
  });

  it('maps whole-session progress to quantised ring steps', () => {
    expect(faviconModel({ phase: 'focus', timeline: at(0) })).toEqual({ kind: 'progress', step: 0, tone: 'focus' });
    expect(faviconModel({ phase: 'focus', timeline: at(0.5) })).toEqual({ kind: 'progress', step: FAVICON_STEPS / 2, tone: 'focus' });
    expect(faviconModel({ phase: 'focus', timeline: at(1) })).toEqual({ kind: 'progress', step: FAVICON_STEPS, tone: 'focus' });
    // tiny changes inside one step keep the same key → no redraw
    const a = faviconKey(faviconModel({ phase: 'focus', timeline: at(0.3) }));
    const b = faviconKey(faviconModel({ phase: 'focus', timeline: at(0.3 + 0.25 / FAVICON_STEPS) }));
    expect(a).toBe(b);
  });

  it('clamps nonsense progress', () => {
    expect(faviconModel({ phase: 'focus', timeline: at(7) })).toMatchObject({ step: FAVICON_STEPS });
    expect(faviconModel({ phase: 'focus', timeline: at(-1) })).toMatchObject({ step: 0 });
    expect(faviconModel({ phase: 'focus', timeline: at(Number.NaN) })).toMatchObject({ step: 0 });
    expect(faviconModel({ phase: 'focus', timeline: null })).toMatchObject({ step: 0 });
  });

  it('tones the ring for breaks and pauses', () => {
    expect(faviconModel({ phase: 'break', timeline: at(0.25) })).toEqual({ kind: 'progress', step: 12, tone: 'break' });
    expect(faviconModel({ phase: 'paused', timeline: at(0.25) })).toEqual({ kind: 'progress', step: 12, tone: 'paused' });
  });

  it('keys differ between tones at the same step', () => {
    const keys = (['focus', 'break', 'paused'] as const).map((tone) => faviconKey({ kind: 'progress', step: 3, tone }));
    expect(new Set(keys).size).toBe(3);
    expect(faviconKey({ kind: 'complete' })).toBe('complete');
  });

  it('ring fraction follows the model', () => {
    expect(ringFraction({ kind: 'none' })).toBe(0);
    expect(ringFraction({ kind: 'progress', step: FAVICON_STEPS / 4, tone: 'focus' })).toBe(0.25);
    expect(ringFraction({ kind: 'complete' })).toBe(1);
  });
});

describe('drawFavicon', () => {
  const vermilion = 'rgba(208,105,74,';
  const olive = 'rgba(111,122,82,';
  const stone = 'rgba(155,151,141,';
  const pond = 'rgba(111,150,144,';

  it('paints a vermilion dot only when complete', () => {
    const done = recordingContext();
    drawFavicon(done, { kind: 'complete' });
    expect(done.fills.some((f) => f.startsWith(vermilion))).toBe(true);
    const running = recordingContext();
    drawFavicon(running, { kind: 'progress', step: 20, tone: 'focus' });
    expect(running.fills.some((f) => f.startsWith(vermilion))).toBe(false);
  });

  it('paints the arc in olive, celadon during breaks, stone grey while paused', () => {
    const tones = { focus: olive, break: pond, paused: stone } as const;
    for (const [tone, colour] of Object.entries(tones)) {
      const ctx = recordingContext();
      drawFavicon(ctx, { kind: 'progress', step: 20, tone: tone as keyof typeof tones });
      expect(ctx.fills.some((f) => f.startsWith(colour)), tone).toBe(true);
    }
  });

  it('paints no arc at step 0', () => {
    const empty = recordingContext();
    drawFavicon(empty, { kind: 'progress', step: 0, tone: 'focus' });
    expect(empty.fills.some((f) => f.startsWith(olive))).toBe(false);
  });

  it('is deterministic', () => {
    const a = recordingContext();
    const b = recordingContext();
    drawFavicon(a, { kind: 'progress', step: 9, tone: 'focus' });
    drawFavicon(b, { kind: 'progress', step: 9, tone: 'focus' });
    expect(a.fills).toEqual(b.fills);
  });
});
