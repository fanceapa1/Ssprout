/**
 * Foreground sprites for the `entities` layer: boulders and grass tufts that plants may stand
 * behind. Each is painted once (per paint scale) onto its own transparent canvas and drawn
 * every frame at its world box, depth-sorted by base y.
 */
import { createRng } from '../core/rng';
import { PIGMENTS, createPainter, makeCanvas, mix, shade, type AnyCanvas, type Quality } from '../paint';
import type { Rect } from '../render/viewport';
import type { Rock } from './geometry';
import type { TuftSpec } from './layout';
import { atmos } from './paint-land';
import { rockOutline } from './paint-pond';

export interface Sprite {
  id: string;
  /** world box the canvas covers */
  box: Rect;
  /** sort key: base y */
  depth: number;
  canvas: AnyCanvas;
}

/** World box a rock sprite needs (stone + cast shadow + base tufts). */
export function rockBox(r: Rock): Rect {
  return { x: r.x - r.w * 0.85, y: r.y - r.h * 1.3, w: r.w * 1.7, h: r.h * 1.62 };
}

export function tuftBox(t: TuftSpec): Rect {
  return { x: t.x - t.h * 1.6, y: t.y - t.h * 1.4, w: t.h * 3.2, h: t.h * 1.6 };
}

function spriteCanvas(box: Rect, scale: number, seed: number | string, quality: Quality) {
  const canvas = makeCanvas(box.w * scale, box.h * scale);
  const p = createPainter(canvas, { seed, quality });
  p.ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  return { canvas, p };
}

/** A boulder (shape shared with its reflection), with moss and sometimes grass at its foot. */
export function paintRockSprite(r: Rock, seed: number, scale: number, quality: Quality = 'normal'): Sprite {
  const box = rockBox(r);
  const { canvas, p } = spriteCanvas(box, scale, `${seed}:${r.id}:paint`, quality);
  const rng = createRng(`${seed}:${r.id}:paint`);
  const far = Math.max(0, Math.min(1, (620 - r.y) / 200));
  // the darkest small accent of the scene: the cool contact shadow where the boulder sits
  p.glaze({ cx: r.x + r.w * 0.04, cy: r.y - r.h * 0.02, rx: r.w * 0.5, ry: r.h * 0.09 }, shade(PIGMENTS.stoneDark, 0.35), { rng, opacity: 0.5, deform: 0.15 });
  p.stone(rockOutline(r, seed), {
    rng,
    pigment: atmos(mix(PIGMENTS.stone, PIGMENTS.stoneDark, rng.range(0, 0.4)), far * 0.25),
    warm: rng.range(0.1, 0.35),
    moss: r.perch ? rng.range(0.15, 0.35) : rng.range(0.3, 0.6),
    granulation: 0.4,
    ink: 0.22 + (1 - far) * 0.15,
    patches: rng.int(2, 3),
  });
  // grass tucked against the foot of most boulders
  const tufts = rng.int(0, 2);
  for (let i = 0; i < tufts; i++) {
    const side = rng.chance(0.5) ? -1 : 1;
    const h = Math.max(12, r.h * rng.range(0.3, 0.45));
    p.grassTuft(
      { x: r.x + side * r.w * rng.range(0.3, 0.48), y: r.y + rng.range(1, 4) },
      { rng, height: h, blades: rng.int(5, 8), opacity: 0.6, pigments: [PIGMENTS.sageLight, PIGMENTS.sap, mix(PIGMENTS.sage, PIGMENTS.sap, 0.4)] },
    );
  }
  return { id: r.id, box, depth: r.y, canvas };
}

/** A foreground grass tuft. */
export function paintTuftSprite(t: TuftSpec, index: number, seed: number, scale: number, quality: Quality = 'normal'): Sprite {
  const box = tuftBox(t);
  const id = `tuft-${index}`;
  const { canvas, p } = spriteCanvas(box, scale, `${seed}:${id}`, quality);
  const rng = createRng(`${seed}:${id}`);
  p.grassTuft(t, {
    rng,
    height: t.h,
    blades: rng.int(8, 12),
    spread: t.h * 0.65,
    opacity: 0.5,
    pigments: [PIGMENTS.sageLight, PIGMENTS.sap, mix(PIGMENTS.sage, PIGMENTS.sap, 0.5), mix(PIGMENTS.sage, PIGMENTS.olive, 0.3)],
  });
  return { id, box, depth: t.y, canvas };
}
