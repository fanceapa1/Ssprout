/**
 * The living water surface (`waterSurface` layer): slow light shimmer bands, an occasional
 * expanding ripple ring and a few glints, all clipped to the pond. Very subtle and cheap: a
 * handful of pre-painted sprites drawn with drawImage each frame. Everything is a pure
 * function of animation time `t` (seconds) and the seed — no state, no Math.random.
 */
import { createRng } from '../core/rng';
import { PAPER_WHITE, PIGMENTS, bounds, createPainter, insetPolygon, makeCanvas, mix, pointInPolygon, type AnyCanvas } from '../paint';
import type { Pt, Rect } from '../render/viewport';
import type { SceneGeometry } from './geometry';
import type { DaylightState } from '../ambience/daylight';

export interface WaterSurface {
  /** draw into a world-unit context; `t` = animation seconds */
  draw(ctx: CanvasRenderingContext2D, t: number, light?: DaylightState | null): void;
}

export interface WaterOptions {
  seed?: number;
  /** no motion (prefers-reduced-motion): a still, faint shimmer only */
  still?: boolean;
  /** sprite resolution in pixels per world unit (default 2) */
  resolution?: number;
}

interface WaterSprite {
  canvas: AnyCanvas;
  /** world size the sprite was painted at */
  w: number;
  h: number;
}

const RIPPLE_PERIOD = 9; // seconds between ripple rings
const RIPPLE_LIFE = 5.5;

function sprite(w: number, h: number, res: number, seed: string, paint: (p: ReturnType<typeof createPainter>) => void): WaterSprite {
  const canvas = makeCanvas(w * res, h * res);
  const p = createPainter(canvas, { seed });
  p.ctx.setTransform(res, 0, 0, res, 0, 0);
  paint(p);
  return { canvas, w, h };
}

