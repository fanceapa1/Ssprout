import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { createRng } from '../../core/rng';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { FaunaSim } from '../sim';
import { perchY } from '../targets';
import scopsOwl, { callPose, choosePerch, owlPerches, ScopsOwl } from './scops-owl';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'scops-owl');

function coastSim(seed = 4, hour = 23) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto: false });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = hour;
  return sim;
}
const owls = (sim: FaunaSim) => sim.creatures.filter((c): c is ScopsOwl => c instanceof ScopsOwl && !c.done);
const settle = (sim: FaunaSim, o: ScopsOwl) => {
  for (let i = 0; i < 600 && o.doing() !== 'perch'; i++) sim.update(0.1, 0);
};

await loadAllCreatures();

describe('where the scops owl perches', () => {
  it('keeps to the olive, the pine and the wall tops', () => {
    const ps = owlPerches(coastSim().world);
    const ids = ps.map((p) => p.id);
    expect(ids.some((id) => id.startsWith('olive'))).toBe(true);
    expect(ids.some((id) => id.startsWith('pine-branch'))).toBe(true);
    expect(ps.some((p) => p.kind === 'wall')).toBe(true);
    expect(ps.every((p) => p.kind === 'branch' || p.kind === 'wall')).toBe(true);
  });

  it('picks the olive most, and never a held perch', () => {
    const w = coastSim().world;
    const rng = createRng(7);
    const n = { olive: 0, pine: 0, wall: 0 };
    for (let i = 0; i < 3000; i++) {
      const p = choosePerch(w, rng, [])!;
      n[p.id.startsWith('olive') ? 'olive' : p.id.startsWith('pine') ? 'pine' : 'wall']++;
    }
    expect(n.olive).toBeGreaterThan(n.pine);
    expect(n.pine).toBeGreaterThan(n.wall);
    expect(n.wall).toBeGreaterThan(0);
    const fork = w.perches.find((p) => p.id === 'olive-fork')!;
    for (let i = 0; i < 200; i++) expect(choosePerch(w, rng, [{ x: fork.x, y: fork.y }])).not.toBe(fork);
  });

  it('needs the olive (not in the oasis)', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(scopsOwl.needs!(sim.world)).toBe(false);
  });
});

describe('a night in the olive', () => {
  it('flies in, sits with its feet on the perch, calls, turns its head, blinks and swoops to another perch', () => {
    const sim = coastSim(5);
    const [o] = sim.spawn('scops-owl') as ScopsOwl[];
    expect(o!.doing()).toBe('fly');
    const acts = new Set<string>();
    const perched = new Set<string>();
    for (let s = 0; s < 900 && !o!.done; s += 0.1) {
      sim.update(0.1, 0);
      const a = o!.acting();
      if (a) acts.add(a);
      if (o!.doing() === 'perch' && o!.perch) {
        expect(o!.y).toBeCloseTo(perchY(o!.perch, o!.x), 5);
        expect(o!.layer).toBe('entities');
        perched.add(o!.perch.id);
      }
    }
    for (const a of ['call', 'turn', 'blink']) expect(acts, a).toContain(a);
    expect(o!.calls).toBeGreaterThan(3);
    expect(o!.moves).toBeGreaterThan(0);
    expect(perched.size).toBeGreaterThan(1);
  });

  it('only one at a time', () => {
    const sim = coastSim(2);
    sim.spawn('scops-owl');
    sim.spawn('scops-owl');
    expect(owls(sim)).toHaveLength(1);
  });

  it('stretches tall and thin while the cat is near, and sits back when it goes', () => {
    const sim = coastSim(6);
    const [o] = sim.spawn('scops-owl') as ScopsOwl[];
    settle(sim, o!);
    expect(o!.doing()).toBe('perch');
    const [cat] = sim.spawn('cat');
    const park = () => {
      cat!.x = o!.x + 40;
      cat!.y = o!.y + 20;
    };
    park();
    for (let i = 0; i < 10; i++) {
      sim.update(0.1, 0);
      park();
    }
    expect(o!.acting()).toBe('tall');
    expect(o!.pose().tall).toBeGreaterThan(0.9);
    expect(o!.alarms).toBe(1);
    expect(o!.doing()).toBe('perch');
    for (let i = 0; i < 40; i++) {
      sim.update(0.1, 0);
      cat!.x = o!.x + 600;
    }
    expect(o!.pose().tall).toBe(0);
  });

  it('night only: gone by day, nocturnal on the schedule', () => {
    const sim = coastSim(8);
    const [o] = sim.spawn('scops-owl') as ScopsOwl[];
    settle(sim, o!);
    sim.hourOverride = 12;
    for (let i = 0; i < 600 && !o!.done; i++) sim.update(0.1, 0);
    expect(o!.done).toBe(true);
    expect(scopsOwl.visit!.nocturnal).toBe(true);
    expect(scopsOwl.visit!.diurnal).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const trace = () => {
      const sim = coastSim(9);
      const [o] = sim.spawn('scops-owl') as ScopsOwl[];
      const out: string[] = [];
      for (let i = 0; i < 1500; i++) {
        sim.update(0.1, 0);
        if (i % 50 === 0) out.push(`${o!.doing()}:${o!.x.toFixed(2)}:${o!.y.toFixed(2)}`);
      }
      return out.join('|');
    };
    expect(trace()).toBe(trace());
  });

  it('the call puffs the throat once every few seconds', () => {
    const puffs = Array.from({ length: 100 }, (_, i) => callPose(i / 10).puff > 0.5);
    const starts = puffs.filter((p, i) => p && !puffs[i - 1]).length;
    expect(starts).toBeGreaterThanOrEqual(3);
    expect(starts).toBeLessThanOrEqual(5);
  });
});
