import type { Rng } from '../../core/rng';
import { PIGMENTS, darken, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { EARTH, groundShadow, paintBud, paintLeaf, paintStem, plantFrame } from '../lib/small-paint';
import { UP, add, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Red spider lily (higanbana): bare stems shoot straight up from the bulb — no leaves at
 * flowering time — and each opens into a ring of flowers with narrow, rippled petals curled
 * back and long stamens sweeping up like brushstrokes. Its red is the one strong note in the
 * garden, so it stays a little muted and only the heads carry it.
 */

interface Floret {
  /** azimuth round the umbel (0 = toward the viewer's right) */
  az: number;
  /** elevation of the flower's axis (0 = horizontal, + = up) */
  el: number;
  petals: { spread: number; len: number; curl: number }[];
  stamens: { spread: number; len: number; curl: number }[];
}

interface Scape {
  stem: StemPlan;
  window: [number, number];
  bud: [number, number];
  open: [number, number];
  florets: Floret[];
  size: number;
}

export interface SpiderLilyPlan {
  scapes: Scape[];
  red: Pigment;
  blades: { x: number; angle: number; length: number; curve: number }[];
}

export function planSpiderLily(rng: Rng): SpiderLilyPlan {
  const red = jitter(mix(darken(PIGMENTS.vermilion, 0.06), PIGMENTS.sakura, 0.12), rng, 0.02);
  const lean = rng.range(-0.08, 0.08);
  const ns = rng.int(3, 4);
  const scapes: Scape[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let s = 0; s < ns; s++) {
    const u = ns === 1 ? 0 : s / (ns - 1) - 0.5;
    const nf = rng.int(4, 6);
    const az0 = rng.range(0, Math.PI * 2);
    const florets: Floret[] = [];
    for (let i = 0; i < nf; i++) {
      florets.push({
        az: az0 + (i / nf) * Math.PI * 2 + rng.gaussian(0, 0.15),
        el: rng.range(-0.15, 0.35),
        petals: Array.from({ length: 6 }, (_, j) => ({ spread: (j / 5 - 0.5) * 1.9 + rng.gaussian(0, 0.08), len: rng.range(0.85, 1.1), curl: rng.range(0.55, 0.9) })),
        stamens: Array.from({ length: 6 }, (_, j) => ({ spread: (j / 5 - 0.5) * 0.9 + rng.gaussian(0, 0.06), len: rng.range(0.9, 1.15), curl: rng.range(0.6, 1.1) })),
      });
    }
    scapes.push({
      stem: makeStem(rng, {
        base: { x: u * rng.range(22, 32) * flip, y: rng.range(-1, 1) },
        length: rng.range(70, 96) * (1 - Math.abs(u) * 0.25),
        angle: UP + lean + u * flip * 0.32 + rng.gaussian(0, 0.04),
        bend: rng.gaussian(0, 0.06),
        segments: 8,
      }),
      window: [...stagger(s, ns, [0.1, 0.5], 0.7)] as [number, number],
      bud: [...stagger(s, ns, [0.42, 0.76], 0.6)] as [number, number],
      open: [...stagger(s, ns, [0.75, 1], 0.7)] as [number, number],
      florets,
      size: rng.range(7.5, 9.5),
    });
  }
  const blades = Array.from({ length: rng.int(3, 5) }, (_, i) => ({ x: rng.range(-20, 20), angle: UP + rng.range(-0.8, 0.8), length: rng.range(7, 12), curve: rng.gaussian(0, 0.2) + (i % 2 ? 0.15 : -0.15) }));
  return { scapes, red, blades };
}

/** Screen direction of a floret's axis; `depth` > 0 means toward the viewer. */
function floretDir(f: Floret, open: number): { angle: number; reach: number; depth: number } {
  const x = Math.cos(f.az);
  const z = Math.sin(f.az);
  // closed: all buds point up together; open: they radiate round the umbel, seen from slightly above
  const el = lerp(1.3, f.el, open);
  const sx = x * Math.cos(el);
  const sy = -Math.sin(el) + z * Math.cos(el) * 0.35;
  return { angle: Math.atan2(sy, sx), reach: Math.min(1, Math.hypot(sx, sy) + 0.25), depth: z };
}

function drawFloret(p: Painter, rng: Rng, f: Floret, c: Pt, size: number, open: number, red: Pigment) {
  const d = floretDir(f, open);
  // short pedicel to the flower
  const base = add(c, d.angle, size * 0.18 * lerp(0.4, 1, open) * d.reach);
  p.inkLine([c, base], { rng: rng.fork('pedicel'), width: 0.45, pigment: mix(PIGMENTS.sage, red, 0.2), opacity: 0.7, breaks: 0, taper: [0, 0.3], wobble: 0.1 });
  // petals: narrow, rippled, curled back from the flower's mouth
  const R = size * 1.6;
  const L = p.layer({ x: base.x - R, y: base.y - R, w: R * 2, h: R * 2 });
  f.petals.forEach((pt, j) => {
    const a = d.angle + pt.spread * lerp(0.15, 1, open) * lerp(0.6, 1, d.reach);
    const len = size * pt.len * lerp(0.45, 1, open) * lerp(0.7, 1, d.reach);
    p.dabInto(L, base, jitter(red, rng.fork(`pc-${j}`), 0.03), {
      rng: rng.fork(`petal-${j}`),
      variant: 'blade',
      angle: a,
      length: len,
      width: size * 0.15,
      curve: Math.sign(pt.spread || 1) * pt.curl * open,
      pool: 0.5,
      basePool: 0.4,
      layers: 3,
    });
  });
  L.dry({ opacity: 0.88 * smooth(open / 0.3), edge: 0.6, edgeWidth: 0.35, sharpness: 0.75, centreLift: 0.25, granulation: 0.08, flow: 0.4, flowScale: 5, darken: 0.32 });
  // stamens: long fine lines sweeping out and up, tipped with dark anthers
  if (open > 0.2) {
    const k = smooth((open - 0.2) / 0.7);
    const S = size * 2.4;
    const SL = p.layer({ x: base.x - S, y: base.y - S, w: S * 2, h: S * 2 });
    const ctx = SL.ctx;
    ctx.lineCap = 'round';
    f.stamens.forEach((st) => {
      const a0 = d.angle + st.spread;
      const len = size * 1.7 * st.len * k;
      const mid = add(base, a0, len * 0.55);
      const end = add(add(base, a0, len), UP, len * 0.35 * st.curl);
      ctx.strokeStyle = `rgba(160,62,48,${0.5})`;
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(92,58,52,0.6)';
      ctx.beginPath();
      ctx.ellipse(end.x, end.y, 0.55 * k, 0.35 * k, a0, 0, Math.PI * 2);
      ctx.fill();
    });
    SL.dry({ opacity: 0.85 * k, edge: 0.3, edgeWidth: 0.2, sharpness: 0.8, centreLift: 0, granulation: 0.05, flow: 0.3, flowScale: 3, darken: 0.2 });
  }
}

function drawScape(p: Painter, rng: Rng, s: Scape, plan: SpiderLilyPlan, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  const pts = stemPoints(s.stem, e, 1);
  paintStem(p, rng.fork('stem'), pts, { width: 1.25, opacity: 0.78, pigment: mix(PIGMENTS.sage, PIGMENTS.celadonMid, 0.25), ink: 0.2, inkReach: 0.5, wetness: 0.55 });
  const tip = pointAt(pts, 1);
  const c = { x: tip.x, y: tip.y };
  const budK = ease(g, s.bud[0], s.bud[1]);
  const openK = smooth(ease(g, s.open[0], s.open[1]));
  // the closed umbel: a pointed sheath first, then a cluster of buds that redden
  const sheath = easeOut(e) * (1 - smooth(openK / 0.4));
  if (visible(sheath)) {
    paintBud(p, rng.fork('sheath'), c, { angle: tip.angle, length: 7 + 4 * budK, width: 3 + 3.2 * budK, k: sheath, colour: budK * 0.85, pigment: plan.red, green: mix(PIGMENTS.sage, PIGMENTS.woodLight, 0.25), sepals: 2, sepalLen: 0.6, opacity: 0.85 * sheath });
  }
  if (!visible(openK)) return;
  const order = s.florets.map((f, i) => ({ f, i, z: floretDir(f, openK).depth })).sort((a, b) => a.z - b.z);
  for (const { f, i } of order) drawFloret(p, rng.fork(`floret-${i}`), f, c, s.size, openK, plan.red);
  p.dab(c, mix(plan.red, PIGMENTS.sumi, 0.3), { rng: rng.fork('knot'), variant: 'round', angle: UP, length: s.size * 0.26 * openK, width: s.size * 0.24 * openK, opacity: 0.7 * openK });
}

const spiderLily: SpeciesDef = {
  id: 'spider-lily',
  name: 'Red Spider Lily',
  nativeName: 'Higanbana',
  // Chinese; on Japan's paddy banks since antiquity
  range: { realms: ['east-asia', 'japan'], biomes: ['wetland'], climates: ['warm-temperate'], cultivatedIn: ['japan'] },
  tier: 2,
  habitats: ['meadow', 'shore'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Spider lily — it blooms at the equinox, when the far shore feels near.',
  bloomColor: '#c94d33',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planSpiderLily(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 26, k: ease(g, 0.05, 0.5) });
      // the bulb's mound of earth, settling as the stems rise
      const mound = 1 - 0.65 * ease(g, 0.1, 0.5);
      p.wash({ cx: 0, cy: -1.5, rx: 14, ry: 4.5 }, EARTH, { rng: r.fork('mound'), opacity: 0.4 * mound, edge: 0.35, centreLift: 0.35, granulation: 0.4, fade: { angle: UP, start: 0.5, amount: 0.6 } });
      const bulb = 1 - ease(g, 0.08, 0.2);
      if (visible(bulb)) p.dab({ x: 0.5, y: -3 }, mix(PIGMENTS.woodLight, PIGMENTS.sakura, 0.25), { rng: r.fork('bulb'), variant: 'round', angle: UP, length: 5.5, width: 5, opacity: 0.8 * bulb });
      // a few low blades of meadow grass for company (the lily's own leaves come after flowering)
      plan.blades.forEach((b, i) => paintLeaf(p, r.fork(`blade-${i}`), { x: b.x, y: 0 }, { angle: b.angle, length: b.length, width: 1.6, curve: b.curve, k: ease(g, 0.05 + i * 0.03, 0.4 + i * 0.03) }, { pigment: PIGMENTS.sap, variant: 'blade', opacity: 0.55, shadow: null }));
      plan.scapes.forEach((s, i) => drawScape(p, r.fork(`scape-${i}`), s, plan, g));

    } finally {
      end();
    }
  },
};

export default spiderLily;
