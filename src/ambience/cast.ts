/**
 * The light of each daylight phase as a painted plate (ADR 0147), multiplied over the whole
 * garden in the `lighting` layer: the phase's grade wash (lighting.ts), then — with the
 * watercolour engine — long cool shadows thrown away from a low sun by the boulders, the trees,
 * the shrubs and the scenery's own things (the engawa: `LightArt.shadows`; short pools under them
 * at midday), paper reserved on the sun-facing side of the tree crowns, and at night the
 * scenery's lit windows (`LightArt.lights`) and warm light around its lanterns. Plates are painted once per phase (on demand) and blended by the phase weights into a
 * composite that also lifts the moving lights: the glow round a low sun, the moon's halo and the
 * moon's (or the sun's) broken path on the pond. Rebuilt only when the light moved (a few times
 * a minute at most); every frame is one blit. A phase's plate is looked up in the persistent
 * paint cache before it is painted, and stored once painted (ADR 0236).
 */
import { createRng, type Rng } from '../core/rng';
import { PIGMENTS, createPainter, makeCanvas, mix, type AnyCanvas, type Painter, type Pt } from '../paint';
import { pointInPolygon } from '../paint/geometry';
import { WORLD_H, WORLD_W } from '../render/viewport';
import type { SceneGeometry } from '../scene/geometry';
import type { ShrubSpec, TreeSpec } from '../scene/layout';
import type { PaintCache } from '../paint/persist';
import { DEFAULT_SCENERY, type SceneryId } from '../scenery/ids';
import { GARDEN_SKY_LAYOUT } from '../scenery/japanese-garden/sky';
import { loaded, type Painters } from '../scenery/painters';
import { PHASES, only, pinnedState, whenIdle, type DayPhase, type DaylightState, type PhaseWeights } from './daylight';
import { gradePlate, washField, type WashField } from './lighting';
import { createPlateCache, cutImage, defaultPlateCache, fingerprint } from './plate-cache';
import { castShadow, moonDisc, reserveStar, stars, sunDisc, sunSide, type CastShadow, type Disc, type SkyLayout } from './sky-layout';
import { PHASE_GRADES, type Grade } from './timeofday';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Plate resolution (px per world unit): the light is soft, the paper adds the grain. */
export const CAST_SCALE = 0.4;
/**
 * A zoomed-in view repaints the plates' marks (shadows, crown lights, window light, stars) for its
 * part of the world at up to this many px per unit, over the upscaled grade wash (ADR 0163).
 */
export const CAST_DETAIL_MAX = 2;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the plates need to know about the painting besides the shared geometry (ADR 0241). */
export interface LightArt {
  trees: readonly TreeSpec[];
  shrubs: readonly ShrubSpec[];
  /** where the sun and the moon are (default: the Japanese garden's sky) */
  sky?: SkyLayout;
  /** the scenery's own marks, loaded with its painters when a plate has to be painted (ADR 0341) */
  painters?: Painters<{ light: LightPainters }>;
  /** the scenery's own phase grades (ADR 0301); a phase it leaves out takes `PHASE_GRADES` */
  grades?: Partial<Record<DayPhase, Grade>>;
}

/** A scenery's own marks on the light plates (in its painter chunk, ADR 0341). */
export interface LightPainters {
  /** the scenery's own shadows, painted after the others (the engawa's) */
  shadows?(p: Painter, rng: Rng, scene: SceneGeometry, shadow: CastShadow, pigment: string): void;
  /** the scenery's own lights on one phase's plate (the shoji's lamp light) */
  lights?(p: Painter, rng: Rng, scene: SceneGeometry, phase: DayPhase): void;
}

/** The radius of the warm pool of light lifted round each of the scene's lights. */
const LIGHT_POOL_R = 70;

