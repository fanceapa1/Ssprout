import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import type { PlantInstance } from '../../core/state';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { FALLS, waterfallScene } from '../../scenery/waterfall/geometry';
import { dist, pointInPolygon, toWorld } from '../math';
import { FaunaSim } from '../sim';
import { Stage } from '../stage';
import { activity, chooseStation, clearOfRocks, Iwana, IWANA_LEN, iwanaProfile, nextVariant, poolAxis, sidePoint } from './iwana';

const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 0.97;
const plants: PlantInstance[] = [];

function waterfallSim(seed = 4, reduced = false, rows = WATERFALL_FAUNA) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE, reducedMotion: reduced });
  sim.setGarden(plants, rows, () => undefined);
  sim.hourOverride = 12;
  return sim;
}

const fish = (sim: FaunaSim) => sim.creatures.filter((c): c is Iwana => c instanceof Iwana);

/** Head, middle and tail tip in world units. */
function body(sim: FaunaSim, f: Iwana) {
  const { cy, squash } = sim.world.pond;
  const pts = f.spine(sim.world.t);
  return [0, Math.floor(pts.length / 2), pts.length - 1].map((i) => toWorld({ x: f.p.x + pts[i]!.x, y: f.p.y + pts[i]!.y }, cy, squash));
}

describe('the char’s shape and choices', () => {
  it('is a slim torpedo: narrow at the snout and the tail root, widest a third of the way back', () => {
    expect(iwanaProfile(0)).toBe(0);
    expect(iwanaProfile(0.34)).toBeCloseTo(1, 2);
    expect(iwanaProfile(1)).toBeLessThan(0.25);
    expect(iwanaProfile(0.05)).toBeLessThan(iwanaProfile(0.2));
  });

  it('takes the variants in the garden’s row order, the fewest first', () => {
    expect(nextVariant(['iwana', 'yamame'], [])).toBe('iwana');
    expect(nextVariant(['iwana', 'yamame'], ['iwana'])).toBe('yamame');
    expect(nextVariant(['iwana'], ['iwana'])).toBe('iwana');
    expect(nextVariant([], ['iwana'])).toBe('yamame');
  });

  it('is livelier after nightfall (the evening rise) than by day', () => {
    expect(activity(false, 0)).toBe(1);
    expect(activity(true, 100)).toBeGreaterThan(activity(true, 0));
    expect(activity(true, 0)).toBeGreaterThan(1);
  });
});

describe('where it lives at the waterfall', () => {
  const w = waterfallSim().world;
  const ax = poolAxis(w);

  it('reads the current from the outflow up to the falls', () => {
    const mouth = toWorld(ax.mouth, w.pond.cy, w.pond.squash);
    expect(mouth.x).toBeGreaterThan(950);
    expect(dist(toWorld(ax.head, w.pond.cy, w.pond.squash), FALLS.foot)).toBeLessThan(1);
    expect(ax.up.x).toBeLessThan(0);
  });

  it('holds stations in the pool’s tail, in the still water, clear of the foam and the boulders, nose to the falls', () => {
    const rng = createRng(2);
    for (let i = 0; i < 40; i++) {
      const len = IWANA_LEN.iwana;
      const st = chooseStation(w, len, rng);
      const p = toWorld(st.p, w.pond.cy, w.pond.squash);
      expect(pointInPolygon(p, w.pond.world)).toBe(true);
      expect(inFoam(p)).toBe(false);
      expect(clearOfRocks(w, st.p, st.heading, len)).toBe(true);
      // nearer the outflow than the falls
      expect(dist(st.p, ax.mouth)).toBeLessThan(dist(st.p, ax.head));
      const toFalls = Math.atan2(ax.head.y - st.p.y, ax.head.x - st.p.x);
      expect(Math.abs(Math.atan2(Math.sin(st.heading - toFalls), Math.cos(st.heading - toFalls)))).toBeLessThan(0.1);
      const q = sidePoint(w, st, len, rng, i % 2 === 0);
      if (q) expect(inFoam(toWorld(q, w.pond.cy, w.pond.squash))).toBe(false);
    }
  });

  it('two fish hold separate stations', () => {
    const sim = waterfallSim(3);
    sim.update(0.1, 0);
    sim.update(0.1, 0);
    const [a, b] = fish(sim);
    expect(fish(sim)).toHaveLength(2);
    expect(dist(a!.station.p, b!.station.p)).toBeGreaterThan(a!.len);
  });
});

