import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { createRng } from '../../core/rng';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { FaunaSim } from '../sim';
import { perchY } from '../targets';
import rockThrush, { choosePerch, dropSpot, RockThrush, songPose, thrushPerches } from './rock-thrush';

const plants: PlantInstance[] = [];
const ONLY = COAST_FAUNA.filter((r) => r.kind === 'rock-thrush');

function coastSim(seed = 4) {
  const sim = new FaunaSim({ scene: COAST.geometry, seed, habitat: COAST.fauna, auto: false });
  sim.setGarden(plants, ONLY, () => undefined);
  sim.hourOverride = 12;
  return sim;
}
const thrushes = (sim: FaunaSim) => sim.creatures.filter((c): c is RockThrush => c instanceof RockThrush && !c.done);

await loadAllCreatures();

describe('where the rock thrush perches', () => {
  it('keeps to high stone: the temple, the copings, the cliff ledges, never the fallen drum', () => {
    const w = coastSim().world;
    const ps = thrushPerches(w);
    expect(new Set(ps.map((p) => p.kind))).toEqual(new Set(['ruin', 'wall', 'ledge']));
    expect(ps.some((p) => p.id === 'drum')).toBe(false);
  });

  it('picks the temple most, and the higher the likelier', () => {
    const w = coastSim().world;
    const rng = createRng(7);
    const n: Record<string, number> = {};
    let ys = 0;
    for (let i = 0; i < 2000; i++) {
      const p = choosePerch(w, rng, [])!;
      n[p.kind] = (n[p.kind] ?? 0) + 1;
      ys += p.y;
    }
    expect(n.ruin!).toBeGreaterThan(n.wall!);
    expect(n.ruin!).toBeGreaterThan(n.ledge!);
    const mean = thrushPerches(w).reduce((a, p) => a + p.y, 0) / thrushPerches(w).length;
    expect(ys / 2000).toBeLessThan(mean);
  });

  it('a held perch is not picked; drop spots lie below, on the same plane', () => {
    const w = coastSim().world;
    const arch = w.perches.find((p) => p.id === 'architrave')!;
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) expect(choosePerch(w, rng, [{ x: arch.x, y: arch.y }])).not.toBe(arch);
    for (let i = 0; i < 50; i++) {
      const d = dropSpot(w, { x: arch.x, y: arch.y }, arch.scale!, rng)!;
      expect(d.at.y).toBeGreaterThan(arch.y);
      expect(Math.abs(d.scale - arch.scale!)).toBeLessThan(arch.scale! * 0.6);
    }
  });

  it('lives only where there are ruins (not in the oasis)', () => {
    const sim = new FaunaSim({ scene: OASIS.geometry, seed: 1, habitat: OASIS.fauna, auto: false });
    expect(rockThrush.needs!(sim.world)).toBe(false);
  });
});

describe('a day on the stone', () => {
  it('flies in, perches with feet on the stone, sings, flicks its tail, drops and flies back to the same perch', () => {
    const sim = coastSim(5);
    const [t] = sim.spawn('rock-thrush') as RockThrush[];
    expect(t!.doing()).toBe('fly');
    const seen = new Set<string>();
    const acts = new Set<string>();
    let dropFrom: string | null = null;
    let returnedTo = 0;
    for (let s = 0; s < 600 && !t!.done; s += 0.1) {
      sim.update(0.1, 0);
      seen.add(t!.doing());
      const a = t!.acting();
      if (a) acts.add(a);
      if (t!.doing() === 'drop' && !dropFrom) dropFrom = (t as unknown as { home: { id: string } }).home.id;
      if (t!.doing() === 'perch' && t!.perch) {
        expect(t!.y).toBeCloseTo(perchY(t!.perch, t!.x), 5);
        expect(t!.layer).toBe('entities');
        if (dropFrom && t!.returns > returnedTo) {
          expect(t!.perch.id).toBe(dropFrom);
          returnedTo = t!.returns;
          dropFrom = null;
        }
      }
    }
    for (const m of ['fly', 'perch', 'drop', 'ground', 'return']) expect(seen, m).toContain(m);
    for (const a of ['sing', 'flick']) expect(acts, a).toContain(a);
    expect(t!.drops).toBeGreaterThan(0);
    expect(t!.returns).toBeGreaterThan(0);
  });

  it('only one at a time', () => {
    const sim = coastSim(2);
    sim.spawn('rock-thrush');
    sim.spawn('rock-thrush');
    expect(thrushes(sim)).toHaveLength(1);
  });

  it('slips away low when the cat comes near, and is gone', () => {
    const sim = coastSim(6);
    const [t] = sim.spawn('rock-thrush') as RockThrush[];
    for (let i = 0; i < 400 && t!.doing() !== 'perch'; i++) sim.update(0.1, 0);
    expect(t!.doing()).toBe('perch');
    const [cat] = sim.spawn('cat');
    cat!.x = t!.x + 30;
    cat!.y = t!.y + 10;
    const y0 = t!.y;
    sim.update(0.05, 0);
    expect(t!.doing()).toBe('flee');
    expect(t!.alarms).toBe(1);
    let maxY = y0;
    for (let i = 0; i < 400 && !t!.done; i++) {
      sim.update(0.05, 0);
      cat!.x = t!.x + 300;
      maxY = Math.max(maxY, t!.y);
    }
    expect(maxY).toBeGreaterThan(y0);
    expect(t!.done).toBe(true);
  });

  it('by day only: it leaves at nightfall and does not come at night', () => {
    const sim = coastSim(8);
    const [t] = sim.spawn('rock-thrush') as RockThrush[];
    for (let i = 0; i < 300; i++) sim.update(0.1, 0);
    sim.hourOverride = 23;
    for (let i = 0; i < 600 && !t!.done; i++) sim.update(0.1, 0);
    expect(t!.done).toBe(true);
    expect(rockThrush.visit!.diurnal).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const trace = () => {
      const sim = coastSim(9);
      const [t] = sim.spawn('rock-thrush') as RockThrush[];
      const out: string[] = [];
      for (let i = 0; i < 1500; i++) {
        sim.update(0.1, 0);
        if (i % 50 === 0) out.push(`${t!.doing()}:${t!.x.toFixed(2)}:${t!.y.toFixed(2)}`);
      }
      return out.join('|');
    };
    expect(trace()).toBe(trace());
  });

  it('the song opens the bill in pulses', () => {
    const bills = new Set(Array.from({ length: 30 }, (_, i) => songPose(i / 30).bill));
    expect(bills).toEqual(new Set([0, 1, 2]));
  });
});
