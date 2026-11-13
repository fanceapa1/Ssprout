/**
 * The coast's light art (G5, ADR 0372): shadows to the right, warm and rose light at the low suns,
 * moonlight and the village's lit windows at night. docs/systems/scenery.md › Coast › Daylight.
 */
import type { LightPainters } from '../../ambience/cast';
import type { DayPhase } from '../../ambience/daylight';
import { reserveStar, type CastShadow } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import type { Painter, Pt } from '../../paint';
import type { SceneGeometry } from '../../scene/geometry';
import { SEA_WATER } from './geometry';
import { COAST_GRADES } from './daylight';
import { CHAPEL, COLUMNS, COLUMN_W, OLIVE, PINE, PROMONTORY, STYLOBATE, VILLAGE, WALLS } from './layout';
import { PINE_PADS, VILLAGE_CUBES, WALL_FACES } from './shapes';
import { COAST_NIGHT_STARS } from './sky';

export { COAST_GRADES };

type Rgb = readonly [number, number, number];

/** A feathered dab of warm or cool paper on the plate (a lifted wash at plate resolution leaves a ring). */
function dab(p: Painter, x: number, y: number, rx: number, ry: number, a: number, rgb: Rgb): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.55, `rgba(${c},${a * 0.6})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Run `fn` clipped to a shape. */
function within(p: Painter, shape: readonly Pt[], fn: () => void): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.beginPath();
  shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
  fn();
  ctx.restore();
}

/**
 * Shadows. The low suns stand over the sea beyond the scene on the left, so long shadows fall
 * right and a little toward the viewer, and the faces turned to the viewer (the walls, the
 * promontory's face) are in shade; midday leaves short pools.
 */
function coastShadows(p: Painter, rng: Rng, _scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const low = Math.abs(sh.dx) > 0.6;
  const a = sh.alpha;
  const dir = Math.sign(sh.dx) || 1;
  const soft = { rng, spread: 0.5, deform: 0.35, edge: 0, edgeWidth: 0 };
  // the promontory's foot over the sea, and at a low sun its whole face turned from the light,
  // fading toward the point, which still catches it
  p.glaze({ cx: 1180, cy: 500, rx: 460, ry: 18 }, pig, { ...soft, opacity: a * (low ? 0.36 : 0.22) });
  if (low) {
    within(p, PROMONTORY, () =>
      p.glaze([{ x: 760, y: 380 }, { x: 1640, y: 280 }, { x: 1640, y: 520 }, { x: 760, y: 520 }], pig, { ...soft, opacity: a * 0.3, fade: { angle: Math.PI, start: 0.35, amount: 0.95, ragged: 0.6 } }),
    );
  }
  // the walls: the face turned from the sun, and the shade it throws on the terrace below
  for (const face of WALL_FACES) {
    const n = face.length / 2;
    const foot = face.slice(n);
    p.glaze(face, pig, { ...soft, spread: 0.2, opacity: a * (low ? 0.32 : 0.12) });
    const depth = low ? 16 : 8;
    p.glaze([...foot, ...foot.slice().reverse().map((q) => ({ x: q.x + dir * (low ? 12 : 2), y: q.y + depth }))], pig, { ...soft, opacity: a * (low ? 0.4 : 0.26), fade: { angle: Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.6 } });
  }
  // each column throws its shade along the krepis and down its steps
  for (const c of COLUMNS) {
    const reach = low ? Math.min(60, c.h * Math.abs(sh.dx) * 0.4) : 6;
    p.glaze([{ x: c.x, y: STYLOBATE.y - 1 }, { x: c.x + COLUMN_W / 2, y: STYLOBATE.y - 1 }, { x: c.x + dir * reach + COLUMN_W / 2, y: STYLOBATE.y + 6 + reach * 0.15 }, { x: c.x + dir * reach - 2, y: STYLOBATE.y + 8 + reach * 0.15 }], pig, {
      ...soft,
      spread: 0.25,
      opacity: a * (low ? 0.5 : 0.3),
      fade: { angle: dir > 0 ? 0 : Math.PI, start: 0.4, amount: 0.8, ragged: 0.5 },
    });
  }
  paintTreeShadows(p, rng, sh, pig, low, dir);
}

/** The olive and the leaning pine: long trunks and crown blots at a low sun, short pools at midday. */
function paintTreeShadows(p: Painter, rng: Rng, sh: CastShadow, pig: string, low: boolean, dir: number): void {
  const olive = OLIVE.base;
  const height = olive.y - OLIVE.crown.y;
  if (!low) {
    p.glaze({ cx: olive.x + 20, cy: olive.y + 6, rx: OLIVE.rx * 0.7, ry: 14 }, pig, { rng, opacity: sh.alpha * 0.32, deform: 0.45, spread: 0.5 });
  } else {
    // on the top terrace, between the promontory's foot and the first wall
    const reach = Math.min(260, height * Math.abs(sh.dx) * 0.55);
    const end = { x: olive.x + dir * reach, y: olive.y + 16 };
    p.stroke([olive, { x: (olive.x + end.x) / 2, y: olive.y + 10 }, end], { rng, pigment: pig, width: 18, opacity: sh.alpha * 0.7, dryness: 0.3, wetness: 0.6, wobble: 0.2, taper: [0, 0.4] });
    p.wash({ cx: end.x + dir * 40, cy: end.y + 2, rx: OLIVE.rx * 0.6, ry: 16 }, pig, {
      rng,
      opacity: sh.alpha * 0.5,
      deform: 0.6,
      spread: 0.35,
      edge: 0.12,
      sharpness: 0.2,
      centreLift: 0.1,
      blooms: 3,
      bloomSize: 0.2,
      fade: { angle: dir > 0 ? 0 : Math.PI, start: 0.5, amount: 0.7, ragged: 0.7 },
    });
  }
  // the pine leans out over the beach: its shade falls on the shingle, right of its rock
  const pine = PINE.base;
  if (!low) {
    p.glaze({ cx: pine.x + 40, cy: pine.y + 8, rx: 70, ry: 10 }, pig, { rng, opacity: sh.alpha * 0.3, deform: 0.4, spread: 0.5 });
    return;
  }
  const reach = Math.min(320, (pine.y - PINE.top.y) * Math.abs(sh.dx) * 0.4);
  const end = { x: pine.x + dir * reach, y: pine.y + 36 };
  p.stroke([pine, { x: (pine.x + end.x) / 2, y: pine.y + 20 }, end], { rng, pigment: pig, width: 10, opacity: sh.alpha * 0.55, dryness: 0.35, wetness: 0.6, wobble: 0.25, taper: [0, 0.5] });
  for (const pad of PINE_PADS.slice(0, 4)) {
    const t = (pine.y - pad.y) / (pine.y - PINE.top.y);
    p.glaze({ cx: pine.x + dir * reach * t + (pad.x - PINE.top.x) * 0.4, cy: end.y + rng.range(-6, 6), rx: pad.rx * 0.6, ry: 7 }, pig, { rng, opacity: sh.alpha * 0.35, deform: 0.6, spread: 0.5 });
  }
}

/** The near cove: kept teal under a warm grade (amber multiplied over turquoise greys it). */
function keepCove(p: Painter, k: number): void {
  within(p, SEA_WATER, () => {
    dab(p, 440, 640, 520, 150, k, [244, 252, 252]);
    dab(p, 700, 520, 240, 90, k * 0.7, [244, 252, 252]);
  });
}

/** The village windows lit after dark: a few of the painted openings, picked at fixed places. */
export const LIT_WINDOWS: readonly Pt[] = VILLAGE_CUBES.flat()
  .flatMap((c) => c.holes.filter((h) => h.h < 4).map((h) => ({ x: h.x + h.w / 2, y: h.y + h.h / 2 })))
  .filter((_, i) => i % 3 === 1)
  .slice(0, 7);

/** The lamp by the chapel's door. */
export const CHAPEL_LAMP: Pt = { x: CHAPEL.x - 7, y: CHAPEL.y + 9 };

/** Warm light on what faces the low sun; moonlight, lit windows and the chapel's lamp at night. */
function coastLights(p: Painter, _rng: Rng, _scene: SceneGeometry, phase: DayPhase): void {
  if (phase === 'sunrise' || phase === 'sunset') {
    const sunset = phase === 'sunset';
    const k = sunset ? 0.62 : 0.45;
    const warm: Rgb = sunset ? [255, 224, 176] : [255, 234, 216];
    const rose: Rgb = sunset ? [252, 214, 204] : [250, 226, 226];
    // the temple catches it: the shafts' left flanks, the capitals and the architrave
    dab(p, 756, 340, 110, 70, k * 0.6, warm);
    for (const c of COLUMNS) for (let y = STYLOBATE.y - c.h + 6; y < STYLOBATE.y; y += 14) dab(p, c.x - 3, y, 7, 10, k * 0.8, warm);
    // the limestone goes rose: the whole promontory, most at the point and along its top
    within(p, PROMONTORY, () => {
      dab(p, 980, 400, 560, 120, k * 0.45, rose);
      for (let x = 640; x <= 1000; x += 36) dab(p, x, 420 - (x - 640) * 0.18, 60, 26, k * 0.6 * (1 - (x - 640) / 600), rose);
    });
    // the white village on the far slope: a broad warmth, then each house
    dab(p, 230, 350, 160, 50, k * 0.55, warm);
    for (const v of VILLAGE) dab(p, v.x + v.w * 0.4, v.y + v.h / 2, v.w * 0.7, v.h * 0.6, k * 0.5, warm);
    // the olive's crown and the pine's trunk on their sun side, the walls' coping ends nearest the sea
    dab(p, OLIVE.crown.x - OLIVE.rx * 0.5, OLIVE.crown.y + 10, 90, 60, k * 0.4, warm);
    for (let i = 1; i < 6; i++) dab(p, PINE.base.x + (PINE.top.x - PINE.base.x) * (i / 6) - 4, PINE.base.y + (PINE.top.y - PINE.base.y) * (i / 6), 8, 40, k * 0.35, warm);
    for (const w of WALLS) dab(p, w.edge[0]!.x + 50, w.edge[0]!.y + 2, 70, 6, k * 0.4, warm);
    keepCove(p, sunset ? 0.42 : 0.3);
    return;
  }
  if (phase === 'midday') {
    keepCove(p, 0.35);
    return;
  }
  // night: moonlight on the pale stone (the temple, the point, the village), stars left as paper
  const cool: Rgb = [232, 238, 255];
  dab(p, 756, 350, 100, 60, 0.3, cool);
  dab(p, 700, 420, 120, 26, 0.22, cool);
  dab(p, 230, 350, 150, 40, 0.18, cool);
  within(p, SEA_WATER, () => dab(p, 600, 520, 200, 110, 0.2, cool));
  // a few warm windows and the chapel's lamp: small, steady points of paper
  const lamp: Rgb = [255, 214, 150];
  for (const w of LIT_WINDOWS) {
    dab(p, w.x, w.y, 7, 6, 0.5, lamp);
    dab(p, w.x, w.y, 2.6, 2.6, 0.95, [255, 228, 170]);
  }
  dab(p, CHAPEL_LAMP.x, CHAPEL_LAMP.y, 12, 10, 0.55, lamp);
  dab(p, CHAPEL_LAMP.x, CHAPEL_LAMP.y, 3, 3, 1, [255, 232, 180]);
  for (const s of COAST_NIGHT_STARS) if (s.y > 14) reserveStar(p.ctx, s, 0.9);
}

/** The coast's own marks on the light plates (its painter chunk, ADR 0341). */
export const COAST_LIGHT: LightPainters = { shadows: coastShadows, lights: coastLights };
