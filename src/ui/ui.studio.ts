import { FIXTURE_SPECIES } from '../dev/fixture-species';
import { allSpecies } from '../plants/registry';
import type { SpeciesDef } from '../plants/types';
import type { StudioSection } from '../studio/types';
import { createPreviewCache, paintPlot, renderPlantPreview } from './previews';

/**
 * UI canvas treatments: the start-sheet plant preview (`renderPlantPreview`) at a few growth
 * values, the planting sheet's waiting plot beside the preview that replaces it (ADR 0222), and
 * the pressed-flower treatment used by the herbarium. Uses registry species first,
 * then the dev fixtures so there is always something to look at.
 */
const pool = (): SpeciesDef[] => [...allSpecies(), ...FIXTURE_SPECIES];

const section: StudioSection = {
  id: 'ui',
  title: 'UI · previews & pressed flowers',
  order: 520,
  entries: [
    {
      id: 'preview-growth',
      label: 'plant preview at growth 0.2 / 0.5 / 1',
      w: 360,
      h: 120,
      render(canvas, { seed }) {
        const list = pool();
        const def = list[seed % list.length]!;
        const ctx = canvas.getContext('2d')!;
        const cw = Math.floor(canvas.width / 3);
        [0.2, 0.5, 1].forEach((g, i) => {
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = canvas.height;
          renderPlantPreview(c, def, seed, g);
          ctx.drawImage(c, i * cw, 0);
        });
      },
    },
    {
      id: 'waiting-plot',
      label: 'planting card: waiting plot, then its preview',
      w: 192,
      h: 92,
      render(canvas, { seed, pixelRatio }) {
        const list = pool();
        const def = list[seed % list.length]!;
        const ctx = canvas.getContext('2d')!;
        const W = Math.round(96 * pixelRatio);
        const H = Math.round(92 * pixelRatio);
        const plot = document.createElement('canvas');
        plot.width = W;
        plot.height = H;
        paintPlot(plot, W, H);
        ctx.drawImage(plot, 0, 0);
        const cache = createPreviewCache((id) => list.find((s) => s.id === id));
        const preview = cache.get(def.id, { w: 96, h: 92, dpr: pixelRatio, seed: `preview:${def.id}` });
        if (preview) ctx.drawImage(preview, W, 0);
      },
    },
    {
      id: 'pressed',
      label: 'fresh vs pressed (herbarium)',
      w: 280,
      h: 150,
      render(canvas, { seed, pixelRatio }) {
        const list = pool();
        const def = list[(seed + 3) % list.length]!;
        const cache = createPreviewCache((id) => list.find((s) => s.id === id));
        const ctx = canvas.getContext('2d')!;
        const fresh = cache.get(def.id, { w: 132, h: 150, dpr: pixelRatio, seed });
        const pressed = cache.get(def.id, { w: 132, h: 150, dpr: pixelRatio, seed, pressed: true });
        if (fresh) ctx.drawImage(fresh, 0, 0);
        if (pressed) ctx.drawImage(pressed, canvas.width / 2, 0);
      },
    },
  ],
};

export default section;
