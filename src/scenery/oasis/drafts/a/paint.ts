/**
 * Oasis draft A, "Ksar & palmeraie": the backdrop's paint steps, back to front, on white
 * (the paper is multiplied last). Light comes from the upper right.
 */
import { createRng, type Rng } from '../../../../core/rng';
import { PAPER_WHITE, blob, bounds, lighten, mix, resample, rgba, ribbon, shade, smoothPath, type Painter, type Pigment } from '../../../../paint';
import type { Pt } from '../../../../render/viewport';
import { paintMargins } from '../../../../scene/paint-land';
import {
  BARS,
  BASIN,
  BASIN_RIM,
  BLUFF,
  BLUFF_FLANK,
  CROSS_WALLS,
  DUNE_BASE,
  DUNE_CRESTS,
  FAR_RANGE,
  GROVE,
  KSAR,
  NEAR_RANGE,
  OUED,
  OVERFLOW,
  PALMS_BEHIND,
  SEGUIA,
  TERRACE_PALMS,
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
  palm: '#808c52',
  palmDark: '#56613c',
  palmLight: '#aab36e',
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
  const sky: Pt[] = [{ x: -20, y: -20 }, { x: 1620, y: -20 }, { x: 1620, y: 380 }, { x: -20, y: 380 }];
  p.wetInWet(sky, C.skyTop, C.skyLow, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.6, opacity: 0.32, edge: 0, granulation: 0.05, flow: 0.5, flowScale: 200 });
  p.glaze(blob(1380, 250, 300, 80, rng, { irregularity: 0.3 }), C.skyLow, { rng, opacity: 0.18, edge: 0, sharpness: 0.05 });
}

export function paintRanges(p: Painter, rng: Rng): void {
  p.wetInWet(belowLine(FAR_RANGE, 380), lighten(C.lilac, 0.04), C.lilac, { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.5, deform: 0.04, spread: 0.03, edge: 0.25, sharpness: 0.7, granulation: 0.3, fade: { angle: Math.PI / 2, start: 0.35, amount: 0.8 } });
  // flat tops catch light: a pale band lifted under each mesa's rim
  for (let i = 1; i < FAR_RANGE.length; i++) {
    const a = FAR_RANGE[i - 1]!;
    const b = FAR_RANGE[i]!;
    if (Math.abs(a.y - b.y) > 4 || b.x - a.x < 60) continue;
    p.glaze([{ x: a.x + 8, y: a.y + 6 }, { x: b.x - 6, y: b.y + 6 }, { x: b.x - 10, y: b.y + 14 }, { x: a.x + 12, y: a.y + 16 }], C.lilacDeep, { rng, opacity: 0.22, edge: 0.1 });
  }
  p.wetInWet(belowLine(NEAR_RANGE, 400), C.roseRange, mix(C.roseRange, C.lilacDeep, 0.4), { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.5, deform: 0.04, spread: 0.03, edge: 0.3, sharpness: 0.7, granulation: 0.4 });
  // the escarpments' shadowed steps: vertical fluting on the left (shade) side of each rise
  for (let i = 1; i < NEAR_RANGE.length; i++) {
    const a = NEAR_RANGE[i - 1]!;
    const b = NEAR_RANGE[i]!;
    if (b.y < a.y - 6) p.glaze([{ x: a.x - 6, y: a.y }, { x: b.x, y: b.y }, { x: b.x + 4, y: b.y + 40 }, { x: a.x - 10, y: a.y + 40 }], C.lilacDeep, { rng, opacity: 0.3, fade: { angle: Math.PI / 2, start: 0.2, amount: 1 } });
  }
}

