import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { inRegion } from '../targets';
import { FaunaSim } from '../sim';
import type { Sprite } from '../sprite';
import { Stage } from '../stage';
import type { Creature } from '../types';
import cicada, { barksOf, Cicada, CICADA_TUNING, drawCicada, flightPose, songPose, spotPoint, type CicadaParts } from './cicada';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'cicada');

function coastSim(seed = 4, { hour = 12, auto = false } = {}) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}

const cicadas = (sim: FaunaSim) => sim.creatures.filter((c): c is Cicada => c instanceof Cicada);
const run = (sim: FaunaSim, seconds: number, dt = 0.1) => {
  for (let s = 0; s < seconds; s += dt) sim.update(dt, 0);
};

await loadAllCreatures();

describe('where the cicada sits', () => {
  it('knows the olive’s and the pine’s bark, and its spots lie on the trunks', () => {
    const w = coastSim().world;
    const barks = barksOf(w);
    expect(barks.map((b) => b.id).sort()).toEqual(['bark-olive', 'bark-pine']);
    for (const b of barks) {
      for (const u of [0.1, 0.5, 0.9]) for (const side of [-1, 0, 1]) expect(inRegion(b.region, spotPoint({ bark: b, u, side }))).toBe(true);
      // the trunk runs up: its foot is the lowest point
      expect(b.spine[b.spine.length - 1]!.y).toBeGreaterThan(b.spine[0]!.y);
    }
  });

  it('lives only where there is bark (not in the oasis)', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(cicada.needs!(sim.world)).toBe(false);
    expect(sim.spawn('cicada')).toHaveLength(0);
  });
});

