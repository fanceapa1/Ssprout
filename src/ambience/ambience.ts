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
import { createEnvelope, settleEnvelope, stepEnvelope, targetsFor, type EnvelopeState, type Levels } from './envelope';
import { createLightingCache, LIGHT, type LightingCache } from './lighting';
import { MOTE, type Emitter } from './motes';
import { createSim, lifeAlpha, setSimArea, stepSim, warmSim, type Sim } from './sim';
import { buildSprites, type Sprites } from './sprites';
import { gradeAt, gradeDistance, timeName, type Grade, type TimeName } from './timeofday';
import { wind as defaultWind, type WindFn } from './wind';

type Ctx = CanvasRenderingContext2D;

/** Look tuning (alphas are peaks at level 1). docs/systems/ambience.md › Tuning. */
export const LOOK = {
  sunGrade: { rgb: [250, 236, 208], alpha: 0.15 },
  rainGrade: { rgb: [204, 213, 221], alpha: 0.2 },
  mistVeil: { rgb: [244, 242, 236], alpha: 0.08 },
  shaftAlpha: 0.42,
  /** breathing period of the light shafts (s) and depth (0..1) */
  shaftBreathS: 13,
  shaftBreath: 0.35,
  rainAlpha: [0.24, 0.3, 0.34] as readonly number[],
  /** stroke width per rain layer (world units) */
  rainWidth: [0.7, 0.95, 1.25] as readonly number[],
  rippleAlpha: 0.75,
  /** vertical squash of ripple rings (perspective) */
  rippleSquash: 0.3,
  glintAlpha: 0.65,
  flameAlpha: 0.22,
  flameSize: 5,
} as const;

export interface AmbienceFrame {
  /** real seconds since the previous frame (0 for frozen frames) */
  dt: number;
  phase: SessionPhase;
  /** the session's weather (null without a session) */
  weather: Weather | null;
  /** mote sources (plants) */
  emitters: readonly Emitter[];
  /** local hour, 0–24 */
  hour: number;
}

export interface AmbienceOptions {
  scene: SceneGeometry;
  reducedMotion?: boolean;
  seed?: string;
  /** world area to spawn particles in (the visible part of the world); default whole world */
  area?: Rect;
  wind?: WindFn;
}

export interface AmbienceDebug {
  phase: SessionPhase;
  weather: Weather | null;
  preview: Weather | null;
  levels: Levels;
  hour: number;
  time: TimeName;
  counts: { rain: number; ripples: number; glints: number; motes: number };
  lightingPaints: number;
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
  drawWater(ctx: Ctx): void;
  drawAir(ctx: Ctx): void;
  drawLighting(ctx: Ctx): void;
  debug(): AmbienceDebug;
}

export function createAmbience(opts: AmbienceOptions): Ambience {
  const { scene } = opts;
  const reducedMotion = opts.reducedMotion ?? false;
  const windFn = opts.wind ?? defaultWind;
  const seed = opts.seed ?? 'ambience';
  const pondBox = bounds(scene.pond);
  const sprites: Sprites = buildSprites(seed, { pondTop: pondBox.y, pondBottom: pondBox.y + pondBox.h });
  const lighting: LightingCache = createLightingCache(scene, `${seed}-light`);
  const area0 = opts.area ?? { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
  let sim: Sim = createSim(createRng(seed).fork('sim'), { pond: scene.pond, area: area0 });
  let env: EnvelopeState = createEnvelope({ motion: 1 });
  let pendingSettle = true;
  let lightDirty = true;
  let sinceLight = 0;
  let painted: Grade | null = null;
  let grade: Grade = gradeAt(12);
  let paints = 0;
  let hour = 12;
  let phase: SessionPhase = 'idle';
  let weather: Weather | null = null;
  let staticKey = '';
  let flameT = 0;
  let pondPath: Path2D | null = null;

  const pond = () => {
    if (!pondPath && typeof Path2D !== 'undefined') {
      pondPath = new Path2D();
      scene.pond.forEach((p, i) => (i ? pondPath!.lineTo(p.x, p.y) : pondPath!.moveTo(p.x, p.y)));
      pondPath.closePath();
    }
    return pondPath;
  };

  const daylight = () => 1 - 0.85 * Math.min(1, grade.lantern);

  const api: Ambience = {
    preview: null,
    setArea(area) {
      setSimArea(sim, area);
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
      hour = frame.hour;
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

      // lighting: repaint on demand, else every few seconds if the grade moved
      sinceLight += frame.dt;
      const next = gradeAt(hour);
      if (lightDirty || (sinceLight >= LIGHT.redrawS && (!painted || gradeDistance(next, painted) > 1e-7))) {
        grade = next;
        lighting.paint(grade);
        painted = grade;
        paints++;
        lightDirty = false;
        sinceLight = 0;
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
      // faint grades
      fill(LOOK.sunGrade.rgb, LOOK.sunGrade.alpha * lv.sun, 'multiply');
      fill(LOOK.rainGrade.rgb, LOOK.rainGrade.alpha * lv.rain, 'multiply');

      // mist: drifting bands over the far bank, then a thin veil
      if (lv.mist > 0.002) {
        ctx.globalCompositeOperation = 'source-over';
        for (const b of sprites.mist) {
          ctx.globalAlpha = b.alpha * lv.mist;
          const off = (((sim.t * b.speed) % WORLD_W) + WORLD_W) % WORLD_W;
          const y = b.y - b.h / 2;
          ctx.drawImage(b.canvas as CanvasImageSource, off - WORLD_W, y, WORLD_W, b.h);
          ctx.drawImage(b.canvas as CanvasImageSource, off, y, WORLD_W, b.h);
        }
        fill(LOOK.mistVeil.rgb, LOOK.mistVeil.alpha * lv.mist, 'source-over');
      }

      // light shafts, two groups breathing in turn
      if (lv.sun > 0.002) {
        ctx.globalCompositeOperation = 'screen';
        const day = daylight();
        sprites.shafts.forEach((s, i) => {
          const breath = 1 - LOOK.shaftBreath * (0.5 + 0.5 * Math.sin((sim.t / LOOK.shaftBreathS) * Math.PI * 2 + i * Math.PI));
          ctx.globalAlpha = LOOK.shaftAlpha * lv.sun * day * breath;
          ctx.drawImage(s as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
        });
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
    drawLighting(ctx) {
      if (grade.amount <= 0.004 && grade.lantern <= 0.004 && grade.glow <= 0.004) return;
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(lighting.canvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
      if (grade.lantern > 0.02) {
        const L = scene.pavilion.lantern;
        const flicker = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(flameT * 2.3) * Math.sin(flameT * 3.7 + 1));
        const s = LOOK.flameSize;
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = LOOK.flameAlpha * grade.lantern * flicker;
        ctx.drawImage(sprites.flame as CanvasImageSource, L.x - s, L.y - s * 1.2, s * 2, s * 2.4);
      }
    },
    debug() {
      return {
        phase,
        weather,
        preview: api.preview,
        levels: { ...env.value },
        hour,
        time: timeName(hour),
        counts: { rain: sim.rain.length, ripples: sim.ripples.length, glints: sim.glints.length, motes: sim.motes.length },
        lightingPaints: paints,
        reducedMotion,
      };
    },
  };
  return api;
}

