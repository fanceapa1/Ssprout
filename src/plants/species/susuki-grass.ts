import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { INK_GREEN, dabAxis, groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, bendProfile, makeStem, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Susuki (Japanese silver grass, pampas of the moon-viewing): a fountain of long arching blades
 * with a pale midrib, and above them slender stalks whose plumes open from tight russet spikes
 * into soft, silver, wind-combed tassels that all lean one way.
 */

interface Blade {
  x: number;
  angle: number;
  length: number;
  width: number;
  curve: number;
  /** turtle turns of the arching blade at full length */
  bends: number[];
  window: [number, number];
  tone: Pigment;
  autumn: number;
}

const makeStemFrom = (b: Blade): StemPlan => ({ base: { x: b.x, y: 0 }, length: b.length, angle: b.angle, bends: b.bends });

interface Plume {
  stem: StemPlan;
  window: [number, number];
  bud: [number, number];
  open: [number, number];
  branches: { t: number; side: number; len: number; droop: number; hairs: number[] }[];
}

export interface SusukiPlan {
  blades: Blade[];
  plumes: Plume[];
  wind: number;
}

const SILVER = mix(PIGMENTS.stoneWarm, PIGMENTS.petalWhite, 0.45);
const RUSSET = mix(PIGMENTS.sakura, PIGMENTS.wood, 0.55);

export function planSusukiGrass(rng: Rng): SusukiPlan {
  const wind = rng.chance(0.5) ? 1 : -1;
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.sap, 0.4), rng, 0.03);
  const n = rng.int(13, 18);
  const blades: Blade[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    // outer blades lean out and arch right over; the inner ones stand taller and straighter
    const curve = Math.sign(u || wind) * rng.range(0.5, 1) * (0.25 + Math.abs(u) * 2.2) + wind * 0.12;
    blades.push({
      x: u * rng.range(8, 14),
      angle: UP + u * 0.7 + wind * 0.06 + rng.gaussian(0, 0.08),
      length: rng.range(60, 100) * (1 - Math.abs(u) * 0.5),
      width: rng.range(2.4, 3.4),
      curve,
      bends: bendProfile(rng, 10, curve * 1.35, 0.7, 0.02),
      window: [0, 0],
      tone: jitter(green, rng, 0.04),
      autumn: rng.chance(0.3) ? rng.range(0.25, 0.5) : 0,
    });
  }
  rng.shuffle(blades.map((_, i) => i)).forEach((bi, k) => {
    blades[bi]!.window = [...stagger(k, n, [0.05, 0.55], 0.45)] as [number, number];
  });
  const np = rng.int(3, 6);
  const plumes: Plume[] = [];
  for (let i = 0; i < np; i++) {
    const u = np === 1 ? 0 : i / (np - 1) - 0.5;
    const nb = rng.int(8, 12);
    const branches: Plume['branches'] = [];
    for (let j = 0; j < nb; j++) {
      const hairs: number[] = [];
      for (let h = 0; h < 9; h++) hairs.push(rng.range(0.7, 1.2));
      branches.push({ t: 0.74 + (0.26 * j) / (nb - 1), side: j % 2 === 0 ? 1 : -1, len: rng.range(10, 17) * (1 - (j / nb) * 0.45), droop: rng.range(0.5, 1), hairs });
    }
    plumes.push({
      stem: makeStem(rng, {
        base: { x: u * rng.range(6, 12), y: 0 },
        length: rng.range(105, 140) * (1 - Math.abs(u) * 0.2),
        angle: UP + u * 0.35 + wind * rng.range(0.03, 0.1),
        bend: wind * rng.range(0.15, 0.4),
        segments: 10,
        tipBias: 0.8,
      }),
      window: [...stagger(i, np, [0.3, 0.68], 0.65)] as [number, number],
      bud: [...stagger(i, np, [0.45, 0.76], 0.6)] as [number, number],
      open: [...stagger(i, np, [0.74, 1], 0.7)] as [number, number],
      branches,
    });
  }
  return { blades, plumes, wind };
}

/** A blade with a pale midrib bled in wet-in-wet; it lengthens from the base and arches as it grows. */
function drawBlade(p: Painter, rng: Rng, b: Blade, g: number, rib = true) {
  const k = ease(g, b.window[0], b.window[1]);
  if (!visible(k)) return;
  const length = b.length * easeOut(k);
  if (length < 1) return;
  // a long blade is a tapered stroke along an arching path that bows over more as it lengthens
  const stem: StemPlan = makeStemFrom(b);
  const pts = stemPoints(stem, easeOut(k), lerp(0.2, 1, k));
  const tone = b.autumn ? mix(b.tone, PIGMENTS.woodLight, b.autumn * ease(g, 0.6, 1)) : b.tone;
  const op = 0.82 * smooth(k * 8);
  p.stroke(pts, { rng: rng.fork('blade'), pigment: tone, width: b.width, taper: [0.03, 0.85], pressure: [1, 0.95, 0.7], wobble: 0.15, wetness: 0.45, opacity: op, edge: 0.5 });
  // the pale midrib, lifted back toward the paper (front blades only: it is lost behind)
  if (rib) p.stroke(subPath(pts, 0.8), { rng: rng.fork('rib'), pigment: lighten(tone, 0.6), width: b.width * 0.22, taper: [0.1, 0.7], wobble: 0.1, wetness: 0.3, opacity: op * 0.5, blend: 'source-over', edge: 0.05 });
}

