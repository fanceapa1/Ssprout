/**
 * The moored caique (G3): a small double-ended Greek fishing boat, white with a blue sheer strake
 * and a red band at the waterline, a short mast with its sail furled on the yard, a mooring line to
 * a buoy, and its broken reflection. Lit from the left. docs/systems/scenery.md › Coast › Water.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, blob, lighten, mix, rgba, ribbon, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { CAIQUE } from './layout';
import { CAIQUE_SCALE, CAIQUE_SHAPES } from './sea';

export const BOAT = {
  white: '#f3f0e8',
  shade: '#9fb2c4',
  blue: '#1f5fa6',
  red: '#c23a2e',
  wood: '#8a6440',
  woodDark: '#4e3a2a',
  sail: '#e6d7b6',
  sailShade: '#b39c78',
  rope: '#6a5a46',
  water: '#1f5f8e',
} satisfies Record<string, Pigment>;

const k = CAIQUE_SCALE;
const at = (x: number, y: number): Pt => ({ x: CAIQUE.x + x * k, y: CAIQUE.y + y * k });

function fillPaper(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

/** A strip `w` thick hanging below (`side` 1) or standing above (-1) a line. */
const band = (line: readonly Pt[], w: number, side: 1 | -1): Pt[] => [...line, ...line.slice().reverse().map((q) => ({ x: q.x, y: q.y + w * side }))];

/** The caique: its reflection and shade on the water first, then the hull, rig and mooring. */
export function* paintCaique(p: Painter, rng: Rng): Strokes {
  yield* paintReflection(p, rng.fork('reflection'));
  yield* paintHull(p, rng.fork('hull'));
  yield* paintRig(p, rng.fork('rig'));
}

function* paintReflection(p: Painter, rng: Rng): Strokes {
  // the white hull mirrored soft, then broken into pieces pushed sideways by the swell, wider gaps deeper down
  const mirror = CAIQUE_SHAPES.hull.map((q) => ({ x: q.x, y: CAIQUE.y + (CAIQUE.y - q.y) * 0.6 }));
  yield* p.parts.lift(mirror, { rng, amount: 0.15, layers: 5, deform: 0.08, spread: 0.12, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.8 } });
  const pale = p.layer({ x: CAIQUE.x - 60, y: CAIQUE.y - 4, w: 120, h: 40 });
  for (let y = 1.4; y < 17; y += rng.range(1.6, 3.4) * (1 + y / 20)) {
    const half = 36 - y * 1.6;
    for (let x = -half + rng.range(0, 6); x < half; ) {
      const len = rng.range(6, 22);
      const dx = Math.sin(y * 0.9 + x * 0.05) * 2.2;
      if (rng.chance(0.8)) pale.fill(band([at(x + dx, y), at(Math.min(half, x + len) + dx, y + rng.range(-0.4, 0.4))], rng.range(0.6, 1.4) * k, 1), PAPER_WHITE, 0.75);
      x += len + rng.range(1, 6);
    }
  }
  yield* pale.dryParts({ opacity: 0.65, edge: 0.05, sharpness: 0.5, centreLift: 0, granulation: 0, flow: 0.3, blend: 'source-over' });
  yield;
  // the red and blue bands mirrored, broken; the mast's wavering line
  const col = p.layer({ x: CAIQUE.x - 60, y: CAIQUE.y - 4, w: 120, h: 70 });
  for (let j = 0; j < 5; j++) {
    const x0 = rng.range(-30, 10);
    const y = 0.6 + rng.range(0, 2.5);
    col.fill(band([at(x0, y), at(x0 + rng.range(6, 24), y + rng.range(-0.3, 0.3))], rng.range(0.5, 1) * k, 1), BOAT.red, 0.5);
  }
  for (let j = 0; j < 6; j++) {
    const x0 = rng.range(-36, 16);
    const y = rng.range(9, 15);
    col.fill(band([at(x0, y), at(x0 + rng.range(5, 18), y + rng.range(-0.3, 0.3))], rng.range(0.5, 1) * k, 1), BOAT.blue, 0.5);
  }
  for (let j = 0; j < 9; j++) {
    const y = 3 + j * 4.2;
    const x = -9 + Math.sin(j * 1.3) * (1.5 + j * 0.3);
    col.fill(band([at(x - 0.6, y), at(x + 0.6 + rng.range(-1, 1), y + 3)], 0.8 * k, 1), BOAT.woodDark, 0.6 - j * 0.05);
  }
  yield* col.dryParts({ opacity: 0.6, edge: 0.2, edgeWidth: 0.8, sharpness: 0.5, centreLift: 0.1, granulation: 0.2, flow: 0.4, flowScale: 10 });
  yield;
  // the hull's shade where it sits in the water
  yield* p.parts.glaze(band(CAIQUE_SHAPES.waterline.map((q) => ({ x: q.x, y: q.y + 0.5 })), 2.2 * k, 1), BOAT.water, { rng, opacity: 0.55, layers: 6, deform: 0.1, spread: 0.15, edge: 0.1 });
  yield;
  // the mooring line under the surface, and the buoy's ring
  const { buoy } = CAIQUE_SHAPES;
  p.stroke([at(-80, 2.5), at(-90, 3.5), { x: buoy.x + 3, y: buoy.y + 1 }], { rng, pigment: mix(BOAT.rope, BOAT.water, 0.6), width: 0.7, opacity: 0.35, wetness: 0.4, wobble: 0.4, taper: [0.1, 0.3] });
  p.ripple({ x: buoy.x, y: buoy.y + 1.5 }, { rng, width: 14 * k, count: 2, squash: 0.18, pigment: BOAT.water, opacity: 0.35, light: 0.8, lineWidth: 0.6 });
  yield;
}

