import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { DRUM, OLIVE, STYLOBATE } from '../../scenery/coast/layout';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { OASIS } from '../../scenery/oasis';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import goat, { bandCoats, drawGoatSprite, GOAT_POSES, goatMap, Goats, route, wayY, type GoatMap, type GoatMember } from './goat';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'goat');

function coastSim(seed = 4, { hour = 12, reduced = false, rows = ONLY, auto = true } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, reducedMotion: reduced, auto });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const bands = (sim: FaunaSim) => sim.creatures.filter((c): c is Goats => c instanceof Goats);

await loadAllCreatures();

/** Where a goat may be: on a way (within 1.5), in a hop between two ways a link joins, or below the cliff top's edge coming in or out. */
function onGround(map: GoatMap, m: GoatMember, entryX: number | null): boolean {
  if (m.hop) return true;
  const w = map.ways[m.way]!;
  if (m.x >= w.x0 - 0.5 && m.x <= w.x1 + 0.5 && Math.abs(m.y - wayY(w, m.x)) < 1.5) return true;
  // the rise over the cliff top, or the walk in off the east end
  if (w.rim && entryX !== null && Math.abs(m.x - entryX) < 6 && m.y > wayY(w, m.x) - 0.5) return true;
  return !w.rim && m.x > w.x1 - 0.5;
}

describe('the goats’ ground', () => {
  const map = goatMap(COAST.fauna.perches!);

  it('joins the ledge stretches into ways by name: the cliff top and three ledges west of the olive, two east of it', () => {
    const ids = map.ways.map((w) => w.id).sort();
    expect(ids).toEqual(['cliff-top-west', 'ledge-east-1', 'ledge-east-2', 'ledge-west-1', 'ledge-west-2', 'ledge-west-3']);
    for (const w of map.ways) for (let i = 1; i < w.pts.length; i++) expect(w.pts[i]!.x).toBeGreaterThanOrEqual(w.pts[i - 1]!.x);
    expect(map.ways.find((w) => w.id === 'cliff-top-west')!.rim).toBe(true);
  });

  it('hops only short drops between ways, so the west side is one range under the cliff top and the east ledges another', () => {
    for (const l of map.links) {
      const d = Math.abs(wayY(map.ways[l.a]!, l.x) - wayY(map.ways[l.b]!, l.x));
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(30);
    }
    const west = map.ranges.find((r) => r.rim !== null)!;
    expect(west.ways.map((k) => map.ways[k]!.id).sort()).toEqual(['cliff-top-west', 'ledge-west-1', 'ledge-west-2', 'ledge-west-3']);
    const east = map.ranges.filter((r) => r.rim === null);
    expect(east.length).toBe(1);
    expect(map.ways[east[0]!.edge]!.x1).toBeGreaterThan(1580);
    // the far pines on the cliff top within a reared goat's reach
    expect(map.pines.length).toBeGreaterThanOrEqual(1);
  });

  it('routes along the ways and through the hops, from the cliff top to the lowest ledge', () => {
    const rim = map.ways.findIndex((w) => w.rim);
    const low = map.ways.findIndex((w) => w.id === 'ledge-west-3');
    const r = route(map, rim, 1000, low, 1020)!;
    expect(r.filter((q) => q.hop).length).toBe(3);
    for (const q of r) expect(Math.abs(q.y - wayY(map.ways[q.way]!, q.x))).toBeLessThan(0.1);
    expect(route(map, rim, 1000, map.ways.findIndex((w) => w.id === 'ledge-east-1'), 1560)).toBeNull();
  });

  it('is the coast’s alone: no ledges, no goats', () => {
    expect(goatMap(OASIS.fauna.perches!).ranges).toEqual([]);
  });
});

