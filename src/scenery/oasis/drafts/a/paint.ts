/**
 * Oasis draft A, "Ksar & palmeraie": the backdrop's paint steps, back to front, on white
 * (the paper is multiplied last). Light comes from the upper right.
 */
import { createRng, type Rng } from '../../../../core/rng';
import { PAPER_WHITE, blob, lighten, mix, resample, rgba, ribbon, shade, smoothPath, type Painter, type Pigment } from '../../../../paint';
import type { Pt } from '../../../../render/viewport';
import { paintMargins } from '../../../../scene/paint-land';
import {
  BAR,
  BASIN,
  BASIN_RIM,
  BIG_PALMS,
  BLUFF,
  BLUFF_FLANK,
  CLIFF_STEP,
  DUNE_BASE,
  DUNE_CRESTS,
  FAR_RANGE,
  KSAR,
  KSAR_DETAIL,
  OUED,
  PALMS_BEHIND,
  SEGUIA_FALLS,
  SEGUIA_RUNS,
  SLUICE,
  WALLS,
  type Block,
} from './layout';

export const C = {
  skyTop: '#a9c6dc',
  skyLow: '#f3cf9c',
  lilac: '#b7a5cb',
  lilacDeep: '#9583b0',
  roseRange: '#c69aa6',
  sand: '#ebcb8b',
  sandLight: '#f2dcaa',
  sandShadow: '#c7956e',
  soil: '#c48a5c',
  soilDamp: '#9a6a4e',
  redOchre: '#c4694a',
  redDeep: '#8f4a3e',
  mud: '#cf8f68',
  mudLit: '#f0bc8a',
  mudShadow: '#9a5c4e',
  palm: '#8c9a5c',
  palmDark: '#66714a',
  palmLight: '#b3bb78',
  palmFar: '#9aa38a',
  trunk: '#8a6a4e',
  waterLight: '#86bcbc',
  waterMid: '#3d8b98',
  waterDeep: '#235b78',
} satisfies Record<string, Pigment>;

const poly = (pts: readonly Pt[]): Pt[] => pts.map((q) => ({ x: q.x, y: q.y }));

/** A skyline closed down to `bottom`. */
function belowLine(line: readonly Pt[], bottom: number): Pt[] {
  return [...line, { x: line[line.length - 1]!.x, y: bottom }, { x: line[0]!.x, y: bottom }];
}

function clipTo(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.clip();
}

function reserve(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

/** Linear interpolation along a polyline by x. */
function yAt(line: readonly Pt[], x: number): number {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-6, b.x - a.x);
  }
  return line[line.length - 1]!.y;
}

// ── sky and distance ──────────────────────────────────────────────────────────────────────

export function paintSky(p: Painter, rng: Rng): void {
  const sky: Pt[] = [{ x: -20, y: -20 }, { x: 1620, y: -20 }, { x: 1620, y: 420 }, { x: -20, y: 420 }];
  p.wetInWet(sky, C.skyTop, C.skyLow, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.6, opacity: 0.32, edge: 0, granulation: 0.05, flow: 0.5, flowScale: 200 });
  p.glaze([{ x: -20, y: 200 }, { x: 1620, y: 180 }, { x: 1620, y: 380 }, { x: -20, y: 380 }], C.skyLow, { rng, opacity: 0.22, edge: 0, sharpness: 0.05, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.4 } });
}

export function paintRanges(p: Painter, rng: Rng): void {
  p.wetInWet(belowLine(FAR_RANGE, 420), lighten(C.lilac, 0.04), mix(C.lilac, C.roseRange, 0.4), { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.5, deform: 0.04, spread: 0.03, edge: 0.25, sharpness: 0.7, granulation: 0.3, fade: { angle: Math.PI / 2, start: 0.35, amount: 0.8 } });
}