function* paintHull(p: Painter, rng: Rng): Strokes {
  const S = CAIQUE_SHAPES;
  // the white hull reserved, a cool shade lower where it turns under, the stern turned from the light
  fillPaper(p, S.hull);
  yield* p.parts.wash([...S.hull], BOAT.white, { rng, opacity: 0.35, layers: 5, deform: 0.01, spread: 0.01, edge: 0.3, edgeWidth: 1, sharpness: 0.9, granulation: 0.2 });
  yield;
  yield* p.parts.glaze(band(S.waterline.map((q) => ({ x: q.x, y: q.y - 6 * k })), 5 * k, 1), BOAT.shade, { rng, opacity: 0.35, layers: 6, deform: 0.04, spread: 0.08, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1 } });
  yield* p.parts.glaze([at(26, -13), at(44, -18), at(42, -6), at(30, -1), at(20, -1)], BOAT.shade, { rng, opacity: 0.35, layers: 5, deform: 0.05, spread: 0.08, fade: { angle: Math.PI, start: 0.4, amount: 1 } });
  yield;
  // the inside of the far gunwale, warm wood seen over the near sheer
  fillPaper(p, S.inside);
  yield* p.parts.wash([...S.inside], mix(BOAT.wood, BOAT.sail, 0.35), { rng, opacity: 0.75, layers: 5, deform: 0.01, spread: 0.02, edge: 0.4, edgeWidth: 0.8, sharpness: 0.85, granulation: 0.3 });
  yield;
  // the blue sheer strake and the red band at the waterline
  const sheer = S.sheer.map((q) => ({ x: q.x, y: q.y - 0.3 }));
  yield* p.parts.wash(band(sheer, 2.6 * k, 1), BOAT.blue, { rng, opacity: 0.9, layers: 6, deform: 0.01, spread: 0.01, edge: 0.35, edgeWidth: 0.8, sharpness: 0.9, granulation: 0.2 });
  yield* p.parts.wash(band(S.waterline.map((q) => ({ x: q.x, y: q.y + 0.4 })), 2.8 * k, -1), BOAT.red, { rng, opacity: 0.85, layers: 6, deform: 0.01, spread: 0.01, edge: 0.35, edgeWidth: 0.8, sharpness: 0.9, granulation: 0.2 });
  yield;
  // the gunwale's dark cap, the rubbing strake's line, the stem and sternpost heads
  p.stroke(S.sheer.map((q) => ({ x: q.x, y: q.y - 0.4 })), { rng, pigment: BOAT.woodDark, width: 0.9 * k, opacity: 0.75, wetness: 0.15, wobble: 0.1, taper: [0.02, 0.02] });
  p.stroke(S.sheer.map((q) => ({ x: q.x, y: q.y + 3.4 * k })), { rng, pigment: mix(BOAT.blue, BOAT.woodDark, 0.4), width: 0.6 * k, opacity: 0.5, wetness: 0.1, wobble: 0.1, taper: [0.1, 0.1] });
  p.stroke([at(-45, -21), at(-49, -27.5)], { rng, pigment: BOAT.blue, width: 1.4 * k, opacity: 0.9, wetness: 0.1, taper: [0, 0.2] });
  p.stroke([at(43, -19), at(44.5, -22)], { rng, pigment: BOAT.blue, width: 1.2 * k, opacity: 0.85, wetness: 0.1, taper: [0, 0.2] });
  // a lit edge along the sheer, the sun from the left
  p.stroke(S.sheer.slice(2).map((q) => ({ x: q.x, y: q.y + 0.9 * k })), { rng, pigment: lighten(BOAT.blue, 0.5), width: 0.5 * k, opacity: 0.6, wetness: 0.1, wobble: 0.1, taper: [0.2, 0.4], blend: 'source-over' });
  yield;
}

