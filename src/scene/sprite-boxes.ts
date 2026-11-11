/**
 * The world boxes of the foreground sprites: geometry only, so a stored sprite atlas is cut up
 * again without loading any painter (ADR 0341).
 */
import type { Rect } from '../render/viewport';
import type { Rock } from './geometry';
import type { TuftSpec } from './layout';

/** World box a rock sprite needs (stone + cast shadow + base tufts). */
export function rockBox(r: Rock): Rect {
  return { x: r.x - r.w * 0.85, y: r.y - r.h * 1.3, w: r.w * 1.7, h: r.h * 1.62 };
}

export function tuftBox(t: TuftSpec): Rect {
  return { x: t.x - t.h * 1.6, y: t.y - t.h * 1.4, w: t.h * 3.2, h: t.h * 1.6 };
}