export function paintDunes(p: Painter, rng: Rng): void {
  const crest = smoothPath(DUNE_CRESTS.map((q) => ({ x: q.x, y: q.y })), 8);
  const body = belowLine(crest, DUNE_BASE);
  reserve(p, body);
  p.wetInWet(body, C.sandLight, C.sand, { rng, angle: Math.PI / 2, split: 0.35, opacity: 0.75, deform: 0.05, spread: 0.04, edge: 0.35, sharpness: 0.75, granulation: 0.35, granules: 0.15 });
  // the shaded west flank of each crest: a lune hugging the crest line, lost toward the foot
  for (let i = 1; i < DUNE_CRESTS.length - 1; i++) {
    const c = DUNE_CRESTS[i]!;
    const w = (c.x - DUNE_CRESTS[i - 1]!.x) * 0.7;
    const top: Pt[] = [];
    const low: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const x = c.x - w + (w * k) / 10;
      const y = yAt(crest, x);
      top.push({ x, y: y + 1 });
      low.push({ x: x + 6, y: y + Math.sin((Math.PI * k) / 10) ** 0.7 * 46 + 4 });
    }
    p.wash([...top, ...low.reverse()], C.sandShadow, { rng, opacity: 0.4, deform: 0.06, spread: 0.05, edge: 0.35, sharpness: 0.8, granulation: 0.45, fade: { angle: Math.PI / 2 + 0.3, start: 0.25, amount: 0.95 } });
  }
  // ripples on the lit faces
  for (let i = 0; i < 22; i++) {
    const x = rng.range(820, 1600);
    const y = yAt(crest, x) + rng.range(18, 60);
    if (y > DUNE_BASE - 10) continue;
    p.stroke([{ x: x - 30, y: y + 3 }, { x, y }, { x: x + 34, y: y + 4 }], { rng, pigment: C.sandShadow, width: 1.6, opacity: 0.35, wetness: 0.3, wobble: 0.3 });
  }
}

// ── the bluff and the ksar ────────────────────────────────────────────────────────────────

export function paintBluff(p: Painter, rng: Rng): void {
  reserve(p, BLUFF);
  p.wetInWet(BLUFF, mix(C.redOchre, C.mudLit, 0.25), mix(C.redOchre, C.redDeep, 0.5), { rng, angle: Math.PI / 2 - 0.4, split: 0.6, softness: 0.6, opacity: 0.78, drops: [{ pigment: C.soil, at: { x: 160, y: 330 }, size: 0.3, alpha: 0.4 }, { pigment: C.redDeep, at: { x: 560, y: 380 }, size: 0.2, alpha: 0.3 }], deform: 0.04, spread: 0.03, edge: 0.4, sharpness: 0.75, granulation: 0.45, granules: 0.2, flow: 0.5 });
  p.glaze(poly(CLIFF_STEP), C.mudLit, { rng, opacity: 0.5, edge: 0.2, blend: 'source-over', fade: { angle: Math.PI, start: 0.4, amount: 0.9 } });
  reserve(p, BLUFF_FLANK);
  p.wetInWet(poly(BLUFF_FLANK), mix(C.mudLit, C.redOchre, 0.2), mix(C.redOchre, C.mudLit, 0.4), { rng, angle: Math.PI, split: 0.5, softness: 0.7, opacity: 0.8, deform: 0.04, spread: 0.03, edge: 0.3, sharpness: 0.7, granulation: 0.4, granules: 0.1 });
  clipTo(p, BLUFF);
  // strata: broken ledges, darker under a lit lip
  for (let k = 0; k < 7; k++) {
    const y0 = 170 + k * 44 + rng.range(-10, 10);
    for (let x = -20; x < 900; ) {
      const len = rng.range(80, 240);
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.001; t += 0.25) pts.push({ x: x + len * t, y: y0 + Math.sin((x + len * t) / 120 + k) * 6 });
      p.dryBrush(pts, { rng, pigment: C.redDeep, width: rng.range(6, 11), opacity: 0.32, dryness: 0.6 });
      x += len + rng.range(30, 120);
    }
  }
  // gullies: cut from the rim, lost toward the foot
  for (let i = 0; i < 14; i++) {
    const x = 10 + i * 58 + rng.range(-15, 15);
    const y = (x < 240 ? 140 : 300) + rng.range(0, 16);
    const len = rng.range(140, 300);
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.2) pts.push({ x: x + Math.sin(t * 3 + i) * 10 + t * 10, y: y + t * len });
    p.stroke(pts, { rng, pigment: mix(C.redDeep, '#8c89a1', 0.2), width: rng.range(10, 18), taper: [0.02, 0.85], opacity: 0.4, wetness: 0.65, dryness: 0.25 });
    p.dryBrush(pts.map((q) => ({ x: q.x + 11, y: q.y })), { rng, pigment: C.mudLit, width: 5, opacity: 0.35, dryness: 0.6, blend: 'source-over' });
  }
  p.ctx.restore();
  // the talus at its foot: soft and grainy into the grove
  const foot: Pt[] = [{ x: -20, y: 420 }, { x: 400, y: 426 }, { x: 900, y: 450 }, { x: 940, y: 486 }, { x: 400, y: 470 }, { x: -20, y: 466 }];
  p.wash(foot, mix(C.redOchre, C.sand, 0.5), { rng, opacity: 0.5, edge: 0.1, granulation: 0.5, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.8 } });
}