export interface CastLight {
  /** recompose for a state if the light moved (or `force`); true when it did */
  update(state: DaylightState, force?: boolean): boolean;
  readonly canvas: AnyCanvas;
  has(phase: DayPhase): boolean;
  prepare(phases: readonly DayPhase[]): void;
  /**
   * Keep a sharp plate for a zoomed view: its visible world rect and device px per unit (null:
   * none). The marks are repainted for that part of the world one phase at a time
   * (`paintDetailStep`, from idle callbacks); until they are, `detail()` is null.
   */
  setDetail(visible: Rect | null, pixelScale: number): void;
  /** paint one missing detail plate; true when there is more to do */
  paintDetailStep(): boolean;
  /** the detail composite for the current light, when it is ready */
  detail(): { canvas: AnyCanvas; rect: Rect } | null;
  /** the phases a light's blend needs whose plate is not here yet */
  missing(state: DaylightState): DayPhase[];
  /** look the blend's missing plates up in the paint cache (no painting) */
  lookup(state: DaylightState): void;
  /** whether a phase's plate is still being looked up */
  looking(phase: DayPhase): boolean;
  /** one part of painting a phase's plate: the wash field first, then the plate (ADR 0337) */
  paintPart(phase: DayPhase): void;
  /** bumps whenever the composite or the detail composite is repainted (caches of them key off it) */
  version(): number;
  /**
   * Resolves once the plates the last light needs can be drawn for real: looked up, and on a
   * miss the scenery's painters loaded (ADR 0341), so the next update composes them.
   */
  settled(): Promise<void>;
  stats(): CastStats;
}

export interface CastStats {
  /** phases whose plate is there, painted or taken from the paint cache */
  plates: number;
  /** phase plates painted here */
  painted: number;
  composes: number;
  paintMs: number;
  /** plates taken from the persistent paint cache, and lookups that found nothing (ADR 0236) */
  cacheHits: number;
  cacheMisses: number;
  detail: { rect: Rect; scale: number; ready: boolean } | null;
  detailMs: number;
}

/** The paint-cache kind of a phase's light plate. */
export const LIGHT_PLATE_KIND = 'light-plate';

/**
 * The paint-cache key of a phase's light plate: the scenery (ADR 0242), its seed, the phase, its
 * pixel size and a fingerprint of the geometry and the art it throws shadows from (`castPrint`).
 * Everything else is code (the cache version).
 */
export function lightPlateKey(scenery: SceneryId, seed: string, phase: DayPhase, w: number, h: number, print: string): string {
  return `${scenery}|${seed}|${phase}|${w}x${h}|g${print}`;
}

/** What the light plates are painted from, as a fingerprint (the studio paints other scenes). */
export function castPrint(scene: SceneGeometry, art: LightArt): string {
  const { pond, waterline, rocks, structure, lights } = scene;
  // grades only when a scenery has its own, so the other sceneries' keys stay as they were
  return fingerprint({ pond, waterline, rocks, structure, lights, trees: art.trees, shrubs: art.shrubs, sky: art.sky ?? null, ...(art.grades ? { grades: art.grades } : {}) });
}

const SHADOW = mix(PIGMENTS.shadow, PIGMENTS.ultramarine, 0.38);

/** Paint one phase's plate (grade wash + shadows + reserved lights) into `p` (world transform set). */
export function paintCastPlate(p: Painter, rng: Rng, phase: DayPhase, scene: SceneGeometry, art: LightArt): void {
  const state = pinnedState(only(phase));
  const sky = art.sky ?? GARDEN_SKY_LAYOUT;
  const own = art.painters ? loaded(art.painters, 'light').light : {};
  const sh = castShadow(state, sky);
  const shadowPig = phase === 'sunset' ? mix(SHADOW, PIGMENTS.violet, 0.3) : phase === 'sunrise' ? mix(SHADOW, PIGMENTS.bellflower, 0.25) : SHADOW;
  if (phase !== 'night') paintShadows(p, rng, scene, art, sh, shadowPig, own);
  if (phase === 'sunrise' || phase === 'sunset') paintCrownLights(p, rng, art, phase, sunSide(sky)[phase]);
  own.lights?.(p, rng, scene, phase);
  // (never on the plate's top rows: tall phones stretch row 0 over the paper above the world)
  if (phase === 'night') for (const s of stars(30, 'stars', sky)) if (s.y > 14) reserveStar(p.ctx, s, 0.9);
}

