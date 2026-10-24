/**
 * The pavilion: an engawa corner at the right edge overlooking the pond's lobe — a shallow
 * roof with an ink-lined eave, two posts, a board wall, the raised veranda deck and a small
 * paper lantern hanging under the eave (its night glow belongs to the lighting system).
 */
import type { Rng } from '../core/rng';
import { PIGMENTS, PAPER_WHITE, lighten, mix, shade, type Painter } from '../paint';
import type { Pt } from '../render/viewport';
import type { SceneGeometry } from './geometry';
import type { Strokes } from './paint-land';

/** Key points of the structure (world units), derived from the scene's pavilion box. */
export function pavilionFrame(pv: SceneGeometry['pavilion']) {
  const x0 = pv.x;
  const right = pv.x + pv.w + 20; // runs off the right edge of the world
  const eaveL: Pt = { x: x0 + 2, y: pv.y + 78 };
  const eaveR: Pt = { x: right, y: pv.y + 38 };
  const ridgeL: Pt = { x: x0 + 62, y: pv.y + 26 };
  const ridgeR: Pt = { x: right, y: pv.y - 10 };
  const deckY = pv.y + pv.h - 40; // top of the deck at the front post
  const post: Pt = { x: x0 + 32, y: deckY + 22 };
  const inner: Pt = { x: x0 + 194, y: deckY + 8 };
  const eaveAt = (x: number) => eaveL.y + ((eaveR.y - eaveL.y) * (x - eaveL.x)) / (eaveR.x - eaveL.x);
  return { x0, right, eaveL, eaveR, ridgeL, ridgeR, deckY, post, inner, eaveAt, lantern: pv.lantern };
}