/** A tower's top: tall stepped horns at the corners over a low parapet. */
function horns(x0: number, x1: number, top: number, k: number): Pt[] {
  const w = x1 - x0;
  const hw = w * 0.2;
  return [
    { x: x0 - 2 * k, y: top + 2 * k }, { x: x0 - 2 * k, y: top - 16 * k }, { x: x0 + hw * 0.5, y: top - 20 * k }, { x: x0 + hw, y: top - 14 * k }, { x: x0 + hw, y: top - 6 * k },
    { x: x0 + w * 0.42, y: top - 6 * k }, { x: x0 + w * 0.42, y: top - 10 * k }, { x: x0 + w * 0.58, y: top - 10 * k }, { x: x0 + w * 0.58, y: top - 6 * k },
    { x: x1 - hw, y: top - 6 * k }, { x: x1 - hw, y: top - 14 * k }, { x: x1 - hw * 0.5, y: top - 20 * k }, { x: x1 + 2 * k, y: top - 16 * k }, { x: x1 + 2 * k, y: top + 2 * k },
  ];
}

function crenels(x0: number, x1: number, top: number, size: number, ruin: Rng | null): Pt[] {
  const pts: Pt[] = [{ x: x0, y: top }];
  const n = Math.max(2, Math.round((x1 - x0) / (size * 2)));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step;
    const drop = ruin ? ruin.range(0, size * 3) : 0;
    pts.push({ x: a, y: top - size + drop }, { x: a + step * 0.55, y: top - size + drop }, { x: a + step * 0.55, y: top + (ruin ? drop * 0.6 : 0) }, { x: a + step, y: top + (ruin ? drop * 0.6 : 0) });
  }
  pts.push({ x: x1, y: top });
  return pts;
}

function paintBlock(p: Painter, b: Block, rng: Rng): void {
  const k = KSAR_DETAIL;
  const top = b.base - b.h;
  const taper = b.tower ? b.w * 0.07 : 0;
  const tl = b.x + taper;
  const tr = b.x + b.w - taper;
  const cren = b.tower ? horns(tl, tr, top, k) : crenels(tl, tr, top, 5 * k, b.ruined ? rng : null);
  const front: Pt[] = [...cren, { x: b.x + b.w, y: b.base }, { x: b.x, y: b.base }];
  reserve(p, front);
  // the lit flank first, so the front's edge sits over it
  if (b.side > 0) {
    const s = b.side;
    const flank: Pt[] = [{ x: tr, y: top }, { x: tr + s, y: top - s * 0.32 + taper * 0.3 }, { x: b.x + b.w + s, y: b.base - s * 0.32 }, { x: b.x + b.w, y: b.base }];
    reserve(p, flank);
    p.wash(flank, mix(C.mudLit, C.mud, 0.35), { rng, opacity: 0.75, deform: 0.04, spread: 0.03, edge: 0.3, sharpness: 0.85, granulation: 0.3 });
    p.dryBrush([{ x: tr + s * 0.5, y: top + 6 }, { x: tr + s * 0.5, y: b.base - 6 }], { rng, pigment: C.mud, width: s * 0.5, opacity: 0.25, dryness: 0.7 });
  }
  p.wetInWet(front, C.mud, C.mudShadow, { rng, angle: Math.PI / 2, split: 0.55, opacity: 0.78, deform: 0.03, spread: 0.02, edge: 0.4, sharpness: 0.85, granulation: 0.4, granules: 0.15 });
  // pisé lifts: faint horizontal formwork lines
  for (let y = top + 14 * k; y < b.base - 4; y += rng.range(9, 13) * k) {
    p.dryBrush([{ x: b.x + 3, y }, { x: b.x + b.w - 3, y: y + rng.range(-1, 1) }], { rng, pigment: C.mudShadow, width: 1.6 * k, opacity: 0.3, dryness: 0.6 });
  }
  // the light catches the crenel tops on the right
  for (let i = 1; i < cren.length - 1; i += 4) {
    const a = cren[i]!;
    const bb = cren[i + 1]!;
    p.stroke([{ x: a.x + 1, y: a.y + 1 }, { x: bb.x - 1, y: bb.y + 1 }], { rng, pigment: C.mudLit, width: 1.6 * k, opacity: 0.5, wetness: 0.2 });
  }
  // the Draa motif: a band of small dark chevrons near the top of a tower
  if (b.tower) {
    const y = top + 16 * k;
    for (let x = tl + 6 * k; x < tr - 6 * k; x += 8 * k) {
      p.stroke([{ x, y }, { x: x + 4 * k, y: y + 5 * k }, { x: x + 8 * k, y }], { rng, pigment: C.mudShadow, width: 1.4 * k, opacity: 0.55, wetness: 0.15, wobble: 0.15 });
    }
    p.dryBrush([{ x: tl + 2, y: y + 9 * k }, { x: tr - 2, y: y + 9 * k }], { rng, pigment: C.mudShadow, width: 1.5 * k, opacity: 0.35, dryness: 0.4 });
  }
  // windows: dark slits
  const rows = Math.floor(b.h / (30 * k));
  for (let r = 0; r < rows; r++) {
    const y = top + 30 * k + r * 28 * k;
    if (y > b.base - 12 * k) break;
    for (let x = b.x + 10 * k; x < b.x + b.w - 10 * k; x += rng.range(14, 22) * k) {
      if (rng.chance(0.4)) continue;
      p.wash([{ x, y }, { x: x + 3 * k, y }, { x: x + 3 * k, y: y + 8 * k }, { x, y: y + 8 * k }], mix(C.redDeep, '#3d2e2a', 0.4), { rng, layers: 3, opacity: 0.75, deform: 0.05, edge: 0.2 });
    }
  }
  // rain-washed streaks down the face
  for (let i = 0; i < Math.round(b.w / 18); i++) {
    const x = rng.range(b.x + 4, b.x + b.w - 4);
    p.dryBrush([{ x, y: top + rng.range(2, 10) }, { x: x + rng.range(-2, 2), y: top + rng.range(20, b.h * 0.8) }], { rng, pigment: C.mudShadow, width: rng.range(1.5, 3) * k, opacity: 0.3, dryness: 0.6 });
  }
}