function drawPlume(p: Painter, rng: Rng, pl: Plume, plan: SusukiPlan, g: number) {
  const e = ease(g, pl.window[0], pl.window[1]);
  if (!visible(e)) return;
  const budK = ease(g, pl.bud[0], pl.bud[1]);
  const openK = smooth(ease(g, pl.open[0], pl.open[1]));
  // the stalk nods further with the weight of the opening plume
  const pts = stemPoints(pl.stem, e, lerp(0.3, 1, openK));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.8, opacity: 0.7, pigment: mix(PIGMENTS.sage, PIGMENTS.woodLight, 0.25), ink: 0.2, inkReach: 0.6 });
  if (!visible(budK)) return;
  const colour = mix(RUSSET, SILVER, openK);
  const top = pointAt(pts, 0.9);
  const R = 48;
  const L = p.layer({ x: top.x - R, y: top.y - R, w: R * 2, h: R * 2 });
  const lines: Pt[][] = [];
  pl.branches.forEach((br, j) => {
    const at = pointAt(pts, lerp(0.86, br.t, budK));
    // closed: branches hug the stalk; open: they fan out and droop downwind
    const spread = lerp(0.04, 0.12 + br.droop * 0.2, openK) * br.side;
    const a0 = at.angle + spread + plan.wind * 0.35 * openK;
    const len = br.len * lerp(0.4, 1, budK) * lerp(0.75, 1, openK);
    const curve = plan.wind * lerp(0.08, 1.05, openK) * br.droop + br.side * 0.08 * openK;
    const axis = dabAxis(at, a0, len, curve, 6);
    lines.push(axis);
    // silky hairs along the branch, combed downwind; they fluff out as the plume opens
    br.hairs.forEach((h, q) => {
      const t = (q + 1) / (br.hairs.length + 1);
      const pt = axis[Math.min(6, Math.round(t * 6))]!;
      const hl = len * 0.42 * h * lerp(0.35, 1, openK);
      p.dabInto(L, pt, jitter(colour, rng.fork(`hc-${j}-${q}`), 0.03), {
        rng: rng.fork(`hair-${j}-${q}`),
        variant: 'needle',
        angle: a0 + curve * t * 2 + (q % 2 ? 0.14 : -0.14) * lerp(0.3, 1, openK),
        length: hl,
        width: lerp(0.5, 0.85, openK),
        curve: plan.wind * 0.2,
        pool: 0.2,
        basePool: 0.2,
        layers: 2,
      });
    });
  });
  L.dry({ opacity: lerp(0.8, 0.7, openK) * smooth(budK * 3), edge: lerp(0.5, 0.15, openK), edgeWidth: 0.25, sharpness: lerp(0.7, 0.4, openK), centreLift: 0.1, granulation: 0.1, flow: 0.45, flowScale: 6, darken: 0.2 });
  // fine ink for a few of the branch stems
  lines.forEach((ln, j) => {
    if (j % 3 !== 0) return;
    p.inkLine(ln, { rng: rng.fork(`br-${j}`), width: 0.25, pigment: mix(INK_GREEN, PIGMENTS.wood, 0.4), opacity: 0.3 * budK, breaks: 0.3, taper: [0.05, 0.6], wobble: 0.15 });
  });
}

const susukiGrass: SpeciesDef = {
  id: 'susuki-grass',
  name: 'Silver Grass',
  nativeName: 'Susuki',
  tier: 2,
  habitats: ['back', 'meadow', 'shore'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Silver grass — the autumn moon’s own brush, combing the wind.',
  bloomColor: '#cdbfa6',
  pollinators: false,
  draw(p, rng, opts) {
    const plan = planSusukiGrass(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 24, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 9 });
      const back = plan.blades.filter((_, i) => i % 2 === 0);
      const front = plan.blades.filter((_, i) => i % 2 === 1);
      back.forEach((b, i) => drawBlade(p, r.fork(`bb-${i}`), b, g, false));
      plan.plumes.forEach((pl, i) => drawPlume(p, r.fork(`plume-${i}`), pl, plan, g));
      front.forEach((b, i) => drawBlade(p, r.fork(`fb-${i}`), b, g));

    } finally {
      end();
    }
  },
};

export default susukiGrass;
