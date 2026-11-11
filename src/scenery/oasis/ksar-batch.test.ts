/**
 * The ksar's marks batched into shared wet layers (ADR 0345): one stroke laid with `strokeInto` and
 * dried with `strokeDry` paints exactly what `p.stroke` paints, so batching changes only what
 * shares a layer, not the marks.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { PaintRecorder } from '../../scene/paint-record';
import { bounds, createPainter, makeCanvas, padRect, smoothPath, WetLayer, type Painter, type Pt, type StrokeOptions } from '../../paint';
import { DRY_BRUSH, strokeDry, strokeInto } from './ksar-batch';

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

describe('ksar marks in a shared layer', () => {
  it.each<[string, StrokeOptions]>([
    ['a wet flick', { pigment: '#7a4a30', width: 1.4, taper: [0.05, 0.6], opacity: 0.4, wetness: 0.3, wobble: 0.2 }],
    ['a rain streak', { pigment: '#8a5a40', width: 2.2, taper: [0.2, 0.9], opacity: 0.18, wetness: 0.6, dryness: 0.3 }],
    ['a lit dry-brush touch', { ...DRY_BRUSH, pigment: '#f4dfb0', width: 1.8, opacity: 0.36, dryness: 0.5, blend: 'source-over' }],
  ])('lays and dries %s exactly as stroke does', (_, opts) => {
    const once = () => record((p) => p.stroke(LINE, { ...opts, rng: createRng('s') }));
    // the first painting fills the work-canvas pool, so compare paintings made after it
    once();
    const batched = record((p) => {
      const width = opts.width!;
      const L = new WetLayer(p.ctx, padRect(bounds(smoothPath(LINE, Math.max(0.6, width * 0.3))), width * 2 + 4), p.env);
      strokeInto(L, p, LINE, { ...opts, rng: createRng('s') });
      L.dry(strokeDry(opts));
    });
    expect(batched).toBe(once());
  });
});