export function createWaterSurface(scene: SceneGeometry, opts: WaterOptions = {}): WaterSurface {
  const seed = opts.seed ?? 1;
  const res = opts.resolution ?? 2;
  const clip = insetPolygon(scene.pond, 8);
  const b: Rect = bounds(clip);
  let sprites: { light: WaterSprite; dark: WaterSprite; ripple: WaterSprite; glint: WaterSprite } | null = null;

  const prepare = () => {
    const rng = createRng(`${seed}:water-sprites`);
    sprites = {
      light: sprite(240, 14, res, `${seed}:light`, (p) => p.lift({ cx: 120, cy: 7, rx: 112, ry: 2.6 }, { rng, amount: 0.9, deform: 0.2, spread: 0.35, layers: 5 })),
      dark: sprite(200, 14, res, `${seed}:dark`, (p) =>
        p.glaze({ cx: 100, cy: 7, rx: 92, ry: 2.4 }, mix(PIGMENTS.celadonDeep, PIGMENTS.celadonMid, 0.3), { rng, opacity: 0.9, deform: 0.2 }),
      ),
      ripple: sprite(90, 30, res, `${seed}:ripple`, (p) =>
        p.ripple({ x: 45, y: 13 }, { rng, width: 76, count: 2, squash: 0.16, opacity: 0.85, light: 0.9, lineWidth: 1 }),
      ),
      glint: sprite(16, 8, res, `${seed}:glint`, (p) =>
        p.dab({ x: 2, y: 4 }, PAPER_WHITE, { rng, variant: 'round', angle: 0, length: 12, width: 3.2, blend: 'source-over', pool: 0, basePool: 0, opacity: 0.95 }),
      ),
    };
  };

  /** A seeded point well inside the pond for ripple ring `i`. */
  const ripplePoint = (i: number): Pt => {
    const r = createRng(`${seed}:ripple:${i}`);
    for (let k = 0; k < 20; k++) {
      const q = { x: r.range(b.x + 40, b.x + b.w - 40), y: r.range(b.y + 30, b.y + b.h - 20) };
      if (pointInPolygon(q, clip) && pointInPolygon({ x: q.x - 50, y: q.y }, clip) && pointInPolygon({ x: q.x + 50, y: q.y }, clip)) return q;
    }
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };

  const bandRng = createRng(`${seed}:bands`);
  const bands = Array.from({ length: 6 }, (_, i) => ({
    y: b.y + b.h * (0.2 + (0.7 * i) / 6) + bandRng.range(-8, 8),
    x: bandRng.range(b.x + b.w * 0.2, b.x + b.w * 0.8),
    w: bandRng.range(120, 300),
    ph: bandRng.range(0, Math.PI * 2),
    speed: bandRng.range(0.04, 0.09),
    dark: i % 3 === 1,
  }));
  const glints = Array.from({ length: 7 }, () => {
    for (let k = 0; k < 20; k++) {
      const q = { x: bandRng.range(b.x, b.x + b.w), y: bandRng.range(b.y + b.h * 0.25, b.y + b.h) };
      if (pointInPolygon(q, clip)) return { ...q, ph: bandRng.range(0, 100), rate: bandRng.range(0.25, 0.5) };
    }
    return { x: b.x + b.w / 2, y: b.y + b.h / 2, ph: 0, rate: 0.3 };
  });

  return {
    draw(ctx, t, light) {
      const w = light?.weights;
      // sparkle follows the sun: brightest and busiest at midday, a few at sunrise/sunset, rare at night
      const sparkle = w ? w.midday * 1.5 + w.sunrise * 0.8 + w.sunset * 0.9 + w.night * 0.12 : 1;
      const glintAt = w ? 0.75 - 0.17 * w.midday : 0.75;
      const outer = ctx.globalAlpha;
      if (!sprites) prepare();
      const s = sprites!;
      const time = opts.still ? 0 : t;
      ctx.save();
      ctx.beginPath();
      clip.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.clip();

      // shimmer: long pale streaks drifting and breathing very slowly
      for (const band of bands) {
        const x = band.x + Math.sin(time * band.speed + band.ph) * 50;
        const y = band.y + Math.sin(time * band.speed * 0.7 + band.ph * 2) * 3;
        const breathe = 0.5 + 0.5 * Math.sin(time * band.speed * 4 + band.ph);
        const sp = band.dark ? s.dark : s.light;
        ctx.globalAlpha = band.dark ? 0.05 + 0.04 * breathe : 0.1 + 0.12 * breathe;
        ctx.drawImage(sp.canvas as CanvasImageSource, x - band.w / 2, y - sp.h / 2, band.w, sp.h);
      }

      if (!opts.still) {
        // ripple rings: one every RIPPLE_PERIOD seconds, expanding and fading out
        const i = Math.floor(t / RIPPLE_PERIOD);
        for (const k of [i - 1, i]) {
          const age = t - k * RIPPLE_PERIOD - 1.5;
          if (age < 0 || age > RIPPLE_LIFE) continue;
          const u = age / RIPPLE_LIFE;
          const q = ripplePoint(k);
          const grow = 0.3 + u * 1.1;
          const fadeIn = Math.min(1, age / 0.6);
          ctx.globalAlpha = 0.55 * fadeIn * (1 - u) ** 1.6;
          const w = s.ripple.w * grow;
          const h = s.ripple.h * grow;
          ctx.drawImage(s.ripple.canvas as CanvasImageSource, q.x - w / 2, q.y - h * 0.43, w, h);
        }
        // glints: brief, soft sparkles of reflected sky
        for (const g of glints) {
          const v = Math.sin(t * g.rate + g.ph);
          if (v < glintAt || sparkle <= 0.01) continue;
          ctx.globalAlpha = Math.min(0.85, ((v - glintAt) / (1 - glintAt)) ** 2 * 0.5 * sparkle) * outer;
          ctx.drawImage(s.glint.canvas as CanvasImageSource, g.x - s.glint.w / 2, g.y - s.glint.h / 2, s.glint.w, s.glint.h);
        }
      }
      ctx.restore();
    },
  };
}