describe('the char and the yamame at the waterfall', () => {
  it('come with their rows: the char at iwana-1, the yamame with it at iwana-2', () => {
    const one = waterfallSim(5, false, WATERFALL_FAUNA.filter((r) => r.id !== 'iwana-2'));
    one.update(0.1, 0);
    expect(fish(one).map((f) => f.variant)).toEqual(['iwana']);
    const two = waterfallSim(5);
    two.update(0.1, 0);
    two.update(0.1, 0);
    expect(fish(two).map((f) => f.variant).sort()).toEqual(['iwana', 'yamame']);
    expect(fish(two).every((f) => !f.visitor && f.layer === 'underwater')).toBe(true);
  });

  it('over 30 simulated minutes they hold station, dart, rise now and then, and never leave the still water', () => {
    const sim = waterfallSim(7);
    const problems: string[] = [];
    const seen = new Set<string>();
    for (let s = 0; s < 30 * 60 * 10; s++) {
      sim.update(0.1, 0);
      for (const f of fish(sim)) {
        seen.add(f.state);
        for (const q of body(sim, f)) {
          if (!pointInPolygon(q, sim.world.pond.world)) problems.push(`${f.variant} ${f.state} out of the still water at ${q.x | 0},${q.y | 0}`);
          if (inFoam(q)) problems.push(`${f.variant} in the foam at ${q.x | 0},${q.y | 0}`);
        }
        if (dist(f.p, f.station.p) > f.len * 1.3) problems.push(`${f.variant} ${f.state} wandered ${dist(f.p, f.station.p) | 0} from its station (len ${f.len | 0})`);
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) problems.push('not finite');
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    for (const st of ['hold', 'dart', 'pause', 'back', 'rise', 'sip']) expect(seen, st).toContain(st);
    for (const f of fish(sim)) {
      expect(f.darts).toBeGreaterThan(30);
      expect(f.rises).toBeGreaterThan(0);
      expect(f.rises).toBeLessThan(f.darts / 2);
    }
  });

  it('stays at night, livelier in the evening rise', () => {
    const moves = (sim: FaunaSim) => fish(sim).reduce((n, f) => n + f.darts + f.rises, 0);
    const day = waterfallSim(9);
    for (let s = 0; s < 15 * 60 * 10; s++) day.update(0.1, 0);
    const dusk = waterfallSim(9);
    dusk.hourOverride = 21;
    for (let s = 0; s < 15 * 60 * 10; s++) dusk.update(0.1, 0);
    expect(fish(dusk)).toHaveLength(2);
    expect(moves(dusk)).toBeGreaterThan(moves(day) * 1.5);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const sim = waterfallSim(11);
      for (let s = 0; s < 3000; s++) sim.update(0.1, 0);
      return fish(sim).map((f) => `${f.variant}:${f.state}:${f.x.toFixed(2)},${f.y.toFixed(2)}`);
    };
    expect(run()).toEqual(run());
  });

  it('is slower with reduced motion but still darts and rises', () => {
    const moves = (sim: FaunaSim) => fish(sim).reduce((n, f) => n + f.darts + f.rises, 0);
    const calm = waterfallSim(7);
    const reduced = waterfallSim(7, true);
    for (let s = 0; s < 30 * 60 * 10; s++) {
      calm.update(0.1, 0);
      reduced.update(0.1, 0);
    }
    expect(moves(reduced)).toBeGreaterThan(5);
    expect(moves(reduced)).toBeLessThan(moves(calm));
  });
});

describe('on the studio’s falls stage', () => {
  it('both fish find their own stations in the little pool', () => {
    const stage = new Stage({ w: 380, h: 240 }, 1, 'iwana', 'falls');
    for (let i = 0; i < 300; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
    }
    const [a, b] = fish(stage.sim);
    expect(fish(stage.sim)).toHaveLength(2);
    expect(dist(a!.station.p, b!.station.p)).toBeGreaterThan(a!.len * 0.9);
  });
});
