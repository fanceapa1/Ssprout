import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { vineLeafOutline } from '../lib/grapevine-paint';
import { treeSuite } from '../lib/suites';
import grapevine, { grapevineArrivals, planGrapevine } from './grapevine';

treeSuite('grapevine', planGrapevine);

const plan = (seed: number) => planGrapevine(createRng(seed).fork('grapevine'));
const STEPS = 400;
type Mark = [string, (g: number) => number];

describe('grapevine', () => {
  it('grows every pad, leaf, tendril and bunch in from nothing, with no jump between growth steps', () => {
    const a = grapevineArrivals;
    for (const s of [1, 2, 3]) {
      const p = plan(s);
      const marks: Mark[] = [
        ...p.pads.map((m): Mark => [`pad ${m.id}`, (g) => a(g).pad(m)]),
        ...p.leaves.filter((_, i) => i % 7 === 0).map((m): Mark => [`leaf ${m.id}`, (g) => a(g).leaf(m)]),
        ...p.tendrils.map((m): Mark => [`tendril ${m.id}`, (g) => a(g).tendril(m)]),
        ...p.bunches.flatMap((m): Mark[] => [
          [`bud ${m.id}`, (g) => a(g).bud(m)],
          [`swell ${m.id}`, (g) => a(g).swell(m)],
          [`ripe ${m.id}`, (g) => a(g).ripe(m)],
        ]),
        ['amber', (g) => a(g).amber],
        ['shade', (g) => a(g).shade],
      ];
      for (const [name, k] of marks) {
        expect(k(0), name).toBe(0);
        expect(k(1), name).toBeGreaterThan(0.99);
        let prev = 0;
        for (let i = 1; i <= STEPS; i++) {
          const v = k(i / STEPS);
          expect(Math.abs(v - prev), name).toBeLessThan(0.05);
          prev = v;
        }
      }
    }
  });

  it('grows bare wood on the frame, then leaves, then flower clusters, then swelling and ripening grapes', () => {
    const p = plan(1);
    const at = grapevineArrivals;
    for (const l of p.leaves) expect(at(0.4).leaf(l)).toBe(0);
    for (const b of p.bunches) {
      expect(at(0.6).bud(b)).toBe(0);
      expect(at(0.72).swell(b)).toBe(0);
      expect(at(0.84).ripe(b)).toBe(0);
    }
    for (const b of p.tree.branches) if (b.order === 0) expect(b.t0).toBeLessThan(0.1);
  });

  it('carries a roof of leaves and many bunches, purple and amber, all inside the box', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      const trunks = p.tree.branches.filter((b) => b.order === 0);
      expect(trunks.length, `seed ${s}`).toBeGreaterThanOrEqual(2);
      expect(trunks.length).toBeLessThanOrEqual(3);
      expect(p.leaves.length, `seed ${s}`).toBeGreaterThan(150);
      expect(p.bunches.length, `seed ${s}`).toBeGreaterThanOrEqual(8);
      expect(p.bunches.some((b) => b.purple)).toBe(true);
      expect(p.bunches.some((b) => !b.purple)).toBe(true);
      expect(p.leaves.filter((l) => l.amber).length, `seed ${s}`).toBeGreaterThan(0);
      for (const l of p.leaves) {
        expect(l.x - l.length).toBeGreaterThan(0);
        expect(l.x + l.length).toBeLessThan(grapevine.size.w);
        expect(l.y - l.length).toBeGreaterThan(0);
      }
      for (const b of p.bunches)
        for (const q of b.berries) {
          expect(b.at.x + q.x).toBeGreaterThan(0);
          expect(b.at.x + q.x).toBeLessThan(grapevine.size.w);
          expect(b.at.y + q.y + q.r + 3).toBeLessThan(grapevine.size.h * grapevine.anchor.y);
        }
      for (const post of p.frame.posts) {
        expect(post.x).toBeGreaterThan(0);
        expect(post.x).toBeLessThan(grapevine.size.w);
      }
    }
  });

  it('paints a five-lobed leaf: its outline swings in and out between the lobes', () => {
    const o = vineLeafOutline({ x: 0, y: 0 }, 0, 10, 1, 0.3, 1);
    const radii = o.map((q) => Math.hypot(q.x, q.y));
    let turns = 0;
    for (let i = 2; i < radii.length; i++) if ((radii[i]! - radii[i - 1]!) * (radii[i - 1]! - radii[i - 2]!) < 0) turns++;
    expect(turns).toBeGreaterThanOrEqual(8);
    expect(Math.max(...radii)).toBeGreaterThan(9);
  });

  it('is cultivated in the oasis’s and the Mediterranean’s realms only', () => {
    expect(grapevine.range.cultivatedIn).toEqual(['n-africa-arabia', 'mediterranean']);
    expect(grapevine.range.realms).toEqual([]);
  });
});
