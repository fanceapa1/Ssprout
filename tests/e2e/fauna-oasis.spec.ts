import type { Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/**
 * Wildlife at the oasis (ADR 0304). The creatures come from the scenery's own table: the test
 * spawns whatever `sprout.fauna.roster()` says is there, so creatures painted later are covered too.
 */

/** `n` finished plants in the oasis's garden, on unique (fake) slots. */
async function plantOasis(page: Page, n: number) {
  await page.evaluate((count) => {
    const plants = Array.from({ length: count }, (_, i) => ({
      id: `oasis-test-${i}`,
      speciesId: 'white-clover',
      sceneryId: 'oasis' as const,
      slotId: `oasis-test-slot-${i}`,
      seed: 300 + i,
      plantedAt: 0,
      sessionMinutes: 25,
      taskName: 'Fauna test',
      completedAt: 1,
    }));
    window.sprout!.setState({ plants });
  }, n);
}

async function openOasis(page: Page) {
  await openDev(page, 'scenery=oasis');
  await page.evaluate(() => window.sprout!.showScenery('oasis'));
  expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe('oasis');
}

test.describe('fauna · the oasis', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('a new oasis garden has striders on the basin and the bunting pair by day; its table drives the roster', async ({ page }) => {
    await openOasis(page);
    await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      f.step(2);
    });
    const roster = await page.evaluate(() => window.sprout!.fauna.roster());
    expect(roster.scenery).toBe('oasis');
    expect(roster.ids).toEqual(expect.arrayContaining(['striders', 'house-bunting', 'leaf']));
    expect(roster.residents).toMatchObject({ strider: 1, bunting: 1 });
    const list = await page.evaluate(() => window.sprout!.fauna.list());
    const buntings = list.filter((c) => c.kind === 'bunting');
    expect(buntings).toHaveLength(2);
    expect(new Set(buntings.map((b) => b.variant))).toEqual(new Set(['male', 'female']));
    // gone at night
    await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(23);
      f.step(90);
    });
    expect((await page.evaluate(() => window.sprout!.fauna.list())).filter((c) => c.kind === 'bunting')).toHaveLength(0);
  });

  test('every creature on the roster can be spawned and stays in the world; the bunting and the dove keep out of the basin', async ({ page }) => {
    await openOasis(page);
    await page.evaluate(() => window.sprout!.freeze());
    await plantOasis(page, 25);
    const roster = await page.evaluate(() => window.sprout!.fauna.roster());
    expect(roster.kinds).toEqual(expect.arrayContaining(['strider', 'leaf', 'bunting']));
    const result = await page.evaluate((kinds) => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      const spawned: Record<string, number> = {};
      for (const k of kinds) spawned[k] = f.spawn(k).length;
      const water = f.water();
      const inside = (p: { x: number; y: number }, poly: { x: number; y: number }[]) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i]!;
          const b = poly[j]!;
          if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
      };
      const v = f.view();
      const bad: string[] = [];
      const seen = new Set<string>();
      for (let s = 0; s < 60; s++) {
        for (const c of f.list()) {
          seen.add(c.kind);
          const out = c.x < v.x - 400 || c.x > v.x + v.w + 400 || c.y < v.y - 400 || c.y > v.y + v.h + 200;
          if (out || !Number.isFinite(c.x) || !Number.isFinite(c.y)) bad.push(`${c.kind}#${c.id} out at ${c.x | 0},${c.y | 0}`);
          if ((c.kind === 'bunting' || c.kind === 'dove') && c.layer === 'entities' && (inside(c, water.still) || water.moving.some((m) => inside(c, m)))) bad.push(`${c.kind}#${c.id} in the water at ${c.x | 0},${c.y | 0}`);
        }
        f.step(2);
      }
      return { spawned, bad, seen: [...seen] };
    }, roster.kinds);
    expect(result.bad).toEqual([]);
    for (const k of roster.kinds) expect(result.spawned[k], k).toBeGreaterThan(0);
    for (const k of roster.kinds) expect(result.seen, k).toContain(k);
  });

  test('the violet dropwing comes with three plants by day, perches by the water and sallies over it', async ({ page }) => {
    await openOasis(page);
    await page.evaluate(() => window.sprout!.freeze());
    await plantOasis(page, 3);
    const roster = await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      return f.roster();
    });
    expect(roster.ids).toContain('violet-dropwing');
    expect(roster.visitors).toContain('dropwing');
    const result = await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.clear();
      f.spawn('dropwing', 2);
      const v = f.view();
      const states = new Set<string>();
      const bad: string[] = [];
      for (let s = 0; s < 240; s++) {
        for (const c of f.list().filter((c) => c.kind === 'dropwing')) {
          states.add(c.state);
          if (c.state === 'perch' && c.layer !== 'entities') bad.push(`perched on ${c.layer}`);
          if (c.state === 'perch' && c.inPond) bad.push(`perched in the basin at ${c.x | 0},${c.y | 0}`);
          if (c.state === 'perch' && (c.x < v.x || c.x > v.x + v.w)) bad.push(`perched off the view at ${c.x | 0}`);
        }
        f.step(0.5);
      }
      f.setHour(23);
      f.step(60);
      return { states: [...states], bad, night: f.list().filter((c) => c.kind === 'dropwing').length };
    });
    expect(result.bad).toEqual([]);
    expect(result.states).toEqual(expect.arrayContaining(['perch', 'fly']));
    expect(result.night).toBe(0);
  });

  test('a busy oasis renders cleanly and stays cheap', async ({ page }) => {
    await openOasis(page);
    await plantOasis(page, 25);
    const bench = await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      f.step(0.5);
      for (const k of f.roster().kinds) f.spawn(k);
      f.step(8);
      f.bench(60);
      return f.bench(60);
    });
    expect(bench.creatures).toBeGreaterThanOrEqual(4);
    // generous for CI; the documented budget is 1.5 ms on a laptop
    expect(bench.total).toBeLessThan(8);
    await page.evaluate(() => window.sprout!.freeze());
    expect((await canvasStats(page)).distinctColours).toBeGreaterThan(2);
  });
});