export function paintDunes(p: Painter, rng: Rng): void {
  const crest = smoothPath(DUNE_CRESTS.map((q) => ({ x: q.x, y: q.y })), 8);
  const body = belowLine(crest, DUNE_BASE);
  reserve(p, body);
  p.wetInWet(body, C.sandLight, C.sand, { rng, angle: Math.PI / 2, split: 0.35, opacity: 0.75, deform: 0.05, spread: 0.04, edge: 0.35, sharpness: 0.75, granulation: 0.35, granules: 0.15 });
  // slip faces: shadow on the west side of each crest, a sharp crest line and a soft foot
  for (let i = 1; i < DUNE_CRESTS.length - 1; i++) {
    const c = DUNE_CRESTS[i]!;
    const prev = DUNE_CRESTS[i - 1]!;
    const w = (c.x - prev.x) * 0.55;
    const face: Pt[] = [
      { x: c.x, y: c.y + 1 },
      { x: c.x - w * 0.35, y: c.y + 26 },
      { x: c.x - w, y: c.y + 62 },
      { x: c.x - w * 0.2, y: c.y + 70 },
      { x: c.x + 18, y: c.y + 40 },
    ];
    p.wash(face, C.sandShadow, { rng, opacity: 0.42, deform: 0.12, spread: 0.08, edge: 0.4, sharpness: 0.8, granulation: 0.4, fade: { angle: Math.PI / 2 + 0.6, start: 0.3, amount: 0.9 } });
  }
  // ripples on the lit faces
  for (let i = 0; i < 22; i++) {
    const x = rng.range(600, 1600);
    const y = yAt(crest, x) + rng.range(18, 60);
    if (y > DUNE_BASE - 10) continue;
    p.stroke([{ x: x - 30, y: y + 3 }, { x, y }, { x: x + 34, y: y + 4 }], { rng, pigment: C.sandShadow, width: 1.6, opacity: 0.35, wetness: 0.3, wobble: 0.3 });
  }
}

// ── the bluff and the ksar ────────────────────────────────────────────────────────────────

