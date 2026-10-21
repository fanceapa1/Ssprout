/**
 * The land: sky, distant hills, grassy banks, the stepping-stone path, background grass tufts
 * and the unpainted-paper margins. Every function paints in world units on a painter whose
 * transform maps world → bitmap. Painted on white; the renderer multiplies the paper last.
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, createSimplex2D, insetPolygon, lighten, mix, smoothPath, type Painter, type Pigment } from '../paint';
import { WORLD_H, WORLD_W, type Pt } from '../render/viewport';
import type { Stone } from './geometry';
import { HILLS, type TuftSpec } from './layout';

/** Aerial perspective: far things are paler and cooler (toward a blue-grey haze). */
export function atmos(p: Pigment, distance: number): Pigment {
  if (distance <= 0) return p;
  return lighten(mix(p, '#b9c4c6', distance * 0.35), distance * 0.32);
}

/** A barely-there sky: a cool wash high up dying into paper, a warm haze at the horizon. */
export function paintSky(p: Painter, rng: Rng): void {
  const top: Pt[] = [
    { x: -60, y: -60 },
    { x: WORLD_W + 60, y: -60 },
    { x: WORLD_W + 60, y: 250 },
    { x: 1100, y: 230 },
    { x: 500, y: 260 },
    { x: -60, y: 240 },
  ];
  p.wetInWet(top, lighten(mix(PIGMENTS.bellflower, PIGMENTS.celadon, 0.55), 0.42), PIGMENTS.washiDeep, {
    rng,
    angle: Math.PI / 2,
    split: 0.35,
    softness: 0.6,
    deform: 0.05,
    opacity: 0.16,
    edge: 0.08,
    centreLift: 0.1,
    granulation: 0.05,
    flow: 0.6,
    flowScale: 260,
    fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.5 },
  });
  // a warm haze low in the sky
  p.glaze({ cx: 860, cy: 300, rx: 760, ry: 70 }, lighten(PIGMENTS.gold, 0.25), {
    rng,
    opacity: 0.07,
    fade: { angle: -Math.PI / 2, start: 0.3, amount: 1 },
  });
}

/** Ridge polygon: smooth top through `ridge`, closed down to `baseY`. */
function ridgePolygon(ridge: Pt[], baseY: number): Pt[] {
  const top = smoothPath(ridge, 24);
  return [...top, { x: top[top.length - 1]!.x, y: baseY }, { x: top[0]!.x, y: baseY }];
}

/** Two pale ridges of distant hills, cool and soft, dissolving downward into the far bank. */
export function paintHills(p: Painter, rng: Rng): void {
  for (const h of HILLS) {
    const pig = h.distance >= 1 ? mix(PIGMENTS.bellflower, PIGMENTS.sageLight, 0.55) : mix(PIGMENTS.sage, PIGMENTS.celadon, 0.5);
    p.wash(ridgePolygon(h.ridge, 470), atmos(pig, h.distance * 0.9), {
      rng,
      deform: 0.04,
      spread: 0.06,
      opacity: h.distance >= 1 ? 0.2 : 0.24,
      edge: 0.28,
      edgeWidth: 3,
      sharpness: 0.55,
      centreLift: 0.1,
      granulation: 0.1,
      flow: 0.5,
      flowScale: 160,
      fade: { angle: Math.PI / 2, start: 0.25, amount: 1, ragged: 0.5 },
    });
  }
  // a far tree line on the second ridge: one soft wash with a scalloped (canopy) top
  const noise = createSimplex2D(rng.fork('treeline'));
  const top: Pt[] = [];
  for (let x = 470; x <= 1180; x += 7) {
    const env = Math.sin(((x - 470) / 710) * Math.PI) ** 0.6; // swells in the middle, dies at the ends
    const canopy = 0.5 + 0.5 * noise(x / 26, 0.5) + 0.35 * Math.abs(noise(x / 9, 3.1));
    top.push({ x, y: 398 - env * (6 + canopy * 16) });
  }
  const band = [...top, { x: 1180, y: 420 }, { x: 470, y: 420 }];
  p.wash(band, atmos(mix(PIGMENTS.sage, PIGMENTS.celadon, 0.3), 0.7), {
    rng,
    deform: 0.02,
    spread: 0.05,
    opacity: 0.2,
    edge: 0.3,
    edgeWidth: 2,
    sharpness: 0.6,
    centreLift: 0.05,
    flow: 0.5,
    flowScale: 40,
    fade: { angle: Math.PI / 2, start: 0.35, amount: 0.9 },
  });
}