export function paintKsar(p: Painter, rng: Rng): void {
  for (const [x, y, sz] of PALMS_BEHIND) palm(p, { x, y }, { x: x + 6, y: 280 }, sz, rng.fork(`behind-${x}`), 0.55);
  for (const b of KSAR) paintBlock(p, b, rng.fork(`block-${b.x}`));
  // the rock's top lip in front of the walls, so the ksar grows out of the bluff
  const lip: Pt[] = [{ x: 240, y: 286 }, { x: 500, y: 292 }, { x: 820, y: 296 }, { x: 830, y: 326 }, { x: 240, y: 322 }];
  p.wash(lip, C.redOchre, { rng, opacity: 0.7, deform: 0.2, spread: 0.15, edge: 0.15, granulation: 0.5, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.9 } });
  for (const b of KSAR.filter((k) => k.tower)) {
    p.glaze([{ x: b.x - 24, y: b.base - 60 }, { x: b.x, y: b.base - 60 }, { x: b.x, y: b.base }, { x: b.x - 44, y: b.base }], C.mudShadow, { rng, opacity: 0.3, edge: 0.1, fade: { angle: Math.PI, start: 0.4, amount: 1 } });
  }
}

// ── palms ─────────────────────────────────────────────────────────────────────────────────

/** A date palm: a leaning trunk from `base` to the crown at `top`, arching fronds. */
export function palm(p: Painter, top: Pt, base: Pt, size: number, rng: Rng, atmos = 0): void {
  const far = (c: Pigment) => mix(c, C.palmFar, atmos);
  const trunkW = 7 * size;
  const mid = { x: (top.x + base.x) / 2 + rng.range(-10, 10) * size, y: (top.y + base.y) / 2 };
  const trunk = smoothPath([base, mid, top], 6);
  p.stroke(trunk, { rng, pigment: far(C.trunk), width: trunkW, taper: [0, 0.05], opacity: 0.8, wetness: 0.35, dryness: 0.25, wobble: 0.2 });
  if (atmos < 0.5) {
    // leaf-base scars, a light side on the right
    for (let t = 0.1; t < 0.95; t += 0.09) {
      const q = trunk[Math.floor(t * (trunk.length - 1))]!;
      p.stroke([{ x: q.x - trunkW * 0.5, y: q.y + 1 }, { x: q.x + trunkW * 0.5, y: q.y - 1 }], { rng, pigment: far(shade(C.trunk, 0.3)), width: 1.3, opacity: 0.45, wetness: 0.1 });
    }
    p.dryBrush(trunk.map((q) => ({ x: q.x + trunkW * 0.3, y: q.y })), { rng, pigment: lighten(C.mudLit, 0.05), width: trunkW * 0.35, opacity: 0.35, dryness: 0.6, blend: 'source-over' });
  }
  // fronds: drooping lower ones in shade first, then the stiff upper ones catching the light
  const n = Math.round(rng.range(16, 20));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const lower = u < 0.35;
    const dip = rng.range(-0.3, 0.5);
    const a0 = lower ? (rng.chance(0.5) ? dip : Math.PI - dip) : -Math.PI - 0.25 + rng.range(0, Math.PI + 0.5);
    const side = Math.abs(Math.cos(a0));
    const len = size * rng.range(46, 64) * (lower ? 0.9 : 1);
    const droop = lower ? 0.9 : 0.15 + side * 0.5;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.125) pts.push({ x: top.x + Math.cos(a0) * len * t, y: top.y + Math.sin(a0) * len * t * 0.85 + droop * len * t * t * 0.55 });
    const lit = Math.cos(a0) > 0.1 && !lower;
    const pig = far(lower ? mix(C.palm, C.palmDark, 0.6) : lit ? C.palmLight : C.palm);
    p.stroke(pts, { rng, pigment: pig, width: size * 3, taper: [0.05, 0.75], opacity: 0.7, wetness: 0.3, dryness: 0.3, wobble: 0.2 });
    if (atmos >= 0.6) {
      p.stroke(pts.map((q) => ({ x: q.x, y: q.y + 3 * size })), { rng, pigment: pig, width: size * 6, taper: [0.1, 0.8], opacity: 0.35, wetness: 0.6, dryness: 0.5 });
      continue;
    }
    // leaflets: pinnae set in a V along the rachis, shorter toward the tip
    const dirAt = (t: number) => Math.atan2(Math.sin(a0) * 0.85 + droop * t * 1.1, Math.cos(a0));
    for (let t = 0.15; t < 0.97; t += 0.075) {
      const k = Math.round(t * (pts.length - 1));
      const q = { x: pts[k]!.x, y: pts[k]!.y };
      const dir = dirAt(t);
      for (const sgn of [-1, 1]) {
        p.dab(q, pig, { rng, variant: 'blade', angle: dir + sgn * 0.75 + 0.25, length: size * rng.range(9, 14) * (1.1 - t * 0.6), width: size * 1.8, opacity: 0.42, layers: 2, pool: 0.3 });
      }
    }
  }
  // the crown's dark heart and date clusters
  p.dab(top, far(C.palmDark), { rng, variant: 'round', length: size * 9, width: size * 8, opacity: 0.6 });
  if (atmos < 0.4) p.dab({ x: top.x + 4 * size, y: top.y + 10 * size }, far(mix(C.redOchre, '#e0a043', 0.4)), { rng, variant: 'round', length: size * 8, width: size * 6, opacity: 0.6, angle: Math.PI / 2 });
}

