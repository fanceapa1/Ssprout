/**
 * The ambience engine: envelopes + particles + pre-painted sprites + the lighting cache, drawn
 * into world-unit contexts. Independent of the renderer and the store so the studio can drive
 * it directly; `system.ts` adapts it to the render `System` contract. docs/systems/ambience.md.
 */
import { createRng } from '../core/rng';
import type { SessionPhase } from '../core/session';
import type { Weather } from '../core/state';
import { bounds, type Rect } from '../paint/geometry';
import { WORLD_H, WORLD_W } from '../render/viewport';
import type { SceneGeometry } from '../scene/geometry';
import { createEnvelope, settleEnvelope, stepEnvelope, targetsFor, type Channel, type EnvelopeState, type Levels } from './envelope';
import { createCastLight, type CastLight, type LightArt } from './cast';
import { createNightEdge, edgeStrength } from './night-edge';
import { LIGHT } from './lighting';
import { nextPhase, pinnedState, only, whenIdle, type DayPhase, type DaylightState } from './daylight';
import { MOTE, type Emitter } from './motes';
import { pavilionFrame } from '../scene/paint-pavilion';
import { createSim, lifeAlpha, setSimArea, stepSim, warmSim, type Eave, type Sim } from './sim';
import { buildSprites, type Sprites } from './sprites';
import { gradeFor, type Grade } from './timeofday';
import { wind as defaultWind, type WindFn } from './wind';

type Ctx = CanvasRenderingContext2D;

/** Look tuning (alphas are peaks at level 1). docs/systems/ambience.md › Tuning. */
export const LOOK = {
  /** the sun's warm glaze at full strength, its lifted bands paler (sprites.ts › sunGlazeAt; ADR 0193) */
  sunGlaze: 0.35,
  rainGrade: { rgb: [204, 213, 221], alpha: 0.2 },
  /** a thin veil over the far half only: it fades out above the plant zone (`mistVeilTo`) */
  mistVeil: { rgb: [244, 242, 236], alpha: 0.08 },
  /** at night the mist (multiplied by the indigo wash) reads as fog: thin it this much */
  mistNight: 0.45,
  /** breathing period of the lifted light (s) and depth (0..1): the two band groups take turns */
  sunBreathS: 13,
  sunBreath: 0.35,
  /** sunlight caught on leaves (screen) */
  leafGlintAlpha: 0.55,
  rainAlpha: [0.3, 0.36, 0.42] as readonly number[],
  /** stroke width per rain layer (world units) */
  rainWidth: [0.9, 1.2, 1.5] as readonly number[],
  rippleAlpha: 0.75,
  /** vertical squash of ripple rings (perspective) */
  rippleSquash: 0.3,
  glintAlpha: 0.65,
  /** eave drips: peak alpha and longest streak (world units) */
  dripAlpha: 0.6,
  dripMaxLen: 30,
  flameAlpha: 0.22,
  flameSize: 5,
  /** how much colour the night takes out before its indigo glaze (saturation blend) */
  nightDesaturate: 0.38,
  /** sunrise mist: which mist bands lie on the pond and far bank, how dense, how far they rise */
  dawnMistBands: [1, 2, 3] as readonly number[],
  dawnMist: 1.25,
  dawnMistRise: 26,
  /** dew twinkles on the near grass at sunrise */
  dewCount: 16,
  dewAlpha: 0.75,
} as const;

export interface AmbienceFrame {
  /** real seconds since the previous frame (0 for frozen frames) */
  dt: number;
  phase: SessionPhase;
  /** the session's weather (null without a session) */
  weather: Weather | null;
  /** mote sources (plants) */
  emitters: readonly Emitter[];
  /** the garden's daylight now (phase weights, sun, moon) */
  light: DaylightState;
  /** force the light to recompose now (e.g. after `setTime`) */
  lightChanged?: boolean;
}

export interface AmbienceOptions {
  scene: SceneGeometry;
  reducedMotion?: boolean;
  seed?: string;
  /** world area to spawn particles in (the visible part of the world); default whole world */
  area?: Rect;
  /** eave for the rain drip line (default: from the scene's pavilion; null = none) */
  eave?: Eave | null;
  wind?: WindFn;
  /** painting-only layout the light plates throw shadows from (default: none but the geometry's) */
  lightArt?: LightArt;
}

