import { createRng } from '../../core/rng';
import { PIGMENTS, createPainter, mix, paperTexture, type AnyCanvas } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { getSpecies, speciesByTier } from '../registry';
import type { SpeciesDef } from '../types';

/**
 * Review boards for the tier 1–2 species: every species at full bloom side by side at the same
 * world scale (do they belong to one painting?), and per-species growth strips (does it grow
 * believably?). Painted on white with the paper multiplied last, like the garden. The species
 * come from the registry by tier (ADR 0251).
 */

export const STRIP = [0, 0.06, 0.12, 0.2, 0.3, 0.45, 0.55, 0.65, 0.75, 0.82, 0.9, 1] as const;

const SCALE = 2;
const paperCache = new Map<string, AnyCanvas>();

function board(canvas: HTMLCanvasElement, pixelRatio: number, draw: (p: ReturnType<typeof createPainter>) => void, ground: 'meadow' | 'water' = 'meadow') {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const p = createPainter(canvas);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const h = canvas.height / pixelRatio;
  const w = canvas.width / pixelRatio;
  const top = ground === 'water' ? 0.35 : 0.62;
  p.wash([{ x: 0, y: h * top }, { x: w, y: h * (top - 0.02) }, { x: w, y: h }, { x: 0, y: h }], ground === 'water' ? PIGMENTS.celadon : mix(PIGMENTS.sageLight, PIGMENTS.washiDeep, 0.5), {
    rng: createRng(ground),
    opacity: ground === 'water' ? 0.6 : 0.35,
    edge: 0.2,
    fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.8 },
  });
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
  const defs = speciesByTier(tier);
  const gap = 12;
  const W = defs.reduce((s, d) => s + d.size.w * SCALE + gap, gap);
  const above = Math.max(...defs.map((d) => d.size.h * SCALE * d.anchor.y), 10);
  const below = Math.max(...defs.map((d) => d.size.h * SCALE * (1 - d.anchor.y)), 0);
  const H = above + below + 20;
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
          place(p, d, x, 10 + above - h * d.anchor.y, seed, 1);
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
      board(
        canvas,
        pixelRatio,
        (p) => {
          STRIP.forEach((g, i) => place(p, def, cw * i, 5, seed, g));
        },
        def.habitats.includes('water') ? 'water' : 'meadow',
      );
    },
  };
}

const section: StudioSection = {
  id: 'plants-a-review',
  title: 'Plants A · tier 1–2 review boards',
  order: 205,
  entries: [lineup(1), lineup(2), ...[...speciesByTier(1), ...speciesByTier(2)].map((d) => strip(d.id)).filter((e): e is StudioEntry => !!e)],
};

export default section;