export function paintBluff(p: Painter, rng: Rng): void {
  reserve(p, BLUFF);
  p.wetInWet(BLUFF, C.redOchre, C.redDeep, { rng, angle: Math.PI / 2 - 0.4, split: 0.6, softness: 0.5, opacity: 0.8, deform: 0.04, spread: 0.03, edge: 0.4, sharpness: 0.75, granulation: 0.45, granules: 0.2, flow: 0.5 });
  p.wash(poly(BLUFF_FLANK), C.mudLit, { rng, opacity: 0.55, deform: 0.05, spread: 0.04, edge: 0.15, sharpness: 0.6, blend: 'source-over', fade: { angle: Math.PI, start: 0.5, amount: 0.9 } });
  p.glaze(poly(BLUFF_FLANK), C.redOchre, { rng, opacity: 0.25, edge: 0.2 });
  clipTo(p, BLUFF);
  // strata: wavy ledges, a lit lip over a dark band
  for (let k = 0; k < 7; k++) {
    const y0 = 290 + k * 30 + rng.range(-6, 6);
    const pts: Pt[] = [];
    for (let x = -20; x <= 720; x += 40) pts.push({ x, y: y0 + Math.sin(x / 90 + k) * 5 + (x > 560 ? (x - 560) * 0.35 : 0) });
    p.dryBrush(pts, { rng, pigment: C.redDeep, width: rng.range(5, 9), opacity: 0.4, dryness: 0.55 });
  }
  // gullies down the face
  for (let i = 0; i < 16; i++) {
    const x = rng.range(10, 560);
    const y = rng.range(262, 300);
    const len = rng.range(80, 200);
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.2) pts.push({ x: x + Math.sin(t * 3 + i) * 6 + t * 10, y: y + t * len });
    p.stroke(pts, { rng, pigment: shade(C.redDeep, 0.15), width: rng.range(4, 10), taper: [0.1, 0.6], opacity: 0.45, wetness: 0.6, dryness: 0.3 });
  }
  p.ctx.restore();
  // the talus at its foot: soft and grainy into the grove
  const foot: Pt[] = [{ x: -20, y: 470 }, { x: 300, y: 470 }, { x: 600, y: 462 }, { x: 720, y: 470 }, { x: 700, y: 500 }, { x: 300, y: 512 }, { x: -20, y: 516 }];
  p.wash(foot, mix(C.redOchre, C.sand, 0.5), { rng, opacity: 0.5, edge: 0.1, granulation: 0.5, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.8 } });
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
  const top = b.base - b.h;
  const taper = b.tower ? b.w * 0.07 : 0;
  const tl = b.x + taper;
  const tr = b.x + b.w - taper;
  const cren = crenels(tl, tr, top, b.tower ? 7 : 5, b.ruined ? rng : null);
  const front: Pt[] = [...cren, { x: b.x + b.w, y: b.base }, { x: b.x, y: b.base }];
  reserve(p, front);
  // the lit flank first, so the front's edge sits over it
  if (b.side > 0) {
    const s = b.side;
    const flank: Pt[] = [{ x: tr, y: top }, { x: tr + s, y: top - s * 0.32 + taper * 0.3 }, { x: b.x + b.w + s, y: b.base - s * 0.32 }, { x: b.x + b.w, y: b.base }];
    reserve(p, flank);
    p.wash(flank, C.mudLit, { rng, opacity: 0.7, deform: 0.04, spread: 0.03, edge: 0.3, sharpness: 0.85, granulation: 0.3 });
    p.dryBrush([{ x: tr + s * 0.5, y: top + 6 }, { x: tr + s * 0.5, y: b.base - 6 }], { rng, pigment: C.mud, width: s * 0.5, opacity: 0.25, dryness: 0.7 });
  }
  p.wetInWet(front, C.mud, C.mudShadow, { rng, angle: Math.PI / 2, split: 0.55, opacity: 0.78, deform: 0.03, spread: 0.02, edge: 0.4, sharpness: 0.85, granulation: 0.4, granules: 0.15 });
  // pisé lifts: faint horizontal formwork lines
  for (let y = top + 14; y < b.base - 4; y += rng.range(9, 13)) {
    p.dryBrush([{ x: b.x + 3, y }, { x: b.x + b.w - 3, y: y + rng.range(-1, 1) }], { rng, pigment: C.mudShadow, width: 1.6, opacity: 0.3, dryness: 0.6 });
  }
  // the light catches the crenel tops on the right
  for (let i = 1; i < cren.length - 1; i += 4) {
    const a = cren[i]!;
    const bb = cren[i + 1]!;
    p.stroke([{ x: a.x + 1, y: a.y + 1 }, { x: bb.x - 1, y: bb.y + 1 }], { rng, pigment: C.mudLit, width: 1.6, opacity: 0.5, wetness: 0.2 });
  }
  // the Draa motif: a band of small dark chevrons near the top of a tower
  if (b.tower) {
    const y = top + 16;
    for (let x = tl + 6; x < tr - 6; x += 8) {
      p.stroke([{ x, y }, { x: x + 4, y: y + 5 }, { x: x + 8, y }], { rng, pigment: C.mudShadow, width: 1.4, opacity: 0.55, wetness: 0.15, wobble: 0.15 });
    }
    p.dryBrush([{ x: tl + 2, y: y + 9 }, { x: tr - 2, y: y + 9 }], { rng, pigment: C.mudShadow, width: 1.5, opacity: 0.35, dryness: 0.4 });
  }
  // windows: dark slits
  const rows = Math.floor(b.h / 30);
  for (let r = 0; r < rows; r++) {
    const y = top + 30 + r * 28;
    if (y > b.base - 12) break;
    for (let x = b.x + 10; x < b.x + b.w - 10; x += rng.range(14, 22)) {
      if (rng.chance(0.4)) continue;
      p.wash([{ x, y }, { x: x + 3, y }, { x: x + 3, y: y + 8 }, { x, y: y + 8 }], mix(C.redDeep, '#3d2e2a', 0.4), { rng, layers: 3, opacity: 0.75, deform: 0.05, edge: 0.2 });
    }
  }
  // rain-washed streaks down the face
  for (let i = 0; i < Math.round(b.w / 18); i++) {
    const x = rng.range(b.x + 4, b.x + b.w - 4);
    p.dryBrush([{ x, y: top + rng.range(2, 10) }, { x: x + rng.range(-2, 2), y: top + rng.range(20, b.h * 0.8) }], { rng, pigment: C.mudShadow, width: rng.range(1.5, 3), opacity: 0.3, dryness: 0.6 });
  }
}

