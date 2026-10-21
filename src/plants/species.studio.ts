import { createRng } from '../core/rng';
import { createPainter } from '../paint';
import type { StudioEntry, StudioSection } from '../studio/types';
import { allSpecies } from './registry';
import type { SpeciesDef } from './types';

/** Growth stages rendered by sprites.ts (see docs/ARCHITECTURE.md › Species). */
export const GROWTH_STAGES = [0.1, 0.3, 0.55, 0.8, 1] as const;

const DISPLAY_SCALE = 2.5;

function drawSpecies(def: SpeciesDef, canvas: HTMLCanvasElement, seed: number, growth: number) {
  def.draw(createPainter(canvas), createRng(seed).fork(def.id), {
    w: canvas.width,
    h: canvas.height,
    growth,
  });
}

/** One section per registered species: every growth stage plus a looping grow animation. */
function speciesSection(def: SpeciesDef): StudioSection {
  const w = Math.round(def.size.w * DISPLAY_SCALE);
  const h = Math.round(def.size.h * DISPLAY_SCALE);
  const stages: StudioEntry[] = GROWTH_STAGES.map((g) => ({
    id: `growth-${g}`,
    label: `growth ${g}`,
    w,
    h,
    render: (canvas, { seed }) => drawSpecies(def, canvas, seed, g),
  }));
  const grow: StudioEntry = {
    id: 'grow',
    label: 'grow 0 → 1 (4 s loop)',
    w,
    h,
    animated: true,
    render: (canvas, { seed, t }) => drawSpecies(def, canvas, seed, Math.min(1, (t % 5) / 4)),
  };
  return {
    id: `species-${def.id}`,
    title: `T${def.tier} · ${def.name}`,
    order: 200 + def.tier,
    entries: [...stages, grow],
  };
}

const sections: StudioSection[] = allSpecies().map(speciesSection);
export default sections;