export interface AmbienceDebug {
  phase: SessionPhase;
  weather: Weather | null;
  preview: Weather | null;
  levels: Levels;
  /** the dominant daylight phase and the weights of all four */
  time: DayPhase;
  weights: DaylightState['weights'];
  counts: { rain: number; ripples: number; glints: number; leafGlints: number; motes: number; drips: number };
  lightingPaints: number;
  /** cost of the light plates painted so far (ms; each phase is painted once) */
  lightingMs: number;
  reducedMotion: boolean;
}

export interface Ambience {
  /** dev preview weather (shown without a session; overrides the session's) */
  preview: Weather | null;
  setArea(area: Rect): void;
  update(frame: AmbienceFrame): void;
  /** jump to steady state on the next update (no crossfade): load, dev previews */
  settle(): void;
  /** force the lighting cache to repaint on the next update */
  invalidateLighting(): void;
  /** the grade the lighting layer was last painted with, and how many repaints so far */
  light(): { grade: Grade; paints: number };
  drawWater(ctx: Ctx): void;
  drawAir(ctx: Ctx): void;
  /**
   * `alpha` fades the whole grade (the app reveals it once the painting is there); `visible` is
   * the world rect this draw shows — a zoomed view the detail plate covers gets the sharp plate.
   */
  drawLighting(ctx: Ctx, alpha?: number, visible?: Rect): void;
  /** keep a sharp light plate for a zoomed view (null: the overview), painted in idle time (ADR 0163) */
  setDetail(visible: Rect | null, pixelScale: number): void;
  /** the wanted detail plate and whether it is painted (null: none wanted) */
  lightDetail(): { rect: Rect; scale: number; ready: boolean; ms: number } | null;
  /** current eased level of one channel */
  level(channel: Channel): number;
  debug(): AmbienceDebug;
}

/** The eave line of the scene's pavilion (same frame the scene paints it with). */
export function eaveOf(scene: SceneGeometry): Eave | null {
  const pv = scene.pavilion;
  if (!(pv.w > 0 && pv.h > 0)) return null;
  const f = pavilionFrame(pv);
  // the fascia's lower edge, where drops gather; they land at the foot of the deck
  return { a: { x: f.eaveL.x, y: f.eaveL.y + 9 }, b: { x: f.eaveR.x, y: f.eaveR.y + 9 }, ground: pv.y + pv.h };
}

const spriteCache = new WeakMap<SceneGeometry, Map<string, Sprites>>();

/** Sprites are immutable: build once per scene + seed. */
function spritesFor(scene: SceneGeometry, seed: string, layout: Parameters<typeof buildSprites>[1]): Sprites {
  let bySeed = spriteCache.get(scene);
  if (!bySeed) spriteCache.set(scene, (bySeed = new Map()));
  let s = bySeed.get(seed);
  if (!s) bySeed.set(seed, (s = buildSprites(seed, layout)));
  return s;
}

