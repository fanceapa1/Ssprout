import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import type { PlantInstance } from '../../core/state';
import { createRng } from '../../core/rng';
import { COAST } from '../../scenery/coast';
import { COAST_FAUNA } from '../../scenery/coast/fauna';
import { OASIS } from '../../scenery/oasis';
import { FaunaSim } from '../sim';
import { perchY } from '../targets';
import scopsOwl, { callPose, choosePerch, flightFrame, HEAD_STEPS, headBlend, owlPerches, ScopsOwl, seatOf, shapeOf, SIT, tuftAt, TURN_MAX } from './scops-owl';

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

  it('takes the scenery’s tree perches as they are: its feet on the perch line, no seat of its own (ADR 0382)', () => {
    const w = coastSim().world;
    const ps = owlPerches(w);
    expect(ps.find((p) => p.id === 'olive-fork')).toBeDefined();
    expect(ps.some((p) => p.id.startsWith('pine-branch'))).toBe(true);
    for (const p of ps) expect(seatOf(p), p.id).toEqual({ x: 0, y: p.kind === 'wall' ? -1 : 0 });
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
        const seat = seatOf(o!.perch);
        expect(o!.y).toBeCloseTo(perchY(o!.perch, o!.x - seat.x) + seat.y, 5);
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

describe('its head turn and poses', () => {
  it('turns through in-between heads: the painted turn and the blend move on smoothly, no frame pops', () => {
    // the turn as drawn: the step under plus the share of the next laid over it
    const drawn = (t: number) => {
      const h = headBlend(t);
      expect(h.b).toBe(h.a + 1);
      expect(h.k).toBeGreaterThanOrEqual(0);
      expect(h.k).toBeLessThanOrEqual(1);
      return Math.sign(t) * (h.a + h.k);
    };
    let last = drawn(-1);
    expect(last).toBeCloseTo(-(HEAD_STEPS - 1), 6);
    for (let i = 1; i <= 400; i++) {
      const v = drawn(-1 + i / 200);
      expect(v - last).toBeGreaterThan(0);
      expect(v - last).toBeLessThan(0.04);
      last = v;
    }
    expect(last).toBeCloseTo(HEAD_STEPS - 1, 6);
    // the face-on head is never mirrored; a turn to −x mirrors the turned ones
    expect(headBlend(-0.05)).toMatchObject({ a: 0, flipA: false, flipB: true });
    expect(headBlend(0.05)).toMatchObject({ a: 0, flipA: false, flipB: false });
    expect(TURN_MAX).toBeGreaterThan(Math.PI / 2);
  });

  it('the ear tufts slide round the head as it turns and stand up as they rise', () => {
    const front = [tuftAt(-1, 0, 0), tuftAt(1, 0, 0)];
    expect(front[0]!.x).toBeCloseTo(-front[1]!.x, 6);
    for (let i = 1; i <= 50; i++) {
      const a = tuftAt(1, (TURN_MAX * (i - 1)) / 50, 0.5);
      const b = tuftAt(1, (TURN_MAX * i) / 50, 0.5);
      expect(Math.abs(b.x - a.x)).toBeLessThan(0.3);
    }
    expect(Math.abs(tuftAt(1, 0, 1).lean)).toBeLessThan(Math.abs(tuftAt(1, 0, 0).lean));
    expect(tuftAt(1, 0, 1).scale).toBeGreaterThan(tuftAt(1, 0, 0).scale);
  });

  it('relaxed is round with the tufts low, alert a little slimmer, tall all the way', () => {
    const sit = shapeOf(SIT);
    const alert = shapeOf({ ...SIT, alert: 1 });
    const tall = shapeOf({ ...SIT, tall: 1 });
    expect(sit.morph).toBe(0);
    expect(alert.morph).toBeGreaterThan(0.2);
    expect(alert.morph).toBeLessThan(0.5);
    expect(tall.morph).toBe(1);
    expect(sit.raise).toBeLessThan(alert.raise);
    expect(alert.raise).toBeLessThan(tall.raise);
  });

  it('flies mostly gliding, with a deep beat now and then', () => {
    const frames = Array.from({ length: 1400 }, (_, i) => flightFrame(i / 1000));
    const glide = frames.filter((f) => f === 'glide').length / frames.length;
    expect(glide).toBeGreaterThan(0.7);
    expect(frames).toContain('up');
    expect(frames).toContain('down');
  });

  it('is alert while it turns its head or calls, and settles back after', () => {
    const sim = coastSim(5);
    const [o] = sim.spawn('scops-owl') as ScopsOwl[];
    settle(sim, o!);
    let keen = 0;
    let calm = 0;
    for (let s = 0; s < 300 && o!.doing() === 'perch'; s += 0.1) {
      sim.update(0.1, 0);
      const q = o!.pose();
      if ((o!.acting() === 'call' || o!.acting() === 'turn') && q.alert > 0.5) keen++;
      if (o!.acting() === 'still' && q.alert === 0) calm++;
    }
    expect(keen).toBeGreaterThan(0);
    expect(calm).toBeGreaterThan(0);
  });
});
