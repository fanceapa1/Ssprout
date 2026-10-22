import { createRng } from '../core/rng';

/**
 * A vertical sumi brush stroke as a closed SVG path, in pixels: it lands with a small pooled
 * head, thins and wobbles a little along its length, and lifts off in a dry tail. Used for the
 * custom scrollbar's thumb (regenerated when its length changes) and the faint track.
 * Deterministic per seed, so screenshots are stable.
 */
export interface BrushOptions {
  /** stroke length (px) */
  length: number;
  /** widest point (px) */
  width: number;
  /** sideways wobble as a share of the width (default 0.18) */
  wobble?: number;
  /** points per side (default 18) */
  steps?: number;
}

export function brushStrokePath(seed: number | string, o: BrushOptions): string {
  const rng = createRng(seed);
  const n = Math.max(6, o.steps ?? 18);
  const L = Math.max(1, o.length);
  const W = Math.max(0.5, o.width);
  const wob = (o.wobble ?? 0.18) * W;
  const cx = W / 2 + 1;
  // a gently drifting centre line and a pressure profile: press, carry, lift
  const drift: number[] = [];
  let d = 0;
  for (let i = 0; i <= n; i++) {
    d = d * 0.7 + rng.range(-1, 1) * wob * 0.5;
    drift.push(d);
  }
  const pressure = (u: number) => {
    const head = Math.min(1, u / 0.08); // the brush lands
    const tail = Math.min(1, (1 - u) / 0.22); // and lifts slowly
    return (0.35 + 0.65 * Math.sqrt(head)) * (0.25 + 0.75 * Math.sqrt(Math.max(0, tail))) * (1 + 0.12 * Math.sin(u * 7.3 + rng.next()));
  };
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const y = u * L;
    const half = (W / 2) * pressure(u) * (1 + rng.range(-0.06, 0.06));
    const x = cx + drift[i]!;
    left.push(`${(x - half).toFixed(2)} ${y.toFixed(2)}`);
    right.push(`${(x + half * 0.92).toFixed(2)} ${y.toFixed(2)}`);
  }
  right.reverse();
  return `M${left.join('L')}L${right.join('L')}Z`;
}