export function createAmbience(opts: AmbienceOptions): Ambience {
  const { scene } = opts;
  const reducedMotion = opts.reducedMotion ?? false;
  const windFn = opts.wind ?? defaultWind;
  const seed = opts.seed ?? 'ambience';
  const pondBox = bounds(scene.pond);
  const sprites: Sprites = spritesFor(scene, seed, { pondTop: pondBox.y, pondBottom: pondBox.y + pondBox.h });
  const cast: CastLight = castFor(scene, opts.lightArt ?? NO_ART, `${seed}-cast`);
  const nightEdge = createNightEdge(`${seed}-edge`);
  const area0 = opts.area ?? { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
  /** the visible area: on tall phones it reaches above and below the world (bare paper there) */
  let view: Rect = area0;
  let sim: Sim = createSim(createRng(seed).fork('sim'), { pond: scene.pond, area: area0, eave: opts.eave ?? eaveOf(scene) });
  let env: EnvelopeState = createEnvelope({ motion: 1 });
  let pendingSettle = true;
  let lightDirty = true;
  let sinceLight = Infinity;
  let light: DaylightState = pinnedState(only('midday'));
  let grade: Grade = gradeFor(light.weights);
  let paints = 0;
  let preparing = false;
  let phase: SessionPhase = 'idle';
  let weather: Weather | null = null;
  let staticKey = '';
  let flameT = 0;
  let pondPath: Path2D | null = null;
  let detailing = false;
  const idleSoon = (fn: () => void) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(fn, { timeout: 600 });
    else setTimeout(fn, 30);
  };
  /** paint the detail plates one phase per idle callback */
  const scheduleDetail = () => {
    if (detailing) return;
    detailing = true;
    idleSoon(() => {
      detailing = false;
      if (cast.paintDetailStep()) scheduleDetail();
    });
  };

  const pond = () => {
    if (!pondPath && typeof Path2D !== 'undefined') {
      pondPath = new Path2D();
      scene.pond.forEach((p, i) => (i ? pondPath!.lineTo(p.x, p.y) : pondPath!.moveTo(p.x, p.y)));
      pondPath.closePath();
    }
    return pondPath;
  };

  /** how much daylight there is for sunny effects (the lifted light, glints): little at night */
  const daylight = () => 1 - 0.85 * Math.min(1, light.weights.night);
  const pondTop = pondBox.y;
  let mistVeil: { top: number; to: number; fill: CanvasGradient } | null = null;
  /** dew points on the near banks (seeded): where the sunrise twinkles */
  const dewRng = createRng(seed).fork('dew');
  const dew = Array.from({ length: LOOK.dewCount }, (_, i) => {
    const left = i % 2 === 0;
    return {
      x: left ? dewRng.range(90, 560) : dewRng.range(980, 1500),
      y: dewRng.range(760, 950),
      len: dewRng.range(7, 12),
      rate: dewRng.range(0.5, 1.1),
      ph: dewRng.range(0, Math.PI * 2),
      variant: dewRng.int(0, sprites.glints.length - 1),
    };
  });

  const api: Ambience = {
    preview: null,
    setArea(area) {
      view = area;
      setSimArea(sim, area);
    },
    lightDetail() {
      const st = cast.stats();
      return st.detail ? { ...st.detail, ms: st.detailMs } : null;
    },
    setDetail(visible, pixelScale) {
      cast.setDetail(visible, pixelScale);
      if (visible) scheduleDetail();
    },
    settle() {
      pendingSettle = true;
      lightDirty = true;
    },
    invalidateLighting() {
      lightDirty = true;
    },
    update(frame) {
      phase = frame.phase;
      weather = frame.weather;
      light = frame.light;
      if (frame.lightChanged) lightDirty = true;
      const targets = targetsFor(frame.phase, frame.weather, { preview: api.preview, reducedMotion });
      const input = { levels: targets, wind: windFn, emitters: frame.emitters };
      const key = `${targets.sun}|${targets.rain}|${targets.mist}`;
      if (pendingSettle) {
        pendingSettle = false;
        env = settleEnvelope(targets);
        sim = createSim(createRng(seed).fork('sim'), sim.world);
        warmSim(sim, 12, input);
        staticKey = key;
      } else {
        env = stepEnvelope(env, targets, frame.dt);
        if (reducedMotion && key !== staticKey) {
          // still frames: lay down the new weather's strokes once; the envelope fades them in
          staticKey = key;
          sim = createSim(createRng(seed).fork('sim'), sim.world);
          warmSim(sim, 3, input);
        }
        stepSim(sim, frame.dt, { levels: env.value, wind: windFn, emitters: frame.emitters });
      }
      if (!reducedMotion) flameT += frame.dt;

      // lighting: recompose on demand, else every few seconds if the light moved
      sinceLight += frame.dt;
      if (lightDirty || frame.dt === 0 || sinceLight >= LIGHT.redrawS) {
        sinceLight = 0;
        if (cast.update(light, lightDirty)) {
          grade = gradeFor(light.weights);
          paints++;
          // a new phase in the blend needs its detail plate too
          if (cast.stats().detail) scheduleDetail();
        }
        lightDirty = false;
        // paint the coming phase's light plate while the browser is idle
        const next = nextPhase(light.phase);
        if (!cast.has(next) && !preparing) {
          preparing = true;
          whenIdle(() => {
            cast.prepare([next]);
            preparing = false;
          });
        }
      }
    },
    drawWater(ctx) {
      const lv = env.value;
      if (!sim.ripples.length && !sim.glints.length) return;
      const path = pond();
      if (path) ctx.clip(path);
      if (sim.ripples.length && lv.rain > 0.002) {
        for (const r of sim.ripples) {
          const k = r.age / r.life;
          const rad = r.size * (0.25 + 0.75 * (1 - (1 - k) ** 2));
          const a = LOOK.rippleAlpha * lv.rain * (1 - k) ** 1.3 * Math.min(1, k / 0.08);
          if (a <= 0.003) continue;
          const s = sprites.ripples[r.variant]!;
          const half = rad * (64 / 58);
          ctx.globalAlpha = a;
          ctx.drawImage(s as CanvasImageSource, r.x - half, r.y - half * LOOK.rippleSquash, half * 2, half * 2 * LOOK.rippleSquash);
        }
      }
      if (sim.glints.length && lv.sun > 0.002) {
        ctx.globalCompositeOperation = 'screen';
        const day = daylight();
        for (const g of sim.glints) {
          const a = LOOK.glintAlpha * lv.sun * day * lifeAlpha(g.age, g.life, 0.3, 0.5);
          if (a <= 0.003) continue;
          ctx.globalAlpha = a;
          const h = g.len * (8 / 48) * 1.4;
          ctx.drawImage(sprites.glints[g.variant]! as CanvasImageSource, g.x - g.len / 2, g.y - h / 2, g.len, h);
        }
      }
    },
    drawAir(ctx) {
      const lv = env.value;
      const area = sim.world.area;
      const fill = (rgb: readonly number[], alpha: number, op: GlobalCompositeOperation) => {
        if (alpha <= 0.002) return;
        ctx.globalCompositeOperation = op;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(area.x, area.y, area.w, area.h);
      };
      // the sun: a thin warm glaze with soft diagonal bands of light lifted out of it (ADR 0193);
      // the two groups of bands take turns, as light comes and goes between drifting clouds
      if (lv.sun > 0.002) {
        ctx.globalCompositeOperation = 'multiply';
        const b = 0.5 * LOOK.sunBreath * Math.sin((sim.t / LOOK.sunBreathS) * Math.PI * 2);
        const a = LOOK.sunGlaze * lv.sun * daylight();
        ctx.globalAlpha = a * (0.5 + b);
        ctx.drawImage(sprites.sun[0] as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
        ctx.globalAlpha = a * (0.5 - b);
        ctx.drawImage(sprites.sun[1] as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
      }
      fill(LOOK.rainGrade.rgb, LOOK.rainGrade.alpha * lv.rain, 'multiply');

      // mist: drifting bands over the far bank, then a thin veil over the far half only
      if (lv.mist > 0.002) {
        const mist = lv.mist * (1 - LOOK.mistNight * (1 - daylight()) / 0.85);
        ctx.globalCompositeOperation = 'source-over';
        for (const b of sprites.mist) {
          ctx.globalAlpha = b.alpha * mist;
          const off = (((sim.t * b.speed) % WORLD_W) + WORLD_W) % WORLD_W;
          const y = b.y - b.h / 2;
          ctx.drawImage(b.canvas as CanvasImageSource, off - WORLD_W, y, WORLD_W, b.h);
          ctx.drawImage(b.canvas as CanvasImageSource, off, y, WORLD_W, b.h);
        }
        const veilTo = pondTop + 140;
        if (!mistVeil || mistVeil.top !== area.y || mistVeil.to !== veilTo) {
          const gr = ctx.createLinearGradient(0, area.y, 0, veilTo);
          const [r, g, b] = LOOK.mistVeil.rgb;
          gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
          gr.addColorStop(0.7, `rgba(${r},${g},${b},0.8)`);
          gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
          mistVeil = { top: area.y, to: veilTo, fill: gr };
        }
        ctx.globalAlpha = LOOK.mistVeil.alpha * mist;
        ctx.fillStyle = mistVeil.fill;
        ctx.fillRect(area.x, area.y, area.w, veilTo - area.y);
      }

      // dawn: mist lying on the pond and the far bank, lifting and thinning as the sun climbs
      const dawn = light.weights.sunrise;
      if (dawn > 0.01) {
        const lift = Math.max(0, Math.min(1, (light.sunAltitude + 4) / 14));
        ctx.globalCompositeOperation = 'source-over';
        for (const i of LOOK.dawnMistBands) {
          const b = sprites.mist[i];
          if (!b) continue;
          ctx.globalAlpha = b.alpha * LOOK.dawnMist * dawn * (1 - 0.65 * lift);
          const off = (((sim.t * b.speed * 0.6) % WORLD_W) + WORLD_W) % WORLD_W;
          const y = b.y - b.h / 2 - LOOK.dawnMistRise * lift;
          ctx.drawImage(b.canvas as CanvasImageSource, off - WORLD_W, y, WORLD_W, b.h);
          ctx.drawImage(b.canvas as CanvasImageSource, off, y, WORLD_W, b.h);
        }
        // dew catching the first light on the near grass
        if (!reducedMotion) {
          ctx.globalCompositeOperation = 'screen';
          for (const d of dew) {
            const v = Math.sin(sim.t * d.rate + d.ph);
            if (v < 0.78) continue;
            ctx.globalAlpha = ((v - 0.78) / 0.22) ** 2 * LOOK.dewAlpha * dawn;
            ctx.drawImage(sprites.glints[d.variant]! as CanvasImageSource, d.x - d.len / 2, d.y - d.len * 0.12, d.len, d.len * 0.24);
          }
        }
      }

      // sunlight caught on leaves: warm lifted dabs that come and go
      if (sim.leafGlints.length && lv.sun > 0.002) {
        ctx.globalCompositeOperation = 'screen';
        const day = daylight();
        for (const g of sim.leafGlints) {
          const a = LOOK.leafGlintAlpha * lv.sun * day * lifeAlpha(g.age, g.life, 0.35, 0.45);
          if (a <= 0.003) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(sprites.leafGlints[g.variant]! as CanvasImageSource, g.x - g.size, g.y - g.size * 0.8, g.size * 2, g.size * 1.6);
        }
      }

      // rain strokes, far → near
      if (sim.rain.length && lv.rain > 0.002) {
        ctx.globalCompositeOperation = 'multiply';
        const m = ctx.getTransform();
        const k = m.a; // uniform scale (device px per world unit)
        const strength = 0.4 + 0.6 * lv.rain;
        for (let layer = 0; layer < LOOK.rainAlpha.length; layer++) {
          const base = LOOK.rainAlpha[layer]! * strength;
          const ww = LOOK.rainWidth[layer]! * 4;
          for (const r of sim.rain) {
            if (r.layer !== layer) continue;
            const a = base * lifeAlpha(r.age, r.life, 0.25, 0.35);
            if (a <= 0.003) continue;
            const sp = Math.hypot(r.vx, r.vy) || 1;
            const c = r.vy / sp;
            const s = -r.vx / sp;
            ctx.setTransform(k * c, k * s, -k * s, k * c, k * r.x + m.e, k * r.y + m.f);
            ctx.globalAlpha = a;
            ctx.drawImage(sprites.rain[layer]![r.variant]! as CanvasImageSource, -ww / 2, -r.len, ww, r.len);
          }
        }
        ctx.setTransform(m);
      }

      // drips off the eave: straight down, stretching as they speed up
      if (sim.drips.length && lv.rain > 0.002) {
        ctx.globalCompositeOperation = 'multiply';
        const ww = LOOK.rainWidth[2]! * 4;
        for (const dr of sim.drips) {
          const len = Math.min(LOOK.dripMaxLen, Math.max(3, dr.vy * 0.025));
          const fade = Math.min(1, dr.age / 0.12) * Math.min(1, (dr.ground - dr.y) / 30);
          const a = LOOK.dripAlpha * lv.rain * fade;
          if (a <= 0.003) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(sprites.rain[1]![dr.variant]! as CanvasImageSource, dr.x - ww / 2, dr.y - len, ww, len);
        }
      }

      // photosynthesis motes
      if (sim.motes.length) {
        ctx.globalCompositeOperation = 'source-over';
        for (const mo of sim.motes) {
          const a = MOTE.alpha * Math.max(lv.motes, 0) * lifeAlpha(mo.age, mo.life, 0.25, 0.45);
          if (a <= 0.003) continue;
          const sprite = sprites.motes[mo.hue < 0.6 ? (mo.phase > Math.PI ? 1 : 0) : mo.phase > Math.PI ? 3 : 2]!;
          ctx.globalAlpha = a;
          ctx.drawImage(sprite as CanvasImageSource, mo.x - mo.size, mo.y - mo.size, mo.size * 2, mo.size * 2);
        }
      }
    },
    drawLighting(ctx, alpha = 1, visible) {
      if (alpha <= 0.002) return;
      // colours fade at night before they darken (the eye's night vision): a cool desaturating glaze
      const desat = LOOK.nightDesaturate * light.weights.night * alpha;
      if (desat > 0.004) {
        // over the whole drawn view, not only the overview's crop (a zoomed view can reach past it)
        const area = visible ?? view;
        // The painting is laid on transparent canvas (white = no paint), and a saturation fill
        // composites source-over: where the frame is still clear it would leave its grey as
        // pigment, darkest where the painting is thinnest, and nothing where something opaque (the
        // sky plate, down to y 500) had filled it in — a hard grey line across the meadow and the
        // plants on it, plain when zoomed in. Back the frame with white paper first (ADR 0206): the
        // multiplies after it come out the same, and the glaze only takes colour out.
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(area.x, area.y, area.w, area.h);
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = desat;
        ctx.fillStyle = 'rgb(120,124,138)';
        ctx.fillRect(area.x, area.y, area.w, area.h);
      }
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      const inWorld = visible ? clip(visible) : null;
      const d = inWorld ? cast.detail() : null;
      if (d && inWorld && contains(d.rect, inWorld)) ctx.drawImage(d.canvas as CanvasImageSource, d.rect.x, d.rect.y, d.rect.w, d.rect.h);
      else ctx.drawImage(cast.canvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
      // paper shown beyond the world's top/bottom (tall phones) takes the light of the nearest edge
      const lc = cast.canvas as CanvasImageSource & { width: number; height: number };
      if (view.y < 0) ctx.drawImage(lc, 0, 0, lc.width, 1, 0, view.y, WORLD_W, -view.y);
      const below = view.y + view.h - WORLD_H;
      if (below > 0) ctx.drawImage(lc, 0, lc.height - 1, lc.width, 1, 0, WORLD_H, WORLD_W, below);
      // in dark light the wash stops short of the stage's dissolve with a watercolour edge (ADR 0184)
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      nightEdge.draw(ctx as CanvasRenderingContext2D, edgeStrength(light) * alpha);
      if (grade.lantern > 0.02) {
        const L = scene.pavilion.lantern;
        const flicker = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(flameT * 2.3) * Math.sin(flameT * 3.7 + 1));
        const s = LOOK.flameSize;
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = LOOK.flameAlpha * grade.lantern * flicker * alpha;
        ctx.drawImage(sprites.flame as CanvasImageSource, L.x - s, L.y - s * 1.2, s * 2, s * 2.4);
      }
    },
    level: (c) => env.value[c],
    light: () => ({ grade, paints }),
    debug() {
      return {
        phase,
        weather,
        preview: api.preview,
        levels: { ...env.value },
        weights: { ...light.weights },
        time: light.phase,
        counts: { rain: sim.rain.length, ripples: sim.ripples.length, glints: sim.glints.length, leafGlints: sim.leafGlints.length, motes: sim.motes.length, drips: sim.drips.length },
        lightingPaints: paints,
        lightingMs: cast.stats().paintMs,
        reducedMotion,
      };
    },
  };
  return api;
}

const NO_ART: LightArt = { trees: [], shrubs: [] };

/** the part of a rect inside the world, or null */
function clip(r: Rect): Rect | null {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const x1 = Math.min(WORLD_W, r.x + r.w);
  const y1 = Math.min(WORLD_H, r.y + r.h);
  return x1 > x && y1 > y ? { x, y, w: x1 - x, h: y1 - y } : null;
}

const contains = (o: Rect, i: Rect) => i.x >= o.x - 0.5 && i.y >= o.y - 0.5 && i.x + i.w <= o.x + o.w + 0.5 && i.y + i.h <= o.y + o.h + 0.5;

const castCache = new WeakMap<SceneGeometry, Map<string, CastLight>>();

/** Light plates are painted once per scene + seed and shared by every engine (the studio runs several). */
function castFor(scene: SceneGeometry, art: LightArt, seed: string): CastLight {
  let bySeed = castCache.get(scene);
  if (!bySeed) castCache.set(scene, (bySeed = new Map()));
  let c = bySeed.get(seed);
  if (!c) bySeed.set(seed, (c = createCastLight(scene, art, seed)));
  return c;
}

