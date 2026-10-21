import { createRng } from '../core/rng';
import { createPainter, makeCanvas, mix, PIGMENTS, lighten, shade, type Painter, type Pt } from '../paint';

/**
 * The watering moment (SPEC §2 "Breaks = watering", docs/systems/plants.md › Watering, ADR 0114).
 *
 * A small copper jōro with a long spout and a brass rose glides in from the side over the plant,
 * tilts, and pours a fine arc of droplets (soft blue-grey dabs, a few catching the light) that
 * land on the leaves and the soil — tiny splashes, the soil wash darkening — while the leaves
 * lift a little; then the can straightens and lifts away. 2.5 s, eased like a breath.
 *
 * Everything is a pure function of progress `u` (0..1) and a seed, so the garden and the plant
 * view (widget, previews) show the same animation. The can, droplets and wet soil are painted
 * once with the watercolour engine and cached per device-pixel size.
 */

export const WATERING_SECONDS = 2.5;
/** how long the darkened soil takes to dry back after the can has gone (garden only) */
export const WET_LINGER_SECONDS = 9;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);
/** smootherstep between a and b — the "breath" easing used for every phase */
export const ease = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export interface WateringPhases {
  /** 0 → 1 as the can glides in */
  enter: number;
  /** 0 → 1 as it lifts away */
  leave: number;
  /** 0..1 how far the can is tilted toward the plant */
  tilt: number;
  /** 0..1 flow from the rose */
  pour: number;
  /** 0..1 darkness of the soil wash (back to 0 at the end; the garden lingers it) */
  wet: number;
  /** 0..1 leaves lifting */
  lift: number;
  /** can opacity */
  alpha: number;
}

/** The choreography. Phases overlap so nothing starts or stops abruptly. */
export function wateringTimeline(u: number): WateringPhases {
  const v = clamp01(u);
  return {
    enter: ease(0, 0.26, v),
    leave: ease(0.8, 1, v),
    tilt: ease(0.2, 0.37, v) * (1 - ease(0.68, 0.84, v)),
    pour: ease(0.29, 0.39, v) * (1 - ease(0.63, 0.74, v)),
    wet: ease(0.36, 0.6, v) * (1 - ease(0.86, 1, v)),
    lift: ease(0.42, 0.62, v) * (1 - ease(0.76, 1, v)),
    alpha: ease(0, 0.1, v) * (1 - ease(0.9, 1, v)),
  };
}

/** Soil wetness in the garden `seconds` after watering began: the pour darkens it, then it dries slowly. */
export function gardenWetness(seconds: number): number {
  if (!(seconds >= 0)) return 0;
  const u = seconds / WATERING_SECONDS;
  const rise = ease(0.36, 0.6, u);
  const peakEnd = WATERING_SECONDS * 0.9;
  if (seconds <= peakEnd) return rise;
  return 1 - ease(0, WET_LINGER_SECONDS, seconds - peakEnd);
}

/** Leaves lift: a small temporary growth (vertical scale) and a sway nudge. */
export const LIFT_SCALE = 0.04;

/** Where the animation happens, in the caller's user units. */
export interface WateringRig {
  /** plant base */
  baseX: number;
  baseY: number;
  /** y of the visible top of the plant (≤ baseY) */
  top: number;
  /** half the visible width of the plant */
  halfWidth: number;
  /** can body width */
  size: number;
  /** the can comes from the right (1, default) or the left (-1) */
  side?: 1 | -1;
  /** where the rose points while pouring (default: above the plant, toward the can's side) */
  aim?: Pt;
}

// Can geometry in "can units": body width 100, origin at the body centre (the pivot).
const CAN_BOX = { x: -152, y: -114, w: 218, h: 168 };
const SPOUT_ROOT: Pt = { x: -47, y: 24 };
const SPOUT_TIP: Pt = { x: -126, y: -62 };
const SPOUT_DIR = (() => {
  const dx = SPOUT_TIP.x - SPOUT_ROOT.x;
  const dy = SPOUT_TIP.y - SPOUT_ROOT.y;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
})();
/** centre of the rose's face */
const ROSE: Pt = { x: SPOUT_TIP.x + SPOUT_DIR.x * 11, y: SPOUT_TIP.y + SPOUT_DIR.y * 11 };
/** full tilt (radians, counter-clockwise lowers the spout) */
const TILT = -0.98;

