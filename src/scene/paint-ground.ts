/**
 * The meadow's close-up texture (ADR 0186): the marks a painter puts into a grass wash that only
 * resolve when you lean in — varied wet-in-wet greens with pooled edges and a few back-runs,
 * granulation, and sparse grass strokes. Painted into the overview and the camera's detail
 * painting alike, from a world-anchored grid of cells, each with its own forked rng, so a
 * detail painting holds exactly the marks of the overview it replaces (no pop) and only the
 * cells near the painted rect are painted (a close view pays for its own corner only).
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, blob, createSimplex2D, deformPolygon, lighten, mix, organicOutline, outlineLayer, pointInPolygon, rgba, type Ctx2D, type Painter, type Pigment, type Pt, type Rect } from '../paint';
import { atmos, type Strokes } from './paint-land';
import { perspectiveScale } from './slots';

/** Where the meadow marks may go, and where they must not. */
export interface GroundArt {
  pond: readonly Pt[];
  /** the worn earth path (no grass on it) */
  path: readonly Pt[];
  /** the engawa's box (painted over the bank; marks would show through it) */
  pavilion: { x: number; y: number; w: number; h: number };
}

/** Top of the painted ground (the far bank's lip), world y. */
export const GROUND_TOP = 412;

/** The world rect a painter's canvas covers (its transform inverted): marks outside are culled. */
export function paintedRect(p: Painter): Rect {
  const m = p.ctx.getTransform();
  const sx = m.a || 1;
  const sy = m.d || 1;
  return { x: -m.e / sx, y: -m.f / sy, w: p.ctx.canvas.width / sx, h: p.ctx.canvas.height / sy };
}

const overlaps = (r: Rect, x: number, y: number, pad: number) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

/** 0 far (the far bank) … 1 near (the bottom of the sheet). */
const nearness = (y: number) => Math.max(0, Math.min(1, (y - GROUND_TOP) / (1000 - GROUND_TOP)));

/** Whether a mark of radius `r` at (x, y) lies on grass (not on the water, the path or under the engawa). */
export function onGrass(art: GroundArt, x: number, y: number, r: number): boolean {
  if (y < GROUND_TOP + r * 0.3) return false;
  const pv = art.pavilion;
  if (x > pv.x - r && y < pv.y + pv.h + r) return false;
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r * 0.6], [0, -r * 0.6]] as const) {
    const q = { x: x + dx, y: y + dy };
    if (pointInPolygon(q, art.pond) || pointInPolygon(q, art.path)) return false;
  }
  return true;
}

/** Greens for the meadow's wet-in-wet patches (cool sage, yellow sap, a touch of gold, a blue-green). */
const PATCH_GREENS: readonly Pigment[] = [
  PIGMENTS.sap,
  mix(PIGMENTS.sap, PIGMENTS.gold, 0.28),
  mix(PIGMENTS.sage, PIGMENTS.celadonMid, 0.3),
  mix(PIGMENTS.sage, PIGMENTS.sap, 0.5),
  mix(PIGMENTS.olive, PIGMENTS.sap, 0.55),
  lighten(mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.5), 0.04),
];

const BLADE_GREENS: readonly Pigment[] = [PIGMENTS.sage, mix(PIGMENTS.olive, PIGMENTS.sage, 0.5), mix(PIGMENTS.sap, PIGMENTS.sage, 0.4), mix(PIGMENTS.olive, PIGMENTS.gold, 0.18)];

/** Patch cells (world units) and grass cells. */
const PATCH_CELL = { w: 120, h: 44 };
const GRASS_CELL = { w: 34, h: 22 };

/**
 * Paint the meadow texture. Call after the banks (and before the pond reserve and the path, whose
 * lifts then clean the rim and the earth).
 */
export function* paintMeadow(p: Painter, rng: Rng, art: GroundArt): Strokes {
  const view = paintedRect(p);
  const area = meadowArea(view);
  if (area) yield* paintPatches(p, rng.fork('patches'), art, view, area);
}

/** Sparse grass strokes over the meadow (a step of its own: the background yields between steps). */
export function* paintMeadowGrass(p: Painter, rng: Rng, art: GroundArt): Strokes {
  const view = paintedRect(p);
  const area = meadowArea(view);
  if (area) yield* paintGrass(p, rng.fork('grass'), art, view, area);
}

/** The part of the ground a painter's canvas shows (null: none of it). */
function meadowArea(view: Rect): Rect | null {
  const top = Math.max(view.y, GROUND_TOP - 20);
  const bottom = Math.min(view.y + view.h, 1000);
  if (bottom <= top) return null;
  const x0 = Math.max(-10, view.x - 10);
  const x1 = Math.min(1610, view.x + view.w + 10);
  return { x: x0, y: top - 10, w: x1 - x0, h: bottom - top + 20 };
}

