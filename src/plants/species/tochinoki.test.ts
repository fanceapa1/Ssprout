import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { candleShape, handShape } from '../lib/tochinoki-paint';
import { treeSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import tochinoki, { planTochinoki, poseTochinoki, type TochinokiPose } from './tochinoki';

treeSuite('tochinoki', planTochinoki);

type Mark = { size: number; pts: number[] };

/** Every hand and candle of a pose by id: its visible size and the numbers that place it. */
function marks(pose: TochinokiPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const h of pose.hands) {
    const tip = h.length * Math.max(...h.lens);
    out.set(h.id, { size: tip * h.alpha, pts: [h.at.x, h.at.y, h.at.x + Math.cos(h.facing) * tip, h.at.y + Math.sin(h.facing) * tip * h.squash, h.spread * tip * 0.5] });
  }
  for (const c of pose.candles) out.set(c.id, { size: c.length * c.alpha, pts: [c.at.x, c.at.y, c.at.x + Math.cos(c.angle) * c.length, c.at.y + Math.sin(c.angle) * c.length, c.width] });
  return out;
}

const plan = (seed: number) => planTochinoki(createRng(seed).fork('tochinoki'));

describe('tochinoki', () => {
  const size = Math.max(tochinoki.size.w, tochinoki.size.h);

  it('grows continuously: no hand or candle jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const p = plan(seed);
      let prev = marks(poseTochinoki(p, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseTochinoki(p, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.012);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.03);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.012);
        prev = cur;
      }
    }
  });

  it('keeps every leaflet and candle inside its box at full growth, clear of the sides and top', () => {
    const { w, h } = tochinoki.size;
    for (let seed = 1; seed <= 16; seed++) {
      const pose = poseTochinoki(plan(seed), 1);
      const pts = [...pose.hands.flatMap((hd) => handShape(hd).flatMap((l) => l.outline)), ...pose.candles.flatMap((c) => candleShape(c).outline)];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(3);
        expect(q.x, `seed ${seed}`).toBeLessThan(w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(3);
        expect(q.y, `seed ${seed}`).toBeLessThan(h);
      }
    }
  });

  it('is one massive straight trunk under a broad dome of hands', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = plan(seed);
      const trunks = p.tree.branches.filter((b) => b.order === 0);
      expect(trunks.length).toBe(1);
      const t = trunks[0]!;
      expect(t.w0, `seed ${seed}`).toBeGreaterThan(17);
      const lean = Math.abs(t.pts[t.pts.length - 1]!.x - t.pts[0]!.x);
      expect(lean, `seed ${seed}`).toBeLessThan(t.len * 0.12);
      const xs = p.hands.map((h) => h.x);
      expect(Math.max(...xs) - Math.min(...xs), `seed ${seed}`).toBeGreaterThan(170);
      expect(p.hands.length, `seed ${seed}`).toBeGreaterThan(60);
    }
  });

  it('hands are palms of 5–7 leaflets; candles stand on top hands and open last', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = plan(seed);
      for (const h of p.hands) expect([5, 6, 7]).toContain(h.lens.length);
      expect(p.candles.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      for (const c of p.candles) expect(p.hands[c.hand]!.top).toBe(true);
      expect(poseTochinoki(p, 0.4).hands.filter((h) => h.id.startsWith('hand-')).length).toBe(0);
      const mid = poseTochinoki(p, 0.72);
      expect(mid.candles.every((c) => c.open < 0.05)).toBe(true);
      expect(mid.hands.length).toBeGreaterThan(40);
      const full = poseTochinoki(p, 1);
      expect(full.candles.length).toBe(p.candles.length);
      expect(full.candles.every((c) => c.open > 0.99)).toBe(true);
    }
  });

  it('grows wild only in Japan’s cool mountain valleys', () => {
    const def = getSpecies('tochinoki')!;
    expect(def.range).toEqual({ realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate'] });
    expect(def.habitats).toEqual(['back', 'meadow']);
    expect(def.bloomColor).toBe('#f1e6d2');
    expect(def.description.length).toBeLessThan(80);
  });
});