export interface CanPose {
  /** pivot (body centre), user units */
  x: number;
  y: number;
  /** rotation, radians (already mirrored for side −1) */
  angle: number;
  alpha: number;
  side: 1 | -1;
  /** user units per can unit */
  k: number;
}

const rot = (p: Pt, a: number): Pt => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

/** Where the rose is aimed while pouring: above and a little to the can's side of the plant. */
export function pourTarget(rig: WateringRig): Pt {
  if (rig.aim) return rig.aim;
  const side = rig.side ?? 1;
  return { x: rig.baseX + side * (rig.halfWidth * 0.6 + rig.size * 0.55), y: rig.top - rig.size * 0.3 };
}

/**
 * Keep the whole can inside a W×H canvas (the plant view): at full tilt the body reaches ~0.62
 * sizes beyond the pivot, which sits ~1.33 sizes beside and ~0.72 above the rose. The aim moves
 * in over the foliage if needed — the can is drawn in front of the plant.
 */
export function fitRigToCanvas(rig: WateringRig, W: number, H: number, margin = 4): WateringRig {
  const side = rig.side ?? 1;
  const t = pourTarget(rig);
  const s = rig.size;
  const reach = 1.95 * s + margin;
  const x = side > 0 ? Math.min(t.x, W - reach) : Math.max(t.x, reach);
  const y = Math.min(Math.max(t.y, 1.34 * s + margin), H - s * 0.5);
  return { ...rig, aim: { x, y } };
}

/** Pose of the can at progress `u`. */
export function canPose(rig: WateringRig, u: number): CanPose {
  const side = rig.side ?? 1;
  const ph = wateringTimeline(u);
  const k = rig.size / 100;
  const full = TILT;
  // pivot such that the rose sits on the pour target at full tilt
  const r = rot({ x: ROSE.x * side, y: ROSE.y }, full * side);
  const target = pourTarget(rig);
  const px = target.x - r.x * k;
  const py = target.y - r.y * k;
  // glide in from the side and a little above; lift away up and back out
  const inX = (1 - ph.enter) * side * rig.size * 2.3;
  const inY = -(1 - ph.enter) * rig.size * 0.55;
  const outX = ph.leave * side * rig.size * 1.1;
  const outY = -ph.leave * rig.size * 1.5;
  // a small settle of the wrist before the tilt, never a bounce
  const angle = side * (full * ph.tilt + 0.06 * ph.enter * (1 - ph.tilt) * (1 - ph.leave));
  return { x: px + inX + outX, y: py + inY + outY, angle, alpha: ph.alpha, side, k };
}

/** Rose position (user units) at progress `u`, and the spout direction there. */
export function rosePoint(rig: WateringRig, u: number): { p: Pt; dir: Pt } {
  const pose = canPose(rig, u);
  const r = rot({ x: ROSE.x * pose.side, y: ROSE.y }, pose.angle);
  const d = rot({ x: SPOUT_DIR.x * pose.side, y: SPOUT_DIR.y }, pose.angle);
  return { p: { x: pose.x + r.x * pose.k, y: pose.y + r.y * pose.k }, dir: d };
}

// ---------------------------------------------------------------------------------------------
// Droplets

interface DropPlan {
  emit: number;
  /** flight time, s */
  T: number;
  /** landing offset across the plant, in half-widths */
  tx: number;
  /** lands on the soil (true) or vanishes into the foliage at height fraction `hy` */
  soil: boolean;
  hy: number;
  size: number;
  light: boolean;
  variant: number;
  splash: boolean;
  splashDir: number;
}

const DROPS = 150;
const planCache = new Map<number, DropPlan[]>();

function dropPlan(seed: number): DropPlan[] {
  const key = seed >>> 0;
  const hit = planCache.get(key);
  if (hit) return hit;
  const rng = createRng(key).fork('watering-drops');
  const plan: DropPlan[] = [];
  for (let i = 0; i < DROPS; i++) {
    const soil = rng.chance(0.72);
    plan.push({
      emit: 0.315 + ((i + rng.range(0, 1)) / DROPS) * (0.71 - 0.315),
      T: rng.range(0.34, 0.5),
      tx: rng.gaussian() * 0.28 - 0.18,
      soil,
      hy: rng.range(0.25, 0.75),
      size: rng.range(0.45, 1.1),
      light: rng.chance(0.25),
      variant: rng.int(0, 2),
      splash: soil && rng.chance(0.55),
      splashDir: rng.chance(0.5) ? 1 : -1,
    });
  }
  if (planCache.size > 32) planCache.delete(planCache.keys().next().value!);
  planCache.set(key, plan);
  return plan;
}

