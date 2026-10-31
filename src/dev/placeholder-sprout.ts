import { EVERYWHERE } from '../plants/biomes';
import type { SpeciesDef } from '../plants/types';

/**
 * TEST FIXTURE: a trivial two-leaf sprout drawn with plain canvas calls — cheap to paint, so unit
 * tests (plant view, widget) can render "a species" without the watercolour engine. Not in the
 * player-facing registry (`src/plants/species/`); `?dev&fixtures` adds it with the `fx-*` species.
 */
export const placeholderSprout: SpeciesDef = {
  id: 'placeholder-sprout',
  name: 'Sprout',
  range: EVERYWHERE,
  tier: 1,
  habitats: ['meadow', 'path', 'rock'],
  sizeClass: 'small',
  size: { w: 40, h: 50 },
  anchor: { x: 0.5, y: 0.95 },
  description: 'Two leaves, and the whole summer ahead.',
  bloomColor: '#a9b386',
  pollinators: false,
  draw(p, rng, { w, h, growth }) {
    const { ctx } = p;
    const bx = w * 0.5;
    const by = h * 0.95;
    const stem = h * 0.6 * Math.max(0.15, growth);
    const lean = rng.range(-0.15, 0.15) * w;
    ctx.save();
    ctx.strokeStyle = '#6f7a52';
    ctx.lineWidth = Math.max(1, w * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx, by - stem * 0.6, bx + lean, by - stem);
    ctx.stroke();
    ctx.fillStyle = 'rgba(141, 154, 108, 0.75)';
    const leaf = w * 0.22 * Math.max(0.3, growth);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + lean + side * leaf * 0.8, by - stem, leaf, leaf * 0.45, side * -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