/** The banks, as overlapping washes from far to near. Paint before the pond (it reserves). */
export function paintBanks(p: Painter, rng: Rng): void {
  const far = atmos(PIGMENTS.sageLight, 0.35);
  // far bank: a cool pale band behind the pond
  const farBank: Pt[] = [
    { x: -60, y: 420 },
    { x: 160, y: 408 },
    { x: 380, y: 414 },
    { x: 580, y: 404 },
    { x: 780, y: 410 },
    { x: 980, y: 402 },
    { x: 1180, y: 408 },
    { x: 1380, y: 414 },
    { x: WORLD_W + 60, y: 406 },
    { x: WORLD_W + 60, y: 540 },
    { x: -60, y: 540 },
  ];
  p.wetInWet(farBank, lighten(far, 0.05), mix(far, PIGMENTS.sap, 0.35), {
    rng,
    angle: Math.PI / 2,
    split: 0.4,
    softness: 0.5,
    deform: 0.04,
    spread: 0.08,
    opacity: 0.42,
    edge: 0.25,
    edgeWidth: 2.5,
    sharpness: 0.6,
    flow: 0.45,
    flowScale: 120,
    fade: { angle: Math.PI / 2, start: 0.5, amount: 0.95 },
  });

  // the left and right banks that hold the pond: a lit lip along the top, dissolving below
  const leftBank: Pt[] = [
    { x: -60, y: 452 },
    { x: 120, y: 448 },
    { x: 262, y: 458 },
    { x: 400, y: 472 },
    { x: 478, y: 494 },
    { x: 456, y: 560 },
    { x: 500, y: 614 },
    { x: 566, y: 654 },
    { x: 650, y: 700 },
    { x: 712, y: 716 },
    { x: 660, y: 770 },
    { x: 600, y: 790 },
    { x: 300, y: 800 },
    { x: -60, y: 790 },
  ];
  p.wetInWet(leftBank, PIGMENTS.sageLight, mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.3), {
    rng,
    angle: Math.PI / 2 + 0.3,
    split: 0.4,
    softness: 0.6,
    deform: 0.05,
    spread: 0.1,
    opacity: 0.5,
    edge: 0.3,
    edgeWidth: 3,
    flow: 0.55,
    flowScale: 110,
    fade: { angle: Math.PI / 2, start: 0.42, amount: 1, ragged: 0.45 },
  });

  const rightBank: Pt[] = [
    { x: 1150, y: 482 },
    { x: 1262, y: 472 },
    { x: 1420, y: 476 },
    { x: WORLD_W + 60, y: 470 },
    { x: WORLD_W + 60, y: 800 },
    { x: 1360, y: 800 },
    { x: 1100, y: 780 },
    { x: 940, y: 770 },
    { x: 900, y: 728 },
    { x: 1100, y: 690 },
  ];
  p.wetInWet(rightBank, PIGMENTS.sageLight, mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.3), {
    rng,
    angle: Math.PI / 2 - 0.3,
    split: 0.45,
    softness: 0.6,
    deform: 0.05,
    spread: 0.1,
    opacity: 0.48,
    edge: 0.3,
    edgeWidth: 3,
    flow: 0.55,
    flowScale: 110,
    fade: { angle: Math.PI / 2, start: 0.45, amount: 1, ragged: 0.45 },
  });

  // near mounds either side of the path: warmer, a defined lip on top, lost toward the corners
  const warm = mix(PIGMENTS.sap, PIGMENTS.gold, 0.1);
  // the lips roll down toward the path (the mounds slope into it rather than stopping flat)
  const nearLeft: Pt[] = [
    { x: -60, y: 790 },
    { x: 90, y: 764 },
    { x: 250, y: 748 },
    { x: 420, y: 752 },
    { x: 540, y: 746 },
    { x: 620, y: 760 },
    { x: 676, y: 790 },
    { x: 700, y: 830 },
    { x: 668, y: 900 },
    { x: 600, y: 960 },
    { x: 560, y: WORLD_H + 60 },
    { x: -60, y: WORLD_H + 60 },
  ];
  p.wetInWet(nearLeft, mix(PIGMENTS.sageLight, warm, 0.5), mix(PIGMENTS.sageLight, warm, 0.2), {
    rng,
    angle: Math.PI / 2,
    split: 0.3,
    softness: 0.6,
    deform: 0.05,
    spread: 0.1,
    opacity: 0.46,
    edge: 0.28,
    edgeWidth: 3.5,
    flow: 0.6,
    flowScale: 130,
    blooms: 1,
    bloomSize: 0.08,
    fade: { angle: Math.PI / 2 + 0.6, start: 0.35, amount: 1, ragged: 0.6 },
  });
  const nearRight: Pt[] = [
    { x: 912, y: 840 },
    { x: 924, y: 796 },
    { x: 966, y: 768 },
    { x: 1040, y: 754 },
    { x: 1160, y: 756 },
    { x: 1300, y: 744 },
    { x: 1460, y: 758 },
    { x: WORLD_W + 60, y: 768 },
    { x: WORLD_W + 60, y: WORLD_H + 60 },
    { x: 1060, y: WORLD_H + 60 },
    { x: 990, y: 960 },
    { x: 940, y: 900 },
  ];
  p.wetInWet(nearRight, mix(PIGMENTS.sageLight, warm, 0.5), mix(PIGMENTS.sageLight, warm, 0.2), {
    rng,
    angle: Math.PI / 2,
    split: 0.3,
    softness: 0.6,
    deform: 0.05,
    spread: 0.1,
    opacity: 0.44,
    edge: 0.28,
    edgeWidth: 3.5,
    flow: 0.6,
    flowScale: 130,
    fade: { angle: Math.PI / 2 - 0.6, start: 0.35, amount: 1, ragged: 0.6 },
  });

  // mid-tone glazes that model the ground: shade where the banks turn down toward the water
  const sage = mix(PIGMENTS.sage, PIGMENTS.sap, 0.4);
  p.glaze({ cx: 230, cy: 600, rx: 220, ry: 54, rotation: 0.08 }, sage, { rng, opacity: 0.16, fade: { angle: -Math.PI / 2, start: 0.3 } });
  p.glaze({ cx: 1400, cy: 690, rx: 200, ry: 50, rotation: -0.06 }, sage, { rng, opacity: 0.15, fade: { angle: -Math.PI / 2, start: 0.3 } });
  p.glaze({ cx: 520, cy: 640, rx: 110, ry: 30, rotation: 0.75 }, PIGMENTS.sage, { rng, opacity: 0.2, fade: { angle: Math.PI, start: 0.4 } });
  p.glaze({ cx: 640, cy: 730, rx: 120, ry: 22, rotation: 0.3 }, PIGMENTS.sage, { rng, opacity: 0.2, fade: { angle: Math.PI / 2, start: 0.35 } });
  p.glaze({ cx: 1010, cy: 750, rx: 140, ry: 22, rotation: -0.1 }, PIGMENTS.sage, { rng, opacity: 0.18, fade: { angle: Math.PI / 2, start: 0.35 } });
  p.glaze({ cx: 470, cy: 790, rx: 210, ry: 28 }, sage, { rng, opacity: 0.16, fade: { angle: Math.PI / 2, start: 0.3 } });
  p.glaze({ cx: 1150, cy: 800, rx: 220, ry: 28 }, sage, { rng, opacity: 0.15, fade: { angle: Math.PI / 2, start: 0.3 } });

  // dry-brush texture along the bank lips, broken and pale
  const lip = mix(PIGMENTS.sage, PIGMENTS.sap, 0.4);
  p.dryBrush([{ x: 30, y: 458 }, { x: 200, y: 455 }, { x: 380, y: 471 }, { x: 466, y: 494 }], { rng, pigment: atmos(lip, 0.2), width: 8, opacity: 0.4 });
  p.dryBrush([{ x: 1210, y: 481 }, { x: 1380, y: 479 }, { x: 1540, y: 476 }], { rng, pigment: atmos(lip, 0.2), width: 7, opacity: 0.35 });
  p.dryBrush([{ x: 120, y: 770 }, { x: 330, y: 760 }, { x: 520, y: 770 }], { rng, pigment: lip, width: 12, opacity: 0.25 });
  p.dryBrush([{ x: 1060, y: 780 }, { x: 1260, y: 772 }, { x: 1460, y: 786 }], { rng, pigment: lip, width: 12, opacity: 0.25 });
}

