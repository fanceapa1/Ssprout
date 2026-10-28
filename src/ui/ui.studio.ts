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
    {
      id: 'garden-thumbs',
      label: 'Gardens card: waiting wash, then a still with its washed edge (ADR 0244)',
      w: 400,
      h: 120,
      render(canvas, { seed, pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        const w = Math.round(192 * pixelRatio);
        const hh = Math.round(120 * pixelRatio);
        // the waiting wash, as `.garden-thumb[data-still='waiting']`
        const g = ctx.createRadialGradient(w / 2, hh * 0.6, 0, w / 2, hh * 0.6, w * 0.55);
        g.addColorStop(0, 'rgba(120,140,120,0.22)');
        g.addColorStop(0.7, 'rgba(120,140,120,0.06)');
        g.addColorStop(1, 'rgba(120,140,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, hh);
        // a stand-in still (a plant preview on a wash) under the card's elliptical mask
        const still = document.createElement('canvas');
        still.width = w;
        still.height = hh;
        const s = still.getContext('2d')!;
        s.fillStyle = 'rgba(150,175,160,0.55)';
        s.fillRect(0, 0, w, hh);
        const list = pool();
        const def = list[seed % list.length]!;
        const preview = createPreviewCache((id) => list.find((x) => x.id === id)).get(def.id, { w: 96, h: 92, dpr: pixelRatio, seed });
        if (preview) s.drawImage(preview, (w - preview.width) / 2, hh - preview.height);
        const m = s.createRadialGradient(w / 2, hh / 2, 0, w / 2, hh / 2, w * 0.36 / 0.62);
        m.addColorStop(0, '#000');
        m.addColorStop(0.62, '#000');
        m.addColorStop(1, 'rgba(0,0,0,0)');
        s.globalCompositeOperation = 'destination-in';
        s.fillStyle = m;
        s.fillRect(0, 0, w, hh);
        ctx.drawImage(still, canvas.width - w, 0);
      },
    },
  ],
};

export default section;
