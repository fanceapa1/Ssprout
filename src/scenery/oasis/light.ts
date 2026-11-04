/**
 * The oasis's placeholder light art (O1): no trees or shrubs of its own (the painted palms throw
 * none yet), a soft shade at the bluff's foot, and warm light on the ksar at sunrise and sunset.
 * O5 paints the real light plates. docs/systems/daylight.md.
 */
import type { LightArt } from '../../ambience/cast';
import type { DayPhase } from '../../ambience/daylight';
import type { CastShadow } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import type { SceneGeometry } from '../../scene/geometry';
import { OASIS_SKY_LAYOUT } from './layout';

/** The bluff's foot along the high terrace and the basin's far rim: deeper when the sun is low. */
function bluffShadow(p: Painter, rng: Rng, _scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const low = Math.abs(sh.dx) > 0.6;
  p.glaze({ cx: 440, cy: 470, rx: 480, ry: 26 }, pig, { rng, opacity: sh.alpha * (low ? 0.4 : 0.26), spread: 0.5, deform: 0.35, edge: 0 });
}

/** Warm light on the ksar's towers and the bluff's lit flank when the sun is low (feathered dabs, as the waterfall's). */
function ksarLight(p: Painter, rng: Rng, _scene: SceneGeometry, phase: DayPhase): void {
  if (phase !== 'sunrise' && phase !== 'sunset') return;
  const a = phase === 'sunset' ? 0.4 : 0.3;
  const ctx = p.ctx;
  for (const [x, y, rx, ry] of [
    [664, 220, 70, 80],
    [850, 240, 50, 70],
    [980, 400, 50, 90],
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

export const OASIS_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: OASIS_SKY_LAYOUT, shadows: bluffShadow, lights: ksarLight };