describe('a day on the bark', () => {
  it('flies in, lands on a trunk, sings in bouts, shuffles, and flies to another tree now and then', () => {
    const sim = coastSim(3);
    const [c] = sim.spawn('cicada') as Cicada[];
    expect(c!.doing()).toBe('fly');
    const seen = new Set<string>();
    const trees = new Set<string>();
    for (let s = 0; s < 400; s += 0.1) {
      sim.update(0.1, 0);
      seen.add(c!.doing());
      if (c!.spot && c!.doing() !== 'fly') {
        trees.add(c!.spot.bark.id);
        expect(inRegion(c!.spot.bark.region, c!)).toBe(true);
        expect(c!.layer).toBe('entities');
        expect(c!.depth()).toBe(c!.spot.bark.depth);
      }
    }
    for (const m of ['fly', 'sit', 'sing', 'shuffle']) expect(seen, m).toContain(m);
    expect(c!.songs).toBeGreaterThan(5);
    expect(c!.shuffles).toBeGreaterThan(0);
    expect(c!.flights).toBeGreaterThan(0);
    expect(trees.size).toBe(2);
  });

  it('a shuffle is a few units along the trunk, slowly', () => {
    const sim = coastSim(6);
    const [c] = sim.spawn('cicada') as Cicada[];
    let moved = 0;
    for (let i = 0; i < 6000; i++) {
      const was = c!.doing() === 'shuffle' ? { x: c!.x, y: c!.y } : null;
      sim.update(0.05, 0);
      if (was && c!.doing() === 'shuffle') {
        const d = Math.hypot(c!.x - was.x, c!.y - was.y);
        expect(d).toBeLessThan(CICADA_TUNING.creep * 0.05 * 1.5);
        moved += d;
      }
    }
    expect(moved).toBeGreaterThan(1);
  });

  it('goes quiet and flattens when a bird comes near, and sings again after it has gone', () => {
    const sim = coastSim(8);
    const [c] = sim.spawn('cicada') as Cicada[];
    run(sim, 30);
    expect(c!.doing()).not.toBe('fly');
    const stub = (kind: string, dx: number): Creature => ({ id: 999, kind, x: c!.x + dx, y: c!.y, layer: 'air', state: 'fly', done: false, visitor: true, forced: true, update: () => {}, draw: () => {}, depth: () => null, leave: () => {} });
    // a butterfly near, a gull far off: nothing
    sim.creatures.push(stub('butterfly', 10), stub('gull', 300));
    run(sim, 2);
    expect(c!.alarms).toBe(0);
    const gull = stub('gull', 40);
    sim.creatures.push(gull);
    run(sim, 2);
    expect(c!.doing()).toBe('still');
    expect(c!.flatness()).toBeGreaterThan(0.9);
    const songs = c!.songs;
    run(sim, 20);
    expect(c!.doing()).toBe('still');
    expect(c!.songs).toBe(songs);
    gull.done = true;
    run(sim, 60);
    expect(c!.alarms).toBe(1);
    expect(c!.songs).toBeGreaterThan(songs);
    expect(c!.flatness()).toBeLessThan(0.5);
  });

  it('by day only: it flies off at nightfall, and none comes after dark', () => {
    const sim = coastSim(5, { auto: true });
    let seen = false;
    for (let s = 0; s < 200; s += 0.1) {
      sim.update(0.1, 0);
      seen ||= cicadas(sim).length > 0;
    }
    expect(seen).toBe(true);
    sim.hourOverride = 22;
    run(sim, 30);
    expect(cicadas(sim)).toHaveLength(0);
    for (let s = 0; s < 1500; s += 0.5) {
      sim.update(0.5, 0);
      expect(cicadas(sim)).toHaveLength(0);
    }
  });

  it('two keep apart on the bark', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const sim = coastSim(seed);
      const made = sim.spawn('cicada', { count: 2 }) as Cicada[];
      expect(made).toHaveLength(2);
      run(sim, 20);
      const [a, b] = made.map((c) => c.perchPoint()!);
      expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThanOrEqual(CICADA_TUNING.gap);
    }
  });

  it('draws only on its own fork, and is deterministic', () => {
    const a = coastSim(5);
    const b = coastSim(5);
    a.spawn('cicada');
    b.spawn('cicada');
    run(a, 300, 0.05);
    run(b, 300, 0.05);
    expect(a.rng.next()).toBe(b.rng.next());
    const ca = cicadas(a)[0]!;
    const cb = cicadas(b)[0]!;
    expect([ca.x, ca.y, ca.state, ca.songs]).toEqual([cb.x, cb.y, cb.state, cb.songs]);
  });

  it('lives on the studio’s coast stage', () => {
    const stage = new Stage(cicada.show!.spec, 1, 'cicada', 'coast');
    const modes = new Set<string>();
    for (let i = 0; i < 30 * 120; i++) {
      stage.tickRespawn(i / 30);
      stage.sim.update(1 / 30, 0);
      for (const c of cicadas(stage.sim)) modes.add(c.doing());
    }
    for (const s of ['fly', 'sit', 'sing']) expect(modes, s).toContain(s);
  });
});

describe('the song and the cost', () => {
  it('the song shimmers: the abdomen throbs and the wings tremble from frame to frame', () => {
    const qs = Array.from({ length: 8 }, (_, i) => songPose(i / 60));
    expect(new Set(qs.map((q) => q.throb.toFixed(2))).size).toBeGreaterThan(4);
    expect(Math.max(...qs.map((q) => Math.abs(q.wingL)))).toBeGreaterThan(0.02);
    expect(flightPose(0).wingL).toBeGreaterThan(0.7);
  });

  it('draws a frame with four drawImages and updates cheaply', () => {
    const sprite = (): Sprite => ({ img: {} as never, w: 1, h: 1, ox: 0, oy: 0 });
    const parts: CicadaParts = { body: sprite(), abdomen: sprite(), wing: sprite() };
    let n = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'drawImage' ? () => n++ : k === 'globalAlpha' ? 1 : () => {}),
      set: () => true,
    });
    drawCicada(ctx as never, parts, songPose(0.3));
    expect(n).toBe(4);
    const sim = coastSim(2);
    sim.spawn('cicada', { count: 2 });
    const t0 = performance.now();
    for (let i = 0; i < 6000; i++) sim.update(1 / 60, 0);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