/**
 * The earthen path: lift the grass back to warm paper with soft, grass-nibbled edges and a
 * little grit. The stones are `paintStones` (after the margins).
 */
export function paintPath(p: Painter, rng: Rng, stones: readonly Stone[]): void {
  const ground: Pt[] = [
    { x: 734, y: 716 },
    { x: 860, y: 718 },
    { x: 896, y: 776 },
    { x: 920, y: 840 },
    { x: 960, y: 920 },
    { x: 1030, y: WORLD_H + 40 },
    { x: 580, y: WORLD_H + 40 },
    { x: 640, y: 920 },
    { x: 690, y: 840 },
    { x: 712, y: 776 },
  ];
  p.lift(ground, { rng, amount: 0.42, deform: 0.1, spread: 0.45, sharpness: 0.15, edge: 0, layers: 12 });
  // bare earth: warm and very pale, a touch deeper where feet have worn it between the stones
  const earth = mix(PIGMENTS.stoneWarm, PIGMENTS.washiDeep, 0.5);
  p.glaze(ground, earth, { rng, opacity: 0.13, edge: 0, sharpness: 0.2, fade: { angle: Math.PI / 2, start: 0.6, amount: 0.8 } });
  p.glaze(insetPolygon(ground, 26), mix(earth, PIGMENTS.stone, 0.3), { rng, opacity: 0.08, edge: 0, sharpness: 0.1 });
  // grit along the worn line, and grass creeping in at both edges
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const edgeLine = stones.map((s) => ({ x: s.x + side * (s.rx * 1.25 + 10), y: s.y + rng.range(-6, 6) }));
    p.dryBrush(edgeLine, { rng, pigment: mix(PIGMENTS.sage, PIGMENTS.stoneWarm, 0.45), width: 9, opacity: 0.22 });
  }
}

