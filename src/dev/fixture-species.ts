import type { Rng } from '../core/rng';
import { PIGMENTS, type Painter } from '../paint';
import { EVERYWHERE } from '../plants/biomes';
import type { Habitat, SizeClass, SpeciesDef, Tier } from '../plants/types';

/**
 * DEV-ONLY fixture species (`?dev&fixtures`, ADR 0055): a dozen simple stand-ins across all tiers
 * and habitats, painted with the watercolour engine, so the UI and e2e tests can exercise locked
 * tiers, water/shore/back slots and swaps before the real species exist. Ids are prefixed `fx-`.
 */

interface Look {
  kind: 'flowers' | 'shrub' | 'tree' | 'pads' | 'blades';
  bloom: string;
  heads: number;
}

type Pt = { x: number; y: number };

function stem(p: Painter, rng: Rng, from: Pt, to: Pt, width: number, pigment: string = PIGMENTS.olive): void {
  const mid = { x: (from.x + to.x) / 2 + rng.range(-0.08, 0.08) * Math.abs(to.y - from.y), y: (from.y + to.y) / 2 };
  p.stroke([from, mid, to], { rng, pigment, width, wobble: 0.25, wetness: 0.4, opacity: 0.8 });
}

function flower(p: Painter, rng: Rng, c: Pt, r: number, bloom: string, petals = 5): void {
  const turn = rng.range(0, Math.PI * 2);
  for (let k = 0; k < petals; k++) {
    const a = turn + (k / petals) * Math.PI * 2 + rng.range(-0.25, 0.25);
    p.dab(c, bloom, { rng, angle: a, length: r * rng.range(0.85, 1.1), width: r * 0.7, variant: 'petal', opacity: 0.8 });
  }
  p.dab(c, PIGMENTS.gold ?? '#d9b36c', { rng, length: r * 0.32, width: r * 0.3, variant: 'round', opacity: 0.85 });
}

function paint(p: Painter, rng: Rng, w: number, h: number, growth: number, look: Look): void {
  const g = Math.max(0.15, Math.min(1, growth));
  const u = Math.min(w, h);
  const base = { x: w * 0.5, y: h * 0.95 };
  if (look.kind === 'pads') {
    for (let i = 0; i < 3; i++) {
      p.wash({ cx: base.x + rng.range(-0.28, 0.28) * w, cy: base.y - rng.range(0.04, 0.16) * h, rx: w * 0.17 * g, ry: h * 0.06 * g }, PIGMENTS.sage, { rng, opacity: 0.75 });
    }
    if (growth > 0.55) {
      const top = { x: base.x + rng.range(-3, 3), y: base.y - h * 0.55 * g };
      stem(p, rng, { x: base.x, y: base.y - h * 0.1 }, top, u * 0.025);
      flower(p, rng, top, u * 0.16, look.bloom, 7);
    }
  } else if (look.kind === 'tree') {
    const top = { x: base.x + rng.range(-0.04, 0.04) * w, y: base.y - h * 0.52 * g };
    p.stroke([base, { x: base.x + rng.range(-0.05, 0.05) * w, y: (base.y + top.y) / 2 }, top], {
      rng,
      pigment: PIGMENTS.sumi,
      width: u * 0.05,
      wobble: 0.3,
      wetness: 0.3,
      opacity: 0.75,
    });
    const crowns = 3 + Math.round(look.heads * 0.3 * g);
    for (let i = 0; i < crowns; i++) {
      const c = { x: top.x + rng.gaussian() * w * 0.16 * g, y: top.y - rng.range(-0.05, 0.22) * h * g };
      p.foliageClump(c, u * 0.2 * g, { light: look.bloom, mid: look.bloom, shadow: PIGMENTS.sage }, { rng, density: 0.7, opacity: 0.75 });
    }
  } else if (look.kind === 'shrub') {
    p.foliageClump({ x: base.x, y: base.y - h * 0.28 * g }, u * 0.36 * g, undefined, { rng, density: 0.8, opacity: 0.8 });
    for (let i = 0; i < Math.round(look.heads * g); i++) {
      flower(p, rng, { x: base.x + rng.gaussian() * w * 0.16 * g, y: base.y - h * rng.range(0.25, 0.55) * g }, u * 0.1, look.bloom, 6);
    }
  } else if (look.kind === 'blades') {
    for (let i = 0; i < 6; i++) {
      p.dab(base, PIGMENTS.sage, { rng, angle: -Math.PI / 2 + rng.range(-0.35, 0.35), length: h * rng.range(0.45, 0.8) * g, width: u * 0.07, variant: 'blade', opacity: 0.75 });
    }
    if (growth > 0.5) {
      for (let i = 0; i < look.heads; i++) {
        flower(p, rng, { x: base.x + rng.range(-0.18, 0.18) * w, y: base.y - h * rng.range(0.6, 0.8) * g }, u * 0.12, look.bloom, 3);
      }
    }
  } else {
    for (let i = 0; i < 5; i++) {
      p.dab({ x: base.x + rng.range(-0.15, 0.15) * w, y: base.y }, PIGMENTS.sap, {
        rng,
        angle: -Math.PI / 2 + rng.range(-1.1, 1.1),
        length: u * 0.25 * g,
        variant: 'leaf',
        opacity: 0.75,
      });
    }
    for (let i = 0; i < look.heads; i++) {
      const top = { x: base.x + rng.range(-0.3, 0.3) * w, y: base.y - h * rng.range(0.4, 0.75) * g };
      stem(p, rng, { x: base.x + rng.range(-2, 2), y: base.y }, top, u * 0.02);
      if (growth > 0.5) flower(p, rng, top, u * 0.1, look.bloom);
    }
  }
}

