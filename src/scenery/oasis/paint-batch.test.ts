/**
 * Dry-brush marks batched into a shared wet layer (ADR 0343): one stroke laid with `dryBrushInto`
 * and dried with `dryBrushDry` issues exactly the canvas calls of `p.dryBrush`, so batching changes
 * only what shares a layer, not the marks.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { PaintRecorder } from '../../scene/paint-record';
import { bounds, createPainter, makeCanvas, padRect, smoothPath, WetLayer, type Painter, type Pt, type StrokeOptions } from '../../paint';
import { dryBrushDry, dryBrushInto } from './paint-batch';

const LINE: Pt[] = [{ x: 40, y: 280 }, { x: 90, y: 200 }, { x: 150, y: 120 }, { x: 210, y: 40 }];

function record(paint: (p: Painter) => void): string {
  const rec = new PaintRecorder({ exact: true });
  const uninstall = rec.install();
  try {
    paint(createPainter(makeCanvas(320, 320), { seed: 3 }));
    return rec.hash;
  } finally {
    uninstall();
  }
}

describe('dry-brush marks in a shared layer', () => {
  it.each<[string, StrokeOptions]>([
    ['a dark trough', { pigment: '#946650', width: 3.2, taper: [0.4, 0], opacity: 0.2, dryness: 0.65 }],
    ['a lit ridge', { pigment: '#f4dfb0', width: 2, opacity: 0.35, dryness: 0.6, blend: 'source-over' }],
  ])('lays and dries %s exactly as dryBrush does', (_, opts) => {
    const once = () => record((p) => p.dryBrush(LINE, { ...opts, rng: createRng('s') }));
    // the first painting fills the work-canvas pool, so compare paintings made after it
    once();
    const batched = record((p) => {
      const width = opts.width!;
      const L = new WetLayer(p.ctx, padRect(bounds(smoothPath(LINE, Math.max(0.6, width * 0.3))), width * 2 + 4), p.env);
      dryBrushInto(L, p, LINE, { ...opts, rng: createRng('s') });
      L.dry(dryBrushDry(opts));
    });
    expect(batched).toBe(once());
  });
});