export function paintKsar(p: Painter, rng: Rng): void {
  for (const [x, y, s] of PALMS_BEHIND) palm(p, { x, y }, { x: x + 4, y: 262 }, s, rng.fork(`behind-${x}`), 0.65);
  for (const b of KSAR) paintBlock(p, b, rng.fork(`block-${b.x}`));
  // the block shadows: each tower's cast shade on the wall to its left
  for (const b of KSAR.filter((k) => k.tower)) {
    p.glaze([{ x: b.x - 14, y: b.base - 34 }, { x: b.x, y: b.base - 34 }, { x: b.x, y: b.base }, { x: b.x - 26, y: b.base }], C.mudShadow, { rng, opacity: 0.3, edge: 0.1, fade: { angle: Math.PI, start: 0.4, amount: 1 } });
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
  // fronds: dark under-fronds first, then the lit upper ones
  const n = Math.round(rng.range(11, 15));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.9 + rng.range(-0.12, 0.12);
      const len = size * rng.range(48, 70) * (1 - Math.abs(Math.cos(a0)) * 0.1);
      const droop = (0.6 + Math.abs(Math.cos(a0)) * 0.9) * (pass ? 0.8 : 1.15);
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.001; t += 0.125) pts.push({ x: top.x + Math.cos(a0) * len * t, y: top.y + Math.sin(a0) * len * t * 0.8 + droop * len * t * t * 0.7 });
      const lit = Math.cos(a0) > 0.2;
      const pig = pass === 0 ? far(C.palmDark) : far(lit ? C.palmLight : C.palm);
      p.stroke(pts, { rng, pigment: pig, width: size * (pass ? 4.5 : 5.5), taper: [0.05, 0.7], opacity: pass ? 0.75 : 0.65, wetness: 0.35, dryness: 0.45, wobble: 0.25 });
      if (atmos >= 0.6) continue;
      // leaflets hanging from the rachis
      for (let t = 0.2; t < 0.95; t += 0.14) {
        const q = pts[Math.round(t * (pts.length - 1))]!;
        const dir = Math.atan2(Math.sin(a0) + droop * t * 1.4, Math.cos(a0));
        for (const side of [-1, 1]) {
          p.dab(q, pig, { rng, variant: 'blade', angle: dir + side * 0.9 + 0.35, length: size * rng.range(10, 16) * (1 - t * 0.4), width: size * 2.2, opacity: 0.55, layers: 2 });
        }
      }
    }
  }
  // the crown's dark heart and date clusters
  p.dab(top, far(C.palmDark), { rng, variant: 'round', length: size * 12, width: size * 10, opacity: 0.7 });
  if (atmos < 0.4) p.dab({ x: top.x + 4 * size, y: top.y + 10 * size }, far(mix(C.redOchre, '#e0a043', 0.4)), { rng, variant: 'round', length: size * 8, width: size * 6, opacity: 0.6, angle: Math.PI / 2 });
}

export function paintGrove(p: Painter, rng: Rng): void {
  // understory haze: a dusty green mass under the crowns so the grove reads as a whole
  const under: Pt[] = [{ x: 640, y: 440 }, { x: 900, y: 420 }, { x: 1200, y: 424 }, { x: 1620, y: 416 }, { x: 1620, y: 520 }, { x: 640, y: 524 }];
  p.wetInWet(under, C.palmFar, mix(C.palm, C.palmDark, 0.5), { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.5, deform: 0.3, spread: 0.2, edge: 0.15, granulation: 0.3, fade: { angle: -Math.PI / 2, start: 0.55, amount: 0.9, ragged: 0.9 } });
  for (const [x, y, s] of GROVE) {
    const far = s < 0.65 ? 0.7 : 0.35;
    palm(p, { x, y }, { x: x + rng.range(-8, 8), y: y + 90 * s + 20 }, s, rng.fork(`grove-${x}-${y}`), far);
  }
}

export function paintTerracePalms(p: Painter, rng: Rng): void {
  for (const [x, y, s] of TERRACE_PALMS) {
    const base = { x: x + rng.range(-24, 24), y: y + 120 * s };
    palm(p, { x, y }, base, s, rng.fork(`terrace-${x}`));
    p.glaze(blob(base.x + 16, base.y + 2, 30 * s, 5 * s, rng), C.mudShadow, { rng, opacity: 0.35, edge: 0.05 });
  }
}