function fx(
  id: string,
  name: string,
  nativeName: string | undefined,
  tier: Tier,
  habitats: Habitat[],
  sizeClass: SizeClass,
  size: { w: number; h: number },
  description: string,
  look: Look,
  pollinators = true,
): SpeciesDef {
  return {
    id,
    name,
    ...(nativeName ? { nativeName } : {}),
    // offered in every scenery (ADR 0250)
    range: EVERYWHERE,
    tier,
    habitats,
    sizeClass,
    size,
    anchor: { x: 0.5, y: 0.95 },
    description,
    bloomColor: look.bloom,
    pollinators,
    draw: (p, rng, { w, h, growth }) => paint(p, rng, w, h, growth, look),
  };
}

export const FIXTURE_SPECIES: readonly SpeciesDef[] = [
  fx('fx-violet', 'Wood Violet', 'Sumire', 1, ['meadow', 'path', 'rock'], 'small', { w: 46, h: 40 }, 'A small violet hush along the stones.', { kind: 'flowers', bloom: '#7b6ba8', heads: 4 }),
  fx('fx-clover', 'White Clover', 'Shirotsumekusa', 1, ['meadow', 'path'], 'small', { w: 50, h: 36 }, 'Low and patient, it keeps the ground company.', { kind: 'flowers', bloom: '#faf6ee', heads: 5 }),
  fx('fx-forget-me-not', 'Forget-me-not', 'Wasurenagusa', 1, ['shore', 'meadow', 'rock'], 'small', { w: 44, h: 42 }, 'A scatter of sky, set down by the water.', { kind: 'flowers', bloom: '#7f97c8', heads: 6 }),
  fx('fx-iris', 'Japanese Iris', 'Hanashōbu', 2, ['shore', 'water'], 'medium', { w: 60, h: 90 }, 'Violet sails unfurled where the water meets the bank.', { kind: 'blades', bloom: '#7b6ba8', heads: 3 }),
  fx('fx-anemone', 'Japanese Anemone', 'Shūmeigiku', 2, ['meadow', 'back'], 'medium', { w: 62, h: 84 }, 'White cups that nod at the end of summer.', { kind: 'flowers', bloom: '#faf6ee', heads: 5 }),
  fx('fx-bellflower', 'Balloon Flower', 'Kikyō', 2, ['meadow', 'path'], 'medium', { w: 54, h: 78 }, 'Each bud a held breath, opening into a star.', { kind: 'flowers', bloom: '#7f97c8', heads: 4 }),
  fx('fx-lotus', 'Sacred Lotus', 'Hasu', 3, ['water'], 'medium', { w: 90, h: 80 }, 'Rising clean from the mud, it opens with the morning.', { kind: 'pads', bloom: '#f1c6c3', heads: 1 }, false),
  fx('fx-peony', 'Tree Peony', 'Botan', 3, ['meadow'], 'large', { w: 96, h: 96 }, 'Heavy blooms that bow, unhurried, toward the path.', { kind: 'shrub', bloom: '#e8a7a9', heads: 5 }),
  fx('fx-hydrangea', 'Hydrangea', 'Ajisai', 3, ['meadow', 'shore', 'back'], 'large', { w: 100, h: 90 }, 'It drinks the rain and answers in blue.', { kind: 'shrub', bloom: '#9a8cc4', heads: 7 }),
  fx('fx-cherry', 'Weeping Cherry', 'Shidarezakura', 4, ['back', 'meadow'], 'tree', { w: 220, h: 260 }, 'A slow pink rain that falls and never lands.', { kind: 'tree', bloom: '#f1c6c3', heads: 12 }),
  fx('fx-maple', 'Japanese Maple', 'Momiji', 4, ['back'], 'tree', { w: 200, h: 240 }, 'Small hands of leaves, turning the light to embers.', { kind: 'tree', bloom: '#d0694a', heads: 10 }, false),
  fx('fx-pine', 'Garden Pine', 'Matsu', 4, ['back', 'rock'], 'tree', { w: 180, h: 200 }, 'Shaped by wind and years, it keeps its green.', { kind: 'tree', bloom: '#8d9a6c', heads: 8 }, false),
];

/** Registry species plus the dev fixtures (fixtures never shadow a real id). */
export function withFixtures(real: readonly SpeciesDef[]): SpeciesDef[] {
  const ids = new Set(real.map((s) => s.id));
  return [...real, ...FIXTURE_SPECIES.filter((s) => !ids.has(s.id))];
}
