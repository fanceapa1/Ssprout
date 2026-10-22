/**
 * Pure maths for the page's custom scrolling (ADR 0131): the eased approach used for wheel and
 * arrow keys, the timed glide used for page keys and jumps to a section, wheel/key deltas and the
 * custom scrollbar's thumb geometry. No DOM here, so all of it is unit-tested.
 */

/** Time constant of the wheel/arrow smoothing (ms): ~63 % of the way after this long. */
export const FOLLOW_TAU_MS = 120;
/** Below this distance (px) the approach snaps onto its target. */
export const SNAP_PX = 0.5;
/** Slowest the approach ever moves (px per ms) before it lands. */
export const MIN_SPEED = 0.06;
/** Arrow keys move this far (px). */
export const ARROW_STEP = 72;
/** Page keys and Space move this share of the viewport. */
export const PAGE_SHARE = 0.85;
/** Pixels per wheel "line" when a wheel reports lines (deltaMode 1). */
export const LINE_PX = 40;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Keep a scroll position inside the document: 0 … max. */
export function clampScroll(y: number, max: number): number {
  return clamp(Number.isFinite(y) ? y : 0, 0, Math.max(0, max));
}

/**
 * One frame of the eased approach: `current` moves toward `target` by an exponential step that
 * does not depend on the frame rate (two 8 ms steps land where one 16 ms step does). Snaps
 * onto the target when within SNAP_PX.
 */
export function approach(current: number, target: number, dtMs: number, tauMs = FOLLOW_TAU_MS): number {
  if (!(tauMs > 0)) return target;
  const dt = Math.max(0, dtMs);
  const k = 1 - Math.exp(-dt / tauMs);
  const gap = target - current;
  // at least ~1 px a frame: browsers round scroll offsets, so a sub-pixel creep would look stuck
  const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(Math.abs(gap) * k, dt * MIN_SPEED));
  const next = current + step;
  return Math.abs(target - next) <= SNAP_PX ? target : next;
}

/** Slow in, slow out, like a breath (cubic). */
export function easeBreath(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/** How long a glide over `distance` px takes (ms): longer for longer trips, within calm bounds. */
export function glideDuration(distance: number): number {
  return Math.round(clamp(420 + Math.sqrt(Math.abs(distance)) * 13, 420, 1100));
}

/** Position of a glide from `from` to `to` after `elapsedMs` of `durationMs`. */
export function glideAt(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return to;
  return from + (to - from) * easeBreath(elapsedMs / durationMs);
}

/** A wheel event's vertical travel in pixels (deltaMode 0 px, 1 lines, 2 pages). */
export function wheelPixels(e: { deltaY: number; deltaMode: number }, pageHeight: number): number {
  const d = Number.isFinite(e.deltaY) ? e.deltaY : 0;
  if (e.deltaMode === 1) return d * LINE_PX;
  if (e.deltaMode === 2) return d * pageHeight * PAGE_SHARE;
  return d;
}

export type ScrollKeyKind = 'step' | 'page' | 'edge';

/**
 * The new scroll target for a scrolling key, or null when the key does not scroll.
 * `step` keys (arrows) are followed with the eased approach; `page`/`edge` keys glide.
 */
export function keyScroll(
  key: string,
  shift: boolean,
  current: number,
  max: number,
  viewportH: number,
): { target: number; kind: ScrollKeyKind } | null {
  const page = Math.max(40, viewportH * PAGE_SHARE);
  let target: number;
  let kind: ScrollKeyKind = 'page';
  switch (key) {
    case 'ArrowDown':
      target = current + ARROW_STEP;
      kind = 'step';
      break;
    case 'ArrowUp':
      target = current - ARROW_STEP;
      kind = 'step';
      break;
    case 'PageDown':
      target = current + page;
      break;
    case 'PageUp':
      target = current - page;
      break;
    case ' ':
    case 'Spacebar':
      target = current + (shift ? -page : page);
      break;
    case 'Home':
      target = 0;
      kind = 'edge';
      break;
    case 'End':
      target = max;
      kind = 'edge';
      break;
    default:
      return null;
  }
  return { target: clampScroll(target, max), kind };
}

export interface ThumbGeometry {
  /** thumb length along the track (px) */
  size: number;
  /** thumb offset from the track's start (px) */
  offset: number;
}

/**
 * The scrollbar thumb for a document scrolled to `y` of `max`, seen through a viewport of
 * `viewH`, on a track `track` px long. The thumb is proportional to the share of the document in
 * view, never shorter than `minSize`.
 */
export function thumbGeometry(y: number, max: number, viewH: number, track: number, minSize = 44): ThumbGeometry {
  if (!(max > 0) || !(track > 0)) return { size: Math.max(0, track), offset: 0 };
  const share = viewH / (viewH + max);
  const size = clamp(track * share, Math.min(minSize, track), track);
  const room = track - size;
  return { size, offset: room * (clampScroll(y, max) / max) };
}

/** Inverse of `thumbGeometry`: the scroll position that puts the thumb at `offset`. */
export function scrollForThumb(offset: number, size: number, track: number, max: number): number {
  const room = track - size;
  if (!(room > 0) || !(max > 0)) return 0;
  return clampScroll((offset / room) * max, max);
}
