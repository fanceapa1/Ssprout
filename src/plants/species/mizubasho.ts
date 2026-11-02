import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { paddleLeaf, paddleShape, spathe, spatheShape, type PaddleShape, type SpatheShape } from '../lib/mizubasho-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Mizubashō (Lysichiton camtschatcensis): one pure white, boat-shaped hood curled round a stubby
 * yellow-green club, standing in cold shallow water, with fresh paddle leaves rising behind it.
 */

const LEAF = '#8fae5e';
const YOUNG = mix(LEAF, PIGMENTS.sageLight, 0.45);
const LEAF_DEEP = mix('#5f7d45', PIGMENTS.celadonDeep, 0.25);
const STALK = mix('#b9c486', PIGMENTS.sageLight, 0.3);
const WHITE = mix(PIGMENTS.petalWhite, '#ffffff', 0.6);
const SHADE = '#cac2d4';
const CLUB = '#c9c27a';
const CLUB_DEEP = mix(CLUB, PIGMENTS.olive, 0.35);
const WATER = mix(PIGMENTS.celadon, PIGMENTS.celadonMid, 0.4);

interface Leaf {
  shape: PaddleShape;
  base: Pt;
  angle: number;
  length: number;
  width: number;
  bend: number;
  window: [number, number];
  tone: Pigment;
  front: boolean;
}

export interface MizubashoPlan {
  leaves: Leaf[];
  spathe: { shape: SpatheShape; base: Pt; stalk: number; angle: number; length: number; width: number; bend: number };
}

export function planMizubasho(rng: Rng): MizubashoPlan {
  const side = rng.chance(0.5) ? 1 : -1;
  const lean = rng.gaussian(0, 0.1);
  const spatheLen = rng.range(60, 68);
  const sp = {
    shape: spatheShape(rng.fork('spathe'), { side, hook: rng.range(0.3, 0.8) * (rng.chance(0.6) ? -side : side), asym: rng.range(-0.06, 0.06) }),
    base: { x: rng.range(-3, 3), y: 0 },
    stalk: rng.range(8, 13),
    angle: UP + lean,
    length: spatheLen,
    width: spatheLen * rng.range(0.41, 0.46),
    bend: rng.gaussian(0, 0.1),
  };
  const n = rng.int(3, 5);
  const green = jitter(LEAF, rng, 0.03);
  const leaves: Leaf[] = [];
  const frontAt = rng.chance(0.7) ? rng.int(0, 1) * (n - 1) : -1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const front = i === frontAt;
    const out = Math.abs(u) * 2;
    const angle = UP + u * rng.range(1.2, 1.5) + rng.gaussian(0, 0.06) + (front ? Math.sign(u) * 0.25 : 0);
    let length = lerp(96, 76, out) * rng.range(0.9, 1.05) * (front ? 0.74 : 1);
    const wk = rng.range(0.27, 0.32);
    const bend = u * rng.range(0.15, 0.4);
    // keep the blade, its flank included, 54 to each side and 138 above the base
    const reach = (Math.abs(Math.cos(angle)) + Math.abs(Math.cos(angle + bend))) / 2 + wk / 2;
    length = Math.min(length, 54 / reach, 138 / ((Math.abs(Math.sin(angle)) + Math.abs(Math.sin(angle + bend))) / 2 + wk / 2));
    leaves.push({
      shape: paddleShape(rng.fork(`leaf-${i}`), { neck: rng.range(0.3, 0.36), asym: rng.range(-0.08, 0.08), veins: rng.int(6, 8) }),
      base: { x: u * 6, y: -0.5 },
      angle,
      length,
      width: length * wk,
      bend,
      window: [0, 0],
      tone: jitter(mix(green, LEAF_DEEP, rng.range(0.12, 0.32)), rng, 0.02),
      front,
    });
  }
  // the middle leaves come first, the outer ones later and larger as the hood fades
  const order = leaves.map((_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  order.forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, n, [0.32, 1], 0.55)] as [number, number];
  });
  return { leaves, spathe: sp };
}