export interface DropMark {
  kind: 'drop' | 'splash' | 'crown';
  x: number;
  y: number;
  /** direction of travel (radians) */
  angle: number;
  /** length and width, user units */
  len: number;
  wid: number;
  alpha: number;
  light: boolean;
  variant: number;
}

const SPLASH_S = 0.28;

/** Every droplet, splash and crown visible at progress `u` (pure; user units). */
export function dropletsAt(rig: WateringRig, u: number, seed: number): DropMark[] {
  const out: DropMark[] = [];
  const S = rig.size;
  const plantH = Math.max(S * 0.3, rig.baseY - rig.top);
  for (const d of dropPlan(seed)) {
    const tau = (u - d.emit) * WATERING_SECONDS;
    if (tau < 0) continue;
    if (tau > d.T + (d.splash ? SPLASH_S : 0)) continue;
    const { p: r0 } = rosePoint(rig, d.emit);
    const tx = rig.baseX + d.tx * Math.max(rig.halfWidth, S * 0.25);
    const ty = d.soil ? rig.baseY + S * 0.015 * d.size : rig.baseY - plantH * d.hy;
    const dy = ty - r0.y;
    // gravity chosen so the stream leaves the rose almost level and arcs down onto its target
    const g = Math.max(S * 2, (1.7 * Math.max(dy, S * 0.2)) / (d.T * d.T));
    const vx = (tx - r0.x) / d.T;
    const vy = (dy - 0.5 * g * d.T * d.T) / d.T;
    const w = S * 0.038 * d.size;
    if (tau <= d.T) {
      const x = r0.x + vx * tau;
      const y = r0.y + vy * tau + 0.5 * g * tau * tau;
      const svy = vy + g * tau;
      const speed = Math.hypot(vx, svy);
      const fadeIn = clamp01(tau / 0.04);
      const fadeOut = d.soil ? 1 : 1 - ease(0.8, 1, tau / d.T);
      out.push({
        kind: 'drop',
        x,
        y,
        angle: Math.atan2(svy, vx),
        len: w * (1.6 + Math.min(2.2, (speed / Math.max(1, S)) * 0.22)),
        wid: w,
        alpha: 0.78 * fadeIn * fadeOut,
        light: d.light,
        variant: d.variant,
      });
    } else {
      const s = tau - d.T;
      const p = s / SPLASH_S;
      const fade = (1 - p) * (1 - p);
      out.push({ kind: 'crown', x: tx, y: ty, angle: 0, len: S * 0.13 * d.size * (0.6 + 0.6 * p), wid: S * 0.035, alpha: 0.5 * fade, light: false, variant: 0 });
      for (const k of [0.6, 1]) {
        const sx = tx + d.splashDir * k * S * 0.9 * s;
        const sy = ty - S * 1.5 * k * s + 0.5 * S * 26 * s * s;
        if (sy > ty + 0.5) continue;
        out.push({ kind: 'splash', x: sx, y: sy, angle: -Math.PI / 2, len: w * 0.55, wid: w * 0.5, alpha: 0.6 * fade, light: false, variant: 1 });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Painted, cached sprites

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const COPPER = mix(mix(PIGMENTS.vermilion, PIGMENTS.gold, 0.25), PIGMENTS.wood, 0.45);
const BRASS = mix(PIGMENTS.gold, PIGMENTS.woodLight, 0.3);
const WATER = mix(PIGMENTS.celadonDeep, PIGMENTS.bellflower, 0.35);
const WET_SOIL = mix(mix(PIGMENTS.stoneWarm, PIGMENTS.olive, 0.3), PIGMENTS.sumi, 0.25);

/** px-size buckets so a sprite is re-painted only when the size changes by ≥ ~19 % */
const bucket = (px: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, 2 ** (Math.round(Math.log2(Math.max(1, px)) * 4) / 4)));

function tryCanvas(w: number, h: number): AnyCanvas | null {
  try {
    return makeCanvas(w, h);
  } catch {
    return null;
  }
}

function curve(a: Pt, c: Pt, b: Pt, n = 10): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * c.y + t * t * b.y });
  }
  return pts;
}

