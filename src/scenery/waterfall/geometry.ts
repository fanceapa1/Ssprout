/**
 * The waterfall's geometry in world units (1600 × 1000): the falls, the plunge pool, the stream,
 * the boulders, the trail and the slots. Composition map and reasoning:
 * docs/systems/scenery.md › Waterfall. Painting-only layout (skyline, cliff, ledges) is in `layout.ts`.
 */
import type { Falls, Rock, SceneGeometry, Stone } from '../../scene/geometry';
import type { Pt } from '../../render/viewport';
import { WATERFALL_SLOTS } from './slots';

/** One sheet off the notch's lip, a little left of centre, widening as it drops into the pool. */
export const FALLS: Falls = {
  outline: [
    { x: 564, y: 296 },
    { x: 660, y: 296 },
    { x: 668, y: 400 },
    { x: 676, y: 500 },
    { x: 688, y: 606 },
    { x: 542, y: 606 },
    { x: 550, y: 500 },
    { x: 556, y: 400 },
  ],
  lip: [
    { x: 566, y: 296 },
    { x: 612, y: 291 },
    { x: 658, y: 296 },
  ],
  foot: { x: 615, y: 608 },
};

/**
 * The plunge pool: its back edge is the cliff's foot, its right end opens into the stream.
 * Clockwise from the left end.
 */
export const POOL: Pt[] = [
  { x: 452, y: 640 },
  { x: 480, y: 612 },
  { x: 532, y: 600 },
  { x: 600, y: 597 },
  { x: 680, y: 598 },
  { x: 760, y: 604 },
  { x: 840, y: 612 },
  { x: 910, y: 624 },
  { x: 964, y: 644 },
  { x: 995, y: 672 },
  { x: 1010, y: 700 },
  { x: 985, y: 716 },
  { x: 940, y: 730 },
  { x: 870, y: 742 },
  { x: 780, y: 748 },
  { x: 690, y: 746 },
  { x: 610, y: 738 },
  { x: 540, y: 722 },
  { x: 484, y: 700 },
  { x: 454, y: 672 },
];

/** The far edge the cliff's reflection mirrors about. */
export const WATERLINE = 598;

/** The stream's centre line from the pool's outflow toward the viewer, and its half-width there. */
export const STREAM_LINE: readonly (Pt & { half: number })[] = [
  { x: 985, y: 704, half: 24 },
  { x: 1040, y: 740, half: 26 },
  { x: 1110, y: 774, half: 30 },
  { x: 1170, y: 816, half: 34 },
  { x: 1190, y: 864, half: 38 },
  { x: 1150, y: 914, half: 44 },
  { x: 1090, y: 958, half: 50 },
  { x: 1076, y: 1004, half: 56 },
  { x: 1096, y: 1044, half: 60 },
];

/** The stream's banks as one closed polygon (left bank down, right bank back up). */
function streamPolygon(line: typeof STREAM_LINE): Pt[] {
  const side = (sign: 1 | -1): Pt[] =>
    line.map((q, i) => {
      const a = line[Math.max(0, i - 1)]!;
      const b = line[Math.min(line.length - 1, i + 1)]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      // the normal to the flow, pointing to the stream's left (the viewer's left going downstream)
      const nx = (b.y - a.y) / len;
      const ny = -(b.x - a.x) / len;
      return { x: Math.round(q.x + sign * nx * q.half), y: Math.round(q.y + sign * ny * q.half) };
    });
  return [...side(-1), ...side(1).reverse()];
}

export const STREAM: Pt[] = streamPolygon(STREAM_LINE);

/** Boulders: in the pool by the foot of the falls (the dipper's), round the rim, in and by the stream. */
export const ROCKS: Rock[] = [
  { id: 'rock-foot', x: 720, y: 632, w: 96, h: 50, perch: true },
  { id: 'rock-foot-left', x: 520, y: 630, w: 72, h: 38, perch: false },
  { id: 'rock-pool-left', x: 460, y: 716, w: 130, h: 72, perch: true },
  { id: 'rock-outflow', x: 1010, y: 724, w: 100, h: 54, perch: true },
  { id: 'rock-stream', x: 1170, y: 840, w: 84, h: 46, perch: true },
  { id: 'rock-stream-bank', x: 1184, y: 962, w: 110, h: 58, perch: false },
  { id: 'rock-trail', x: 570, y: 862, w: 66, h: 34, perch: false },
  { id: 'rock-right', x: 1340, y: 650, w: 160, h: 88, perch: true },
  { id: 'rock-cliff-foot', x: 300, y: 652, w: 120, h: 60, perch: false },
];

/** Stepping stones from the bottom up to the pool's near edge (near → far). */
export const TRAIL: Stone[] = [
  { x: 680, y: 968, rx: 88, ry: 26 },
  { x: 636, y: 914, rx: 76, ry: 22 },
  { x: 668, y: 864, rx: 66, ry: 19 },
  { x: 708, y: 822, rx: 58, ry: 16.5 },
  { x: 684, y: 786, rx: 50, ry: 14.5 },
  { x: 650, y: 760, rx: 42, ry: 12 },
];

/** The waterfall's geometry (its scenery: `./index.ts`). No building, no lantern, no eave. */
export const waterfallScene: SceneGeometry = {
  pond: POOL,
  waterline: WATERLINE,
  streams: [STREAM],
  falls: FALLS,
  rocks: ROCKS,
  path: TRAIL,
  structure: null,
  lights: [],
  eave: null,
  slots: WATERFALL_SLOTS,
  // over the open sky right of the cliff and in front of the crown
  skyBand: { top: 40, bottom: 320 },
};
