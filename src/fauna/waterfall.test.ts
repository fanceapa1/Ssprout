import { describe, expect, it } from 'vitest';
import type { PlantInstance } from '../core/state';
import { perspectiveScale } from '../scene/slots';
import { FOAM, WATERFALL_FAUNA, WATERFALL_WILDLIFE, waterfallPerspective } from '../scenery/waterfall/fauna';
import { FALLS, POOL, STREAM, waterfallScene } from '../scenery/waterfall/geometry';
import { LEDGES } from '../scenery/waterfall/layout';
import { carveEllipse, closestOnPolygon, clockwise, pointInPolygon, signedArea, toPlane } from './math';
import { FaunaSim } from './sim';
import { perspectiveFit, type TargetSpecies } from './targets';

/** well inside the foam (points on its rim are the still water's edge) */
const inFoam = (p: { x: number; y: number }) => ((p.x - FOAM.x) / FOAM.rx) ** 2 + ((p.y - FOAM.y) / FOAM.ry) ** 2 < 0.97;
const flower: TargetSpecies = { pollinators: true, habitats: ['meadow', 'shore', 'rock', 'back', 'path'], size: { w: 60, h: 90 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#e8a7a9' };
const plants: PlantInstance[] = waterfallScene.slots
  .filter((s) => s.habitat !== 'water')
  .map((s, i) => ({ id: `w${i}`, speciesId: 'flower', sceneryId: 'waterfall', slotId: s.id, seed: i + 1, plantedAt: 0, sessionMinutes: 25, taskName: 't', completedAt: 1 }));

function waterfallSim(seed = 4) {
  const sim = new FaunaSim({ scene: waterfallScene, seed, habitat: WATERFALL_WILDLIFE });
  sim.setGarden(plants, WATERFALL_FAUNA, () => flower);
  sim.hourOverride = 12;
  return sim;
}

describe('carving an ellipse out of a polygon edge', () => {
  it('bites the foam out of the pool’s back edge and keeps the rest', () => {
    const still = carveEllipse(POOL, FOAM);
    expect(still.some(inFoam)).toBe(false);
    expect(pointInPolygon({ x: FALLS.foot.x, y: FALLS.foot.y + 10 }, still)).toBe(false);
    expect(pointInPolygon({ x: 800, y: 690 }, still)).toBe(true);
    expect(pointInPolygon({ x: 500, y: 680 }, still)).toBe(true);
    const area = (p: typeof POOL) => Math.abs(signedArea(p));
    expect(area(still)).toBeLessThan(area(POOL));
    expect(area(still)).toBeGreaterThan(area(POOL) * 0.85);
  });

  it('leaves a polygon the ellipse misses alone, and winds polygons alike', () => {
    expect(carveEllipse(POOL, { x: 2000, y: 2000, rx: 10, ry: 10 })).toEqual(POOL);
    expect(Math.sign(signedArea(clockwise(STREAM)))).toBe(Math.sign(signedArea(clockwise(POOL))));
    expect(Math.sign(signedArea(clockwise([...POOL].reverse())))).toBe(Math.sign(signedArea(clockwise(POOL))));
  });
});

describe('the waterfall’s wildlife targets', () => {
  it('still water is the pool minus the foam; the layers clip to the pool and the stream', () => {
    const w = waterfallSim().world;
    expect(w.pond.world.some(inFoam)).toBe(false);
    expect(w.water.moving).toEqual([STREAM]);
    expect(w.water.clip).toHaveLength(2);
    const sign = Math.sign(signedArea(w.water.clip[0]!));
    expect(w.water.clip.every((p) => Math.sign(signedArea(p)) === sign)).toBe(true);
  });

  it('perches are the ledge edges and the wet rocks, not the trail stones', () => {
    const perches = waterfallSim().world.perches;
    expect(perches.filter((p) => p.kind === 'ledge')).toHaveLength(LEDGES.length);
    expect(perches.filter((p) => p.kind === 'rock').map((p) => p.id).sort()).toEqual(['rock-foot', 'rock-outflow', 'rock-pool-left', 'rock-stream']);
    expect(perches.some((p) => p.kind === 'stone')).toBe(false);
    for (const p of perches.filter((q) => q.kind === 'ledge')) expect(p.depth).toBeLessThan(600);
  });

  it('heron stands are in the pool, clear of the falls and the foam', () => {
    const stands = waterfallSim().heronStands();
    expect(stands.length).toBeGreaterThan(0);
    for (const s of stands) {
      expect(pointInPolygon(s, POOL)).toBe(true);
      expect(inFoam(s)).toBe(false);
      expect(Math.abs(s.x - FALLS.foot.x)).toBeGreaterThan(150);
    }
  });

  it('only the shared kinds with modules are scheduled; striders keep to the pool’s margin and nothing goes in the foam or the stream', () => {
    const sim = waterfallSim();
    const problems: string[] = [];
    const still = sim.world.pond.world;
    const plane = sim.world.pond.plane;
    for (let t = 0; t < 900; t += 0.1) {
      sim.update(0.1, 0);
      for (const c of sim.creatures) {
        if (c.kind !== 'strider' && c.kind !== 'leaf') continue;
        if (c.kind === 'leaf' && c.layer !== 'waterSurface') continue;
        if (!pointInPolygon(c, still)) problems.push(`${c.kind} out of still water at ${c.x | 0},${c.y | 0}`);
        if (inFoam(c)) problems.push(`${c.kind} in the foam`);
        if (pointInPolygon(c, STREAM) && !pointInPolygon(c, POOL)) problems.push(`${c.kind} in the stream`);
        if (c.kind === 'strider' && closestOnPolygon(toPlane(c, sim.world.pond.cy, sim.world.pond.squash), plane).d > 110) problems.push('strider far from the edge');
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(sim.creatures.filter((c) => c.kind === 'strider').every((c) => c.variant === 'margin')).toBe(true);
    expect(sim.creatures.some((c) => c.kind === 'koi' || c.kind === 'frog' || c.kind === 'swallow')).toBe(false);
  });

  it('shared visitors come in their gorge variants', () => {
    const sim = waterfallSim();
    const by = (kind: string) => sim.spawn(kind, { count: 2 }).map((c) => c.variant);
    expect(by('dragonfly')).toEqual(['aka']);
    expect(by('butterfly')).toEqual(['swallowtail', 'swallowtail']);
    expect(by('bird').every((v) => v === 'wagtail')).toBe(true);
    expect(by('leaf')).toEqual(['maple']);
  });
});

describe('the waterfall’s perspective', () => {
  it('is within 0.02 of every slot’s scale, ledges and crown included', () => {
    for (const s of waterfallScene.slots) expect(Math.abs(waterfallPerspective(s.x, s.y) - s.scale), s.id).toBeLessThanOrEqual(0.02);
  });

  it('is the ground’s outside the cliff; a line through the slots was not good enough', () => {
    for (const y of [620, 700, 850, 960]) expect(waterfallPerspective(1300, y)).toBe(perspectiveScale(y));
    const fit = perspectiveFit(waterfallScene.slots);
    const worst = Math.max(...waterfallScene.slots.map((s) => Math.abs(fit(s.y) - s.scale) / s.scale));
    expect(worst).toBeGreaterThan(0.05);
  });

  it('reaches the creatures through the world, with x', () => {
    const w = waterfallSim().world;
    const ledge = LEDGES[1]!;
    expect(w.perspective(ledge.edge[0].y + 2, ledge.edge[0].x + 20)).toBeCloseTo(ledge.scale, 1);
    expect(w.perspective(700, 1300)).toBe(perspectiveScale(700));
  });
});