/** The jōro body outline (can units): a domed shoulder, a gently tapering drum, a soft base. */
function bodyOutline(): Pt[] {
  return [
    ...curve({ x: -47, y: -33 }, { x: 0, y: -50 }, { x: 46, y: -34 }, 12),
    ...curve({ x: 47, y: -30 }, { x: 52, y: 4 }, { x: 50, y: 30 }, 6).slice(1),
    ...curve({ x: 50, y: 31 }, { x: 47, y: 41 }, { x: 0, y: 42 }, 6).slice(1),
    ...curve({ x: 0, y: 42 }, { x: -47, y: 41 }, { x: -50, y: 31 }, 6).slice(1),
    ...curve({ x: -50, y: 30 }, { x: -52, y: 2 }, { x: -47, y: -30 }, 6).slice(1),
  ];
}

/** Paint the can in can units (body width 100), pivot at the origin. */
export function paintCan(p: Painter): void {
  const rng = createRng('joro').fork('can');
  const copperDark = shade(COPPER, 0.32);
  const ink = { rng, pigment: mix(PIGMENTS.sumi, COPPER, 0.25) };

  // body: one wet layer — copper, a cool shadow side pooled into it, a lifted highlight band
  const body = bodyOutline();
  const L = p.layer({ x: -58, y: -56, w: 116, h: 104 });
  L.fill(body, COPPER, 0.78);
  // the shadow side: the body's own right flank (so the silhouette stays the drum's)
  for (const [from, a] of [[4, 0.13], [16, 0.14], [28, 0.16], [40, 0.12]] as const) L.fill(body.filter((q) => q.x > from), copperDark, a);
  // the light: a soft lifted streak, feathered so it has no hard edge
  for (const [hw, a] of [[9, 0.1], [6, 0.12], [3.5, 0.16], [1.6, 0.2]] as const) {
    L.lift([{ x: -30 - hw, y: -39 }, { x: -30 + hw, y: -40 }, { x: -26 + hw, y: 34 }, { x: -26 - hw, y: 35 }], a);
  }
  // reflected light along the far edge
  L.lift([{ x: 44, y: -28 }, { x: 47, y: -27 }, { x: 47, y: 28 }, { x: 44, y: 30 }], 0.12);
  L.dry({ opacity: 0.94, edge: 0.6, edgeWidth: 2.2, granulation: 0.35, flow: 0.45, centreLift: 0.18, darken: 0.35 });
  p.glaze(
    body.filter((q) => q.x > 6),
    shade(COPPER, 0.45),
    { rng, opacity: 0.32, fade: { angle: Math.PI, start: 0.3, amount: 1, ragged: 0.5 } },
  );
  // riveted hoops: two thin darker bands following the drum's curve
  for (const y of [-27, 29]) {
    p.stroke(curve({ x: -48, y }, { x: 0, y: y + 5 }, { x: 49, y }, 10), {
      rng,
      pigment: copperDark,
      width: 2.4,
      taper: [0.05, 0.05],
      wobble: 0.2,
      wetness: 0.3,
      opacity: 0.6,
    });
  }
  // a breath of verdigris where water always sits
  p.wash({ cx: 22, cy: 35, rx: 8, ry: 2.6 }, mix(PIGMENTS.celadon, PIGMENTS.celadonMid, 0.5), { rng, opacity: 0.32, edge: 0.35, deform: 0.4, granulation: 0.1 });
  // filler cap
  p.wash({ cx: 20, cy: -43, rx: 13, ry: 4.2 }, BRASS, { rng, opacity: 0.85, edge: 0.6, edgeWidth: 1.4, deform: 0.15 });

  // the arched bail handle over the top
  const handle = [
    ...curve({ x: 38, y: -30 }, { x: 42, y: -78 }, { x: 8, y: -86 }, 10),
    ...curve({ x: 8, y: -86 }, { x: -22, y: -88 }, { x: -27, y: -34 }, 10).slice(1),
  ];
  p.stroke(handle, { rng, pigment: COPPER, width: 4.6, taper: [0.02, 0.02], pressure: [1, 0.85, 0.9, 1], wobble: 0.15, wetness: 0.35, opacity: 0.88 });
  p.inkLine(handle.map((q) => ({ x: q.x, y: q.y - 2 })), { ...ink, width: 1.0, breaks: 0.4, opacity: 0.55 });

  // the spout, soldered on low at the front: a long tapering copper tube with a dark underside
  const spout = [...curve(SPOUT_ROOT, { x: (SPOUT_ROOT.x + SPOUT_TIP.x) / 2 + 3, y: (SPOUT_ROOT.y + SPOUT_TIP.y) / 2 + 4 }, SPOUT_TIP, 14)];
  p.stroke(spout, { rng, pigment: COPPER, width: 7, taper: [0, 0.06], pressure: [1.35, 1.1, 0.8, 0.62], wobble: 0.08, wetness: 0.4, opacity: 0.92, edge: 0.65 });
  p.stroke(spout.slice(2, -1).map((q) => ({ x: q.x + SPOUT_DIR.y * -1.4, y: q.y - SPOUT_DIR.x * -1.4 })), {
    rng,
    pigment: shade(COPPER, 0.3),
    width: 2.6,
    taper: [0.1, 0.3],
    wobble: 0.15,
    wetness: 0.3,
    opacity: 0.45,
  });
  const under = spout.slice(1).map((q) => ({ x: q.x + SPOUT_DIR.y * -3.2, y: q.y - SPOUT_DIR.x * -3.2 }));
  p.inkLine(under, { ...ink, width: 1.15, breaks: 0.35, opacity: 0.7, taper: [0.05, 0.3] });
  // a pale lifted line along the top of the tube
  const over = spout.slice(2, -2).map((q) => ({ x: q.x - SPOUT_DIR.y * -1.6, y: q.y + SPOUT_DIR.x * -1.6 }));
  p.stroke(over, { rng, pigment: lighten(COPPER, 0.35), width: 1.6, taper: [0.2, 0.3], wobble: 0.2, wetness: 0.2, opacity: 0.55, blend: 'source-over' });

  // the joint: a small darker collar where the tube meets the drum
  p.wash({ cx: SPOUT_ROOT.x + 1, cy: SPOUT_ROOT.y, rx: 3.4, ry: 6.5, rotation: Math.atan2(SPOUT_DIR.y, SPOUT_DIR.x) }, copperDark, { rng, opacity: 0.8, edge: 0.6, edgeWidth: 1.2, deform: 0.15 });

  // the rose (hasu-kuchi): a flared brass cone with a domed face
  const nx = -SPOUT_DIR.y;
  const ny = SPOUT_DIR.x;
  const base = { x: SPOUT_TIP.x - SPOUT_DIR.x * 2, y: SPOUT_TIP.y - SPOUT_DIR.y * 2 };
  const cone: Pt[] = [
    { x: base.x + nx * 3.5, y: base.y + ny * 3.5 },
    { x: ROSE.x + nx * 10, y: ROSE.y + ny * 10 },
    { x: ROSE.x + SPOUT_DIR.x * 2.5, y: ROSE.y + SPOUT_DIR.y * 2.5 },
    { x: ROSE.x - nx * 10, y: ROSE.y - ny * 10 },
    { x: base.x - nx * 3.5, y: base.y - ny * 3.5 },
  ];
  p.wash(cone, BRASS, { rng, opacity: 0.9, edge: 0.65, edgeWidth: 1.4, deform: 0.12, granulation: 0.3 });
  const faceAngle = Math.atan2(SPOUT_DIR.y, SPOUT_DIR.x);
  p.wash({ cx: ROSE.x + SPOUT_DIR.x * 1.5, cy: ROSE.y + SPOUT_DIR.y * 1.5, rx: 3.2, ry: 10.5, rotation: faceAngle }, shade(BRASS, 0.2), {
    rng,
    opacity: 0.85,
    edge: 0.7,
    edgeWidth: 1.2,
    deform: 0.1,
  });
  p.inkLine(curve({ x: ROSE.x + nx * 10, y: ROSE.y + ny * 10 }, { x: ROSE.x + SPOUT_DIR.x * 5, y: ROSE.y + SPOUT_DIR.y * 5 }, { x: ROSE.x - nx * 10, y: ROSE.y - ny * 10 }, 8), {
    ...ink,
    width: 1.0,
    breaks: 0.2,
    opacity: 0.6,
  });

  // ink: lost on the lit upper left, found on the shadow side and the base
  p.inkLine(body.slice(10, 22), { ...ink, width: 1.4, breaks: 0.25, opacity: 0.7, pressure: [0.6, 1, 1.1] });
  p.inkLine(body.slice(22, 33), { ...ink, width: 1.2, breaks: 0.3, opacity: 0.55, pressure: [1, 0.8, 0.3] });
  p.inkLine(body.slice(2, 9), { ...ink, width: 0.9, breaks: 0.5, opacity: 0.35 });
}

