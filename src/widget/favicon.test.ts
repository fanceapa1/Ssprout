import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { ICON_STROKES } from '../ui/icons';
import { PIGMENT, wash } from './brush';
import { drawFavicon, FAVICON_RENDER_PX, FAVICON_STEPS, faviconKey, faviconModel, glyphPath, ringFraction } from './favicon';
import { rasterContext, recordingContext, type RasterContext, type Rgb } from './test-helpers';

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

  const leaf = 'rgba(139,156,90,'; // MARK_LEAF, the sprout mark's sap green
  const ink = 'rgba(74,68,60,';

  it('never paints vermilion: a bloom closes the ring around the sprout mark (ADR 0194)', () => {
    const done = recordingContext();
    drawFavicon(done, { kind: 'complete' });
    expect(done.fills.some((f) => f.startsWith(vermilion))).toBe(false);
    expect(done.fills.some((f) => f.startsWith(leaf))).toBe(true);
    expect(done.fills.some((f) => f.startsWith(ink))).toBe(true);
    expect(done.fills.some((f) => f.startsWith(olive))).toBe(true); // the closed ring
    for (const tone of ['focus', 'break', 'paused'] as const) {
      const running = recordingContext();
      drawFavicon(running, { kind: 'progress', step: 20, tone });
      expect(running.fills.some((f) => f.startsWith(vermilion) || f.startsWith(leaf))).toBe(false);
    }
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

/** The same "red" as tests/e2e/marks.spec.ts: a saturated vermilion. */
const isRed = ([r, g, b]: Rgb) => r > 140 && r - g > 60 && r - b > 60;
/** Sap-green leaf wash. */
const isLeaf = ([r, g, b]: Rgb) => g - b > 25 && g >= r;
const lum = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;
const STRIPS = { light: '#dee1e6', dark: '#35363a' } as const;

/** Pixels within `radius` of the icon centre (the old dot's place), in a `size` px icon. */
function centre(ctx: RasterContext, size: number, radius: number): Rgb[] {
  const out: Rgb[] = [];
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= radius) out.push(ctx.pixel(x, y));
  return out;
}
function all(ctx: RasterContext, size: number): Rgb[] {
  return centre(ctx, size, size);
}
function painted(size: number, bg: string, model: Parameters<typeof drawFavicon>[1] = { kind: 'complete' }): RasterContext {
  const ctx = rasterContext(size, size, bg);
  drawFavicon(ctx, model, size);
  return ctx;
}

describe('drawFavicon pixels (bloomed while away)', () => {
  it('the red detector finds the old vermilion dot (guards the tests below)', () => {
    const ctx = rasterContext(32, 32, STRIPS.light);
    const dot = Array.from({ length: 16 }, (_, i) => ({ x: 16 + Math.cos((i / 16) * Math.PI * 2) * 4.1, y: 16 + Math.sin((i / 16) * Math.PI * 2) * 4.1 }));
    wash(ctx, dot, createRng('dot'), { color: PIGMENT.vermilion, alpha: 0.55, layers: 3, jitter: 0.3, rim: 0.55 });
    expect(centre(ctx, 32, 4).filter(isRed).length).toBeGreaterThan(20);
  });

  // 16 / 32 / 64 px tabs (1× and 2× DPR), the 64 px PNG the tab gets, the 96 px notification icon
  for (const size of [16, 32, 64, 96]) {
    for (const [strip, bg] of Object.entries(STRIPS)) {
      it(`${size} px on a ${strip} strip: no red anywhere, the sprout where the dot was`, () => {
        const ctx = painted(size, bg);
        const s = size / 32;
        expect(all(ctx, size).filter(isRed)).toEqual([]);
        const spot = centre(ctx, size, 6.5 * s); // inside the ring: the dot was r ≈ 4.1 there
        expect(spot.filter(isLeaf).length, 'sap-green leaves').toBeGreaterThanOrEqual(Math.max(2, Math.round(4 * s * s)));
        // the ink reads against the washi disc on light and dark strips alike
        const paper = Math.max(...spot.map(lum));
        const darkest = Math.min(...spot.map(lum));
        expect(paper - darkest, 'ink contrast').toBeGreaterThan(size <= 16 ? 45 : 70);
        // not one blob: the paper shows between the strokes in the old dot's disc
        const dot = centre(ctx, size, 4.1 * s);
        expect(dot.filter((p) => lum(p) > paper - 25).length / dot.length, 'paper between strokes').toBeGreaterThan(0.3);
      });
    }
  }

  it('the running ring has no mark in the middle', () => {
    const ctx = painted(32, STRIPS.light, { kind: 'progress', step: 30, tone: 'focus' });
    expect(centre(ctx, 32, 6.5).filter(isLeaf)).toEqual([]);
    expect(all(ctx, 32).filter(isRed)).toEqual([]);
  });

  it('the tab gets a 64 px PNG (32 px grid at 2×)', () => {
    expect(FAVICON_RENDER_PX).toBe(64);
  });
});

describe('glyphPath', () => {
  it('samples the sprout glyph: absolute moves, relative curves, implicit repeats, close', () => {
    const [stem, right] = ICON_STROKES.sprout.map((st) => glyphPath(st.d));
    expect(stem![0]).toEqual({ x: 12, y: 20.2 });
    expect(stem).toHaveLength(9);
    expect(stem![8]!.x).toBeCloseTo(12.7);
    expect(stem![8]!.y).toBeCloseTo(11.6);
    // two curves (the second an implicit repeat) that come back to the start
    expect(right).toHaveLength(17);
    expect(right![8]!.x).toBeCloseTo(18.8);
    expect(right![8]!.y).toBeCloseTo(9.1);
    expect(right![16]!.x).toBeCloseTo(12.6);
    expect(right![16]!.y).toBeCloseTo(12.4);
  });

  it('rejects commands it does not sample', () => {
    expect(() => glyphPath('M0 0a1 1 0 0 1 2 2')).toThrow(/unsupported/);
  });
});