/**
 * The stepping stones themselves — painted after the paper margins so the near stones stay
 * crisp where the grass around them dissolves (the eye follows them in from the bottom edge).
 */
export function paintStones(p: Painter, rng: Rng, stones: readonly Stone[]): void {
  for (const s of stones) {
    const k = Math.max(0, Math.min(1, (s.y - 700) / 300)); // 0 far .. 1 near
    // the shallow hollow the stone is bedded in: cool, offset down-right (light from upper left)
    p.glaze({ cx: s.x + s.rx * 0.04, cy: s.y + s.ry * 0.3, rx: s.rx * 1.04, ry: s.ry * 0.7 }, mix(PIGMENTS.stoneDark, PIGMENTS.sage, 0.4), {
      rng,
      opacity: 0.2 + 0.05 * k,
    });
    p.stone(
      { cx: s.x, cy: s.y, rx: s.rx, ry: s.ry, rotation: rng.range(-0.06, 0.06) },
      {
        rng,
        pigment: mix(PIGMENTS.stone, PIGMENTS.stoneWarm, 0.35),
        warm: 0.4,
        moss: k > 0.4 ? 0.14 : 0.05,
        granulation: 0.5,
        ink: 0.22 + 0.14 * k,
        groundShadow: false,
        patches: rng.int(1, 3),
      },
    );
  }
}

