import { describe, expect, it } from 'vitest';
import { CARD_FONTS, CARD_INK, CARD_W, cardTextWidth, fitStateLine, LAYOUT } from './card-art';

/**
 * The floating card's type (v2 polish, the font pass of ADR 0136 brought to the card): bigger,
 * solid ink that reads at ≥ 4.5:1 on the card's paper, and a layout that still fits the
 * 260 × 340 PiP window.
 */
const PAPER = '#f3ecd9';
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const px = (font: string) => Number(/([\d.]+)px/.exec(font)![1]);

describe('card type', () => {
  it.each(Object.entries(CARD_INK))('%s ink reads at ≥ 4.5:1 on the card paper', (_, ink) => {
    expect(contrast(ink, PAPER)).toBeGreaterThanOrEqual(4.5);
  });

  it('is bigger than before the pass (task 15, time 34, state and buttons 13.5 px)', () => {
    expect(px(CARD_FONTS.task)).toBeGreaterThanOrEqual(17);
    expect(px(CARD_FONTS.time)).toBeGreaterThanOrEqual(38);
    expect(px(CARD_FONTS.state)).toBeGreaterThanOrEqual(15);
    expect(px(CARD_FONTS.button)).toBeGreaterThanOrEqual(15);
  });

  it('the lines stack without touching, and the plant keeps most of the card', () => {
    const tx = (font: string) => px(font) * 0.75; // cap height + descender, roughly
    // task above time above progress above state above the buttons
    expect(LAYOUT.taskBaseline - tx(CARD_FONTS.task)).toBeGreaterThan(LAYOUT.timeBaseline);
    expect(LAYOUT.timeBaseline - 6).toBeGreaterThan(LAYOUT.progressY);
    expect(LAYOUT.progressY - 4).toBeGreaterThan(LAYOUT.stateBaseline);
    expect(LAYOUT.stateBaseline - 4).toBeGreaterThan(LAYOUT.buttonsBottom + LAYOUT.buttonH);
    expect(LAYOUT.footer).toBeGreaterThan(LAYOUT.taskBaseline + px(CARD_FONTS.task));
    expect(LAYOUT.footer / 340).toBeLessThan(0.5);
  });

  it('the state line drops the session total when it would not fit, never the state', () => {
    const measure = (s: string) => s.length * 6.4; // ~15 px italic Cormorant
    const short = { state: 'focus 1 of 2', total: '50:00 in all' };
    expect(fitStateLine(short, measure, cardTextWidth(CARD_W))).toBe('focus 1 of 2 · 50:00 in all');
    const long = { state: 'Break — your Japanese Iris is thirsty', total: '33:00 in all' };
    expect(fitStateLine(long, measure, cardTextWidth(CARD_W))).toBe('Break — your Japanese Iris is thirsty');
    expect(fitStateLine({ state: 'paused', total: '' }, measure, 10)).toBe('paused');
  });
});
