import { describe, expect, it } from 'vitest';
import type { PlantInstance } from '../../core/state';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { dist } from '../math';
import { FaunaSim } from '../sim';
import birdDef, { Bird } from './bird';
import { Yamasemi } from './yamasemi';

const plants: PlantInstance[] = [];

describe('the wagtail at the waterfall', () => {
  it('never picks a perch the yamasemi holds', () => {
    const sim = new FaunaSim({ scene: waterfallScene, seed: 4, habitat: WATERFALL_WILDLIFE, auto: false });
    sim.setGarden(plants, [], () => undefined);
    sim.hourOverride = 12;
    const [k] = sim.spawn('yamasemi') as Yamasemi[];
    for (let i = 0; i < 600 && k!.state !== 'perch'; i++) sim.update(0.05, 0);
    expect(k!.state).toBe('perch');
    const held = k!.perch!;
    const pick = (n: number) => {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) {
        const [b] = birdDef.spawn(sim.world, { count: 1, index: 0, seed: 1, stay: 30, variants: ['wagtail'] }) as Bird[];
        if (!b) continue;
        ids.push(b.perch!.id);
        if (sim.creatures.includes(k!)) expect(dist(b.perch!, held)).toBeGreaterThanOrEqual(30);
      }
      return ids;
    };
    expect(pick(80)).not.toContain(held.id);
    // the rock is one a wagtail would otherwise choose
    sim.creatures.splice(sim.creatures.indexOf(k!), 1);
    expect(pick(80)).toContain(held.id);
  });
});
