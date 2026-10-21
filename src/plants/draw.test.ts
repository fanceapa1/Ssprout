import { describe, expect, it } from 'vitest';
import { bendOffset, crossFade, drawPlant, drawSliced, morphBetween, type Scratch } from './draw';
import { FakeCanvas } from './test-canvas';

describe('sway maths', () => {
  it('keeps the base still and moves the top by lean × height', () => {
    expect(bendOffset(0.05, 100, 0, 1)).toBe(0);
    expect(bendOffset(0.05, 100, 1, 1)).toBeCloseTo(5, 9);
    expect(bendOffset(0.05, 100, 0.5, 1)).toBeCloseTo(2.5, 9);
  });

  it('bends trees: the trunk moves far less than a straight skew would', () => {
    const straight = bendOffset(0.02, 400, 0.3, 1);
    const bent = bendOffset(0.02, 400, 0.3, 2.4);
    expect(bent).toBeLessThan(straight * 0.3);
    expect(bendOffset(0.02, 400, 1, 2.4)).toBeCloseTo(8, 9);
    expect(bendOffset(0.02, 400, 1.5, 2.4)).toBeCloseTo(8, 9); // clamped
  });
});

describe('drawing', () => {
  it('skews about the base: the base row stays, the top shifts', () => {
    const c = new FakeCanvas(100, 100);
    drawPlant(c.ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, { x: 0, y: 0, w: 10, h: 20 }, 5, 20, { lean: 0.1, bend: 1, scaleY: 1, alpha: 1 });
    const t = c.ctx.calls.find((k) => k.name === 'transform')!.args as number[];
    // x' = x + c·y + e: at the base (y = 20) no shift, at the top (y = 0) +lean·h
    const shift = (y: number) => t[2]! * y + t[4]!;
    expect(shift(20)).toBeCloseTo(0, 9);
    expect(shift(0)).toBeCloseTo(2, 9);
    expect(c.ctx.count('drawImage')).toBe(1);
  });

  it('bends in slices whose offsets meet at every seam', () => {
    const c = new FakeCanvas(100, 100);
    const off = (y: number) => (100 - y) ** 2 / 1000;
    drawSliced(c.ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, { x: 0, y: 0, w: 50, h: 100 }, off, 5);
    const ts = c.ctx.calls.filter((k) => k.name === 'transform').map((k) => k.args as number[]);
    expect(ts).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      const [, , cc, , e] = ts[i]!;
      const ya = i * 20;
      const yb = (i + 1) * 20;
      expect(cc! * ya + e!).toBeCloseTo(off(ya), 9);
      expect(cc! * yb + e!).toBeCloseTo(off(yb), 9);
    }
    expect(c.ctx.count('clip')).toBe(5);
  });

  it('skips invisible plants', () => {
    const c = new FakeCanvas(10, 10);
    drawPlant(c.ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, { x: 0, y: 0, w: 1, h: 1 }, 0, 1, { lean: 0, bend: 1, scaleY: 1, alpha: 0 });
    expect(c.ctx.count('drawImage')).toBe(0);
  });

  it('cross-fades with lighter so the weights add to one', () => {
    const c = new FakeCanvas(10, 10);
    const alphas: Array<[number, string]> = [];
    const ctx = c.ctx;
    const out = { canvas: c, ctx } as unknown as Scratch;
    const orig = ctx.drawImage as (...a: unknown[]) => void;
    (ctx as Record<string, unknown>).drawImage = (...a: unknown[]) => {
      alphas.push([ctx.globalAlpha as number, ctx.globalCompositeOperation as string]);
      orig(...a);
    };
    crossFade(out, {} as CanvasImageSource, {} as CanvasImageSource, 0.3);
    expect(alphas[0]![0]).toBeCloseTo(0.7, 9);
    expect(alphas[1]).toEqual([0.3, 'lighter']);
    alphas.length = 0;
    crossFade(out, {} as CanvasImageSource, null, 0.3);
    expect(alphas).toEqual([[1, 'source-over']]);
  });

  it('morphs between steps: the lower grows toward the upper, both exact at their own step', () => {
    const m = morphBetween({ left: 0.3, top: 0.5, right: 0.7, bottom: 0.95 }, { left: 0.25, top: 0.4, right: 0.75, bottom: 0.95 }, { x: 0.5, y: 0.95 })!;
    expect(m.sy).toBeCloseTo(0.55 / 0.45, 9);
    expect(m.sx).toBeCloseTo(0.5 / 0.4, 9);
    expect(morphBetween(null, { left: 0, top: 0, right: 1, bottom: 1 }, { x: 0.5, y: 1 })).toBeNull();
    // huge jumps are clamped (a species may change shape between steps)
    expect(morphBetween({ left: 0.45, top: 0.9, right: 0.55, bottom: 1 }, { left: 0, top: 0, right: 1, bottom: 1 }, { x: 0.5, y: 1 })!.sy).toBe(1.25);
    const c = new FakeCanvas(100, 200);
    const out = { canvas: c, ctx: c.ctx } as unknown as Scratch;
    crossFade(out, {} as CanvasImageSource, {} as CanvasImageSource, 0, { sx: 1.2, sy: 1.2, ax: 0.5, ay: 1 });
    // weight 0: the lower step is drawn exactly, unscaled
    expect(c.ctx.calls.filter((k) => k.name === 'drawImage').map((k) => k.args.slice(1))).toEqual([[0, 0, 100, 200]]);
    c.ctx.calls.length = 0;
    crossFade(out, {} as CanvasImageSource, {} as CanvasImageSource, 0.5, { sx: 1.21, sy: 1.21, ax: 0.5, ay: 1 });
    const [lo, hi] = c.ctx.calls.filter((k) => k.name === 'drawImage').map((k) => k.args as number[]);
    expect(lo![3]).toBeCloseTo(110, 6); // 100 × 1.21^0.5
    expect(hi![3]).toBeCloseTo(100 / 1.1, 6);
    // both stay centred on the anchor and keep the base row
    expect(lo![1]! + lo![3]! / 2).toBeCloseTo(50, 6);
    expect(hi![1]! + hi![3]! / 2).toBeCloseTo(50, 6);
    expect(lo![2]! + lo![4]!).toBeCloseTo(200, 6);
    expect(hi![2]! + hi![4]!).toBeCloseTo(200, 6);
  });
});
