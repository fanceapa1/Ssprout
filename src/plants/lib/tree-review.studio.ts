import { createRng } from '../../core/rng';
import { createPainter, makeCanvas } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { getSpecies } from '../registry';
import type { SpeciesDef } from '../types';

/** The tier-4 centrepieces, reviewed side by side (each species also has its own section). */
const TREES = ['weeping-cherry', 'japanese-maple', 'wisteria', 'black-pine', 'ginkgo', 'plum-blossom'];

const CELL = { w: 190, h: 230 };

function drawInto(ctx: CanvasRenderingContext2D, def: SpeciesDef, seed: number, growth: number, x: number, y: number, pr: number): void {
  // world size at the cell's scale (trees share one scale so their sizes compare honestly)
  const k = CELL.h / 460;
  const w = Math.round(def.size.w * k * pr);
  const h = Math.round(def.size.h * k * pr);
  const c = makeCanvas(w, h);
  def.draw(createPainter(c), createRng(seed).fork(def.id), { w, h, growth });
  ctx.drawImage(c as CanvasImageSource, Math.round((x + CELL.w / 2) * pr - w / 2), Math.round((y + CELL.h) * pr - h));
}

function grid(id: string, label: string, rows: { growth: number; seedOffset: number }[]): StudioEntry {
  return {
    id,
    label,
    w: CELL.w * TREES.length,
    h: CELL.h * rows.length,
    render(canvas, { seed, pixelRatio }) {
      const ctx = canvas.getContext('2d')!;
      rows.forEach((row, ri) =>
        TREES.forEach((tid, i) => {
          const def = getSpecies(tid);
          if (def) drawInto(ctx, def, seed + row.seedOffset, row.growth, i * CELL.w, ri * CELL.h, pixelRatio);
        }),
      );
    },
  };
}

const section: StudioSection = {
  id: 'plants-trees',
  title: 'Plants · tier-4 trees side by side',
  order: 205,
  entries: [
    grid('lineup', 'all six at full bloom, shared scale', [{ growth: 1, seedOffset: 0 }]),
    grid('variety', 'three more seeds each', [
      { growth: 1, seedOffset: 101 },
      { growth: 1, seedOffset: 202 },
      { growth: 1, seedOffset: 303 },
    ]),
    grid('growth', 'growth 0.1 · 0.3 · 0.55 · 0.8 (same seed per column)', [
      { growth: 0.1, seedOffset: 0 },
      { growth: 0.3, seedOffset: 0 },
      { growth: 0.55, seedOffset: 0 },
      { growth: 0.8, seedOffset: 0 },
    ]),
  ],
};

export default section;