// ── the terraces, the seguia and the basin ────────────────────────────────────────────────

export function paintGround(p: Painter, rng: Rng): void {
  const ground: Pt[] = [{ x: -20, y: 470 }, { x: 1620, y: 440 }, { x: 1620, y: 1020 }, { x: -20, y: 1020 }];
  p.wetInWet(ground, C.soil, C.sand, { rng, angle: Math.PI / 2, split: 0.35, softness: 0.5, opacity: 0.45, edge: 0.05, granulation: 0.45, granules: 0.15, flow: 0.55, flowScale: 120 });
  // the tilled plots on the upper terrace: darker, damp earth with furrows
  const plots: Pt[][] = [
    [{ x: 120, y: 560 }, { x: 560, y: 548 }, { x: 660, y: 600 }, { x: 640, y: 668 }, { x: 140, y: 650 }],
    [{ x: 930, y: 540 }, { x: 1600, y: 536 }, { x: 1600, y: 658 }, { x: 940, y: 676 }],
  ];
  for (const pl of plots) {
    p.wash(pl, C.soil, { rng, opacity: 0.35, deform: 0.2, spread: 0.15, edge: 0.1, granulation: 0.5, fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.6 } });
    const b = bounds(pl);
    for (let y = b.y + 14; y < b.y + b.h - 8; y += rng.range(11, 16)) {
      p.dryBrush([{ x: b.x + rng.range(10, 60), y }, { x: b.x + b.w - rng.range(10, 60), y: y + rng.range(-2, 2) }], { rng, pigment: C.soilDamp, width: 2, opacity: 0.25, dryness: 0.7 });
    }
  }
  // sunlit sand on the lower terrace and the near banks
  const sandy: Pt[][] = [
    [{ x: -20, y: 690 }, { x: 600, y: 700 }, { x: 900, y: 716 }, { x: 1620, y: 690 }, { x: 1620, y: 790 }, { x: -20, y: 830 }],
    [{ x: -20, y: 900 }, { x: 640, y: 880 }, { x: 1620, y: 870 }, { x: 1620, y: 1020 }, { x: -20, y: 1020 }],
  ];
  for (const s of sandy) p.wash(s, C.sandLight, { rng, opacity: 0.4, deform: 0.2, spread: 0.2, edge: 0.05, granulation: 0.4 });
}

function wallFace(edge: readonly Pt[], h: number): Pt[] {
  const top = resample(smoothPath(edge.map((q) => ({ x: q.x, y: q.y })), 8), 12);
  return [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + h }))];
}

