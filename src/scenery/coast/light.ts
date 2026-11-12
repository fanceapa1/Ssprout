/**
 * The coast's placeholder light marks (G1): a shade under the promontory's sea foot and the walls'
 * feet, and warm light on the temple and the promontory's face at sunrise and sunset. The daylight
 * task paints the real light plates. docs/systems/daylight.md.
 */
import type { LightPainters } from '../../ambience/cast';
import type { DayPhase } from '../../ambience/daylight';
import type { CastShadow } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import type { SceneGeometry } from '../../scene/geometry';
import { STYLOBATE, WALLS } from './layout';

/** The promontory's foot over the sea and each wall's foot: deeper when the sun is low. */
function coastShadows(p: Painter, rng: Rng, _scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const low = Math.abs(sh.dx) > 0.6;
  p.glaze({ cx: 1180, cy: 500, rx: 460, ry: 18 }, pig, { rng, opacity: sh.alpha * (low ? 0.36 : 0.22), spread: 0.5, deform: 0.35, edge: 0 });
  for (const w of WALLS) {
    const a = w.edge[0]!;
    const b = w.edge[w.edge.length - 1]!;
    p.glaze({ cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 + w.h + 8, rx: (b.x - a.x) / 2, ry: 9 }, pig, { rng, opacity: sh.alpha * 0.22, spread: 0.4, deform: 0.3, edge: 0 });
  }
}

/** Warm light on the temple's columns and the promontory's sea face when the sun is low. */
function coastLights(p: Painter, rng: Rng, _scene: SceneGeometry, phase: DayPhase): void {
  if (phase !== 'sunrise' && phase !== 'sunset') return;
  const a = phase === 'sunset' ? 0.4 : 0.3;
  const ctx = p.ctx;
  for (const [x, y, rx, ry] of [
    [(STYLOBATE.x0 + STYLOBATE.x1) / 2, STYLOBATE.y - 50, 90, 60],
    [760, 450, 120, 40],
  ] as const) {
    ctx.save();
    ctx.translate(x + rng.range(-4, 4), y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,228,186,${a})`);
    g.addColorStop(1, 'rgba(255,228,186,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
}

export const COAST_LIGHT: LightPainters = { shadows: coastShadows, lights: coastLights };