export function paintGrove(p: Painter, rng: Rng): void {
  for (let x = 900; x < 1640; x += rng.range(70, 120)) {
    p.wetInWet(blob(x, rng.range(462, 478), rng.range(70, 110), rng.range(30, 44), rng, { irregularity: 0.3, flatBottom: 0.6 }), C.palmFar, mix(C.palm, C.palmDark, 0.5), { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.5, deform: 0.3, spread: 0.2, edge: 0.2, granulation: 0.3 });
  }
  // a hazy far row, then a nearer one behind the basin
  const rows = [
    { step: [50, 80], y: [300, 330], s: [0.8, 1.0], far: 0.7 },
    { step: [90, 150], y: [250, 300], s: [1.3, 1.6], far: 0.3 },
  ];
  for (const [r, row] of rows.entries()) {
    for (let x = 900 + rng.range(0, 40); x < 1640; x += rng.range(row.step[0]!, row.step[1]!)) {
      const y = rng.range(row.y[0]!, row.y[1]!);
      const s = rng.range(row.s[0]!, row.s[1]!);
      palm(p, { x, y }, { x: x + rng.range(-14, 14), y: 466 + r * 10 }, s, rng.fork(`grove-${r}-${Math.round(x)}`), row.far);
    }
  }
}

export function paintBigPalms(p: Painter, rng: Rng): void {
  for (const b of BIG_PALMS) {
    p.glaze(blob(b.base.x + 40 * b.size, b.base.y + 4, 60 * b.size, 8 * b.size, rng), C.mudShadow, { rng, opacity: 0.3, edge: 0.05 });
    palm(p, b.top, b.base, b.size, rng.fork(`big-${b.base.x}`));
  }
}

// ── the terraces, the seguia and the basin ────────────────────────────────────────────────