function paintWall(p: Painter, edge: readonly Pt[], h: number, rng: Rng): void {
  const face = wallFace(edge, h);
  reserve(p, face);
  p.wetInWet(face, C.mud, C.mudShadow, { rng, angle: Math.PI / 2, split: 0.3, opacity: 0.75, deform: 0.03, spread: 0.02, edge: 0.35, sharpness: 0.8, granulation: 0.45 });
  const top = resample(smoothPath(edge.map((q) => ({ x: q.x, y: q.y })), 8), 12);
  // the lit coping and crumbling notches
  p.stroke(top.map((q) => ({ x: q.x, y: q.y + 1.5 })), { rng, pigment: C.mudLit, width: 3.5, opacity: 0.6, wetness: 0.2, dryness: 0.3, taper: [0.02, 0.02] });
  for (let i = 0; i < top.length / 6; i++) {
    const q = top[rng.int(0, top.length - 1)]!;
    p.wash(blob(q.x, q.y + 3, rng.range(5, 12), rng.range(2, 4), rng), PAPER_WHITE, { rng, opacity: 0.9, blend: 'source-over', layers: 3, edge: 0 });
  }
  // the cast shadow at its foot
  p.glaze(top.map((q) => ({ x: q.x, y: q.y + h })).concat(top.slice().reverse().map((q) => ({ x: q.x + 6, y: q.y + h + 10 }))), mix(C.mudShadow, '#8c89a1', 0.4), { rng, opacity: 0.32, edge: 0.05, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
}

export function paintWalls(p: Painter, rng: Rng): void {
  for (const w of WALLS) paintWall(p, w.edge, w.h, rng.fork(`wall-${w.edge[0]!.y}`));
  for (const [a, b] of CROSS_WALLS) {
    const side: Pt[] = [a, b, { x: b.x + 10, y: b.y + 4 }, { x: a.x + 8, y: a.y + 4 }];
    p.wash(side, C.mud, { rng, opacity: 0.6, edge: 0.3, granulation: 0.4 });
    p.stroke([a, b], { rng, pigment: C.mudLit, width: 3, opacity: 0.5, wetness: 0.2 });
  }
}

function channel(path: readonly Pt[], w: number): Pt[] {
  const s = smoothPath(path.map((q) => ({ x: q.x, y: q.y })), 4);
  return ribbon(s, () => w);
}

export function paintSeguia(p: Painter, rng: Rng): void {
  const bed = channel(SEGUIA, 7);
  reserve(p, bed);
  p.wash(channel(SEGUIA, 9), C.mudShadow, { rng, opacity: 0.55, edge: 0.4, sharpness: 0.8, granulation: 0.3 });
  p.wetInWet(bed, C.waterLight, C.waterMid, { rng, angle: 0.4, split: 0.5, opacity: 0.8, edge: 0.35, sharpness: 0.85, deform: 0.02, spread: 0.02 });
  const s = smoothPath(SEGUIA.map((q) => ({ x: q.x, y: q.y })), 4);
  p.stroke(s.map((q) => ({ x: q.x + 1, y: q.y - 2 })), { rng, pigment: lighten(C.waterLight, 0.2), width: 1.4, opacity: 0.6, wetness: 0.1, blend: 'source-over' });
  // the overflow runnel to the oued
  const run = channel(OVERFLOW, 4);
  reserve(p, run);
  p.wash(run, C.waterMid, { rng, opacity: 0.6, edge: 0.3, sharpness: 0.7 });
}

export function paintBasin(p: Painter, rng: Rng): void {
  const outer = poly(BASIN);
  const r = BASIN_RIM;
  const inner: Pt[] = [{ x: outer[0]!.x + r * 1.2, y: outer[0]!.y + r * 0.6 }, { x: outer[1]!.x - r * 1.2, y: outer[1]!.y + r * 0.6 }, { x: outer[2]!.x - r * 1.6, y: outer[2]!.y - r * 0.9 }, { x: outer[3]!.x + r * 1.6, y: outer[3]!.y - r * 0.9 }];
  reserve(p, outer);
  // the stone coping: warm limestone, its near face in shade
  p.wash(outer, mix('#d9c3a0', C.mudLit, 0.3), { rng, opacity: 0.65, deform: 0.02, spread: 0.02, edge: 0.4, sharpness: 0.9, granulation: 0.5 });
  const nearFace: Pt[] = [outer[3]!, outer[2]!, { x: outer[2]!.x - 2, y: outer[2]!.y + 9 }, { x: outer[3]!.x + 2, y: outer[3]!.y + 9 }];
  p.wash(nearFace, mix(C.mudShadow, '#8c89a1', 0.3), { rng, opacity: 0.7, edge: 0.3, sharpness: 0.9 });
  // coping joints
  for (let x = outer[3]!.x + 22; x < outer[2]!.x - 10; x += rng.range(22, 32)) {
    p.stroke([{ x, y: 650 }, { x: x - 1, y: 659 }], { rng, pigment: C.mudShadow, width: 1.2, opacity: 0.5, wetness: 0.1 });
  }
  reserve(p, inner);
  p.waterBody(inner, { rng, pigments: [C.waterLight, C.waterMid, C.waterDeep], bands: 3, ripples: 1, reflection: 0.5, farShadow: 0.8, granulation: 0.3 });
  // the far rim's dark reflection and the sky glint
  p.glaze([{ x: inner[0]!.x, y: inner[0]!.y }, { x: inner[1]!.x, y: inner[1]!.y }, { x: inner[1]!.x - 2, y: inner[1]!.y + 10 }, { x: inner[0]!.x + 2, y: inner[0]!.y + 10 }], C.waterDeep, { rng, opacity: 0.4, fade: { angle: Math.PI / 2, start: 0.2, amount: 1 } });
  for (let i = 0; i < 4; i++) {
    const y = 618 + i * 7;
    p.lift({ cx: 800 + rng.range(-40, 40), cy: y, rx: rng.range(20, 50), ry: 1.2 }, { rng, amount: 0.4, layers: 4 });
  }
  // the spout where the seguia enters
  p.wash(blob(694, 606, 7, 4, rng), C.waterLight, { rng, opacity: 0.6, edge: 0.2 });
}

// ── the oued ──────────────────────────────────────────────────────────────────────────────

export function paintOued(p: Painter, rng: Rng): void {
  const water = poly(OUED);
  // the wet sand margin first: a darker band hugging the water
  p.wash(water.map((q) => ({ x: q.x, y: q.y + (q.y < 870 && q.x > 0 && q.x < 1600 ? -8 : 8) })), mix(C.sandShadow, C.soilDamp, 0.4), { rng, opacity: 0.35, deform: 0.08, edge: 0.1, granulation: 0.4 });
  reserve(p, water);
  p.waterBody(water, { rng, pigments: [C.waterLight, C.waterMid, C.waterDeep], bands: 5, ripples: 3, reflection: 0.45, farShadow: 0.65, granulation: 0.35 });
  // warm shallows on the inside of the bend and the sand bars
  p.glaze([{ x: 380, y: 880 }, { x: 640, y: 862 }, { x: 860, y: 856 }, { x: 860, y: 868 }, { x: 640, y: 884 }, { x: 420, y: 912 }], C.sand, { rng, opacity: 0.4, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1 } });
  for (const b of BARS) {
    const bar = blob(b.cx, b.cy, b.rx, b.ry, rng, { irregularity: 0.25, flatBottom: 0.3 });
    reserve(p, bar);
    p.wash(bar, C.sandLight, { rng, opacity: 0.7, edge: 0.3, granulation: 0.5 });
    p.glaze(blob(b.cx, b.cy + b.ry * 0.6, b.rx * 0.9, b.ry * 0.5, rng), C.sandShadow, { rng, opacity: 0.35 });
  }
  // the bluff's warm reflection on the far left water, and the sky's pale band
  p.glaze([{ x: -20, y: 846 }, { x: 300, y: 808 }, { x: 420, y: 830 }, { x: 120, y: 880 }, { x: -20, y: 900 }], C.redOchre, { rng, opacity: 0.18, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
  for (let i = 0; i < 10; i++) {
    const x = rng.range(200, 1500);
    const y = yAt(OUED.slice(0, 9), x) + rng.range(16, 60);
    p.lift({ cx: x, cy: y, rx: rng.range(30, 90), ry: rng.range(0.8, 1.6) }, { rng, amount: rng.range(0.25, 0.4), layers: 4 });
  }
}

/** Reeds and a few stones at the water's edge, sparing (the plants come later). */
export function paintEdges(p: Painter, rng: Rng): void {
  for (const [x, y] of [[90, 836], [1480, 806], [1560, 800], [300, 812]] as const) {
    for (let i = 0; i < 9; i++) {
      p.dab({ x: x + rng.range(-12, 12), y }, mix(C.palm, C.sand, 0.3), { rng, variant: 'blade', angle: -Math.PI / 2 + rng.range(-0.4, 0.4), length: rng.range(18, 34), width: 3, opacity: 0.6, layers: 2 });
    }
  }
  for (const [x, y, w] of [[470, 704, 22], [1100, 702, 18], [640, 900, 26], [1360, 890, 20]] as const) {
    p.stone({ x, y, w, h: w * 0.6 }, { rng, pigment: mix('#c9ae8a', C.mudLit, 0.3), warm: 0.6, moss: 0, ink: 0.15 });
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
  { name: 'seguia', run: paintSeguia },
  { name: 'basin', run: paintBasin },
  { name: 'terrace-palms', run: paintTerracePalms },
  { name: 'oued', run: paintOued },
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