interface CanSprite {
  canvas: AnyCanvas;
  /** px per can unit */
  scale: number;
}

const canCache = new Map<number, CanSprite | null>();

/** The painted can for a body width of `px` device pixels (bucketed, cached). */
export function canSprite(px: number): CanSprite | null {
  const b = bucket(px, 16, 360);
  if (canCache.has(b)) return canCache.get(b)!;
  const scale = b / 100;
  const c = tryCanvas(Math.ceil(CAN_BOX.w * scale), Math.ceil(CAN_BOX.h * scale));
  let sprite: CanSprite | null = null;
  if (c) {
    try {
      const p = createPainter(c, { seed: 'joro' });
      p.ctx.setTransform(scale, 0, 0, scale, -CAN_BOX.x * scale, -CAN_BOX.y * scale);
      paintCan(p);
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      sprite = { canvas: c, scale };
    } catch {
      sprite = null;
    }
  }
  canCache.set(b, sprite);
  return sprite;
}

const DROP_CELL = 40;
interface DropSprites {
  canvas: AnyCanvas;
  /** px per drop unit (cell is 40 units) */
  scale: number;
}
const dropCache = new Map<number, DropSprites | null>();

/**
 * Droplet atlas: 3 plain soft blue-grey dabs and their light-catching twins (a pale lifted
 * highlight on the upper flank). Each cell is 40 units; a drop is ~14 wide, 26 long, pointing up.
 */