export function* paintPavilion(p: Painter, rng: Rng, pv: SceneGeometry['pavilion']): Strokes {
  const f = pavilionFrame(pv);
  const wood = PIGMENTS.wood;
  const woodLight = PIGMENTS.woodLight;
  const ink = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.25);

  // reserve the structure so it sits in front of the far tree and bank
  const silhouette: Pt[] = [f.eaveL, f.ridgeL, f.ridgeR, { x: f.right, y: f.deckY + 40 }, { x: f.x0 + 6, y: f.deckY + 42 }];
  yield* p.parts.lift(silhouette, { rng, amount: 0.5, deform: 0.03, layers: 6 });
  yield;

  // wall behind the veranda: pale boards, darker under the eave
  const wall: Pt[] = [
    { x: f.inner.x, y: f.eaveAt(f.inner.x) + 4 },
    { x: f.right, y: f.eaveR.y + 6 },
    { x: f.right, y: f.deckY - 8 },
    { x: f.inner.x, y: f.deckY - 2 },
  ];
  yield* p.parts.wash(wall, lighten(woodLight, 0.18), { rng, deform: 0.03, spread: 0.06, opacity: 0.42, edge: 0.3, flow: 0.5, flowScale: 50, granulation: 0.3 });
  yield;
  yield* p.parts.glaze(
    [wall[0]!, wall[1]!, { x: f.right, y: f.eaveR.y + 90 }, { x: f.inner.x, y: f.eaveAt(f.inner.x) + 96 }],
    shade(woodLight, 0.3),
    { rng, opacity: 0.3, fade: { angle: Math.PI / 2, start: 0.35, amount: 1 } },
  );
  yield;
  // board seams and a rail
  for (let x = f.inner.x + 24; x < f.right - 8; x += 27 + rng.range(-3, 3)) {
    p.inkLine([{ x, y: f.eaveAt(x) + 10 }, { x: x + rng.range(-1, 1), y: f.deckY - 6 }], { rng, width: 0.9, pigment: mix(ink, woodLight, 0.4), opacity: 0.45, breaks: 0.35 });
    yield;
  }
  p.inkLine([{ x: f.inner.x, y: f.deckY - 92 }, { x: f.right, y: f.deckY - 96 }], { rng, width: 1.4, pigment: ink, opacity: 0.6 });
  yield;
  // an open shoji panel: paper left white, framed by thin lines
  const sx = f.inner.x + 30;
  const sy = f.deckY - 210;
  yield* p.parts.lift([{ x: sx, y: sy }, { x: sx + 62, y: sy - 4 }, { x: sx + 62, y: sy + 104 }, { x: sx, y: sy + 108 }], { rng, amount: 0.55, deform: 0.02 });
  yield;
  for (let k = 0; k <= 3; k++) {
    const y = sy + k * 36;
    p.inkLine([{ x: sx, y }, { x: sx + 62, y: y - 4 }], { rng, width: 0.8, pigment: ink, opacity: 0.4 });
    yield;
  }

  // roof plane with board lines running up the slope
  const roof: Pt[] = [f.eaveL, f.ridgeL, f.ridgeR, f.eaveR];
  yield* p.parts.wash(roof, mix(PIGMENTS.stoneDark, wood, 0.45), { rng, deform: 0.03, spread: 0.06, opacity: 0.6, edge: 0.45, granulation: 0.4, flow: 0.5, flowScale: 40 });
  yield;
  const n = 15;
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const a = { x: f.eaveL.x + (f.eaveR.x - f.eaveL.x) * t, y: f.eaveL.y + (f.eaveR.y - f.eaveL.y) * t };
    const b = { x: f.ridgeL.x + (f.ridgeR.x - f.ridgeL.x) * t, y: f.ridgeL.y + (f.ridgeR.y - f.ridgeL.y) * t };
    p.inkLine([a, { x: b.x, y: b.y + 2 }], { rng, width: 0.9, pigment: ink, opacity: 0.4, breaks: 0.3 });
    yield;
  }
  p.inkLine([f.eaveL, f.ridgeL], { rng, width: 1.4, pigment: ink, opacity: 0.7 });
  yield;
  // fascia: a dark band under the eave, then the crisp eave line
  const fascia: Pt[] = [f.eaveL, f.eaveR, { x: f.eaveR.x, y: f.eaveR.y + 9 }, { x: f.eaveL.x + 4, y: f.eaveL.y + 9 }];
  yield* p.parts.wash(fascia, mix(wood, PIGMENTS.sumi, 0.3), { rng, deform: 0.02, spread: 0.04, opacity: 0.75, edge: 0.35 });
  yield;
  p.inkLine([{ x: f.eaveL.x - 4, y: f.eaveL.y + 1 }, { x: f.eaveR.x, y: f.eaveR.y }], { rng, width: 2.2, pigment: ink, opacity: 0.85, pressure: [1.3, 1, 0.9] });
  yield;

  // posts
  const postTop = f.eaveAt(f.post.x) + 9;
  p.stroke([{ x: f.post.x, y: postTop }, { x: f.post.x + 1, y: f.post.y + 20 }], { rng, pigment: wood, width: 9, wetness: 0.25, wobble: 0.1, taper: [0, 0], opacity: 0.8 });
  yield;
  p.inkLine([{ x: f.post.x - 4.5, y: postTop }, { x: f.post.x - 3.5, y: f.post.y + 20 }], { rng, width: 1.2, pigment: ink, opacity: 0.7, breaks: 0.2 });
  yield;
  p.inkLine([{ x: f.post.x + 4.5, y: postTop }, { x: f.post.x + 5.5, y: f.post.y + 20 }], { rng, width: 1, pigment: ink, opacity: 0.5, breaks: 0.4 });
  yield;
  const innerTop = f.eaveAt(f.inner.x) + 9;
  p.stroke([{ x: f.inner.x, y: innerTop }, { x: f.inner.x, y: f.inner.y }], { rng, pigment: mix(wood, woodLight, 0.4), width: 7, wetness: 0.25, wobble: 0.1, taper: [0, 0], opacity: 0.75 });
  yield;
  p.inkLine([{ x: f.inner.x - 3.5, y: innerTop }, { x: f.inner.x - 3.5, y: f.inner.y }], { rng, width: 1, pigment: ink, opacity: 0.55, breaks: 0.3 });
  yield;
  // rail between the posts
  p.inkLine([{ x: f.post.x + 4, y: f.deckY - 88 }, { x: f.inner.x - 4, y: f.deckY - 94 }], { rng, width: 1.6, pigment: ink, opacity: 0.6 });
  yield;

  // veranda deck: lit top boards and a darker front beam
  const deckTop: Pt[] = [
    { x: f.x0 + 4, y: f.deckY },
    { x: f.right, y: f.deckY - 12 },
    { x: f.right, y: f.deckY + 4 },
    { x: f.x0 + 8, y: f.deckY + 16 },
  ];
  yield* p.parts.wash(deckTop, lighten(woodLight, 0.08), { rng, deform: 0.02, spread: 0.05, opacity: 0.6, edge: 0.3, granulation: 0.25 });
  yield;
  const beam: Pt[] = [
    deckTop[3]!,
    deckTop[2]!,
    { x: f.right, y: f.deckY + 20 },
    { x: f.x0 + 12, y: f.deckY + 34 },
  ];
  yield* p.parts.wash(beam, mix(wood, PIGMENTS.sumi, 0.15), { rng, deform: 0.02, spread: 0.05, opacity: 0.72, edge: 0.4, granulation: 0.3 });
  yield;
  p.inkLine([deckTop[3]!, deckTop[2]!], { rng, width: 1.5, pigment: ink, opacity: 0.75 });
  yield;
  p.inkLine([beam[3]!, beam[2]!], { rng, width: 1.2, pigment: ink, opacity: 0.5, breaks: 0.35 });
  yield;
  // the deck stands on the bank: a dark crawl space under it, footing stones under the posts,
  // a cool shadow on the grass in front and the flat step stone (kutsunugi-ishi) at its edge
  const under: Pt[] = [
    beam[3]!,
    beam[2]!,
    { x: f.right, y: f.deckY + 40 },
    { x: f.x0 + 14, y: f.deckY + 48 },
  ];
  yield* p.parts.wash(under, mix(PIGMENTS.shadow, PIGMENTS.sumi, 0.35), { rng, deform: 0.03, spread: 0.06, opacity: 0.5, edge: 0.2, granulation: 0.2, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.7 } });
  yield;
  for (const x of [f.post.x, f.inner.x]) {
    yield* p.parts.stone({ cx: x + 1, cy: f.deckY + 47, rx: 9, ry: 4 }, { rng, pigment: PIGMENTS.stone, moss: 0, ink: 0.3, groundShadow: false, patches: 0 });
    yield;
  }
  yield* p.parts.glaze({ cx: f.x0 + 170, cy: f.deckY + 54, rx: 190, ry: 14 }, PIGMENTS.shadow, { rng, opacity: 0.28, fade: { angle: Math.PI / 2, start: 0.35 } });
  yield;
  yield* p.parts.glaze({ cx: f.x0 + 100, cy: f.deckY + 68, rx: 40, ry: 7 }, mix(PIGMENTS.stoneDark, PIGMENTS.sage, 0.4), { rng, opacity: 0.25 });
  yield;
  yield* p.parts.stone(
    { cx: f.x0 + 96, cy: f.deckY + 62, rx: 36, ry: 10, rotation: -0.04 },
    { rng, pigment: mix(PIGMENTS.stone, PIGMENTS.stoneWarm, 0.35), warm: 0.4, moss: 0.08, granulation: 0.45, ink: 0.28, groundShadow: false, patches: 1 },
  );
  yield;

  // hanging paper lantern
  const L = f.lantern;
  const top = f.eaveAt(L.x) + 8;
  p.inkLine([{ x: L.x, y: top }, { x: L.x, y: L.y - 14 }], { rng, width: 0.8, pigment: ink, opacity: 0.7, breaks: 0 });
  yield;
  yield* p.parts.lift({ cx: L.x, cy: L.y, rx: 10, ry: 13.5 }, { rng, amount: 0.9, paper: PAPER_WHITE });
  yield;
  yield* p.parts.wash({ cx: L.x, cy: L.y, rx: 10, ry: 13.5 }, mix(PIGMENTS.washi, PIGMENTS.gold, 0.35), { rng, opacity: 0.55, edge: 0.6, centreLift: 0.5, deform: 0.05 });
  yield;
  for (const dy of [-13, 13]) {
    p.stroke([{ x: L.x - 6, y: L.y + dy }, { x: L.x + 6, y: L.y + dy }], { rng, pigment: mix(PIGMENTS.sumi, wood, 0.3), width: 3, taper: [0, 0], wobble: 0, opacity: 0.8 });
    yield;
  }
  p.inkLine([{ x: L.x - 9, y: L.y - 2 }, { x: L.x + 9, y: L.y - 3 }], { rng, width: 0.6, pigment: PIGMENTS.vermilion, opacity: 0.35, breaks: 0 });
}