export function paintGround(p: Painter, rng: Rng): void {
  const ground: Pt[] = [{ x: -20, y: 420 }, { x: 1620, y: 440 }, { x: 1620, y: 1020 }, { x: -20, y: 1020 }];
  p.wetInWet(ground, mix(C.soil, C.sand, 0.4), C.sand, { rng, angle: Math.PI / 2, split: 0.4, softness: 0.5, opacity: 0.6, edge: 0.05, granulation: 0.45, granules: 0.15, flow: 0.55, flowScale: 160 });
  // the terraces' tilled plots on the left, furrowed
  const plots = [[-20, 446, 300, 500], [-20, 532, 440, 594], [40, 660, 460, 770], [140, 820, 600, 960]] as const;
  for (const [x0, y0, x1, y1] of plots) {
    const pl: Pt[] = [{ x: x0, y: y0 }, { x: x1, y: y0 + rng.range(-4, 4) }, { x: x1 + 20, y: y1 }, { x: x0, y: y1 }];
    p.wash(pl, mix(C.soil, C.soilDamp, rng.range(0, 0.5)), { rng, opacity: 0.38, deform: 0.25, spread: 0.2, edge: 0.06, sharpness: 0.2, granulation: 0.55, granules: 0.1, fade: { angle: Math.PI, start: 0.6, amount: 0.7, ragged: 0.8 } });
    for (let yy = y0 + 12; yy < y1 - 8; yy += rng.range(12, 20) * (0.6 + (yy / 1000) * 0.8)) {
      p.dryBrush([{ x: x0 + 20, y: yy }, { x: x1 - rng.range(10, 60), y: yy + rng.range(-3, 3) }], { rng, pigment: C.soilDamp, width: 2 + yy / 400, opacity: 0.22, dryness: 0.7 });
    }
  }
  // the basin terrace: pale trodden sand round the basin, young barley under the palms
  p.glaze(blob(840, 760, 520, 120, rng, { irregularity: 0.2 }), C.sandLight, { rng, opacity: 0.4, edge: 0, granulation: 0.3 });
  p.glaze(blob(1400, 520, 240, 50, rng, { irregularity: 0.25 }), mix(C.palmLight, C.sand, 0.4), { rng, opacity: 0.35, edge: 0.05 });
}

function wallFace(edge: readonly Pt[], h: number): Pt[] {
  const top = resample(smoothPath(edge.map((q) => ({ x: q.x, y: q.y })), 8), 12);
  return [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + h }))];
}

function paintWall(p: Painter, edge: readonly Pt[], h: number, rng: Rng): void {
  const face = wallFace(edge, h);
  reserve(p, face);
  p.wetInWet(face, mix(C.mud, C.mudLit, 0.3), C.mudShadow, { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.7, deform: 0.04, spread: 0.03, edge: 0.15, sharpness: 0.6, granulation: 0.5 });
  const top = resample(smoothPath(edge.map((q) => ({ x: q.x, y: q.y })), 8), 12);
  // the lit coping and crumbling notches
  p.stroke(top.map((q) => ({ x: q.x, y: q.y + 1.5 })), { rng, pigment: C.mudLit, width: 3, opacity: 0.7, wetness: 0.2, dryness: 0.3, taper: [0.02, 0.02] });
  p.glaze(top.map((q) => ({ x: q.x, y: q.y })).concat(top.slice().reverse().map((q) => ({ x: q.x, y: q.y - 22 }))), C.sandLight, { rng, opacity: 0.35, edge: 0, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1 } });
  // the cast shadow at its foot
  p.glaze(top.map((q) => ({ x: q.x, y: q.y + h })).concat(top.slice().reverse().map((q) => ({ x: q.x + 6, y: q.y + h + 10 }))), mix(C.mudShadow, '#8c89a1', 0.4), { rng, opacity: 0.32, edge: 0.05, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
}

export function paintWalls(p: Painter, rng: Rng): void {
  for (const w of WALLS) paintWall(p, w.edge, w.h, rng.fork(`wall-${w.edge[0]!.y}`));
}

function channel(path: readonly Pt[], w: number): Pt[] {
  const s = smoothPath(path.map((q) => ({ x: q.x, y: q.y })), 4);
  return ribbon(s, () => w);
}

export function paintSeguia(p: Painter, rng: Rng): void {
  for (const [i, run] of SEGUIA_RUNS.entries()) {
    const s = smoothPath(run.map((q) => ({ x: q.x, y: q.y })), 4);
    const k = i === 2 ? 1.8 : 1;
    p.wash(channel(run, 14 * k), C.mud, { rng, opacity: 0.5, deform: 0.1, edge: 0.2, sharpness: 0.5, granulation: 0.4 });
    const bed = channel(run, 8 * k);
    reserve(p, bed);
    p.wetInWet(bed, C.waterLight, C.waterMid, { rng, angle: 0.6, split: 0.5, opacity: 0.8, edge: 0.35, sharpness: 0.85, deform: 0.02, spread: 0.02 });
    p.stroke(s.map((q) => ({ x: q.x + 3 * k, y: q.y - 9 * k })), { rng, pigment: C.mudLit, width: 4 * k, opacity: 0.7, wetness: 0.2 });
    p.stroke(s.map((q) => ({ x: q.x - 2 * k, y: q.y + 9 * k })), { rng, pigment: C.mudShadow, width: 3.5 * k, opacity: 0.5, wetness: 0.2 });
  }
  // the small falls over each wall: a pale sheet, streaks, foam at the foot
  for (const f of SEGUIA_FALLS) {
    const { x, y } = f.top;
    const sheet: Pt[] = [{ x: x - 8, y }, { x: x + 8, y }, { x: x + 10, y: y + f.drop }, { x: x - 10, y: y + f.drop }];
    reserve(p, sheet);
    p.wash(sheet, C.waterLight, { rng, opacity: 0.45, edge: 0.2, sharpness: 0.6, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.6 } });
    for (let i = -1; i <= 1; i++) p.stroke([{ x: x + i * 4, y: y + 2 }, { x: x + i * 5, y: y + f.drop - 2 }], { rng, pigment: C.waterMid, width: 1.6, opacity: 0.45, wetness: 0.3 });
    p.wash(blob(x, y + f.drop + 2, 16, 5, rng, { irregularity: 0.4 }), PAPER_WHITE, { rng, opacity: 0.85, blend: 'source-over', layers: 4, edge: 0 });
  }
  // the sluice to the oued
  const run = channel(SLUICE, 7);
  reserve(p, run);
  p.wash(run, C.waterMid, { rng, opacity: 0.6, edge: 0.3, sharpness: 0.7 });
}

