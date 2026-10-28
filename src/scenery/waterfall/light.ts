/**
 * The waterfall's light art (ADR 0247): no trees or shrubs of its own, the cliff and the
 * buttress's shadows, warm light on the sun-facing rock at sunrise and sunset, and moonlight on
 * the falls and their spray at night (no lantern). docs/systems/daylight.md › Waterfall.
 */
import type { LightArt } from '../../ambience/cast';
import type { DayPhase } from '../../ambience/daylight';
import type { CastShadow } from '../../ambience/sky-layout';
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import type { SceneGeometry } from '../../scene/geometry';
import { FALLS } from './geometry';
import { LEDGES, skylineAt, WATERFALL_SKY_LAYOUT } from './layout';

/**
 * Shadows. Both low suns stand right of the buttress here, so the long shadows always fall left,
 * whatever the global `dx` sign says; midday leaves short pools under the ledges and the overhang.
 */
function rockShadows(p: Painter, rng: Rng, _scene: SceneGeometry, sh: CastShadow, pig: string): void {
  const low = Math.abs(sh.dx) > 0.6;
  const a = sh.alpha;
  const soft = { rng, spread: 0.5, deform: 0.35, edge: 0, edgeWidth: 0 };
  for (const l of LEDGES) {
    const [l0, l1] = l.edge;
    p.glaze({ cx: (l0.x + l1.x) / 2, cy: (l0.y + l1.y) / 2 + 12, rx: (l1.x - l0.x) * 0.48, ry: 9 }, pig, { ...soft, opacity: a * 0.32 });
  }
  // the cliff's foot: shade along the pool's back edge
  p.glaze({ cx: 720, cy: 616, rx: 290, ry: 20 }, pig, { ...soft, opacity: a * (low ? 0.42 : 0.3) });
  if (!low) return;
  // the buttress shades the notch and the falls' right half, fading to the left
  p.glaze(
    [
      { x: 712, y: 250 },
      { x: 640, y: 300 },
      { x: 596, y: 420 },
      { x: 600, y: 596 },
      { x: 704, y: 600 },
      { x: 720, y: 420 },
    ],
    pig,
    { ...soft, opacity: a * 0.34, fade: { angle: Math.PI, start: 0.3, amount: 0.9, ragged: 0.6 } },
  );
  // the left cliff is turned away from both low suns: a soft shade, fading toward the falls
  p.glaze([{ x: -80, y: 300 }, { x: 470, y: 320 }, { x: 480, y: 630 }, { x: -80, y: 640 }], pig, {
    ...soft,
    opacity: a * 0.26,
    fade: { angle: 0, start: 0.45, amount: 0.9, ragged: 0.6 },
  });
}

/** A feathered dab of warm or cool paper (a lifted wash at plate resolution leaves a pooled ring). */
function dab(p: Painter, x: number, y: number, rx: number, ry: number, a: number, rgb: readonly number[]): void {
  const ctx = p.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.55, `rgba(${c},${a * 0.6})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Warm light on the rock facing the low sun; moonlight on the falls and their spray at night. */
function rockLights(p: Painter, rng: Rng, _scene: SceneGeometry, phase: DayPhase): void {
  if (phase === 'sunrise' || phase === 'sunset') {
    const k = phase === 'sunset' ? 0.5 : 0.4;
    const warm = phase === 'sunset' ? [255, 228, 186] : [255, 236, 220];
    const sunX = phase === 'sunset' ? WATERFALL_SKY_LAYOUT.sunsetX : WATERFALL_SKY_LAYOUT.sunriseX;
    // the buttress's crown and right flank, turned to the sun, then the crown woods' top edge
    for (let x = 720; x <= 1000; x += 28) dab(p, x + rng.range(-6, 6), skylineAt(x) + 22, 46, 26, k * (0.55 + (x - 720) / 600), warm);
    for (let x = -40; x <= 520; x += 36) dab(p, x + rng.range(-6, 6), skylineAt(x) + 12, 50, 18, k * 0.6 * (0.4 + x / 900), warm);
    // the ledges' lit tops, strongest on the sun's side
    for (const l of LEDGES) {
      const [l0, l1] = l.edge;
      dab(p, (l0.x + l1.x) / 2 + 20, (l0.y + l1.y) / 2 - 2, (l1.x - l0.x) * 0.45, 7, k * (l1.x > 650 ? 0.9 : 0.5), warm);
    }
    // the far ridge under the sun
    dab(p, sunX, skylineAt(sunX) + 28, 240, 44, k * 0.7, warm);
    return;
  }
  if (phase !== 'night') return;
  // pale moonlight on the falling sheet, brightest down its middle, then the spray at its foot
  const cool = [238, 243, 255];
  for (let y = 310; y <= 590; y += 28) {
    const t = (y - 296) / 310;
    dab(p, 612 + t * 2, y, 40 + t * 22, 30, 0.5, cool);
  }
  dab(p, FALLS.foot.x, FALLS.foot.y - 4, 130, 34, 0.55, cool);
  dab(p, FALLS.foot.x + 40, FALLS.foot.y + 40, 220, 24, 0.3, cool);
}

export const WATERFALL_LIGHT_ART: LightArt = { trees: [], shrubs: [], sky: WATERFALL_SKY_LAYOUT, shadows: rockShadows, lights: rockLights };
