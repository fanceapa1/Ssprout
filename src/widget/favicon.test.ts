import { describe, expect, it } from 'vitest';
import { drawFavicon, FAVICON_STEPS, faviconKey, faviconModel, ringFraction } from './favicon';
import { recordingContext, status } from './test-helpers';

describe('faviconModel', () => {
  it('idle → no custom icon', () => {
    expect(faviconModel(status())).toEqual({ kind: 'none' });
  });

  it('maps progress to quantised ring steps', () => {
    expect(faviconModel(status({ phase: 'running', progress: 0 }))).toEqual({ kind: 'progress', step: 0, paused: false });
    expect(faviconModel(status({ phase: 'running', progress: 0.5 }))).toEqual({
      kind: 'progress',
      step: FAVICON_STEPS / 2,
      paused: false,
    });
    expect(faviconModel(status({ phase: 'running', progress: 1 }))).toEqual({ kind: 'progress', step: FAVICON_STEPS, paused: false });
    // tiny changes inside one step keep the same key → no redraw
    const a = faviconKey(faviconModel(status({ phase: 'running', progress: 0.3 })));
    const b = faviconKey(faviconModel(status({ phase: 'running', progress: 0.3 + 0.25 / FAVICON_STEPS })));
    expect(a).toBe(b);
  });

  it('clamps nonsense progress', () => {
    expect(faviconModel(status({ phase: 'running', progress: 7 }))).toMatchObject({ step: FAVICON_STEPS });
    expect(faviconModel(status({ phase: 'running', progress: -1 }))).toMatchObject({ step: 0 });
    expect(faviconModel(status({ phase: 'running', progress: Number.NaN }))).toMatchObject({ step: 0 });
  });

  it('marks paused and complete', () => {
    expect(faviconModel(status({ phase: 'paused', progress: 0.25 }))).toEqual({ kind: 'progress', step: 12, paused: true });
    expect(faviconModel(status({ phase: 'reward' }))).toEqual({ kind: 'complete' });
  });

  it('keys differ between paused and running at the same step', () => {
    expect(faviconKey({ kind: 'progress', step: 3, paused: true })).not.toBe(faviconKey({ kind: 'progress', step: 3, paused: false }));
    expect(faviconKey({ kind: 'complete' })).toBe('complete');
  });

  it('ring fraction follows the model', () => {
    expect(ringFraction({ kind: 'none' })).toBe(0);
    expect(ringFraction({ kind: 'progress', step: FAVICON_STEPS / 4, paused: false })).toBe(0.25);
    expect(ringFraction({ kind: 'complete' })).toBe(1);
  });
});

describe('drawFavicon', () => {
  const vermilion = 'rgba(208,105,74,';
  const olive = 'rgba(111,122,82,';
  const stone = 'rgba(155,151,141,';

  it('paints a vermilion dot only when complete', () => {
    const done = recordingContext();
    drawFavicon(done, { kind: 'complete' });
    expect(done.fills.some((f) => f.startsWith(vermilion))).toBe(true);

    const running = recordingContext();
    drawFavicon(running, { kind: 'progress', step: 20, paused: false });
    expect(running.fills.some((f) => f.startsWith(vermilion))).toBe(false);
  });

  it('paints the progress arc in olive, or stone grey while paused', () => {
    const run = recordingContext();
    drawFavicon(run, { kind: 'progress', step: 20, paused: false });
    expect(run.fills.some((f) => f.startsWith(olive))).toBe(true);
    const paused = recordingContext();
    drawFavicon(paused, { kind: 'progress', step: 20, paused: true });
    expect(paused.fills.some((f) => f.startsWith(stone))).toBe(true);
    expect(paused.fills.some((f) => f.startsWith(olive))).toBe(false);
  });

  it('paints no arc at step 0', () => {
    const empty = recordingContext();
    drawFavicon(empty, { kind: 'progress', step: 0, paused: false });
    expect(empty.fills.some((f) => f.startsWith(olive))).toBe(false);
  });

  it('is deterministic', () => {
    const a = recordingContext();
    const b = recordingContext();
    drawFavicon(a, { kind: 'progress', step: 9, paused: false });
    drawFavicon(b, { kind: 'progress', step: 9, paused: false });
    expect(a.fills).toEqual(b.fills);
  });
});