/**
 * A boulder's shadow ellipse and the direction it fades toward (null: no fade). Mirror-symmetric in
 * the sun's side: the tilt comes from |dx| and turns with the side (ADR 0284).
 */
export function rockShadow(r: { x: number; y: number; w: number; h: number }, sh: CastShadow): { cx: number; cy: number; rx: number; ry: number; rotation: number; fade: number | null } {
  const long = Math.abs(sh.dx) > 0.6;
  const reach = Math.min(240, r.h * Math.abs(sh.dx) * 1.1);
  const side = Math.sign(sh.dx) || 1;
  return {
    cx: r.x + side * (r.w * 0.28 + reach * 0.5),
    cy: r.y + r.h * 0.04 + sh.dy * r.h * 0.5,
    rx: Math.max(r.w * 0.42, reach * 0.55 + r.w * 0.2),
    ry: r.h * (long ? 0.16 : 0.2),
    rotation: long ? side * Math.atan2(sh.dy, Math.abs(sh.dx)) * 0.15 : 0,
    fade: long ? (side > 0 ? 0 : Math.PI) : null,
  };
}

/** Cast shadows: a cool glaze from each thing's foot, away from the sun, fading toward its tip. */
function paintShadows(p: Painter, rng: Rng, scene: SceneGeometry, art: LightArt, sh: CastShadow, pig: string, own: LightPainters): void {
  const long = Math.abs(sh.dx) > 0.6;
  const onWater = (q: Pt) => pointInPolygon(q, scene.pond);
  // boulders
  for (const r of scene.rocks) {
    const { fade, ...shape } = rockShadow(r, sh);
    if (onWater({ x: shape.cx, y: shape.cy })) continue;
    p.glaze(shape, pig, { rng, opacity: sh.alpha * 0.55, deform: 0.3, fade: fade === null ? undefined : { angle: fade, start: 0.35, amount: 0.9, ragged: 0.5 } });
  }
  // shrubs
  for (const s of art.shrubs) {
    const reach = Math.min(200, s.r * 1.4 * Math.abs(sh.dx));
    const side = Math.sign(sh.dx) || 1;
    p.glaze({ cx: s.x + side * (s.r * 0.3 + reach * 0.45), cy: s.y + 4 + sh.dy * s.r * 0.3, rx: s.r * 0.7 + reach * 0.5, ry: s.r * 0.2 }, pig, {
      rng,
      opacity: sh.alpha * 0.45 * (1 - s.distance * 0.5),
      fade: long ? { angle: side > 0 ? 0 : Math.PI, start: 0.35, amount: 0.9 } : undefined,
    });
  }
  // trees: the trunk's long shadow and dappled crown shadows on the ground
  for (const t of art.trees) {
    const near = 1 - t.distance * 0.6;
    const top = t.stems[0]![t.stems[0]!.length - 1]!;
    const height = Math.max(40, t.base.y - top.y);
    const reach = Math.min(long ? 520 : 60, height * Math.abs(sh.dx) * 0.9);
    const dir = Math.sign(sh.dx) || 1;
    const end = { x: t.base.x + dir * reach, y: t.base.y + sh.dy * height * 0.25 };
    p.stroke([t.base, { x: (t.base.x + end.x) / 2, y: (t.base.y + end.y) / 2 + 3 }, end], {
      rng,
      pigment: pig,
      width: t.width * 1.7,
      opacity: sh.alpha * 0.36 * near,
      dryness: 0.35,
      wetness: 0.6,
      wobble: 0.2,
      taper: [0, 0.7],
    });
    // the crown's shadow: one soft, dappled mass where the pads project onto the ground
    let x0 = Infinity;
    let x1 = -Infinity;
    let rr = 0;
    for (const [x, y, r] of t.pads) {
      const gx = x + dir * Math.min(long ? 560 : 50, (t.base.y - y) * Math.abs(sh.dx) * 0.9);
      x0 = Math.min(x0, gx - r);
      x1 = Math.max(x1, gx + r);
      rr = Math.max(rr, r);
    }
    if (!Number.isFinite(x0)) continue;
    x0 = Math.max(-80, x0);
    x1 = Math.min(WORLD_W + 80, x1);
    const cx = (x0 + x1) / 2;
    const cy = t.base.y + 6 + sh.dy * height * 0.18;
    if (x1 - x0 < 10 || onWater({ x: cx, y: cy })) continue;
    p.wash({ cx, cy, rx: (x1 - x0) / 2, ry: rr * (long ? 0.24 : 0.3) }, pig, {
      rng,
      opacity: sh.alpha * 0.3 * near,
      deform: 0.5,
      spread: 0.35,
      edge: 0.15,
      sharpness: 0.2,
      centreLift: 0.1,
      granulation: 0.05,
      blooms: 3,
      bloomSize: 0.2,
      fade: long ? { angle: dir > 0 ? 0 : Math.PI, start: 0.45, amount: 0.8, ragged: 0.7 } : undefined,
    });
  }
  own.shadows?.(p, rng, scene, sh, pig);
}

