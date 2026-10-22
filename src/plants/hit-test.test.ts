import { describe, expect, it } from 'vitest';
import { maskHit, pickPlant, type AlphaMask, type HitCandidate } from './hit-test';

/** A mask with paint in a filled rectangle of cells (x0..x1, y0..y1 inclusive). */
function rectMask(w: number, h: number, x0: number, y0: number, x1: number, y1: number): AlphaMask {
  const data = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data[y * w + x] = 255;
  return { w, h, data };
}

describe('maskHit', () => {
  const m = rectMask(10, 10, 4, 2, 5, 9); // a stem-like column in the middle

  it('hits painted cells and misses transparent air', () => {
    expect(maskHit(m, 0.45, 0.5)).toBe(true);
    expect(maskHit(m, 0.1, 0.5)).toBe(false);
    expect(maskHit(m, 0.45, 0.05)).toBe(false);
  });

  it('a tolerance radius reaches a thin stem nearby', () => {
    expect(maskHit(m, 0.3, 0.5, 0)).toBe(false);
    expect(maskHit(m, 0.3, 0.5, 1.5)).toBe(true);
  });

  it('ignores faint pixels', () => {
    const faint: AlphaMask = { w: 2, h: 2, data: new Uint8Array([5, 5, 5, 5]) };
    expect(maskHit(faint, 0.5, 0.5, 1)).toBe(false);
  });
});

describe('pickPlant', () => {
  const back: HitCandidate = { id: 'back', box: { x: 0, y: 0, w: 120, h: 100 }, depth: 400, mask: rectMask(10, 10, 0, 0, 9, 9) };
  const front: HitCandidate = { id: 'front', box: { x: 50, y: 50, w: 100, h: 100 }, depth: 700, mask: rectMask(10, 10, 0, 0, 4, 9) };

  it('the front-most painted plant wins where two overlap', () => {
    expect(pickPlant([back, front], { x: 60, y: 60 })?.id).toBe('front');
    expect(pickPlant([front, back], { x: 60, y: 60 })?.id).toBe('front');
  });

  it("a transparent part of the front plant's box lets the click through to the plant behind", () => {
    // front's right half is air: (130, 60) is inside its box but not painted; back does not reach there
    expect(pickPlant([back, front], { x: 130, y: 60 })).toBeNull();
    // (106, 60) is in front's air but on back's paint
    expect(pickPlant([back, front], { x: 106, y: 60 })?.id).toBe('back');
  });

  it('misses outside every box, and uses the inner box when no sprite is painted yet', () => {
    expect(pickPlant([back], { x: 300, y: 300 })).toBeNull();
    const bare: HitCandidate = { id: 'bare', box: { x: 0, y: 0, w: 100, h: 100 }, depth: 1, mask: null };
    expect(pickPlant([bare], { x: 50, y: 50 })?.id).toBe('bare');
    expect(pickPlant([bare], { x: 5, y: 50 })).toBeNull();
  });

  it('tolerance is in world units (the caller scales it with the zoom)', () => {
    const stem: HitCandidate = { id: 'stem', box: { x: 0, y: 0, w: 100, h: 100 }, depth: 1, mask: rectMask(10, 10, 5, 0, 5, 9) };
    expect(pickPlant([stem], { x: 40, y: 50 }, 0)).toBeNull();
    expect(pickPlant([stem], { x: 40, y: 50 }, 12)?.id).toBe('stem');
  });
});
