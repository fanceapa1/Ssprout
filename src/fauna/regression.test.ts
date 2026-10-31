import { describe, expect, it } from 'vitest';
import { FAUNA_UNLOCKS } from '../core/fauna-unlocks';
import { hashString } from '../core/rng';
import type { PlantInstance } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { FaunaSim } from './sim';
import type { TargetSpecies } from './targets';

const flower: TargetSpecies = { pollinators: true, habitats: ['meadow', 'path', 'rock', 'shore', 'back'], size: { w: 60, h: 90 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#e8a7a9' };
const lily: TargetSpecies = { pollinators: false, habitats: ['water'], size: { w: 60, h: 30 }, anchor: { x: 0.5, y: 0.6 }, bloomColor: '#faf6ee' };
const lookup = (id: string) => (id === 'lily' ? lily : flower);
const plants: PlantInstance[] = gardenScene.slots.map((s, i) => ({
  id: `p${i}`, speciesId: s.habitat === 'water' ? 'lily' : 'flower', sceneryId: 'japanese-garden', slotId: s.id, seed: i + 1, plantedAt: 0, sessionMinutes: 25, taskName: 't', completedAt: 1,
}));

function fingerprint(seed: number, seconds: number, opts: { reduced?: boolean; hour?: number; ids?: string[] } = {}): string {
  const sim = new FaunaSim({ scene: gardenScene, seed, reducedMotion: opts.reduced });
  sim.setGarden(plants, opts.ids ?? FAUNA_UNLOCKS.map((f) => f.id), lookup);
  sim.hourOverride = opts.hour ?? 12;
  const marks: string[] = [];
  for (let i = 0; i * 0.1 < seconds; i++) {
    sim.update(0.1, 0);
    if (i % 300 === 0) marks.push(JSON.stringify(sim.list().map((c) => [c.id, c.kind, c.x.toFixed(3), c.y.toFixed(3), c.layer, c.state])));
  }
  return `${hashString(marks.join('|')).toString(16)}:${sim.creatures.length}`;
}

/** Hashes of the creatures' positions and states, taken before the creature registry (ADR 0248). */
describe('Japanese garden regression', () => {
  it('the same table and seeds give the same garden as before wildlife went per scenery', () => {
    const out = [fingerprint(7, 900), fingerprint(3, 600, { reduced: true }), fingerprint(11, 600, { hour: 23 }), fingerprint(5, 300, { ids: ['striders', 'dragonfly', 'koi-1'] })];
    expect(out).toEqual(['312b82a4:11', 'cc5b6199:6', '4123856:7', '95ae85e7:6']);
  }, 60_000);
});
