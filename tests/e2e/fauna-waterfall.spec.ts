import type { Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/**
 * Wildlife at the waterfall (ADR 0248). The creatures come from the scenery's own table: the test
 * spawns whatever `sprout.fauna.roster()` says is there, so creatures added later are covered too.
 */

/** `n` finished plants in the waterfall's garden, on unique (fake) slots. */
async function plantWaterfall(page: Page, n: number) {
  await page.evaluate((count) => {
    const plants = Array.from({ length: count }, (_, i) => ({
      id: `falls-test-${i}`,
      speciesId: 'white-clover',
      sceneryId: 'waterfall' as const,
      slotId: `falls-test-slot-${i}`,
      seed: 200 + i,
      plantedAt: 0,
      sessionMinutes: 25,
      taskName: 'Fauna test',
      completedAt: 1,
    }));
    window.sprout!.setState({ plants });
  }, n);
}

async function openWaterfall(page: Page) {
  await openDev(page, 'scenery=waterfall');
  await page.evaluate(() => window.sprout!.showScenery('waterfall'));
  expect(await page.evaluate(() => window.sprout!.scenery().viewed)).toBe('waterfall');
}

test.describe('fauna · the waterfall', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1440, height: 900 }));

  test('a new waterfall garden has striders at the pool’s edge; its table drives the roster', async ({ page }) => {
    await openWaterfall(page);
    await page.evaluate(() => {
      window.sprout!.fauna.clear();
      window.sprout!.fauna.step(1);
    });
    const roster = await page.evaluate(() => window.sprout!.fauna.roster());
    expect(roster.scenery).toBe('waterfall');
    expect(roster.ids).toEqual(expect.arrayContaining(['striders', 'dipper', 'leaf']));
    expect(roster.residents).toMatchObject({ strider: 1 });
    expect(roster.variants).toMatchObject({ strider: ['margin'], leaf: ['maple'] });
    const water = await page.evaluate(() => window.sprout!.fauna.water());
    expect(water.moving).toHaveLength(1);
    expect(water.clip).toHaveLength(2);
    const striders = (await page.evaluate(() => window.sprout!.fauna.list())).filter((c) => c.kind === 'strider');
    expect(striders.length).toBeGreaterThan(0);
    for (const s of striders) expect(s.variant).toBe('margin');
  });

  test('every creature on the roster can be spawned; nothing enters the foam or the stream, striders keep to the edge', async ({ page }) => {
    await openWaterfall(page);
    await page.evaluate(() => window.sprout!.freeze());
    await plantWaterfall(page, 25);
    const roster = await page.evaluate(() => window.sprout!.fauna.roster());
    // the shared kinds come with the waterfall's table (more as their modules are painted)
    expect(roster.kinds).toEqual(expect.arrayContaining(['strider', 'leaf', 'dragonfly', 'bird', 'heron']));
    expect(roster.kinds).not.toContain('koi');
    expect(roster.kinds).not.toContain('swallow');
    expect(roster.kinds).not.toContain('frog');
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
      const variants: Record<string, string[]> = {};
      for (let s = 0; s < 60; s++) {
        for (const c of f.list()) {
          seen.add(c.kind);
          if (c.variant) variants[c.kind] = [...new Set([...(variants[c.kind] ?? []), c.variant])];
          const out = c.x < v.x - 400 || c.x > v.x + v.w + 400 || c.y < v.y - 400 || c.y > v.y + v.h + 200;
          if (out || !Number.isFinite(c.x) || !Number.isFinite(c.y)) bad.push(`${c.kind}#${c.id} out at ${c.x | 0},${c.y | 0}`);
          const onWater = c.kind === 'strider' || (c.kind === 'leaf' && c.layer === 'waterSurface');
          if (onWater && !c.inPond) bad.push(`${c.kind}#${c.id} off the still water (foam or stream) at ${c.x | 0},${c.y | 0}`);
          if (onWater && inside(c, water.moving[0]!) && !inside(c, water.clip[0]!)) bad.push(`${c.kind}#${c.id} in the stream`);
          if (c.kind === 'strider' && c.edge > 110) bad.push(`strider#${c.id} ${c.edge | 0} from the edge`);
        }
        f.step(2);
      }
      return { spawned, bad, seen: [...seen], variants };
    }, roster.kinds);
    expect(result.bad).toEqual([]);
    for (const k of roster.kinds) expect(result.spawned[k], k).toBeGreaterThan(0);
    for (const k of roster.kinds) expect(result.seen, k).toContain(k);
    // shared creatures in their gorge forms
    expect(result.variants).toMatchObject({ dragonfly: ['aka'], bird: ['wagtail'], leaf: ['maple'] });
  });

  test('perches are the ledges and wet rocks; the heron wades clear of the falls', async ({ page }) => {
    await openWaterfall(page);
    await plantWaterfall(page, 20);
    const targets = await page.evaluate(() => window.sprout!.fauna.targets());
    // six ledge edges high on the cliff and four wet rocks, no trail stones
    expect(targets.perches).toHaveLength(10);
    expect(targets.perches.filter((p) => p.y < 580)).toHaveLength(6);
    expect(targets.stands.length).toBeGreaterThan(0);
    for (const s of targets.stands) expect(s.x).toBeGreaterThan(780);
  });

  test('a busy pool renders cleanly and stays cheap', async ({ page }) => {
    await openWaterfall(page);
    await plantWaterfall(page, 25);
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
    expect(bench.creatures).toBeGreaterThanOrEqual(5);
    // generous for CI; the documented budget is 1.5 ms on a laptop
    expect(bench.total).toBeLessThan(8);
    await page.evaluate(() => window.sprout!.freeze());
    expect((await canvasStats(page)).distinctColours).toBeGreaterThan(2);
  });
});
