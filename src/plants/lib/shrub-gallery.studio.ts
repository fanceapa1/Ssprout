/**
 * Review sheet for the tier-3 flowering shrubs: all of them side by side at full bloom, and a
 * growth strip per species (same seed, growth 0 → 1) to check that it reads as one plant
 * growing continuously. Each species also has its automatic section (species.studio.ts).
 */
import { createRng } from '../../core/rng';
import { createPainter, makeCanvas } from '../../paint';
import type { StudioEntry, StudioSection } from '../../studio/types';
import { getSpecies } from '../registry';
import type { SpeciesDef } from '../types';

export const SHRUB_IDS = ['tree-peony', 'hydrangea', 'azalea', 'camellia', 'chrysanthemum', 'lotus'] as const;
const STRIP = [0.04, 0.1, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 1] as const;

function paintInto(target: HTMLCanvasElement, def: SpeciesDef, seed: number, growth: number, x: number, y: number, scale: number): void {
  const w = Math.round(def.size.w * scale);
  const h = Math.round(def.size.h * scale);
  const c = makeCanvas(w, h);
  def.draw(createPainter(c), createRng(seed).fork(def.id), { w, h, growth });
  const ctx = target.getContext('2d')!;
  ctx.drawImage(c as CanvasImageSource, Math.round(x - w * def.anchor.x), Math.round(y - h * def.anchor.y));
}

const defs = (): SpeciesDef[] => SHRUB_IDS.map((id) => getSpecies(id)).filter((d): d is SpeciesDef => d !== undefined);

const bloomRow = (id: string, label: string, scale: number, seedOffset: number): StudioEntry => ({
  id,
  label,
  w: 1400,
  h: Math.round(250 * scale),
  render(canvas, { seed, pixelRatio }) {
    const list = defs();
    const cw = 1400 / Math.max(1, list.length);
    list.forEach((def, i) => paintInto(canvas, def, seed + seedOffset, 1, (cw * i + cw / 2) * pixelRatio, 236 * scale * pixelRatio, scale * pixelRatio));
  },
});

const seedsRow = (def: SpeciesDef): StudioEntry => ({
  id: `seeds-${def.id}`,
  label: `${def.name} — five seeds at full bloom`,
  w: 1400,
  h: 300,
  render(canvas, { seed, pixelRatio }) {
    for (let i = 0; i < 5; i++) paintInto(canvas, def, seed * 7 + i * 101, 1, (140 + i * 280) * pixelRatio, 285 * pixelRatio, 1.2 * pixelRatio);
  },
});

const strip = (def: SpeciesDef): StudioEntry => ({
  id: `grow-${def.id}`,
  label: `${def.name} — growth ${STRIP.join(' · ')}`,
  w: 1400,
  h: 580,
  render(canvas, { seed, pixelRatio }) {
    STRIP.forEach((g, i) => paintInto(canvas, def, seed, g, (140 + (i % 5) * 280) * pixelRatio, (280 + Math.floor(i / 5) * 290) * pixelRatio, 1.2 * pixelRatio));
  },
});

const section: StudioSection = {
  id: 'shrubs-b',
  title: 'Plants · tier 3 shrubs review',
  order: 290,
  entries: [
    bloomRow('bloom', 'all tier-3 shrubs at growth 1 (preview scale)', 1.1, 0),
    bloomRow('bloom-small', 'all tier-3 shrubs at growth 1 (garden scale ~0.55)', 0.55, 0),
    ...defs().map(strip),
    ...defs().map(seedsRow),
  ],
};

export default section;
