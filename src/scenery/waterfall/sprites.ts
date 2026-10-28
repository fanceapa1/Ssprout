/**
 * The waterfall's boulder sprites: wet, dark stones in and beside the water, mossy ones on the
 * banks. They replace the garden's boulder for this scenery (`SceneArt.rockSprites`).
 */
import { createRng } from '../../core/rng';
import { PIGMENTS, createPainter, makeCanvas, mix, pointInPolygon, shade, type Quality } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Rock } from '../../scene/geometry';
import { rockOutline } from '../../scene/paint-pond';
import { rockBox, type RockSprites, type Sprite } from '../../scene/sprites';
import { POOL, STREAM } from './geometry';
import { ROCK_LIGHT, WET_ROCK } from './paint-rocks';

const MOSS = {
  light: PIGMENTS.sap,
  mid: mix(PIGMENTS.sap, PIGMENTS.sage, 0.5),
  shadow: mix(PIGMENTS.olive, PIGMENTS.sage, 0.4),
  dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.3),
};

function near(q: Pt, poly: readonly Pt[], d: number): boolean {
  return [0, d, -d].some((dx) => [0, d, -d].some((dy) => pointInPolygon({ x: q.x + dx, y: q.y + dy }, poly)));
}

/** Is this boulder in or at the edge of the pool or the stream (wet), or on a bank (mossy)? */
export function isWetRock(r: Rock): boolean {
  return near(r, POOL, 24) || near(r, STREAM, 24);
}

function clip(ctx: CanvasRenderingContext2D, shape: readonly Pt[]): void {
  ctx.save();
  ctx.beginPath();
  shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
}

/** One waterfall boulder, a generator that pauses after each mark (ADR 0226). */
export function* paintWaterfallRock(r: Rock, seed: number, scale: number, quality: Quality = 'normal'): Generator<void, Sprite, undefined> {
  const box = rockBox(r);
  const key = `${seed}:${r.id}:waterfall`;
  const canvas = makeCanvas(box.w * scale, box.h * scale);
  const p = createPainter(canvas, { seed: key, quality });
  p.ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  const rng = createRng(key);
  const wet = isWetRock(r);
  const outline = rockOutline(r, seed);

  // contact: a dark wet waterline in the water, a cool cast shadow on the bank
  yield* p.parts.glaze(
    { cx: r.x + r.w * 0.06, cy: r.y - r.h * 0.02, rx: r.w * (wet ? 0.56 : 0.52), ry: r.h * (wet ? 0.12 : 0.09) },
    wet ? mix(WET_ROCK, PIGMENTS.celadonDeep, 0.3) : shade(PIGMENTS.stoneDark, 0.35),
    { rng, opacity: wet ? 0.55 : 0.5, deform: 0.15 },
  );
  yield;
  yield* p.parts.stone(outline, {
    rng,
    pigment: wet ? mix(PIGMENTS.stoneDark, PIGMENTS.indigo, 0.08) : mix(PIGMENTS.stone, PIGMENTS.stoneDark, rng.range(0, 0.35)),
    warm: wet ? rng.range(0.02, 0.12) : rng.range(0.15, 0.35),
    light: ROCK_LIGHT,
    moss: wet ? rng.range(0.05, 0.15) : rng.range(0.45, 0.7),
    granulation: 0.5,
    ink: wet ? 0.35 : 0.25,
    patches: rng.int(2, 4),
    groundShadow: false,
  });
  yield;

  clip(p.ctx, outline);
  if (wet) {
    // the splashed lower half: darker, with a pale sheen on the lit shoulder
    yield* p.parts.glaze({ cx: r.x, cy: r.y - r.h * 0.12, rx: r.w * 0.6, ry: r.h * 0.42 }, WET_ROCK, {
      rng,
      opacity: 0.5,
      fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 },
    });
    yield;
    yield* p.parts.lift({ cx: r.x + r.w * 0.16, cy: r.y - r.h * 0.78, rx: r.w * 0.16, ry: r.h * 0.07, rotation: 0.35 }, { rng, amount: 0.45, deform: 0.3, layers: 6 });
    yield;
    // dark green slime at the waterline
    yield* p.parts.glaze({ cx: r.x, cy: r.y - r.h * 0.06, rx: r.w * 0.5, ry: r.h * 0.08 }, mix(PIGMENTS.olive, WET_ROCK, 0.5), { rng, opacity: 0.4, deform: 0.4 });
    p.ctx.restore();
  } else {
    p.ctx.restore();
    // a moss cushion on the top (unclipped: it bulges over the stone's outline)
    yield* p.parts.foliageClump({ x: r.x + r.w * rng.range(-0.15, 0.2), y: r.y - r.h * 0.86 }, r.w * rng.range(0.2, 0.28), MOSS, {
      rng,
      light: ROCK_LIGHT,
      flatness: 0.4,
      density: 0.8,
      dabSize: 0.3,
      gaps: 0.15,
      opacity: 0.7,
    });
  }
  yield;
  if (!wet) {
    for (let i = rng.int(1, 2); i > 0; i--) {
      const side = rng.chance(0.5) ? -1 : 1;
      p.grassTuft(
        { x: r.x + side * r.w * rng.range(0.3, 0.48), y: r.y + rng.range(1, 4) },
        { rng, height: Math.max(12, r.h * rng.range(0.3, 0.45)), blades: rng.int(5, 8), opacity: 0.6, pigments: [PIGMENTS.sageLight, PIGMENTS.sap, mix(PIGMENTS.sage, PIGMENTS.sap, 0.4)] },
      );
      if (i > 1) yield;
    }
  }
  return { id: r.id, box, depth: r.y, canvas };
}

export const WATERFALL_ROCKS: RockSprites = { box: rockBox, paint: paintWaterfallRock };
