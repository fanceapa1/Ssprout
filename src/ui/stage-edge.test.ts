import { describe, expect, it } from 'vitest';
import { fadeHeight, featherWidth, stageEdgeAlpha } from './stage-edge';

const W = 300;
const H = 200;
const at = (a: Float32Array, x: number, y: number) => a[y * W + x]!;

describe('stage edge mask', () => {
  const alpha = stageEdgeAlpha({ w: W, h: H, cssPerPx: 2, fade: 120, seed: 3 });

  it('keeps the painting whole in the middle and lets it go at the bottom', () => {
    expect(at(alpha, W / 2, H / 3)).toBe(1);
    for (let x = 10; x < W - 10; x += 17) expect(at(alpha, x, H - 1)).toBeLessThan(0.05);
  });

  it('feathers the top and the sides over a few pixels, never a hard edge', () => {
    for (let y = 20; y < H / 2; y += 13) {
      expect(at(alpha, 0, y)).toBeLessThan(0.5);
      expect(at(alpha, W - 1, y)).toBeLessThan(0.5);
      expect(at(alpha, 40, y)).toBe(1);
    }
    for (let x = 20; x < W - 20; x += 23) {
      expect(at(alpha, x, 0)).toBeLessThan(0.5);
      expect(at(alpha, x, 40)).toBe(1);
    }
  });

  it('fades the bottom along a ragged line, not a ruler', () => {
    // the first row (from the top) where each column starts to thin
    const starts: number[] = [];
    for (let x = 12; x < W - 12; x += 3) {
      let y = H / 2;
      while (y < H && at(alpha, x, y) > 0.98) y++;
      starts.push(y);
    }
    const spread = Math.max(...starts) - Math.min(...starts);
    expect(spread).toBeGreaterThan(4);
    // and it falls monotonically on average down a column
    const col = Math.floor(W / 2);
    expect(at(alpha, col, H - 30)).toBeLessThan(at(alpha, col, H - 60) + 0.15);
  });

  it('is deterministic per seed', () => {
    const again = stageEdgeAlpha({ w: W, h: H, cssPerPx: 2, fade: 120, seed: 3 });
    expect(again).toEqual(alpha);
    const other = stageEdgeAlpha({ w: W, h: H, cssPerPx: 2, fade: 120, seed: 4 });
    expect(other).not.toEqual(alpha);
  });

  it('sizes the dissolve to the stage, within calm bounds', () => {
    expect(fadeHeight(300)).toBe(64);
    expect(fadeHeight(800)).toBe(120);
    expect(fadeHeight(3000)).toBe(190);
    expect(featherWidth(390, 740)).toBe(16);
    expect(featherWidth(1412, 792)).toBe(32);
    expect(featherWidth(4000, 3000)).toBe(44);
  });
});