function drawLeaf(p: Painter, rng: Rng, l: Leaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  // a young leaf rises as a rolled, upright spike, then unrolls and leans out
  const open = smooth((k - 0.1) / 0.75);
  paddleLeaf(
    p,
    rng,
    l.shape,
    { base: l.base, angle: lerp(UP, l.angle, smooth(k)), length: l.length * easeOut(k), bend: l.bend * open, width: l.width * easeOut(k) },
    { pigment: mix(YOUNG, l.tone, smooth(k * 1.2)), deep: LEAF_DEEP, rib: mix(l.tone, PIGMENTS.petalWhite, 0.5), opacity: 0.94 * smooth(k * 4) },
    open,
  );
}

function drawSpathe(p: Painter, rng: Rng, plan: MizubashoPlan, g: number) {
  const s = plan.spathe;
  const k = ease(g, 0.06, 0.62);
  if (!visible(k)) return;
  const stalk = s.stalk * ease(g, 0.2, 0.7);
  const top = { x: s.base.x + Math.cos(s.angle) * stalk, y: s.base.y + Math.sin(s.angle) * stalk };
  paintStem(p, rng.fork('stalk'), [s.base, { x: (s.base.x + top.x) / 2, y: (s.base.y + top.y) / 2 }, top], { width: 2.6, pigment: STALK, opacity: 0.85 });
  spathe(
    p,
    rng.fork('hood'),
    s.shape,
    { base: top, angle: s.angle, length: s.length * easeOut(k), bend: s.bend, width: s.width * easeOut(k) },
    { white: WHITE, shade: SHADE, green: mix(STALK, LEAF, 0.4), club: CLUB, clubDeep: CLUB_DEEP },
    { open: ease(g, 0.28, 0.66), club: ease(g, 0.4, 0.75), opacity: smooth(k * 4) },
  );
}

const mizubasho: SpeciesDef = {
  id: 'mizubasho',
  name: 'Asian Skunk Cabbage',
  nativeName: 'Mizubashō',
  // fens, wet woods and stream margins; wild only, so the Japanese garden does not offer it
  range: { realms: ['japan'], biomes: ['montane-stream', 'wetland'], climates: ['cool-temperate'] },
  tier: 2,
  habitats: ['water', 'shore'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.9 },
  description: 'Mizubashō — a white sail raised the week the snow lets go.',
  bloomColor: '#f7f3e6',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planMizubasho(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      // it stands in cold, shallow water
      groundShadow(p, r.fork('water'), { rx: 30, ry: 4.6, k: ease(g, 0.04, 0.5), pigment: WATER, opacity: 0.32 });
      groundShadow(p, r, { rx: 14, k: ease(g, 0.08, 0.6), opacity: 0.2 });
      seedMound(p, r, g, { rx: 8 });
      plan.leaves.forEach((l, i) => !l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      drawSpathe(p, r.fork('spathe'), plan, g);
      plan.leaves.forEach((l, i) => l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      // the feet are lost in the water, and it parts round them
      groundShadow(p, r.fork('foot'), { rx: 12, ry: 2.4, k: ease(g, 0.2, 0.6), pigment: WATER, opacity: 0.38 });
      const wk = ease(g, 0.3, 0.7);
      if (visible(wk)) {
        for (const [i, sg] of [[0, -1], [1, 1]] as const) {
          const x0 = sg * 7;
          const x1 = sg * lerp(8, 24, wk);
          p.stroke([{ x: x0, y: 2 }, { x: (x0 + x1) / 2, y: 1.5 }, { x: x1, y: 2.3 }], { rng: r.fork(`ripple-${i}`), pigment: PIGMENTS.celadonDeep, width: 0.6, taper: [0.2, 0.5], wobble: 0.2, wetness: 0.4, opacity: 0.4 * wk, edge: 0.3 });
        }
      }
    } finally {
      end();
    }
  },
};

export default mizubasho;
