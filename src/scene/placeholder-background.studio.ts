import { WORLD_H, WORLD_W } from '../render/viewport';
import type { StudioSection } from '../studio/types';
import { placeholderScene } from './geometry';
import { paintPlaceholderBackground } from './placeholder-background';

const section: StudioSection = {
  id: 'scene-placeholder',
  title: 'Scene · placeholder background',
  order: 100,
  entries: [
    {
      id: 'background',
      label: 'background layer (world 1600×1000)',
      w: WORLD_W / 2,
      h: WORLD_H / 2,
      render(canvas) {
        const ctx = canvas.getContext('2d')!;
        const k = canvas.width / WORLD_W;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        paintPlaceholderBackground(ctx, placeholderScene);
      },
    },
    {
      id: 'slots',
      label: 'slots by habitat',
      w: WORLD_W / 2,
      h: WORLD_H / 2,
      render(canvas) {
        const ctx = canvas.getContext('2d')!;
        const k = canvas.width / WORLD_W;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        paintPlaceholderBackground(ctx, placeholderScene);
        const colours: Record<string, string> = {
          water: '#6f9690',
          shore: '#7b6ba8',
          meadow: '#8d9a6c',
          path: '#a39a8b',
          back: '#4a443c',
          rock: '#d0694a',
        };
        ctx.font = '22px serif';
        for (const s of placeholderScene.slots) {
          ctx.fillStyle = colours[s.habitat] ?? '#000';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 10 * s.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(s.id, s.x + 14, s.y + 6);
        }
      },
    },
  ],
};

export default section;