/** Background grass tufts: soft, pale, never spiky. */
export function paintTufts(p: Painter, rng: Rng, tufts: readonly TuftSpec[]): void {
  for (const t of tufts) {
    const d = Math.max(0, Math.min(1, (760 - t.y) / 360)); // far tufts paler
    p.grassTuft(t, {
      rng,
      height: t.h,
      spread: t.h * 0.7,
      blades: rng.int(8, 12),
      opacity: 0.38 - d * 0.1,
      pigments: [atmos(PIGMENTS.sageLight, d), atmos(PIGMENTS.sap, d), atmos(mix(PIGMENTS.sap, PIGMENTS.sage, 0.4), d)],
    });
  }
}

/**
 * Unpainted-paper margins: lift everything back toward bare paper near the edges, with a
 * ragged organic front (a real painting stops before the edge of the sheet). Strongest at the
 * bottom corners and the sides, lightest along the (already pale) sky.
 */
export function paintMargins(p: Painter, rng: Rng): void {
  const L = p.layer({ x: -10, y: -10, w: WORLD_W + 20, h: WORLD_H + 20 });
  const outer: Pt[] = [
    { x: -200, y: -200 },
    { x: WORLD_W + 200, y: -200 },
    { x: WORLD_W + 200, y: WORLD_H + 200 },
    { x: -200, y: WORLD_H + 200 },
  ];
  const noise = createSimplex2D(rng.fork('margin'));
  const steps = 9;
  for (let k = 0; k < steps; k++) {
    const t = k / (steps - 1);
    const inner = organicFrame(10 + t * 190, 8 + t * 120, noise, k);
    const c = L.ctx;
    c.beginPath();
    for (const poly of [outer, inner]) {
      poly.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
    }
    c.fillStyle = 'rgba(255,253,248,0.2)';
    c.fill('evenodd');
  }
  L.dry({ opacity: 1, edge: 0.04, edgeWidth: 6, sharpness: 0.15, centreLift: 0, granulation: 0.05, flow: 0.6, flowScale: 120, blend: 'source-over' });
}

/**
 * A closed, irregular rounded window inset `mx` (sides) / `my` (top, bottom) from the world
 * edges; corners cut deeper; the front wanders with low-frequency noise.
 */
function organicFrame(mx: number, my: number, noise: (x: number, y: number) => number, k: number): Pt[] {
  const pts: Pt[] = [];
  const n = 120;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const e = 0.28;
    const x = Math.sign(c) * Math.abs(c) ** e;
    const y = Math.sign(s) * Math.abs(s) ** e;
    const rx = WORLD_W / 2 - mx * (1 + 0.6 * Math.max(0, s)); // deeper at the bottom
    const ry = WORLD_H / 2 - my * (s > 0 ? 1.3 : 0.6); // shallow at the top
    const wob = 1 + 0.02 * noise(Math.cos(a) * 2.2 + k * 0.15, Math.sin(a) * 2.2) + 0.008 * noise(a * 6, k);
    pts.push({ x: WORLD_W / 2 + x * rx * wob, y: WORLD_H / 2 + y * ry * wob });
  }
  return pts;
}

/** The pale rim between grass and water: lift the pond (slightly outset) back to paper. */
export function reservePond(p: Painter, rng: Rng, pond: readonly Pt[]): void {
  // the rim is a thin line at the far side and widens toward the viewer (perspective)
  const rim = outsetBy(pond, (q) => 3 + 9 * Math.min(1, Math.max(0, (q.y - 460) / 240)));
  p.lift(rim, { rng, amount: 0.92, deform: 0.03, spread: 0.08, layers: 10, sharpness: 0.5 });
}

/** Offset a polygon outward by a per-vertex distance (averaged edge normals). */
function outsetBy(poly: readonly Pt[], d: (q: Pt) => number): Pt[] {
  const unit = insetPolygon(poly, -1);
  return poly.map((q, i) => {
    const u = unit[i]!;
    const k = d(q);
    return { x: q.x + (u.x - q.x) * k, y: q.y + (u.y - q.y) * k };
  });
}
