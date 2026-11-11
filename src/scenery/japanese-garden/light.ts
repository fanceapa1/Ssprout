/**
 * The engawa's own marks on the Japanese garden's light plates: its shadow and the lamp-lit
 * shoji. Painters only (ADR 0341); the light's data is `GARDEN_LIGHT_ART` in `art.ts`.
 */
import type { LightPainters } from '../../ambience/cast';
import type { CastShadow } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { pavilionOf, type SceneGeometry } from '../../scene/geometry';
import { pavilionFrame } from '../../scene/paint-pavilion';

/** The engawa: a long shadow onto the bank toward the pond at sunrise, a pool under the deck at midday. */
function engawaShadow(p: Painter, rng: Rng, scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const pv = pavilionOf(scene);
  if (!pv) return;
  const f = pavilionFrame(pv);
  const deckFoot = pv.y + pv.h;
  if (sh.dx < -0.4) {
    const reach = Math.min(300, 160 * Math.abs(sh.dx));
    p.glaze(
      [
        { x: f.x0 + 10, y: deckFoot - 6 },
        { x: f.x0 - reach, y: deckFoot + 2 },
        { x: f.x0 - reach * 0.8, y: deckFoot + 34 },
        { x: f.right, y: deckFoot + 40 },
        { x: f.right, y: deckFoot + 4 },
      ],
      pig,
      { rng, opacity: sh.alpha * 0.5, deform: 0.2, fade: { angle: Math.PI, start: 0.5, amount: 0.9, ragged: 0.5 } },
    );
  } else {
    p.glaze({ cx: (f.x0 + f.right) / 2 + 20, cy: deckFoot + 12, rx: (f.right - f.x0) / 2 + 10, ry: 18 }, pig, { rng, opacity: sh.alpha * 0.4, deform: 0.2 });
  }
}

/** Lamp light in the shoji panel and spilling onto the deck (night; begins at sunset). */
function shojiLight(p: Painter, rng: Rng, scene: SceneGeometry, phase: string): void {
  if (phase !== 'night' && phase !== 'sunset') return;
  const pv = pavilionOf(scene);
  if (!pv) return;
  const k = phase === 'night' ? 1 : 0.45;
  const f = pavilionFrame(pv);
  const sx = f.inner.x + 30;
  const sy = f.deckY - 210;
  const glow = '#ffe6b0';
  p.lift([{ x: sx - 2, y: sy - 2 }, { x: sx + 64, y: sy - 6 }, { x: sx + 64, y: sy + 106 }, { x: sx - 2, y: sy + 110 }], { rng, amount: 0.85 * k, paper: glow, deform: 0.04, layers: 6, sharpness: 0.5 });
  p.lift({ cx: sx + 30, cy: sy + 54, rx: 70, ry: 90 }, { rng, amount: 0.3 * k, paper: '#ffe2b8', deform: 0.3, layers: 6, sharpness: 0.1 });
  // a warm patch on the deck boards in front of the panel
  p.lift({ cx: sx + 24, cy: f.deckY + 12, rx: 60, ry: 10 }, { rng, amount: 0.35 * k, paper: glow, deform: 0.3, layers: 5 });
}

/** The engawa's marks alone (they paint nothing in a scene without one). */
export const ENGAWA_LIGHT: LightPainters = { shadows: engawaShadow, lights: shojiLight };