/** Paper reserved on the sun side of each crown: light caught by the leaves (`side` +1 = right). */
function paintCrownLights(p: Painter, rng: Rng, art: LightArt, phase: 'sunrise' | 'sunset', side: 1 | -1): void {
  const amount = phase === 'sunset' ? 0.42 : 0.32;
  // soft-edged: at plate resolution a lifted wash would leave a pooled ring, so the light is
  // taken out with a feathered brush (a radial fade of warm paper)
  const ctx = p.ctx;
  const warm = phase === 'sunrise' ? [255, 246, 232] : [255, 240, 214];
  const dab = (x: number, y: number, rx: number, ry: number, a: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${warm[0]},${warm[1]},${warm[2]},${a})`);
    g.addColorStop(0.55, `rgba(${warm[0]},${warm[1]},${warm[2]},${a * 0.6})`);
    g.addColorStop(1, `rgba(${warm[0]},${warm[1]},${warm[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  for (const t of art.trees) {
    for (const [x, y, r] of t.pads) {
      dab(x + side * r * 0.45 + rng.range(-3, 3), y - r * 0.15, r * 0.7, r * 0.5, amount * (1 - t.distance * 0.4));
    }
  }
  for (const s of art.shrubs) dab(s.x + side * s.r * 0.4, s.y - s.r * 0.6, s.r * 0.6, s.r * 0.45, amount * 0.8);
}

/** A stable key for the composite: weights to 1/200, light discs to a world unit. */
const key = (w: PhaseWeights, sun: Disc, moon: Disc) => {
  const q = (v: number) => Math.round(v * 200);
  const d = (c: Disc) => (c.alpha > 0.005 ? `${Math.round(c.x)},${Math.round(c.y)},${q(c.alpha)}` : '-');
  return `${PHASES.map((p) => q(w[p])).join(',')}|${d(sun)}|${d(moon)}`;
};

const totals = { painted: 0, cacheHits: 0, cacheMisses: 0 };
/** the lights whose composite waits for a plate's lookup */
const deferring = new Set<object>();

/**
 * Whether a light's composite is waiting for a plate's paint-cache lookup (ADR 0236). The
 * ambience waits for it before revealing the light at boot, so the first lit frame does not paint
 * a plate the cache is about to give.
 */
export function lightPlatesPending(): boolean {
  return deferring.size > 0;
}

/** the lights whose last blend lacked a plate, with their `settled` */
const unsettled = new Map<object, () => Promise<void>>();

/**
 * Resolves once every light whose last blend lacked a plate has it looked up and, on a miss, its
 * painters loaded (devlog 155). At once when nothing is missing: a warm visit loads no painters.
 */
export async function lightPlatesSettled(): Promise<void> {
  await Promise.all([...unsettled.values()].map((settled) => settled()));
}

/**
 * Light plates painted, taken from the paint cache and looked up in vain by every light in this
 * page so far (`sprout.lightPlates()`; the ambience shares one light per scene and seed).
 */
export function lightPlateTotals(): { painted: number; cacheHits: number; cacheMisses: number } {
  return { ...totals };
}

export function createCastLight(scene: SceneGeometry, art: LightArt, seed = 'cast', opts: { cache?: PaintCache | null; scenery?: SceneryId } = {}): CastLight {
  const sky = art.sky ?? GARDEN_SKY_LAYOUT;
  const scenery = opts.scenery ?? DEFAULT_SCENERY;
  const phaseGrade = (phase: DayPhase): Grade => art.grades?.[phase] ?? PHASE_GRADES[phase];
  // the wash's noise fields are built only when a plate is painted (not when it comes from the cache)
  let washed: WashField | null = null;
  const field = () => (washed ??= washField(scene, `${seed}-wash`, CAST_SCALE));
  const w = Math.ceil(WORLD_W * CAST_SCALE);
  const h = Math.ceil(WORLD_H * CAST_SCALE);
  const plates = new Map<DayPhase, AnyCanvas>();
  /** each phase's grade wash before its marks (the detail plates start from it) */
  const grades = new Map<DayPhase, AnyCanvas>();
  const canvas = makeCanvas(w, h);
  let lastState: DaylightState | null = null;
  let want: { rect: Rect; scale: number; key: string } | null = null;
  const detailPlates = new Map<DayPhase, { key: string; canvas: AnyCanvas }>();
  let detailComp: { key: string; canvas: AnyCanvas; rect: Rect } | null = null;
  let detailMs = 0;
  const ctx = canvas.getContext('2d') as Ctx;
  let last = '';
  let composes = 0;
  let version = 0;
  let paintMs = 0;
  let painted = 0;
  let pondPath: Path2D | null = null;
  /** the light changed while a needed plate was still being looked up: composed when it answers (or when drawn) */
  let deferred: { state: DaylightState; sun: Disc; moon: Disc } | null = null;
  const self = {};
  /** phases `prepare` asked for whose lookup has not answered yet */
  const preparing = new Set<DayPhase>();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  /** the scenery's painters are here (or it has none): a plate can be painted now */
  const ready = () => !art.painters || art.painters.get() !== null;
  let fetching: Promise<void> | null = null;
  /** load the painters; once they land, the next update recomposes what was drawn without them */
  const fetchPainters = (): Promise<void> =>
    (fetching ??= art.painters!.load().then(
      () => {
        last = '';
        version++;
      },
      (err: unknown) => {
        fetching = null;
        console.warn('[cast] light painters failed to load', err);
      },
    ));

  let print: string | null = null;
  const store = createPlateCache<DayPhase>({
    cache: opts.cache === undefined ? defaultPlateCache() : opts.cache,
    kind: LIGHT_PLATE_KIND,
    key: (phase) => lightPlateKey(scenery, seed, phase, w, h, (print ??= castPrint(scene, art))),
    load(phase, image) {
      if (image.width !== w || image.height !== h) return false;
      if (!plates.has(phase)) plates.set(phase, cutImage(image, 0, 0, w, h));
      return true;
    },
    answered(phase, hit) {
      if (hit) totals.cacheHits++;
      else totals.cacheMisses++;
      // a miss is painted: its painters start loading now (ADR 0341)
      if (!hit && !ready()) void fetchPainters();
      if (preparing.delete(phase) && !plates.has(phase)) {
        if (ready()) whenIdle(() => void plate(phase));
        else void fetchPainters().then(() => whenIdle(() => void plate(phase)));
      }
      if (deferred && !waiting(deferred.state)) flush();
    },
  });

  const plate = (phase: DayPhase): AnyCanvas => {
    const known = plates.get(phase);
    if (known) return known;
    if (!ready()) {
      // until the painters land: the grade wash alone, neither kept nor stored
      void fetchPainters();
      return gradeOf(phase);
    }
    const t0 = now();
    const c = gradePlate(phaseGrade(phase), field());
    const g = makeCanvas(w, h);
    (g.getContext('2d') as Ctx).drawImage(c as CanvasImageSource, 0, 0);
    grades.set(phase, g);
    const p = createPainter(c, { seed: `${seed}:${phase}` });
    p.ctx.setTransform(CAST_SCALE, 0, 0, CAST_SCALE, 0, 0);
    paintCastPlate(p, createRng(`${seed}:${phase}`), phase, scene, art);
    plates.set(phase, c);
    paintMs += now() - t0;
    painted++;
    totals.painted++;
    store.painted(phase, () => c);
    return c;
  };

  /** a phase's grade wash before its marks (kept when its plate was painted here, else made now) */
  const gradeOf = (phase: DayPhase): AnyCanvas => {
    let g = grades.get(phase);
    if (!g) grades.set(phase, (g = gradePlate(phaseGrade(phase), field())));
    return g;
  };

  const pond = () => {
    if (!pondPath && typeof Path2D !== 'undefined') {
      pondPath = new Path2D();
      scene.pond.forEach((q, i) => (i ? pondPath!.lineTo(q.x, q.y) : pondPath!.moveTo(q.x, q.y)));
      pondPath.closePath();
    }
    return pondPath;
  };

  const phasesOf = (state: DaylightState) => PHASES.filter((p) => state.weights[p] > 0.002).sort((a, b) => state.weights[b] - state.weights[a]);
  /** whether a plate the blend needs is still being looked up */
  const waiting = (state: DaylightState) => phasesOf(state).some((p) => !plates.has(p) && store.pending(p));

  /** a phase's plate repainted for the detail rect: the grade wash upscaled, the marks at full resolution */
  const paintDetailPlate = (phase: DayPhase, d: { rect: Rect; scale: number; key: string }): AnyCanvas => {
    const t0 = now();
    const grade = gradeOf(phase);
    const dw = Math.max(1, Math.ceil(d.rect.w * d.scale));
    const dh = Math.max(1, Math.ceil(d.rect.h * d.scale));
    const c = makeCanvas(dw, dh);
    const cx = c.getContext('2d') as Ctx;
    cx.imageSmoothingEnabled = true;
    cx.drawImage(grade as CanvasImageSource, d.rect.x * CAST_SCALE, d.rect.y * CAST_SCALE, d.rect.w * CAST_SCALE, d.rect.h * CAST_SCALE, 0, 0, dw, dh);
    const p = createPainter(c, { seed: `${seed}:${phase}` });
    p.ctx.setTransform(d.scale, 0, 0, d.scale, -d.rect.x * d.scale, -d.rect.y * d.scale);
    paintCastPlate(p, createRng(`${seed}:${phase}`), phase, scene, art);
    detailMs += now() - t0;
    return c;
  };

  /** blend plates by the phase weights, then lift the moving lights (world transform `t`) */
  const composeInto = (
    cx: Ctx,
    cw: number,
    ch: number,
    state: DaylightState,
    sun: Disc,
    moon: Disc,
    plateOf: (p: DayPhase) => AnyCanvas,
    t: [number, number, number],
  ) => {
    const list = phasesOf(state);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalCompositeOperation = 'source-over';
    cx.globalAlpha = 1;
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, cw, ch);
    let acc = 0;
    for (const p of list) {
      acc += state.weights[p];
      cx.globalAlpha = state.weights[p] / acc;
      cx.drawImage(plateOf(p) as CanvasImageSource, 0, 0);
    }
    cx.globalAlpha = 1;
    cx.setTransform(t[0], 0, 0, t[0], t[1], t[2]);
    liftLights(cx, state, sun, moon);
    cx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const compose = (state: DaylightState, sun: Disc, moon: Disc) => {
    deferred = null;
    deferring.delete(self);
    composeInto(ctx, w, h, state, sun, moon, plate, [CAST_SCALE, 0, 0]);
    composes++;
    version++;
  };

  const settled = async (): Promise<void> => {
    if (!lastState) return;
    const missing = phasesOf(lastState).filter((p) => !plates.has(p));
    if (!missing.length) unsettled.delete(self);
    await Promise.all(missing.map((p) => store.whenAnswered(p)));
    if (missing.some((p) => !plates.has(p)) && !ready()) await fetchPainters();
  };

  /** compose a deferred light change now (its missing plates painted) */
  const flush = () => {
    if (deferred) compose(deferred.state, deferred.sun, deferred.moon);
  };

  /** the detail composite, if every phase in the blend has its detail plate */
  const composeDetail = () => {
    if (!want || !lastState) return null;
    const list = phasesOf(lastState);
    if (list.some((p) => detailPlates.get(p)?.key !== want!.key)) return null;
    const sun = sunDisc(lastState, sky);
    const moon = moonDisc(lastState, sky);
    const k = `${want.key}|${key(lastState.weights, sun, moon)}`;
    if (detailComp?.key === k) return detailComp;
    const dw = Math.max(1, Math.ceil(want.rect.w * want.scale));
    const dh = Math.max(1, Math.ceil(want.rect.h * want.scale));
    const c = detailComp && detailComp.canvas.width === dw && detailComp.canvas.height === dh ? detailComp.canvas : makeCanvas(dw, dh);
    const d = want;
    composeInto(c.getContext('2d') as Ctx, dw, dh, lastState, sun, moon, (p) => detailPlates.get(p)!.canvas, [d.scale, -d.rect.x * d.scale, -d.rect.y * d.scale]);
    detailComp = { key: k, canvas: c, rect: d.rect };
    version++;
    return detailComp;
  };

  const liftLights = (ctx: Ctx, state: DaylightState, sun: Disc, moon: Disc) => {
    if (sun.alpha > 0.01) liftGlow(ctx, sun.x, sun.y, sun.r * 7, 0.36 * sun.alpha, [255, 222, 168]);
    if (moon.alpha > 0.01) {
      // the moon itself left as paper, then a soft halo of moonlight round it
      liftGlow(ctx, moon.x, moon.y, moon.r * 1.3, 0.95 * moon.alpha, [252, 252, 255]);
      liftGlow(ctx, moon.x, moon.y, moon.r * 3.4, 0.55 * moon.alpha, [232, 238, 255]);
    }
    // each lantern's own warm pool of light (the wash already reserves paper round it)
    let lantern = 0;
    for (const p of PHASES) lantern += state.weights[p] * phaseGrade(p).lantern;
    if (lantern > 0.01) for (const L of scene.lights) liftGlow(ctx, L.at.x, L.at.y + 6, LIGHT_POOL_R, 0.55 * lantern, [255, 222, 160]);
    // the light's broken path on the water, under its reflection
    const path = pond();
    if (path) {
      if (moon.alpha > 0.01) waterPath(ctx, path, scene, moon, 0.65 * moon.alpha, [232, 238, 255]);
      if (sun.alpha > 0.01) waterPath(ctx, path, scene, sun, 0.5 * sun.alpha, [255, 232, 196]);
    }
  };

  return {
    get canvas() {
      flush();
      return canvas;
    },
    update(state, force = false) {
      const sun = sunDisc(state, sky);
      const moon = moonDisc(state, sky);
      const k = key(state.weights, sun, moon);
      if (!force && k === last) return false;
      last = k;
      lastState = state;
      if (phasesOf(state).some((p) => !plates.has(p))) unsettled.set(self, settled);
      else unsettled.delete(self);
      if (store.enabled) {
        // plates the blend lacks are looked up first; the composite follows their answers, or
        // the first draw, whichever comes first (a draw never shows a stale composite)
        for (const p of phasesOf(state)) if (!plates.has(p)) store.request(p);
        if (waiting(state)) {
          deferred = { state, sun, moon };
          deferring.add(self);
          return true;
        }
      }
      compose(state, sun, moon);
      return true;
    },
    prepare(phases) {
      for (const p of phases) {
        if (plates.has(p)) continue;
        if (!store.enabled) plate(p);
        else if (!store.pending(p)) {
          preparing.add(p);
          store.request(p);
          // asked before: its answer has come (a miss), so paint it now
          if (!store.pending(p)) {
            preparing.delete(p);
            plate(p);
          }
        }
      }
    },
    has: (p) => plates.has(p),
    missing: (state) => phasesOf(state).filter((p) => !plates.has(p)),
    lookup(state) {
      if (store.enabled) for (const p of phasesOf(state)) if (!plates.has(p)) store.request(p);
    },
    looking: (p) => !plates.has(p) && store.enabled && store.pending(p),
    paintPart(p) {
      if (plates.has(p)) return;
      if (!washed) field();
      else if (!ready()) void fetchPainters();
      else plate(p);
    },
    setDetail(visible, pixelScale) {
      const scale = Math.round(Math.min(CAST_DETAIL_MAX, pixelScale) * 100) / 100;
      if (!visible || scale <= CAST_SCALE * 1.5) {
        want = null;
        detailComp = null;
        detailPlates.clear();
        return;
      }
      const m = 30;
      const x0 = Math.max(0, Math.floor(visible.x - m));
      const y0 = Math.max(0, Math.floor(visible.y - m));
      const x1 = Math.min(WORLD_W, Math.ceil(visible.x + visible.w + m));
      const y1 = Math.min(WORLD_H, Math.ceil(visible.y + visible.h + m));
      if (x1 <= x0 || y1 <= y0) {
        want = null;
        return;
      }
      const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      const k = `${x0},${y0},${x1},${y1}@${scale}`;
      if (want?.key === k) return;
      want = { rect, scale, key: k };
      for (const [p, d] of detailPlates) if (d.key !== k) detailPlates.delete(p);
    },
    paintDetailStep() {
      if (!want || !lastState) return false;
      const missing = phasesOf(lastState).filter((p) => detailPlates.get(p)?.key !== want!.key);
      const next = missing[0];
      if (!next) return false;
      if (!ready()) {
        void fetchPainters();
        return true;
      }
      detailPlates.set(next, { key: want.key, canvas: paintDetailPlate(next, want) });
      return missing.length > 1;
    },
    detail() {
      const d = composeDetail();
      return d ? { canvas: d.canvas, rect: d.rect } : null;
    },
    version: () => {
      flush();
      return version;
    },
    settled,
    stats: () => ({
      plates: plates.size,
      painted,
      composes,
      paintMs,
      cacheHits: store.stats().hits,
      cacheMisses: store.stats().misses,
      detail: want ? { rect: { ...want.rect }, scale: want.scale, ready: composeDetail() !== null } : null,
      detailMs,
    }),
  };
}

/** Lighten the composite toward `rgb` in a soft disc (less pigment where the light is). */
function liftGlow(ctx: Ctx, x: number, y: number, r: number, a: number, rgb: readonly number[]): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.35, `rgba(${c},${a * 0.6})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Broken horizontal lifts down the water below a light's mirror image. */
function waterPath(ctx: Ctx, pond: Path2D, scene: SceneGeometry, light: Disc, a: number, rgb: readonly number[]): void {
  const top = scene.waterline + 4;
  // a high moon mirrors below the near shore: its broken path then starts near the far shore, as
  // a painter would put it (a low sun starts it at its own mirror image)
  const mirror = 2 * scene.waterline - light.y;
  const y0 = Math.max(top, Math.min(mirror - 30, top + 50));
  const rng = createRng(`path:${Math.round(light.x / 4)}`);
  ctx.save();
  ctx.clip(pond);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  for (let y = y0; y < WORLD_H; y += rng.range(8, 15)) {
    const d = (y - y0) / 260;
    if (d > 1) break;
    const half = light.r * (0.6 + d * 2.4) * rng.range(0.5, 1.2);
    const x = light.x + rng.range(-1, 1) * light.r * 0.4 * (1 + d);
    ctx.fillStyle = `rgba(${c},${a * (1 - d) ** 1.5 * rng.range(0.5, 1)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, half, rng.range(2.6, 4.6), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

