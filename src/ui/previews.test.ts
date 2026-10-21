import { describe, expect, it } from 'vitest';
import { fitSprite, pressPixels } from './previews';

describe('previews', () => {
  it('fits tall sprites by height and wide sprites by width, base near the bottom', () => {
    const tall = fitSprite({ size: { w: 40, h: 100 }, anchor: { x: 0.5, y: 0.95 } }, 200, 200);
    expect(tall.sh).toBe(180);
    expect(tall.sw).toBe(72);
    expect(tall.x + tall.sw * 0.5).toBeCloseTo(100, 0);
    expect(tall.y + tall.sh * 0.95).toBeCloseTo(190, 0);
    const wide = fitSprite({ size: { w: 300, h: 100 }, anchor: { x: 0.5, y: 1 } }, 200, 200);
    expect(wide.sw).toBe(184);
    expect(wide.sh).toBe(61);
  });

  it('presses colour towards a faded sepia of the same lightness', () => {
    const px = new Uint8ClampedArray([200, 60, 120, 255, 255, 255, 255, 0]);
    pressPixels(px);
    // less saturated: channels closer together than before
    expect(Math.max(px[0]!, px[1]!, px[2]!) - Math.min(px[0]!, px[1]!, px[2]!)).toBeLessThan(140 * 0.7);
    expect(px[3]).toBeLessThan(255);
    expect(px[7]).toBe(0); // transparent stays transparent
  });
});
