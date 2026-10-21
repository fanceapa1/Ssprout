import { createRng } from '../../core/rng';
import { PIGMENTS, createPainter, mix, paperTexture, type AnyCanvas } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { getSpecies } from '../registry';
import type { SpeciesDef } from '../types';

/**
 * Review boards for the tier 1–2 species: every species at full bloom side by side at the same
 * world scale (do they belong to one painting?), and per-species growth strips (does it grow
 * believably?). Painted on white with the paper multiplied last, like the garden.
 */

export const SPECIES_A = {
  1: ['violet', 'white-clover', 'forget-me-not', 'wild-strawberry', 'dandelion', 'maidenhair-fern'],
  2: ['japanese-iris', 'anemone', 'balloon-flower', 'cosmos', 'spider-lily', 'water-lily', 'susuki-grass'],
} as const;

export const STRIP = [0, 0.06, 0.12, 0.2, 0.3, 0.45, 0.55, 0.65, 0.75, 0.82, 0.9, 1] as const;

const SCALE = 2;
const paperCache = new Map<string, AnyCanvas>();

function board(canvas: HTMLCanvasElement, pixelRatio: number, draw: (p: ReturnType<typeof createPainter>) => void, meadow = true) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const p = createPainter(canvas);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (meadow) {
    const h = canvas.height / pixelRatio;
    const w = canvas.width / pixelRatio;
    p.wash([{ x: 0, y: h * 0.62 }, { x: w, y: h * 0.6 }, { x: w, y: h }, { x: 0, y: h }], mix(PIGMENTS.sageLight, PIGMENTS.washiDeep, 0.5), {
      rng: createRng('meadow'),
      opacity: 0.35,
      edge: 0.2,
      fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.8 },
    });
  }
  draw(p);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const key = `${canvas.width}x${canvas.height}`;
  let paper = paperCache.get(key);
  if (!paper) {
    paper = paperTexture(canvas.width, canvas.height, 1);
    paperCache.set(key, paper);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paper as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

/** Draw `def` with its box placed at (x, y) (top-left, world units × SCALE). */
function place(p: ReturnType<typeof createPainter>, def: SpeciesDef, x: number, y: number, seed: number, growth: number) {
  const w = def.size.w * SCALE;
  const h = def.size.h * SCALE;
  p.ctx.save();
  p.ctx.translate(x, y);
  def.draw(p, createRng(seed).fork(def.id), { w, h, growth });
  p.ctx.restore();
}

function lineup(tier: 1 | 2): StudioEntry {
  const defs = SPECIES_A[tier].map((id) => getSpecies(id)).filter((d): d is SpeciesDef => !!d);
  const gap = 12;
  const W = defs.reduce((s, d) => s + d.size.w * SCALE + gap, gap);
  const H = Math.max(...defs.map((d) => d.size.h * SCALE), 10) + 30;
  return {
    id: `lineup-t${tier}`,
    label: `tier ${tier} at full bloom, same world scale (×${SCALE})`,
    w: W,
    h: H,
    render(canvas, { seed, pixelRatio }) {
      board(canvas, pixelRatio, (p) => {
        let x = gap;
        for (const d of defs) {
          const h = d.size.h * SCALE;
          // bases on one ground line
          place(p, d, x, H - 14 - h * d.anchor.y, seed, 1);
          x += d.size.w * SCALE + gap;
        }
      });
    },
  };
}

function strip(id: string): StudioEntry | null {
  const def = getSpecies(id);
  if (!def) return null;
  const w = def.size.w * SCALE;
  const h = def.size.h * SCALE;
  const cw = w * 0.85;
  return {
    id: `strip-${id}`,
    label: `${def.name}: growth ${STRIP.join(' · ')}`,
    w: Math.round(cw * STRIP.length + w * 0.15),
    h: Math.round(h + 10),
    render(canvas, { seed, pixelRatio }) {
      board(canvas, pixelRatio, (p) => {
        STRIP.forEach((g, i) => place(p, def, cw * i, 5, seed, g));
      });
    },
  };
}

const section: StudioSection = {
  id: 'plants-a-review',
  title: 'Plants A · tier 1–2 review boards',
  order: 205,
  entries: [lineup(1), lineup(2), ...[...SPECIES_A[1], ...SPECIES_A[2]].map(strip).filter((e): e is StudioEntry => !!e)],
};

export default section;
