/**
 * The pond: celadon water with bands and a pale reflection band, then static reflections of
 * the far bank, trees, boulders, shrubs and the pavilion — flipped, soft, low in contrast and
 * broken by horizontal lifted strokes, as a painter would suggest them.
 */
import { createRng, type Rng } from '../core/rng';
import {
  PIGMENTS,
  bounds,
  blob,
  deformPolygon,
  insetPolygon,
  mix,
  padRect,
  pointInPolygon,
  smoothPolygon,
  stoneShape,
  type Painter,
  type Pigment,
} from '../paint';
import type { Pt } from '../render/viewport';
import type { Rock, SceneGeometry } from './geometry';
import type { ShrubSpec, TreeSpec } from './layout';
import { pavilionFrame } from './paint-pavilion';
import { foliageFor } from './paint-trees';
import { atmos } from './paint-land';

const mirror = (pts: readonly Pt[], about: number): Pt[] => pts.map((q) => ({ x: q.x, y: 2 * about - q.y }));

/** Rock silhouettes are seeded per rock id so the sprite and its reflection agree. */
export function rockOutline(r: Rock, seed: number): Pt[] {
  return stoneShape(r.x, r.y, r.w, r.h, createRng(`${seed}:${r.id}`));
}

export function paintWater(p: Painter, rng: Rng, pond: readonly Pt[]): void {
  p.waterBody(pond, {
    rng,
    pigments: [
      mix(mix(PIGMENTS.celadon, PIGMENTS.washi, 0.2), PIGMENTS.stone, 0.15),
      mix(PIGMENTS.celadonMid, PIGMENTS.stone, 0.2),
      mix(mix(PIGMENTS.celadonDeep, PIGMENTS.celadonMid, 0.3), PIGMENTS.stoneDark, 0.2),
    ],
    bands: 6,
    ripples: 0,
    reflection: 0,
    farShadow: 0.6,
    granulation: 0.35,
  });
}

export interface ReflectionInput {
  scene: SceneGeometry;
  trees: readonly TreeSpec[];
  shrubs: readonly ShrubSpec[];
  /** scene seed (rock silhouettes) */
  seed: number;
}

