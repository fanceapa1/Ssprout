/**
 * A study plan drawn as a segmented brush line: focus blocks are ink strokes, breaks are small
 * gaps holding a water drop. Geometry is pure (unit-tested); `renderPlanLine` fills an <svg>.
 */
export interface PlanBlockLike {
  kind: 'focus' | 'break';
  minutes: number;
}

export interface PlanSegment {
  index: number;
  kind: 'focus' | 'break';
  x0: number;
  x1: number;
  /** cumulative minutes at the segment start / end */
  m0: number;
  m1: number;
}

/** Lay blocks out along `width`: proportional to minutes, breaks at least `minBreak` wide. */
export function planSegments(blocks: readonly PlanBlockLike[], width: number, minBreak = 14): PlanSegment[] {
  const total = blocks.reduce((s, b) => s + b.minutes, 0);
  if (total <= 0 || blocks.length === 0) return [];
  const raw = blocks.map((b) => (b.minutes / total) * width);
  const breakW = blocks.map((b, i) => (b.kind === 'break' ? Math.max(minBreak, raw[i]!) : 0));
  const breaksTotal = breakW.reduce((s, w) => s + w, 0);
  const focusMinutes = blocks.reduce((s, b) => s + (b.kind === 'focus' ? b.minutes : 0), 0);
  const focusWidth = Math.max(0, width - breaksTotal);
  const out: PlanSegment[] = [];
  let x = 0;
  let m = 0;
  blocks.forEach((b, index) => {
    const w = b.kind === 'break' ? breakW[index]! : focusMinutes > 0 ? (b.minutes / focusMinutes) * focusWidth : 0;
    out.push({ index, kind: b.kind, x0: x, x1: x + w, m0: m, m1: m + b.minutes });
    x += w;
    m += b.minutes;
  });
  return out;
}

/** x position for `minutes` elapsed along the plan (piecewise linear through the segments). */
export function xAtMinutes(segs: readonly PlanSegment[], minutes: number): number {
  if (segs.length === 0) return 0;
  if (minutes <= 0) return segs[0]!.x0;
  for (const s of segs) {
    if (minutes <= s.m1) return s.m1 === s.m0 ? s.x1 : s.x0 + ((minutes - s.m0) / (s.m1 - s.m0)) * (s.x1 - s.x0);
  }
  return segs[segs.length - 1]!.x1;
}

/** "50 min, unbroken" · "3 × 25 min · 5-min breaks" · "65 · break 20 · 65" */
export function planSummary(blocks: readonly PlanBlockLike[]): string {
  const focus = blocks.filter((b) => b.kind === 'focus');
  const breaks = blocks.filter((b) => b.kind === 'break');
  if (breaks.length === 0) return `${focus.reduce((s, b) => s + b.minutes, 0)} min, unbroken`;
  const sameFocus = focus.every((b) => b.minutes === focus[0]!.minutes);
  const sameBreak = breaks.every((b) => b.minutes === breaks[0]!.minutes);
  if (sameFocus && sameBreak && focus.length > 2) return `${focus.length} × ${focus[0]!.minutes} min · ${breaks[0]!.minutes}-min breaks`;
  return blocks.map((b) => (b.kind === 'focus' ? String(b.minutes) : `break ${b.minutes}`)).join(' · ');
}

const NS = 'http://www.w3.org/2000/svg';
let clipCounter = 0;

function wobblePath(x0: number, x1: number, y: number, seed: number): string {
  const mid = (x0 + x1) / 2;
  const a = Math.sin(seed * 12.9898) * 0.9;
  const b = Math.cos(seed * 78.233) * 0.8;
  return `M${(x0 + 1.5).toFixed(1)} ${(y + a * 0.4).toFixed(1)}Q${mid.toFixed(1)} ${(y + b).toFixed(1)} ${(x1 - 1.5).toFixed(1)} ${(y - a * 0.3).toFixed(1)}`;
}

const DROP = 'M0 -4.2C1.4 -2 2.4 -0.6 2.4 0.9 2.4 2.4 1.3 3.3 0 3.3 -1.3 3.3 -2.4 2.4 -2.4 0.9 -2.4 -0.6 -1.4 -2 0 -4.2Z';

export interface PlanLineState {
  /** minutes elapsed along the plan (focus + break), for the ink overlay */
  elapsedMinutes?: number;
  /** current block index (highlighted) */
  current?: number;
  /** break indices already watered */
  watered?: readonly number[];
}

/** Fill `svg` (viewBox `0 0 width 14`) with the plan's segments. */
export function renderPlanLine(svg: SVGSVGElement, blocks: readonly PlanBlockLike[], width = 300, state: PlanLineState = {}): void {
  const H = 14;
  const y = 7;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('plan-line');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const segs = planSegments(blocks, width);
  const elapsedX = state.elapsedMinutes === undefined ? null : xAtMinutes(segs, state.elapsedMinutes);
  const clipId = `plan-clip-${++clipCounter}`;
  if (elapsedX !== null) {
    const defs = document.createElementNS(NS, 'defs');
    const clip = document.createElementNS(NS, 'clipPath');
    clip.id = clipId;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('height', String(H));
    rect.setAttribute('width', elapsedX.toFixed(1));
    rect.classList.add('plan-clip-rect');
    clip.appendChild(rect);
    defs.appendChild(clip);
    svg.appendChild(defs);
  }
  for (const s of segs) {
    if (s.kind === 'focus') {
      const d = wobblePath(s.x0, s.x1, y, s.index + 1);
      const track = document.createElementNS(NS, 'path');
      track.setAttribute('d', d);
      track.classList.add('plan-focus');
      if (state.current === s.index) track.classList.add('is-current');
      svg.appendChild(track);
      if (elapsedX !== null) {
        const ink = document.createElementNS(NS, 'path');
        ink.setAttribute('d', d);
        ink.setAttribute('clip-path', `url(#${clipId})`);
        ink.classList.add('plan-ink');
        svg.appendChild(ink);
      }
    } else {
      const drop = document.createElementNS(NS, 'path');
      drop.setAttribute('d', DROP);
      drop.setAttribute('transform', `translate(${((s.x0 + s.x1) / 2).toFixed(1)} ${y + 0.5})`);
      drop.classList.add('plan-drop');
      if (state.current === s.index) drop.classList.add('is-current');
      if (state.watered?.includes(s.index)) drop.classList.add('is-watered');
      svg.appendChild(drop);
    }
  }
}

export function createPlanLineSvg(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}
