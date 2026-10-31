import { createRng } from '../core/rng';
import { SCENERY_IDS, type SceneryId } from '../core/sceneries';
import { createPainter, makeCanvas, paperTexture } from '../paint';
import { getScenery } from '../scenery/registry';
import type { StudioEntry, StudioSection } from '../studio/types';
import { allSpecies } from './registry';
import { TIERS, type SpeciesDef, type Tier } from './types';

/**
 * Each garden's flora: the species it offers, one row per tier, at full bloom and one world scale,
 * so a new species is seen beside its neighbours (docs/systems/species-recipe.md, ADR 0251).
 */

// F1 hook (ADR 0250): use `floraOf(sceneryId)` from ./flora once it is on main.
const offeredIn = (_sceneryId: SceneryId): SpeciesDef[] => allSpecies();

/** canvas px per world unit (trees stay on screen, small plants still read) */
const SCALE = 0.5;
const GAP = 14;
const PAD = 12;

function rowsOf(defs: SpeciesDef[]): { tier: Tier; defs: SpeciesDef[]; above: number; below: number; w: number }[] {
  return TIERS.map((tier) => {
    const row = defs.filter((d) => d.tier === tier);
    return {
      tier,
      defs: row,
      above: Math.max(10, ...row.map((d) => d.size.h * SCALE * d.anchor.y)),
      below: Math.max(0, ...row.map((d) => d.size.h * SCALE * (1 - d.anchor.y))),
      w: row.reduce((s, d) => s + d.size.w * SCALE + GAP, PAD * 2 - GAP),
    };
  }).filter((r) => r.defs.length > 0);
}

function lineup(sceneryId: SceneryId): StudioEntry {
  const scenery = getScenery(sceneryId);
  const rows = rowsOf(offeredIn(sceneryId));
  const W = Math.max(320, ...rows.map((r) => r.w));
  const H = rows.reduce((s, r) => s + r.above + r.below + GAP, PAD * 2);
  return {
    id: sceneryId,
    label: `${scenery.name}: its species by tier at growth 1 (×${SCALE} world scale)`,
    w: Math.ceil(W),
    h: Math.ceil(H),
    render(canvas, { seed, pixelRatio }) {
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let top = PAD;
      for (const r of rows) {
        const ground = top + r.above;
        let x = PAD;
        for (const d of r.defs) {
          const w = Math.round(d.size.w * SCALE * pixelRatio);
          const h = Math.round(d.size.h * SCALE * pixelRatio);
          const c = makeCanvas(w, h);
          d.draw(createPainter(c), createRng(seed).fork(d.id), { w, h, growth: 1 });
          ctx.drawImage(c as CanvasImageSource, Math.round(x * pixelRatio), Math.round(ground * pixelRatio - h * d.anchor.y));
          x += d.size.w * SCALE + GAP;
        }
        top = ground + r.below + GAP;
      }
      // paint on white, paper multiplied last (ADR 0021)
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(paperTexture(canvas.width, canvas.height, 1) as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

const section: StudioSection = {
  id: 'flora',
  title: 'Plants · each garden’s flora by tier',
  order: 206,
  entries: SCENERY_IDS.map(lineup),
};

export default section;
