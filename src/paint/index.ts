/**
 * Watercolour paint engine entry point.
 *
 * PLACEHOLDER: the paint engine task expands `Painter` with wash/glaze/dab/ink helpers.
 * Keep it additive: species and scene code only rely on `ctx`, `w` and `h` today.
 */
export interface Painter {
  /** 2D context of the target canvas, in pixels (origin top-left). */
  readonly ctx: CanvasRenderingContext2D;
  /** Target width in pixels. */
  readonly w: number;
  /** Target height in pixels. */
  readonly h: number;
}

export function createPainter(canvas: HTMLCanvasElement): Painter {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { ctx, w: canvas.width, h: canvas.height };
}
