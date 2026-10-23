import { describe, expect, it } from 'vitest';
import { anchorOnScreen, placeTip, TIP_MARGIN, type Box } from './tip-place';

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });
const VP = { w: 1440, h: 900 };
const NOTE = { w: 220, h: 70 };

describe('tip placement (ADR 0181)', () => {
  it('puts the note on the first preferred side that fits, with a leader to the control', () => {
    const a = box(600, 400, 120, 40);
    const s = placeTip(['below', 'left'], a, a, NOTE, VP)!;
    expect(s.side).toBe('below');
    expect(s.top).toBeGreaterThan(a.bottom);
    expect(s.leader.y1).toBeLessThan(s.top);
    expect(s.leader.y2).toBeGreaterThan(a.bottom);
  });

  it('falls to the next side when the first does not fit on screen', () => {
    const a = box(600, 820, 120, 40); // near the bottom: no room below
    expect(placeTip(['below', 'above'], a, a, NOTE, VP)!.side).toBe('above');
  });

  it('never places a note off screen: no side fits → null (the tip waits)', () => {
    const a = box(10, 820, 120, 40); // bottom-left corner: no room below, none to the left
    expect(placeTip(['below', 'left'], a, a, NOTE, VP)).toBeNull();
  });

  it('waits while the control is not wholly on screen (scrolled half away)', () => {
    expect(placeTip(['below', 'above'], box(600, -20, 120, 40), box(600, -20, 120, 40), NOTE, VP)).toBeNull();
    expect(placeTip(['above', 'below'], box(600, 880, 120, 40), box(600, 880, 120, 40), NOTE, VP)).toBeNull();
    expect(anchorOnScreen(box(600, 0, 120, 40), VP.w, VP.h)).toBe(true);
    expect(anchorOnScreen(box(600, 870, 120, 40), VP.w, VP.h)).toBe(false);
  });

  it('keeps clear of other UI on the painting when another side fits', () => {
    const a = box(600, 400, 120, 40);
    const below = placeTip(['below', 'above'], a, a, NOTE, VP)!;
    const other = placeTip(['below', 'above'], a, a, NOTE, VP, [below])!;
    expect(other.side).toBe('above');
  });

  it('never covers other UI: with every side blocked the tip waits', () => {
    const a = box(600, 400, 120, 40);
    const heading = box(0, 0, 1440, 395); // e.g. the dock's heading right above, and more
    const below = placeTip(['below'], a, a, NOTE, VP)!;
    expect(placeTip(['below', 'above'], a, a, NOTE, VP, [below, heading])).toBeNull();
  });

  it('stays inside the margins horizontally', () => {
    const a = box(1400, 400, 30, 30);
    const s = placeTip(['below'], a, a, NOTE, VP)!;
    expect(s.right).toBeLessThanOrEqual(VP.w - TIP_MARGIN + 0.5);
    expect(s.left).toBeGreaterThanOrEqual(TIP_MARGIN - 0.5);
  });
});