export function dropSprites(px: number): DropSprites | null {
  const b = bucket(px, 8, 64);
  if (dropCache.has(b)) return dropCache.get(b)!;
  const scale = b / 14;
  const c = tryCanvas(Math.ceil(DROP_CELL * 6 * scale), Math.ceil(DROP_CELL * scale));
  let s: DropSprites | null = null;
  if (c) {
    try {
      const p = createPainter(c, { seed: 'drops' });
      const rng = createRng('joro').fork('drops');
      p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      for (let i = 0; i < 6; i++) {
        const cx = DROP_CELL * i + DROP_CELL / 2;
        const at = { x: cx, y: DROP_CELL / 2 + 12 };
        p.dab(at, i % 3 === 1 ? lighten(WATER, 0.12) : WATER, {
          rng,
          variant: 'petal',
          angle: -Math.PI / 2 + rng.range(-0.05, 0.05),
          length: 26,
          width: 10,
          pool: 0.7,
          basePool: 0.5,
          opacity: 0.8,
          edge: 0.7,
          edgeWidth: 1.6,
        });
        if (i >= 3) {
          p.dab({ x: cx - 2.5, y: at.y - 13 }, PIGMENTS.petalWhite, { rng, variant: 'round', angle: -Math.PI / 2, length: 6, width: 3.6, opacity: 0.95, blend: 'source-over', edge: 0.1 });
        }
      }
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      s = { canvas: c, scale };
    } catch {
      s = null;
    }
  }
  dropCache.set(b, s);
  return s;
}

const WET_BOX = { w: 200, h: 64 };
const wetCache = new Map<number, AnyCanvas | null>();

