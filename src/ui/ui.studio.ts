import { FIXTURE_SPECIES } from '../dev/fixture-species';
import { allSpecies } from '../plants/registry';
import type { SpeciesDef } from '../plants/types';
import type { StudioSection } from '../studio/types';
import { createPreviewCache, renderPlantPreview } from './previews';

/**
 * UI canvas treatments: the start-sheet plant preview (`renderPlantPreview`) at a few growth
 * values, and the pressed-flower treatment used by the herbarium. Uses registry species first,
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