function* paintRig(p: Painter, rng: Rng): Strokes {
  const S = CAIQUE_SHAPES;
  // the mast, and the yard with the sail furled along it, lit on top
  p.stroke([...S.mast], { rng, pigment: BOAT.wood, width: 1.5 * k, opacity: 0.9, wetness: 0.15, wobble: 0.1, taper: [0, 0.35] });
  const [y0, y1] = S.yard;
  const yard = [y0!, { x: (y0!.x + y1!.x) / 2, y: (y0!.y + y1!.y) / 2 + 1 }, y1!];
  const furl = ribbon(yard, (t) => (1.2 + 2.2 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * k);
  fillPaper(p, furl);
  yield* p.parts.wash(furl, BOAT.sail, { rng, opacity: 0.75, layers: 6, deform: 0.03, spread: 0.04, edge: 0.4, edgeWidth: 0.8, sharpness: 0.8, granulation: 0.35 });
  yield* p.parts.glaze(ribbon(yard, (t) => 1.6 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * k, (t) => 1.8 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * k), BOAT.sailShade, { rng, opacity: 0.55, layers: 5, deform: 0.05, spread: 0.06 });
  yield;
  for (let t = 0.18; t < 0.9; t += 0.16) {
    const q = { x: y0!.x + (y1!.x - y0!.x) * t, y: y0!.y + (y1!.y - y0!.y) * t + 0.6 };
    p.stroke([{ x: q.x - 0.6, y: q.y - 2 * k }, { x: q.x + 0.6, y: q.y + 2 * k }], { rng, pigment: BOAT.rope, width: 0.5 * k, opacity: 0.65, wetness: 0.1, taper: [0.1, 0.1] });
  }
  // the halyard down the mast, the mooring line from the stem to the water, the buoy
    p.stroke([...S.mooring], { rng, pigment: BOAT.rope, width: 0.45 * k, opacity: 0.6, wetness: 0.15, wobble: 0.2, taper: [0.05, 0.3] });
  const { buoy } = S;
  fillPaper(p, blob(buoy.x, buoy.y - 1.6, 2.6 * k, 2.1 * k, rng, { points: 12 }));
  p.dab({ x: buoy.x, y: buoy.y }, BOAT.red, { rng, variant: 'round', angle: -Math.PI / 2, length: 3.6 * k, width: 4 * k, opacity: 0.85, pool: 0.3 });
  yield;
}