/** Wet-in-wet green patches in one layer: they bleed where they touch, pool where they stop, and a few have back-runs. */
function* paintPatches(p: Painter, rng: Rng, art: GroundArt, view: Rect, area: Rect): Strokes {
  const L = p.layer(area);
  if (L.empty) {
    L.discard();
    return;
  }
  const c = L.ctx;
  const i0 = Math.floor((view.x - 120) / PATCH_CELL.w);
  const i1 = Math.ceil((view.x + view.w + 120) / PATCH_CELL.w);
  const j0 = Math.max(0, Math.floor((Math.max(view.y, GROUND_TOP) - GROUND_TOP - 80) / PATCH_CELL.h));
  const j1 = Math.ceil((Math.min(view.y + view.h, 1000) - GROUND_TOP + 80) / PATCH_CELL.h);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const r = rng.fork(`p${i},${j}`);
      const x = (i + r.range(0.1, 0.9)) * PATCH_CELL.w;
      const y = GROUND_TOP + (j + r.range(0.1, 0.9)) * PATCH_CELL.h;
      const k = perspectiveScale(y);
      const rx = r.range(55, 120) * k * 1.25;
      const ry = rx * r.range(0.22, 0.34);
      if (!overlaps(view, x, y, rx + 10) || !onGrass(art, x, y, rx * 0.6)) continue;
      if (r.next() < 0.25) continue; // some cells stay plain
      const near = nearness(y);
      const pig = atmos(r.pick(PATCH_GREENS), 1 - near);
      const o = organicOutline(blob(x, y, rx, ry, r, { irregularity: 0.22, rotation: r.range(-0.08, 0.08) }), r, { deform: 0.3 });
      const n = 4;
      const a = 0.07 + 0.07 * near;
      for (let q = 0; q < n; q++) {
        const poly = outlineLayer(o, r, 0.5);
        c.beginPath();
        poly.forEach((pt, idx) => (idx ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
        c.closePath();
        c.fillStyle = rgba(pig, a);
        c.fill();
      }
      // a back-run: water crept back into the drying patch, a pale crinkled bloom with a darker fringe
      if (r.next() < 0.22) {
        const br = rx * r.range(0.22, 0.38);
        const bx = x + r.range(-0.3, 0.3) * rx;
        const by = y + r.range(-0.2, 0.2) * ry;
        const shape = deformPolygon(blob(bx, by, br, br * 0.6, r, { points: 30, irregularity: 0.25, scallop: 1, scallops: r.int(6, 10) }), r, { depth: 2, variance: 0.2, cap: br * 0.08 });
        L.lift(shape, r.range(0.3, 0.5));
      }
    }
    // rasterise the row now, in its own part, not all rows in the drying pass's read (ADR 0238)
    L.flush();
    // a row of cells at a time: the layer stays open (and wet) between them
    yield;
  }
  yield* L.dryParts({ opacity: 0.55, edge: 0.22, edgeWidth: 2.2, sharpness: 0.3, centreLift: 0.12, granulation: 0.45, granules: 0.22, flow: 0.65, flowScale: 60, darken: 0.2 });
}

/** Sparse grass strokes in small clusters, finer and paler toward the far bank. */
function* paintGrass(p: Painter, rng: Rng, art: GroundArt, view: Rect, area: Rect): Strokes {
  const L = p.layer(area);
  if (L.empty) {
    L.discard();
    return;
  }
  const c = L.ctx;
  // grass comes in drifts: a coarse world-anchored noise gates where clusters may grow
  const drift = createSimplex2D(rng.fork('drift'));
  const i0 = Math.floor((view.x - 40) / GRASS_CELL.w);
  const i1 = Math.ceil((view.x + view.w + 40) / GRASS_CELL.w);
  const j0 = Math.max(0, Math.floor((Math.max(view.y, GROUND_TOP) - GROUND_TOP - 30) / GRASS_CELL.h));
  const j1 = Math.ceil((Math.min(view.y + view.h, 1000) - GROUND_TOP + 30) / GRASS_CELL.h);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const r = rng.fork(`g${i},${j}`);
      const x = (i + r.next()) * GRASS_CELL.w;
      const y = GROUND_TOP + (j + r.next()) * GRASS_CELL.h;
      const near = nearness(y);
      // clusters thicken toward the viewer and along the bank lips; most of the meadow stays a wash
      const gate = Math.max(0, Math.min(1, 0.5 + 0.9 * drift(x / 170, y / 70)));
      if (r.next() > (0.08 + 0.5 * near) * gate * gate) continue;
      const k = perspectiveScale(y) * 1.25;
      if (!overlaps(view, x, y, 20 * k) || !onGrass(art, x, y, 8 * k)) continue;
      const blades = r.int(3, 7);
      for (let b = 0; b < blades; b++) {
        const bx = x + r.range(-5, 5) * k;
        const h = r.range(5, 14) * k;
        const lean = r.range(-0.45, 0.45) + (bx - x) * 0.03;
        const w = r.range(0.7, 1.15) * k;
        const pig = atmos(r.pick(BLADE_GREENS), (1 - near) * 0.8);
        c.fillStyle = rgba(pig, r.range(0.5, 0.85));
        c.beginPath();
        bladePath(c, bx, y, h, lean, w, r.range(-0.25, 0.25));
        c.fill();
      }
    }
    // rasterise the row now, in its own part, not all rows in the drying pass's read (ADR 0238)
    L.flush();
    // a row of cells at a time: the layer stays open (and wet) between them
    yield;
  }
  yield* L.dryParts({ opacity: 0.55, edge: 0.3, edgeWidth: 0.5, sharpness: 0.78, centreLift: 0.05, granulation: 0.12, flow: 0.3, flowScale: 10, darken: 0.22 });
}

/** A tapered, slightly curved blade from its root at (x, y). */
function bladePath(c: Ctx2D, x: number, y: number, h: number, lean: number, w: number, curl: number): void {
  const tipX = x + Math.sin(lean) * h;
  const tipY = y - Math.cos(lean) * h;
  const mx = x + Math.sin(lean) * h * 0.55 + curl * h * 0.3;
  const my = y - Math.cos(lean) * h * 0.55;
  c.moveTo(x - w / 2, y);
  c.quadraticCurveTo(mx - w * 0.3, my, tipX, tipY);
  c.quadraticCurveTo(mx + w * 0.3, my, x + w / 2, y);
  c.closePath();
}
