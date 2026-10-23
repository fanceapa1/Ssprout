/**
 * The light plate laid at device resolution while the view rests (ADR 0207).
 *
 * The plate is a soft, low-resolution image multiplied over the whole frame. Drawn as it is, every
 * frame resamples it up to the screen (bilinear) and blends it: on a CPU rasteriser that is the
 * single most expensive thing in a frame (~30 ms at 2824×1584). Once the same plate is drawn
 * through the same transform two frames running (the camera rests and the light has not been
 * recomposed), it is resampled once into a frame-sized buffer, exactly as it would have been
 * drawn, and every later frame blends that buffer 1:1 (a third of the cost on a CPU rasteriser,
 * the same on a GPU). Any change of the plate, the view or the canvas size draws directly again.
 */
import { makeCanvas, type AnyCanvas } from '../paint';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface DevicePlate {
  /**
   * Draw what `paint` draws (in `ctx`'s current transform, compositing and alpha). `key` names the
   * picture: the same key draws the same pixels. `paint` must not change compositing or alpha.
   */
  draw(ctx: Ctx, key: string, paint: (c: Ctx) => void): void;
  stats(): { direct: number; builds: number; blits: number };
  /** drop the buffer (memory) */
  clear(): void;
}

export function createDevicePlate(): DevicePlate {
  let buf: { canvas: AnyCanvas; ctx: Ctx } | null = null;
  /** what the buffer holds, and what was drawn last frame */
  let held = '';
  let seen = '';
  let direct = 0;
  let builds = 0;
  let blits = 0;

  const buffer = (w: number, h: number) => {
    if (!buf) {
      let canvas: AnyCanvas;
      try {
        canvas = makeCanvas(w, h);
      } catch {
        return null;
      }
      const c = canvas.getContext('2d') as Ctx | null;
      if (!c) return null;
      buf = { canvas, ctx: c };
    }
    if (buf.canvas.width !== w || buf.canvas.height !== h) {
      buf.canvas.width = w;
      buf.canvas.height = h;
    }
    return buf;
  };

  return {
    draw(ctx, key, paint) {
      const m = ctx.getTransform();
      const target = ctx.canvas as { width: number; height: number } | undefined;
      const w = target?.width ?? 0;
      const h = target?.height ?? 0;
      const full = `${key}|${m.a},${m.b},${m.c},${m.d},${m.e},${m.f}|${w}x${h}`;
      if (full !== held) {
        const resting = full === seen;
        seen = full;
        const b = resting && w > 0 && h > 0 ? buffer(w, h) : null;
        if (!b) {
          direct++;
          paint(ctx);
          return;
        }
        const c = b.ctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        c.clearRect(0, 0, w, h);
        c.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
        c.imageSmoothingQuality = ctx.imageSmoothingQuality;
        c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
        paint(c);
        c.setTransform(1, 0, 0, 1, 0, 0);
        held = full;
        builds++;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buf!.canvas as CanvasImageSource, 0, 0);
      ctx.restore();
      blits++;
    },
    stats: () => ({ direct, builds, blits }),
    clear() {
      buf = null;
      held = '';
      seen = '';
    },
  };
}
