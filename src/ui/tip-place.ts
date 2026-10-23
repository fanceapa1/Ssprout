/**
 * Where a tip's note goes around its control (ADR 0181), as pure geometry in client (viewport)
 * pixels. No DOM, unit-tested in tip-place.test.ts.
 *
 * A note is only placed when its control is wholly on screen and the note fits inside the
 * viewport on one of the tip's preferred sides; otherwise `placeTip` returns null and the tip waits
 * (it never falls back to a spot off screen or over unrelated content).
 */

export type Side = 'above' | 'below' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TipSpot extends Box {
  side: Side;
  /** the leader line, from the note's facing edge to just short of the control */
  leader: { x1: number; y1: number; x2: number; y2: number };
}

export const TIP_GAP = 22;
export const TIP_MARGIN = 12;

export const intersects = (a: Box, b: Box): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** The control is wholly inside the viewport (a little slack for hairline overflow). */
export function anchorOnScreen(a: Box, vw: number, vh: number): boolean {
  return a.top >= -1 && a.left >= -1 && a.bottom <= vh + 1 && a.right <= vw + 1 && a.right > a.left && a.bottom > a.top;
}

/**
 * The first preferred side where the note fits on screen and clears `avoid` (other slips, the
 * dock's headings); else null — a note never covers other UI, it waits for room.
 * `container` is the control's slip (the note keeps clear of the whole slip, not only the button).
 */
export function placeTip(
  sides: readonly Side[],
  a: Box,
  container: Box,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  avoid: readonly Box[] = [],
): TipSpot | null {
  const { w, h } = size;
  const vw = viewport.w;
  const vh = viewport.h;
  if (!anchorOnScreen(a, vw, vh)) return null;
  const cx = (a.left + a.right) / 2;
  const cy = (a.top + a.bottom) / 2;
  const clampX = (x: number) => Math.min(vw - TIP_MARGIN - w, Math.max(TIP_MARGIN, x));
  const clampY = (y: number) => Math.min(vh - TIP_MARGIN - h, Math.max(TIP_MARGIN, y));
  const candidate = (side: Side): Box & { side: Side } => {
    let x = 0;
    let y = 0;
    if (side === 'above') {
      x = clampX(cx - w * 0.7);
      y = Math.min(a.top, container.top) - TIP_GAP - h;
    } else if (side === 'below') {
      x = clampX(cx - w * 0.75);
      y = Math.max(a.bottom, container.bottom) + TIP_GAP;
    } else if (side === 'left') {
      x = Math.min(a.left, container.left) - TIP_GAP * 1.5 - w;
      y = clampY(cy - h / 2);
    } else {
      x = Math.max(a.right, container.right) + TIP_GAP * 1.5;
      y = clampY(cy - h / 2);
    }
    return { side, left: x, top: y, right: x + w, bottom: y + h };
  };
  const fits = (b: Box) =>
    b.left >= TIP_MARGIN - 0.5 && b.top >= TIP_MARGIN - 0.5 && b.right <= vw - TIP_MARGIN + 0.5 && b.bottom <= vh - TIP_MARGIN + 0.5;
  const options = sides.map(candidate);
  const pick = options.find((o) => fits(o) && !avoid.some((r) => intersects(o, r)));
  if (!pick) return null;

  // the line stops at the control's slip edge, never crossing the slip's text
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  if (pick.side === 'above' || pick.side === 'below') {
    x1 = Math.min(Math.max(cx, pick.left + 16), pick.right - 16);
    y1 = pick.side === 'above' ? pick.bottom + 2 : pick.top - 2;
    x2 = cx;
    y2 = pick.side === 'above' ? Math.min(a.top, container.top) - 4 : Math.max(a.bottom, container.bottom) + 4;
  } else {
    x1 = pick.side === 'left' ? pick.right + 2 : pick.left - 2;
    y1 = Math.min(Math.max(cy, pick.top + 10), pick.bottom - 10);
    x2 = pick.side === 'left' ? Math.min(a.left, container.left) - 5 : Math.max(a.right, container.right) + 5;
    y2 = cy;
  }
  return { ...pick, leader: { x1, y1, x2, y2 } };
}
