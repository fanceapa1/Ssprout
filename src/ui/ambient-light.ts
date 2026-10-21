/**
 * The UI under the garden's light (ADR 0121). The washi slips and the soft paper dabs behind
 * the corner icons and the quiet line are DOM, so the canvas's time-of-day wash never reaches
 * them: at night they glowed like lamps on the indigo painting. The ambience reports its grade;
 * this turns it into two CSS custom properties on the UI root:
 * - `--ui-dab`: the paper colour under the current wash (r, g, b) — dabs blend into the painting;
 * - `--ui-dim`: a brightness for the slips, so paper reads as paper in the dusk, not as a light.
 */
import type { Grade } from '../ambience/timeofday';

const WASHI = { r: 243, g: 236, b: 217 };

export interface UiLight {
  dab: { r: number; g: number; b: number };
  dim: number;
}

/** Paper multiplied by the wash near the top of the frame (where the menu and the line sit). */
export function uiLight(g: Pick<Grade, 'tint' | 'amount' | 'sky'>): UiLight {
  // a little lighter than the wash itself: a lifted patch of paper behind the ink, not a lamp
  const a = 0.72 * Math.min(0.85, Math.max(0, g.amount + Math.max(0, g.sky) * 0.6));
  const f = (c: number) => 1 - a + (a * c) / 255;
  const fr = f(g.tint[0]);
  const fg = f(g.tint[1]);
  const fb = f(g.tint[2]);
  const lum = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;
  return {
    dab: { r: Math.round(WASHI.r * fr), g: Math.round(WASHI.g * fg), b: Math.round(WASHI.b * fb) },
    // slips dim less than the painting (they are the thing being read), never below 0.8
    dim: Math.round(Math.max(0.8, Math.min(1, 0.45 + 0.55 * lum)) * 1000) / 1000,
  };
}

export function applyUiLight(root: HTMLElement, g: Pick<Grade, 'tint' | 'amount' | 'sky'>): void {
  const { dab, dim } = uiLight(g);
  root.style.setProperty('--ui-dab', `${dab.r}, ${dab.g}, ${dab.b}`);
  root.style.setProperty('--ui-dim', String(dim));
}
