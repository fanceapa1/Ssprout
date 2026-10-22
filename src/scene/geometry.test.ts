import { describe, expect, it } from 'vitest';
import { area, pointInPolygon } from '../paint/geometry';
import { HABITATS, SIZE_CLASSES } from '../plants/types';
import { WORLD_H, WORLD_W, type Pt } from '../render/viewport';
import { gardenScene, PATH, PAVILION, POND, ROCKS, type Slot } from './geometry';
import { FOREGROUND_TUFTS, TREES } from './layout';
import { FAR_SCALE, GARDEN_PLANT_SCALE, NEAR_SCALE, PLANT_SIZES, perspectiveScale, plantScale } from './slots';

const { slots } = gardenScene;
const byHabitat = (h: string) => slots.filter((s) => s.habitat === h);

/** Distance from a point to the closest edge of a closed polygon. */
function edgeDistance(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

describe('scene geometry', () => {
  it('has 50–60 slots with unique ids', () => {
    expect(slots.length).toBeGreaterThanOrEqual(50);
    expect(slots.length).toBeLessThanOrEqual(60);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });

  it.each([
    ['water', 6, 8],
    ['shore', 8, 10],
    ['meadow', 12, 16],
    ['path', 6, 8],
    ['back', 6, 8],
    ['rock', 5, 6],
  ])('has %s slots in the planned range', (habitat, min, max) => {
    const n = byHabitat(habitat).length;
    expect(n).toBeGreaterThanOrEqual(min);
    expect(n).toBeLessThanOrEqual(max);
  });

  it('uses only known habitats and size classes', () => {
    for (const s of slots) {
      expect(HABITATS).toContain(s.habitat);
      expect(SIZE_CLASSES).toContain(s.maxSize);
    }
  });

  it('keeps every slot (and the box of its largest plant) inside the world', () => {
    for (const s of slots) {
      const size = PLANT_SIZES[s.maxSize];
      expect(s.x, s.id).toBeGreaterThanOrEqual(0);
      expect(s.x, s.id).toBeLessThanOrEqual(WORLD_W);
      expect(s.y, s.id).toBeLessThanOrEqual(WORLD_H);
      expect(s.y - size.h * s.scale, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts every water slot on the pond, clear of the edge', () => {
    for (const s of byHabitat('water')) {
      expect(pointInPolygon(s, POND), s.id).toBe(true);
      expect(edgeDistance(s, POND), s.id).toBeGreaterThanOrEqual(30);
    }
  });

  it('puts shore slots at the pond edge (within 45 units of it)', () => {
    for (const s of byHabitat('shore')) expect(edgeDistance(s, POND), s.id).toBeLessThanOrEqual(45);
  });

  it('keeps land slots off the water', () => {
    for (const s of slots.filter((q) => q.habitat !== 'water' && q.habitat !== 'shore')) {
      expect(pointInPolygon(s, POND), s.id).toBe(false);
    }
  });

  it('scales slots with perspective: far ~0.55 … near ~1.15, increasing with y', () => {
    for (const s of slots) {
      expect(s.scale).toBe(perspectiveScale(s.y));
      expect(s.scale).toBeGreaterThanOrEqual(FAR_SCALE);
      expect(s.scale).toBeLessThanOrEqual(NEAR_SCALE);
    }
    expect(perspectiveScale(400)).toBeCloseTo(0.55);
    expect(perspectiveScale(960)).toBeCloseTo(1.15);
    expect(perspectiveScale(700)).toBeGreaterThan(perspectiveScale(500));
  });

  it('only offers tree-sized slots on the far bank, spaced so full-size trees do not collide', () => {
    const trees = slots.filter((s) => s.maxSize === 'tree');
    expect(trees.length).toBeGreaterThanOrEqual(2);
    for (const t of trees) expect(t.habitat).toBe('back');
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const a = trees[i]!;
        const b = trees[j]!;
        const halfWidths = (PLANT_SIZES.tree.w * (plantScale(a) + plantScale(b))) / 2;
        // crowns may touch a little (×0.6) but trunks and most of the canopy stay apart
        expect(Math.abs(a.x - b.x), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(halfWidths * 0.6);
      }
    }
  });

  it('keeps slots apart from each other', () => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(28);
      }
    }
  });

  it('puts path slots beside the stepping stones, not on them', () => {
    for (const s of byHabitat('path')) {
      const near = Math.min(...PATH.map((st) => Math.hypot(s.x - st.x, s.y - st.y)));
      expect(near, s.id).toBeLessThanOrEqual(130);
      for (const st of PATH) expect(((s.x - st.x) / st.rx) ** 2 + ((s.y - st.y) / st.ry) ** 2, s.id).toBeGreaterThan(1.4);
    }
  });

  it('never plants on a stepping stone or inside a boulder', () => {
    for (const s of slots) {
      // a stone plus a margin (a plant's own width at the base): the plant stands beside it
      for (const st of PATH) {
        const d = ((s.x - st.x) / (st.rx + 24)) ** 2 + ((s.y - st.y) / (st.ry + 10)) ** 2;
        expect(d, `${s.id} on the stone at ${st.x},${st.y}`).toBeGreaterThan(1);
      }
      // a boulder's footprint: the lower body of the stone sprite
      for (const r of ROCKS) {
        const d = ((s.x - r.x) / (r.w * 0.45)) ** 2 + ((s.y - (r.y - r.h * 0.3)) / (r.h * 0.4)) ** 2;
        expect(d, `${s.id} inside ${r.id}`).toBeGreaterThan(1);
      }
    }
  });

  it('puts rock slots at the foot of a boulder', () => {
    for (const s of byHabitat('rock')) {
      const near = Math.min(...ROCKS.map((r) => Math.hypot(s.x - r.x, s.y - r.y) - r.w / 2));
      expect(near, s.id).toBeLessThanOrEqual(40);
    }
  });

  it('has a simple, clockwise-agnostic pond polygon around the focus area', () => {
    expect(Math.abs(area(POND))).toBeGreaterThan(100_000);
    for (let i = 0; i < POND.length; i++) {
      for (let j = i + 2; j < POND.length; j++) {
        if (i === 0 && j === POND.length - 1) continue;
        const crosses = segmentsCross(POND[i]!, POND[(i + 1) % POND.length]!, POND[j]!, POND[(j + 1) % POND.length]!);
        expect(crosses, `edges ${i} and ${j}`).toBe(false);
      }
    }
    expect(pointInPolygon({ x: 800, y: 560 }, POND)).toBe(true);
  });

  it('rings the pond with 8–12 boulders, some of them perches, with unique ids', () => {
    expect(ROCKS.length).toBeGreaterThanOrEqual(8);
    expect(ROCKS.length).toBeLessThanOrEqual(12);
    expect(ROCKS.some((r) => r.perch)).toBe(true);
    expect(new Set(ROCKS.map((r) => r.id)).size).toBe(ROCKS.length);
    for (const r of ROCKS) expect(edgeDistance(r, POND), r.id).toBeLessThanOrEqual(60);
  });

  it('runs the stepping stones from the bottom centre up to the pond, shrinking with distance', () => {
    expect(PATH[0]!.y).toBeGreaterThan(900);
    expect(Math.abs(PATH[0]!.x - WORLD_W / 2)).toBeLessThan(60);
    for (let i = 1; i < PATH.length; i++) {
      expect(PATH[i]!.y).toBeLessThan(PATH[i - 1]!.y);
      expect(PATH[i]!.rx).toBeLessThan(PATH[i - 1]!.rx);
    }
    expect(edgeDistance(PATH[PATH.length - 1]!, POND)).toBeLessThan(70);
  });

  describe('plants at the garden scale (1.25×, ADR 0148)', () => {
    /** the box of the largest plant a slot takes, as the plant system draws it (anchor 0.5, 0.95) */
    const box = (s: Slot) => {
      const k = plantScale(s);
      const w = PLANT_SIZES[s.maxSize].w * k;
      const h = PLANT_SIZES[s.maxSize].h * k;
      return { x: s.x - w / 2, y: s.y - 0.95 * h, w, h };
    };
    /** where a plant stands: the middle 60 % of its box, its lowest 15 % */
    const footprint = (s: Slot) => {
      const b = box(s);
      return { x0: s.x - b.w * 0.3, x1: s.x + b.w * 0.3, y0: s.y - b.h * 0.15, y1: s.y };
    };

    it('draws plants 1.25× their v1 size', () => {
      expect(GARDEN_PLANT_SCALE).toBe(1.25);
      for (const s of slots) expect(plantScale(s)).toBeCloseTo(s.scale * 1.25, 9);
    });

    it('never stands a plant on a stepping stone', () => {
      for (const s of slots) {
        const f = footprint(s);
        for (const st of PATH) {
          // the footprint's closest point to the stone's centre stays outside the stone
          const cx = Math.max(f.x0, Math.min(st.x, f.x1));
          const cy = Math.max(f.y0, Math.min(st.y, f.y1));
          expect(((cx - st.x) / st.rx) ** 2 + ((cy - st.y) / st.ry) ** 2, `${s.id} on the stone at ${st.x},${st.y}`).toBeGreaterThan(1);
        }
      }
    });

    it('never hides the engawa: at most a fifth of any plant box lies over its wall and deck', () => {
      const body = { x0: PAVILION.x + 20, x1: WORLD_W, y0: PAVILION.y, y1: PAVILION.y + PAVILION.h - 40 };
      for (const s of slots) {
        const b = box(s);
        const ox = Math.max(0, Math.min(b.x + b.w, body.x1) - Math.max(b.x, body.x0));
        const oy = Math.max(0, Math.min(b.y + b.h, body.y1) - Math.max(b.y, body.y0));
        expect((ox * oy) / (b.w * b.h), s.id).toBeLessThanOrEqual(0.2);
        // and nothing grows over the lantern
        const L = PAVILION.lantern;
        expect(L.x >= b.x && L.x <= b.x + b.w && L.y >= b.y && L.y <= b.y + b.h, `${s.id} over the lantern`).toBe(false);
      }
    });

    it('keeps neighbours readable: plants at the same depth overlap by at most half their footprint', () => {
      // trees stand on a trunk (their crowns are spaced above), rock-crevice plants tuck in front by design
      const open = slots.filter((s) => s.maxSize !== 'tree' && s.habitat !== 'rock');
      for (let i = 0; i < open.length; i++) {
        for (let j = i + 1; j < open.length; j++) {
          const a = open[i]!;
          const b = open[j]!;
          if (Math.abs(a.y - b.y) > 40) continue;
          const fa = footprint(a);
          const fb = footprint(b);
          const ov = Math.max(0, Math.min(fa.x1, fb.x1) - Math.max(fa.x0, fb.x0));
          expect(ov / Math.min(fa.x1 - fa.x0, fb.x1 - fb.x0), `${a.id}–${b.id}`).toBeLessThanOrEqual(0.5);
        }
      }
    });
  });

  it('keeps the lantern under the pavilion and the sky band in the sky', () => {
    const pv = gardenScene.pavilion;
    expect(pv.lantern.x).toBeGreaterThanOrEqual(pv.x);
    expect(pv.lantern.x).toBeLessThanOrEqual(pv.x + pv.w);
    expect(pv.lantern.y).toBeGreaterThanOrEqual(pv.y);
    expect(pv.lantern.y).toBeLessThanOrEqual(pv.y + pv.h);
    expect(pv.x + pv.w).toBeLessThanOrEqual(WORLD_W);
    expect(gardenScene.skyBand.top).toBeGreaterThanOrEqual(0);
    expect(gardenScene.skyBand.bottom).toBeLessThan(gardenScene.waterline);
  });

  it('keeps the painted trees and foreground tufts inside the world', () => {
    for (const t of TREES) for (const [x, y] of t.pads) expect(x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H, t.id).toBe(true);
    for (const t of FOREGROUND_TUFTS) expect(t.y).toBeLessThanOrEqual(WORLD_H);
  });
});
