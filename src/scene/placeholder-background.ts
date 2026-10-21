import type { System } from '../render/types';
import { WORLD_H, WORLD_W } from '../render/viewport';
import type { SceneGeometry } from './geometry';

/**
 * PLACEHOLDER: flat paper, a crude pond and grey stones so something is visible before the
 * painted scene exists. The scene task replaces this system.
 */
export function paintPlaceholderBackground(ctx: CanvasRenderingContext2D, scene: SceneGeometry): void {
  ctx.fillStyle = '#f3ecd9';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = '#c3c79d';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 430, WORLD_W, WORLD_H - 430);
  ctx.globalAlpha = 1;

  const [first, ...rest] = scene.pond;
  if (first) {
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = '#a9c3bb';
    ctx.fill();
  }

  ctx.fillStyle = '#9b978d';
  for (const r of scene.rocks) {
    ctx.beginPath();
    ctx.ellipse(r.x, r.y - r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#a39a8b';
  for (const s of scene.path) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createPlaceholderBackground(): System {
  let scene: SceneGeometry | null = null;
  return {
    id: 'placeholder-background',
    init(ctx) {
      scene = ctx.scene;
    },
    draw(layer, ctx) {
      if (layer === 'background' && scene) paintPlaceholderBackground(ctx, scene);
    },
  };
}