describe('the band', () => {
  it('is a black nanny leading, a pied billy with the bell, a kid or a tan nanny', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = bandCoats(createRng(i));
      expect(c[0]).toBe('black');
      expect(c.length).toBeGreaterThanOrEqual(2);
      expect(c.length).toBeLessThanOrEqual(3);
      expect(c.filter((k) => k === 'kid').length).toBeLessThanOrEqual(1);
      seen.add(c.join(','));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(bandCoats(createRng(1), 3).length).toBe(3);
  });

  it('over three hours of days: comes, keeps to the ledges and the cliff top, rests and moves on, leaves; never on the temple, in the olive or down on the terraces', () => {
    const problems: string[] = [];
    const did = { graze: 0, look: 0, lie: 0, rear: 0, lookout: 0, hop: 0, skip: 0, move: 0, browse: 0 };
    let visits = 0;
    let shownT = 0;
    const cliffTop = COAST_SLOTS.find((x) => x.id === 'scrub-1')!;
    const terraceFeet = Math.min(...COAST_SLOTS.filter((x) => x.id !== 'scrub-1' && x.y > cliffTop.y).map((x) => x.y));
    for (const seed of [1, 2, 3]) {
      const sim = coastSim(seed);
      const map = goatMap(sim.world.perches);
      const seenBands = new Set<Goats>();
      for (let i = 0; i < 3600 * 20; i++) {
        sim.update(0.05, 0);
        for (const b of bands(sim)) {
          if (!seenBands.has(b)) {
            seenBands.add(b);
            visits++;
          }
          const entryX = b.range.rim !== null ? (b as unknown as { entry: { x: number }[] }).entry[1]!.x : null;
          for (const m of b.members) {
            if (!m.shown || m.gone) continue;
            shownT += 0.05;
            if (!onGround(map, m, entryX)) problems.push(`off the ground ${m.coat} ${m.x.toFixed(1)},${m.y.toFixed(1)} way ${map.ways[m.way]!.id}`);
            if (m.x < DRUM.x + 12 && m.x > STYLOBATE.x0 - 10 && m.y - 14 <= STYLOBATE.y + 2) problems.push(`on the temple ${m.x.toFixed(1)},${m.y.toFixed(1)}`);
            if (m.y > 470) problems.push(`down to the terraces ${m.y.toFixed(1)}`);
            for (const y of [m.y, m.y - 14]) if (((m.x - OLIVE.crown.x) / (OLIVE.rx * 1.1)) ** 2 + ((y - OLIVE.crown.y) / (OLIVE.ry * 1.1)) ** 2 < 1) problems.push(`in the olive ${m.x.toFixed(1)},${m.y.toFixed(1)}`);
          }
          // behind every terrace plant, in front of the cliff-top tree
          const d = b.depth()!;
          if (d >= terraceFeet || d <= cliffTop.y) problems.push(`depth ${d.toFixed(1)}`);
        }
      }
      for (const b of seenBands) for (const k of Object.keys(did) as (keyof typeof did)[]) did[k] += b.did[k];
    }
    expect([...new Set(problems)].slice(0, 8)).toEqual([]);
    // about a visit an hour of a garden's day; the band in the painting a good part of it
    expect(visits).toBeGreaterThanOrEqual(3);
    expect(visits).toBeLessThanOrEqual(12);
    expect(shownT).toBeGreaterThan(600);
    for (const k of ['graze', 'look', 'lie', 'rear', 'lookout', 'hop', 'skip', 'move'] as const) expect(did[k], k).toBeGreaterThan(0);
  });

  it('leaves at nightfall the way it came, and is not there at night', () => {
    const sim = coastSim(6, { auto: false });
    sim.spawn('goat');
    const b = bands(sim)[0]!;
    for (let i = 0; i < 1200; i++) sim.update(0.05, 0);
    expect(b.members.some((m) => m.shown)).toBe(true);
    sim.hourOverride = 22;
    for (let i = 0; i < 6000 && !b.done; i++) sim.update(0.05, 0);
    expect(b.done).toBe(true);
    expect(bands(sim)).toEqual([]);
    const night = coastSim(6, { hour: 23 });
    for (let i = 0; i < 3600 * 4; i++) night.update(0.05, 0);
    expect(bands(night)).toEqual([]);
  });

  it('draws only on its own fork, and is deterministic', () => {
    const a = coastSim(5, { auto: false });
    const b = coastSim(5, { auto: false });
    a.spawn('goat');
    b.spawn('goat');
    for (let i = 0; i < 3000; i++) a.update(0.05, 0);
    expect(a.rng.next()).toBe(b.rng.next());
    const run = () => {
      const sim = coastSim(9);
      for (let i = 0; i < 20000; i++) sim.update(0.05, 0);
      return bands(sim).flatMap((g) => g.members.map((m) => `${m.x.toFixed(2)},${m.y.toFixed(2)},${m.act}`));
    };
    expect(run()).toEqual(run());
  });

  it('is summoned by hand as a band of the asked size (the dev hook: `sprout.fauna.spawn(\'goat\', n)`)', () => {
    for (const n of [2, 3]) {
      const sim = coastSim(7, { auto: false });
      sim.spawn('goat', { count: n });
      expect(bands(sim)[0]!.members.length).toBe(n);
    }
  });

  it('sends home at once the goats still out of sight when it leaves early', () => {
    const sim = coastSim(8, { auto: false });
    sim.spawn('goat', { count: 3 });
    const b = bands(sim)[0]!;
    sim.update(0.05, 0);
    b.leave(sim.world);
    const hidden = b.members.filter((m) => !m.shown);
    expect(hidden.length).toBeGreaterThan(0);
    for (const m of hidden) expect(m.gone).toBe(true);
    for (let i = 0; i < 4000 && !b.done; i++) sim.update(0.05, 0);
    expect(b.done).toBe(true);
  });

  it('in reduced motion walks slower', () => {
    const walked = (reduced: boolean) => {
      const sim = coastSim(3, { reduced, auto: false });
      sim.spawn('goat');
      const m = bands(sim)[0]!.members[0]!;
      let d = 0;
      for (let i = 0; i < 400; i++) {
        const [x, y] = [m.x, m.y];
        sim.update(0.05, 0);
        if (!m.hop) d += Math.hypot(m.x - x, m.y - y);
      }
      return d;
    };
    expect(walked(true)).toBeLessThan(walked(false) * 0.8);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(goat.show!.spec, 1, 'goat', 'coast');
    let shown = 0;
    for (let i = 0; i < 3600; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const b of bands(stage.sim)) shown += b.members.filter((m) => m.shown).length;
    }
    expect(shown).toBeGreaterThan(0);
  });
});

describe('cost', () => {
  it('draws one sprite per goat (a clip only while one is behind the cliff top’s edge)', () => {
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : () => {}),
      set: () => true,
    });
    const s: Sprite = { img: {} as never, w: 1, h: 1, ox: 0, oy: 0 };
    drawGoatSprite(ctx as never, s, 0, 0, 1, 1);
    expect(n).toBe(1);
    const sim = coastSim(2, { auto: false });
    sim.spawn('goat');
    const b = bands(sim)[0]!;
    for (let i = 0; i < 2400; i++) sim.update(0.05, 0);
    n = 0;
    const w = { ...sim.world, art: { get: () => s } } as never;
    b.draw('entities', ctx as never, w);
    expect(n).toBe(b.members.filter((m) => m.shown && !m.gone).length);
    expect(GOAT_POSES.length).toBe(11);
  });

  it('updates cheaply', () => {
    const sim = coastSim(2, { auto: false });
    sim.spawn('goat');
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
