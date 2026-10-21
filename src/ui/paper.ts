import { createRng, type Rng } from '../core/rng';

/**
 * Washi slips: seeded, slightly deckled paper shapes rendered as SVG background images (ADR 0052).
 * Each variant is a closed path in a 1000×1000 box (stretched to the element with
 * `preserveAspectRatio="none"`), filled with paper and outlined by a thin ink line that breaks
 * in one or two places (lost edges). Installed once as CSS custom properties on :root.
 */

const BOX = 1000;

/** Random-walk offsets along one edge, smoothed so the tear reads as fibres, not zig-zag. */
function edge(rng: Rng, n: number, amp: number): number[] {
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i <= n; i++) {
    v = v * 0.6 + rng.range(-amp, amp);
    out.push(v);
  }
  return out;
}

/** A closed, deckled rectangle path (absolute coords in the 1000 box). */
export function deckledPath(rng: Rng, inset = 7, steps = 48, amp = 3.4): string {
  const lo = inset;
  const hi = BOX - inset;
  const pts: Array<[number, number]> = [];
  const span = hi - lo;
  const top = edge(rng, steps, amp);
  const right = edge(rng, steps, amp);
  const bottom = edge(rng, steps, amp);
  const left = edge(rng, steps, amp);
  for (let i = 0; i < steps; i++) pts.push([lo + (span * i) / steps, lo + top[i]!]);
  for (let i = 0; i < steps; i++) pts.push([hi + right[i]!, lo + (span * i) / steps]);
  for (let i = 0; i < steps; i++) pts.push([hi - (span * i) / steps, hi + bottom[i]!]);
  for (let i = 0; i < steps; i++) pts.push([lo + left[i]!, hi - (span * i) / steps]);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

export interface SlipStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  /** stroke width in CSS px (non-scaling) */
  strokeWidth?: number;
  /** whether the ink outline breaks (lost edges) */
  broken?: boolean;
}

export function slipSvg(seed: number | string, style: SlipStyle): string {
  const rng = createRng(seed);
  const d = deckledPath(rng);
  // two or three gaps in the outline, at seeded places (pathLength normalises the dash units)
  const a = rng.int(900, 1500);
  const b = rng.int(15, 40);
  const c = rng.int(1100, 1700);
  const e = rng.int(10, 30);
  const dash = style.broken === false ? '' : ` stroke-dasharray="${a} ${b} ${c} ${e} ${4000 - a - b - c - e} 0"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" preserveAspectRatio="none">` +
    `<path d="${d}" fill="${style.fill}" fill-opacity="${style.fillOpacity}" stroke="${style.stroke}" ` +
    `stroke-opacity="${style.strokeOpacity}" stroke-width="${style.strokeWidth ?? 1}" vector-effect="non-scaling-stroke" pathLength="4000"${dash}/>` +
    `</svg>`
  );
}

export const svgUrl = (svg: string): string => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Paper-fibre grain tile (PNG data URL) drawn with seeded noise; null without a canvas. */
export function grainDataUrl(seed: number | string, size = 160): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const rng = createRng(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng.next();
    img.data[i] = 74;
    img.data[i + 1] = 68;
    img.data[i + 2] = 60;
    img.data[i + 3] = v > 0.985 ? 38 : v > 0.9 ? 14 : 4;
  }
  ctx.putImageData(img, 0, 0);
  // a few long fibres
  ctx.strokeStyle = 'rgba(74,68,60,0.07)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const a = rng.range(0, Math.PI);
    const l = rng.range(6, 18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rng.range(-2, 2), y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const PAPER = '#f3ecd9';
const INK = '#4a443c';
const VERMILION = '#c4553a';

/** Install the slip variants (`--slip-0…3`, `--slip-dense-0…1`, `--seal-0…1`, `--grain`) on :root. */
export function installPaper(doc: Document = document): void {
  if (doc.getElementById('ui-paper')) return;
  const vars: string[] = [];
  for (let i = 0; i < 4; i++) {
    vars.push(`--slip-${i}: ${svgUrl(slipSvg(`slip-${i}`, { fill: PAPER, fillOpacity: 0.86, stroke: INK, strokeOpacity: 0.32 }))};`);
  }
  for (let i = 0; i < 2; i++) {
    vars.push(`--slip-dense-${i}: ${svgUrl(slipSvg(`dense-${i}`, { fill: PAPER, fillOpacity: 0.96, stroke: INK, strokeOpacity: 0.3 }))};`);
    vars.push(`--seal-${i}: ${svgUrl(slipSvg(`seal-${i}`, { fill: VERMILION, fillOpacity: 0.94, stroke: '#8f3524', strokeOpacity: 0.45, broken: false }))};`);
  }
  vars.push(`--slip-faint: ${svgUrl(slipSvg('faint', { fill: PAPER, fillOpacity: 0.9, stroke: INK, strokeOpacity: 0.2 }))};`);
  const grain = grainDataUrl('washi');
  vars.push(`--grain: ${grain ? `url("${grain}")` : 'none'};`);
  const style = doc.createElement('style');
  style.id = 'ui-paper';
  style.textContent = `:root{${vars.join('')}}`;
  doc.head.appendChild(style);
}