/** A darker, granulating wash of damp earth (200 × 64 units). */
export function wetSoilSprite(px: number): AnyCanvas | null {
  const b = bucket(px, 24, 480);
  if (wetCache.has(b)) return wetCache.get(b)!;
  const scale = b / WET_BOX.w;
  const c = tryCanvas(Math.ceil(WET_BOX.w * scale), Math.ceil(WET_BOX.h * scale));
  let out: AnyCanvas | null = null;
  if (c) {
    try {
      const p = createPainter(c, { seed: 'wet-soil' });
      const rng = createRng('joro').fork('wet');
      p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      p.wash({ cx: 100, cy: 34, rx: 84, ry: 17 }, WET_SOIL, { rng, opacity: 0.45, edge: 0.4, edgeWidth: 4, sharpness: 0.35, granulation: 0.55, deform: 0.4, centreLift: 0.1, flow: 0.5 });
      p.wash({ cx: 96, cy: 36, rx: 46, ry: 9 }, shade(WET_SOIL, 0.15), { rng, opacity: 0.4, edge: 0.4, granulation: 0.4, deform: 0.45 });
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      out = c;
    } catch {
      out = null;
    }
  }
  wetCache.set(b, out);
  return out;
}

/** Device pixels per user unit of `ctx`'s current transform. */
const pxPerUnit = (ctx: Ctx): number => {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
};

/** Paint the cached sprites for a rig at this context's scale (call during idle time). */
export function prewarmWatering(ctxScale: number, size: number): void {
  canSprite(size * ctxScale);
  dropSprites(size * 0.042 * ctxScale);
  wetSoilSprite(size * 1.6 * ctxScale);
}

/** The darkened soil under the plant (draw before the plant). */
export function drawWetSoil(ctx: Ctx, rig: WateringRig, wet: number): void {
  if (wet <= 0.003) return;
  const w = Math.max(rig.halfWidth * 1.9, rig.size * 1.3);
  const sprite = wetSoilSprite(w * pxPerUnit(ctx));
  if (!sprite) return;
  const h = (w * WET_BOX.h) / WET_BOX.w;
  ctx.save();
  ctx.globalAlpha *= clamp01(wet);
  ctx.drawImage(sprite, rig.baseX - w / 2, rig.baseY - h * 0.55, w, h);
  ctx.restore();
}

/** The can, the stream of droplets and the splashes (draw after the plant). */
export function drawWateringFront(ctx: Ctx, rig: WateringRig, u: number, seed: number): void {
  if (u <= 0 || u >= 1) return;
  const ph = wateringTimeline(u);
  const k = pxPerUnit(ctx);
  const drops = ph.pour > 0 || u < 0.95 ? dropletsAt(rig, u, seed) : [];
  const ds = drops.length ? dropSprites(rig.size * 0.042 * k) : null;
  if (ds) {
    const cell = DROP_CELL;
    // never thinner than ~1.6 device px, or the stream turns to dust at garden scale
    const minW = 1.6 / k;
    for (const d of drops) {
      if (d.alpha <= 0.01) continue;
      if (d.wid < minW) {
        const f = minW / d.wid;
        d.wid = minW;
        d.len *= Math.sqrt(f);
        d.alpha *= 0.85;
      }
      ctx.save();
      ctx.globalAlpha *= d.alpha;
      ctx.translate(d.x, d.y);
      if (d.kind === 'crown') {
        ctx.scale(1, 0.32);
        const i = 1;
        ctx.drawImage(ds.canvas, cell * i * ds.scale, 0, cell * ds.scale, cell * ds.scale, -d.len / 2, -d.len / 2, d.len, d.len);
      } else {
        ctx.rotate(d.angle + Math.PI / 2);
        const i = d.variant + (d.light ? 3 : 0);
        // the dab is ~10 × 26 units in a 40-unit cell, base 12 below the centre
        const sx = d.wid / 10;
        const sy = d.len / 26;
        ctx.scale(sx, sy);
        ctx.drawImage(ds.canvas, cell * i * ds.scale, 0, cell * ds.scale, cell * ds.scale, -cell / 2, -cell / 2 - 1, cell, cell);
      }
      ctx.restore();
    }
  }
  if (ph.alpha <= 0.01) return;
  const pose = canPose(rig, u);
  const sprite = canSprite(rig.size * k);
  if (!sprite) return;
  ctx.save();
  ctx.globalAlpha *= pose.alpha;
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.side * pose.k, pose.k);
  ctx.drawImage(sprite.canvas, CAN_BOX.x, CAN_BOX.y, CAN_BOX.w, CAN_BOX.h);
  ctx.restore();
}
