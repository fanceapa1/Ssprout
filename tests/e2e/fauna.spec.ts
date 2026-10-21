import { canvasStats, expect, openDev, test } from './fixtures';
import type { Page } from '@playwright/test';

/** `n` finished plants on unique (fake) slots: enough to unlock every plant-count creature. */
async function plantGarden(page: Page, n: number) {
  await page.evaluate((count) => {
    const plants = Array.from({ length: count }, (_, i) => ({
      id: `fauna-test-${i}`,
      speciesId: 'placeholder-sprout',
      slotId: `fauna-test-slot-${i}`,
      seed: 100 + i,
      plantedAt: 0,
      sessionMinutes: 25,
      taskName: 'Fauna test',
      completedAt: 1,
    }));
    window.sprout!.setState({ plants });
  }, n);
}

/** Every creature within the world (generous margin for entering / leaving); pond dwellers in the pond. */
async function checkBounds(page: Page) {
  return page.evaluate(() => {
    const f = window.sprout!.fauna;
    const v = f.view();
    const bad: string[] = [];
    for (const c of f.list()) {
      const out = c.x < v.x - 400 || c.x > v.x + v.w + 400 || c.y < v.y - 400 || c.y > v.y + v.h + 200;
      if (out || !Number.isFinite(c.x) || !Number.isFinite(c.y)) bad.push(`${c.kind}#${c.id} at ${c.x.toFixed(0)},${c.y.toFixed(0)}`);
      if ((c.kind === 'koi' || c.kind === 'strider') && !c.inPond) bad.push(`${c.kind}#${c.id} left the pond`);
    }
    return bad;
  });
}

test.describe('fauna', () => {
  test('a new garden has water striders on the pond; koi arrive with plants', async ({ page }) => {
    await openDev(page);
    await page.evaluate(() => {
      window.sprout!.reset();
      window.sprout!.fauna.clear();
      window.sprout!.fauna.step(1);
    });
    let list = await page.evaluate(() => window.sprout!.fauna.list());
    const striders = list.filter((c) => c.kind === 'strider');
    expect(striders.length).toBeGreaterThan(0);
    expect(striders.every((s) => s.inPond && s.layer === 'waterSurface')).toBe(true);
    expect(list.some((c) => c.kind === 'koi')).toBe(false);

    await plantGarden(page, 3);
    await page.evaluate(() => window.sprout!.fauna.step(1));
    list = await page.evaluate(() => window.sprout!.fauna.list());
    const koi = list.filter((c) => c.kind === 'koi');
    expect(koi).toHaveLength(1);
    expect(koi[0]!.layer).toBe('underwater');
    expect(koi[0]!.inPond).toBe(true);
    expect(await page.evaluate(() => window.sprout!.fauna.roster())).toMatchObject({ koi: 1, striders: true });
  });

  test('the unlock table drives the roster; visits are scheduled, not immediate', async ({ page }) => {
    await openDev(page);
    await plantGarden(page, 25);
    await page.evaluate(() => {
      window.sprout!.fauna.clear();
      window.sprout!.fauna.step(0.5);
    });
    const roster = await page.evaluate(() => window.sprout!.fauna.roster());
    expect(roster.koi).toBe(3);
    // placeholder species attract no pollinators and grow no pads: no bees, butterflies or frog
    expect(roster.visitors.sort()).toEqual(['bird', 'dragonfly', 'heron', 'leaf', 'swallow']);
    const schedule = await page.evaluate(() => window.sprout!.fauna.schedule());
    expect(Object.keys(schedule).sort()).toEqual(['bird', 'dragonfly', 'heron', 'leaf', 'swallow']);
    for (const due of Object.values(schedule)) expect(due).toBeGreaterThan(5);
    const visitors = await page.evaluate(() => window.sprout!.fauna.list().filter((c) => c.visitor).length);
    expect(visitors).toBe(0);
  });

  test('every creature can be spawned and stays within bounds while it lives', async ({ page }) => {
    await openDev(page);
    await plantGarden(page, 25);
    const spawned = await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      const out: Record<string, number> = {};
      for (const k of ['dragonfly', 'butterflies', 'bees', 'small-birds', 'swallows', 'heron', 'leaf', 'frog']) out[k] = f.spawn(k).length;
      f.step(1);
      return out;
    });
    expect(spawned).toMatchObject({ dragonfly: 1, butterflies: 1, bees: 1, 'small-birds': 1, swallows: 3, heron: 1, leaf: 1 });
    expect(spawned.frog).toBe(0); // no water plant in the garden, so nowhere to sit
    const kinds = new Set<string>();
    for (let s = 0; s < 40; s++) {
      for (const c of await page.evaluate(() => window.sprout!.fauna.list())) kinds.add(c.kind);
      expect(await checkBounds(page)).toEqual([]);
      await page.evaluate(() => window.sprout!.fauna.step(2));
    }
    for (const k of ['koi', 'strider', 'dragonfly', 'butterfly', 'bee', 'bird', 'swallow', 'heron', 'leaf']) expect(kinds.has(k), k).toBe(true);
  });

  test('birds land on perches as depth-sorted entities, then fly away', async ({ page }) => {
    await openDev(page);
    await plantGarden(page, 8);
    await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(10);
      f.clear();
      f.spawn('bird');
    });
    const layers = new Set<string>();
    let landed = false;
    for (let s = 0; s < 70; s++) {
      const bird = await page.evaluate(() => window.sprout!.fauna.list().find((c) => c.kind === 'bird'));
      if (!bird) break;
      layers.add(bird.layer);
      if (bird.state === 'ground') landed = true;
      await page.evaluate(() => window.sprout!.fauna.step(1));
    }
    expect(landed).toBe(true);
    expect([...layers].sort()).toEqual(['air', 'entities']);
    expect(await page.evaluate(() => window.sprout!.fauna.list().some((c) => c.kind === 'bird'))).toBe(false);
  });

  test('at night birds, bees and butterflies rest while the koi stay', async ({ page }) => {
    await openDev(page);
    await plantGarden(page, 10);
    await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      f.step(0.5);
      f.spawn('bird');
      f.spawn('bee');
      f.spawn('butterfly');
      f.step(5);
      f.setHour(23);
      f.step(120);
    });
    const kinds = await page.evaluate(() => window.sprout!.fauna.list().map((c) => c.kind));
    expect(kinds).not.toContain('bird');
    expect(kinds).not.toContain('bee');
    expect(kinds).not.toContain('butterfly');
    expect(kinds).toContain('koi');
    expect(await page.evaluate(() => Object.keys(window.sprout!.fauna.schedule()))).toContain('bird');
  });

  test('a busy pond renders cleanly and the fauna stays cheap', async ({ page }) => {
    await openDev(page);
    await plantGarden(page, 25);
    const bench = await page.evaluate(() => {
      const f = window.sprout!.fauna;
      f.setHour(12);
      f.clear();
      f.step(0.5);
      for (const k of ['dragonfly', 'butterfly', 'bee', 'bee', 'bird', 'bird', 'swallows', 'heron', 'leaf']) f.spawn(k);
      f.step(8);
      return f.bench(60);
    });
    expect(bench.creatures).toBeGreaterThanOrEqual(12);
    // generous for CI; the documented budget is 1.5 ms on a laptop
    expect(bench.total).toBeLessThan(8);
    await page.evaluate(() => window.sprout!.freeze());
    const stats = await canvasStats(page);
    expect(stats.distinctColours).toBeGreaterThan(2);
  });
});