export function paintBasin(p: Painter, rng: Rng): void {
  const o = poly(BASIN);
  const r = BASIN_RIM;
  const inner: Pt[] = [
    { x: o[0]!.x + r.side * 0.8, y: o[0]!.y + r.far }, { x: o[1]!.x - r.side * 0.8, y: o[1]!.y + r.far },
    { x: o[2]!.x - r.side * 1.3, y: o[2]!.y - r.near }, { x: o[3]!.x + r.side * 1.3, y: o[3]!.y - r.near },
  ];
  const nearFace: Pt[] = [o[3]!, o[2]!, { x: o[2]!.x - 3, y: o[2]!.y + r.face }, { x: o[3]!.x + 3, y: o[3]!.y + r.face }];
  reserve(p, [...o, ...nearFace.slice(2).reverse()]);
  p.wash(o, mix('#d9c3a0', C.mudLit, 0.3), { rng, opacity: 0.65, deform: 0.02, spread: 0.02, edge: 0.4, sharpness: 0.9, granulation: 0.55 });
  p.wash(nearFace, mix(C.mudShadow, '#8c89a1', 0.3), { rng, opacity: 0.7, edge: 0.3, sharpness: 0.9, granulation: 0.4 });
  // coping joints, wider apart toward the viewer
  for (let t = 0.04; t < 0.98; t += rng.range(0.05, 0.08)) {
    const xn = o[3]!.x + (o[2]!.x - o[3]!.x) * t;
    p.stroke([{ x: xn, y: o[3]!.y + 2 }, { x: xn - 1, y: o[3]!.y + r.face - 2 }], { rng, pigment: C.mudShadow, width: 2, opacity: 0.5, wetness: 0.1 });
    const xf = o[0]!.x + (o[1]!.x - o[0]!.x) * t;
    p.stroke([{ x: xf, y: o[0]!.y + 1 }, { x: xf, y: o[0]!.y + r.far - 1 }], { rng, pigment: C.mudShadow, width: 1.2, opacity: 0.4, wetness: 0.1 });
  }
  reserve(p, inner);
  p.waterBody(inner, { rng, pigments: [C.waterLight, C.waterMid, C.waterDeep], bands: 4, ripples: 2, reflection: 0.5, farShadow: 0.8, granulation: 0.3 });
  clipTo(p, inner);
  // reflections: the red bluff and ksar on the left, the palms' dark crowns on the right
  p.glaze([{ x: 500, y: 488 }, { x: 900, y: 488 }, { x: 880, y: 560 }, { x: 760, y: 600 }, { x: 500, y: 610 }], C.redOchre, { rng, opacity: 0.32, deform: 0.2, fade: { angle: Math.PI / 2, start: 0.4, amount: 1, ragged: 0.9 } });
  for (const [x, w] of [[540, 70], [640, 80], [780, 60]] as const) {
    p.glaze(blob(x + w / 2, 520, w * 0.45, 34, rng, { irregularity: 0.3 }), C.mudShadow, { rng, opacity: 0.16, deform: 0.4, edge: 0.05, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.9 } });
  }
  p.glaze(blob(1080, 500, 90, 26, rng), mix(C.palmDark, C.waterDeep, 0.5), { rng, opacity: 0.35, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
  for (let i = 0; i < 9; i++) {
    const y = 560 + i * 7;
    p.lift({ cx: rng.range(620, 1080), cy: y, rx: rng.range(30, 90), ry: 1.4 }, { rng, amount: 0.4, layers: 4 });
  }
  p.ctx.restore();
}

// ── the oued ──────────────────────────────────────────────────────────────────────────────

export function paintOued(p: Painter, rng: Rng): void {
  const water = poly(OUED);
  p.wash(water.map((q) => ({ x: q.x + (q.x < 1450 ? -12 : 12), y: q.y })), mix(C.sandShadow, C.soilDamp, 0.4), { rng, opacity: 0.35, deform: 0.08, edge: 0.1, granulation: 0.4 });
  reserve(p, water);
  p.waterBody(water, { rng, pigments: [C.waterLight, C.waterMid, C.waterDeep], bands: 5, ripples: 2, reflection: 0.45, farShadow: 0.6, granulation: 0.35 });
  const bar = blob(BAR.cx, BAR.cy, BAR.rx, BAR.ry, rng, { irregularity: 0.25 });
  reserve(p, bar);
  p.wash(bar, C.sandLight, { rng, opacity: 0.7, edge: 0.1, sharpness: 0.3, granulation: 0.5 });
  p.glaze(blob(BAR.cx - 10, BAR.cy + 10, BAR.rx * 0.6, BAR.ry * 0.8, rng), C.sandShadow, { rng, opacity: 0.3 });
}

/** Reeds and a few stones at the water's edge, sparing (the plants come later). */
export function paintEdges(p: Painter, rng: Rng): void {
  for (const [x, y] of [[1330, 690], [1540, 724], [1280, 900]] as const) {
    for (let i = 0; i < 10; i++) {
      p.dab({ x: x + rng.range(-16, 16), y }, mix(C.palm, C.sand, 0.3), { rng, variant: 'blade', angle: -Math.PI / 2 + rng.range(-0.4, 0.4), length: rng.range(30, 56), width: 5, opacity: 0.6, layers: 2 });
    }
  }
  for (const [x, y, w] of [[460, 652, 40], [1230, 660, 34], [640, 980, 60], [1150, 1000, 50], [40, 990, 70]] as const) {
    p.stone({ x, y, w, h: w * 0.55 }, { rng, pigment: mix('#c9ae8a', C.mudLit, 0.3), warm: 0.6, moss: 0, ink: 0.15 });
  }
}

export function paintMargin(p: Painter, rng: Rng): void {
  const m = paintMargins(p, rng);
  while (!m.next().done);
}

/** The steps back to front; `only` limits them by name. */
export interface DraftStep {
  name: string;
  run(p: Painter, rng: Rng): void;
}
export const STEPS: readonly DraftStep[] = [
  { name: 'sky', run: paintSky },
  { name: 'ranges', run: paintRanges },
  { name: 'dunes', run: paintDunes },
  { name: 'ground', run: paintGround },
  { name: 'grove', run: paintGrove },
  { name: 'bluff', run: paintBluff },
  { name: 'ksar', run: paintKsar },
  { name: 'walls', run: paintWalls },
  { name: 'basin', run: paintBasin },
  { name: 'seguia', run: paintSeguia },
  { name: 'oued', run: paintOued },
  { name: 'big-palms', run: paintBigPalms },
  { name: 'edges', run: paintEdges },
  { name: 'margins', run: paintMargin },
];

/** Paint the draft with `p` (its transform set to world units), seeded by `seed`. */
export function paintDraftA(p: Painter, seed: number, only?: readonly string[]): void {
  const root = createRng(seed);
  for (const s of STEPS) {
    const rng = root.fork(s.name);
    if (only && !only.includes(s.name)) continue;
    s.run(p, rng);
  }
}