/** All static reflections, painted into one soft, clipped wet layer. */
export function paintReflections(p: Painter, rng: Rng, input: ReflectionInput): void {
  const { scene } = input;
  const pond = scene.pond;
  const b = bounds(pond);
  const clip = smoothPolygon(insetPolygon(pond, 4), 1);
  const L = p.layer(padRect(b, 6));
  L.ctx.save();
  L.clip(clip);
  const fillBlob = (cx: number, cy: number, rx: number, ry: number, pig: Pigment, alpha: number) => {
    const shape = deformPolygon(blob(cx, cy, rx, ry, rng, { points: 18, irregularity: 0.2 }), rng, { depth: 2, variance: 0.12, cap: Math.min(rx, ry) * 0.1 });
    L.fill(shape, pig, alpha);
  };

  // the far bank's green, mirrored as a soft band under the far shore
  const shore = scene.waterline;
  for (let k = 0; k < 4; k++) {
    const band: Pt[] = [];
    for (let x = b.x - 20; x <= b.x + b.w + 20; x += 40) band.push({ x, y: shore + rng.range(-2, 4) });
    for (let x = b.x + b.w + 20; x >= b.x - 20; x -= 40) band.push({ x, y: shore + 26 + k * 3 + rng.range(-6, 6) });
    L.fill(band, mix(PIGMENTS.sap, PIGMENTS.celadonMid, 0.5), 0.12);
  }

  // trees: pads and trunks, mirrored about their shore line
  for (const t of input.trees) {
    if (t.reflectAbout === undefined) continue;
    const pig = mix(foliageFor(t.distance).mid, PIGMENTS.celadonDeep, 0.45);
    for (const [x, y, r] of t.pads) {
      const my = 2 * t.reflectAbout - y;
      fillBlob(x, my, r * 1.02, r * 0.5, pig, 0.32);
      fillBlob(x + rng.range(-0.2, 0.2) * r, my + r * 0.1, r * 0.7, r * 0.32, pig, 0.18);
    }
    const bark = mix(atmos(PIGMENTS.wood, t.distance), PIGMENTS.celadonDeep, 0.4);
    for (const stem of t.stems) {
      const m = mirror(stem, t.reflectAbout);
      const w = t.width * 0.9;
      const ribbon: Pt[] = [...m.map((q) => ({ x: q.x - w / 2, y: q.y })), ...m.reverse().map((q) => ({ x: q.x + w / 2, y: q.y }))];
      L.fill(ribbon, bark, 0.16);
    }
  }

  // shrubs near the water
  for (const s of input.shrubs) {
    const my = 2 * (s.y + 14) - (s.y - s.r * 0.5);
    fillBlob(s.x, my, s.r * 1.05, s.r * 0.45, mix(PIGMENTS.sap, PIGMENTS.celadonDeep, 0.5), 0.3);
  }

  // boulders: the stone's own silhouette, flipped about its base, darker and cooler
  for (const r of scene.rocks) {
    const shape = mirror(rockOutline(r, input.seed), r.y);
    const near = (r.y - 450) / 300; // near-edge rocks barely show (their reflection is hidden)
    L.fill(shape, mix(PIGMENTS.stoneDark, PIGMENTS.celadonDeep, 0.45), 0.3 * (1 - near * 0.6));
  }

  // the pavilion's posts and deck beam over the lobe
  const f = pavilionFrame(scene.pavilion);
  const about = f.deckY + 50;
  const wood = mix(PIGMENTS.wood, PIGMENTS.celadonDeep, 0.4);
  const beam: Pt[] = [
    { x: f.x0 + 8, y: f.deckY + 34 },
    { x: f.right, y: f.deckY + 20 },
    { x: f.right, y: f.deckY + 4 },
    { x: f.x0 + 8, y: f.deckY + 16 },
  ];
  L.fill(mirror(beam, about), wood, 0.4);
  for (const x of [f.post.x, f.inner.x]) {
    L.fill(
      [
        { x: x - 4.5, y: about },
        { x: x + 4.5, y: about },
        { x: x + 5, y: about + 150 },
        { x: x - 5, y: about + 150 },
      ],
      wood,
      0.35,
    );
  }
  L.ctx.restore();
  L.dry({ opacity: 0.6, edge: 0.18, edgeWidth: 2.5, sharpness: 0.25, centreLift: 0.05, granulation: 0.15, flow: 0.5, flowScale: 30 });

  // break the reflections with horizontal lifted strokes, denser toward the near water
  const lifts = rng.fork('lifts');
  for (let i = 0; i < 26; i++) {
    const y = b.y + b.h * (0.12 + 0.82 * (i / 26)) + lifts.range(-6, 6);
    const w = lifts.range(40, 180);
    const x = lifts.range(b.x + w * 0.4, b.x + b.w - w * 0.4);
    if (!pointInPolygon({ x: x - w * 0.45, y }, clip) || !pointInPolygon({ x: x + w * 0.45, y }, clip)) continue;
    p.lift({ cx: x, cy: y, rx: w / 2, ry: lifts.range(0.8, 2) }, { rng: lifts, amount: lifts.range(0.25, 0.5), deform: 0.2, spread: 0.3, layers: 4 });
  }
}

/**
 * The pale reflection band of the sky across the middle of the pond, a few quick ripple lines
 * and a broken ink accent under the far shore.
 */
export function paintWaterDetail(p: Painter, rng: Rng, pond: readonly Pt[]): void {
  const b = bounds(pond);
  const inside = (x: number, y: number) => pointInPolygon({ x, y }, pond);
  // sky reflection band: one long soft lift, broken into two pieces
  for (const [cx, w] of [
    [b.x + b.w * 0.36, b.w * 0.42],
    [b.x + b.w * 0.66, b.w * 0.3],
  ] as const) {
    const cy = b.y + b.h * 0.47 + rng.range(-6, 6);
    if (!inside(cx - w / 2, cy) || !inside(cx + w / 2, cy)) continue;
    p.lift({ cx, cy, rx: w / 2, ry: 5 }, { rng, amount: 0.42, deform: 0.15, spread: 0.4, sharpness: 0.2, layers: 6 });
  }
  // ripple lines (a quick hand, in two places)
  for (const [x, y, w] of [
    [b.x + b.w * 0.58, b.y + b.h * 0.66, 120],
    [b.x + b.w * 0.27, b.y + b.h * 0.58, 80],
    [b.x + b.w * 0.45, b.y + b.h * 0.8, 70],
  ] as const) {
    if (!inside(x - w / 2, y) || !inside(x + w / 2, y)) continue;
    p.ripple({ x, y }, { rng, width: w, count: rng.int(2, 3), opacity: 0.38, light: 0.7, lineWidth: 1.1 });
  }
  // the far shore's cut: a broken, faint ink line just under the back edge
  const back = pond.filter((q) => q.y < b.y + 24 && q.x > b.x + 40 && q.x < b.x + b.w * 0.85);
  if (back.length > 2) {
    p.inkLine(
      back.map((q) => ({ x: q.x, y: q.y + 4 })),
      { rng, width: 1.2, pigment: mix(PIGMENTS.celadonDeep, PIGMENTS.sumi, 0.35), opacity: 0.3, breaks: 0.5, wobble: 0.2 },
    );
  }
}
