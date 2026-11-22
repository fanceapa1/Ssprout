/**
 * The coast's water in motion (G6, ADRs 0282, 0374): a pure function of the animation time, every
 * mark inside its water, nothing under reduced motion, skipped off screen, a bounded frame, and the
 * caique's pose small, continuous and carried to its perches.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { pinnedState, type DaylightState, type DayPhase } from '../../ambience/daylight';
import { moonDisc, sunDisc } from '../../ambience/sky-layout';
import { carried } from '../../fauna/targets';
import { bounds, pointInPolygon } from '../../paint';
import type { Pt } from '../../render/viewport';
import { PaintRecorder } from '../../scene/paint-record';
import { COAST } from '.';
import { POOL_WATER, SEA_WATER } from './geometry';
import { CAIQUE, COAST_SKY_LAYOUT, HORIZON } from './layout';
import { createCoastMotion, MOTION_BOUNDS, PLATE_RECT, WET_ROCKS, type CoastMotion } from './motion';
import { CAIQUE_DEPTH, CAIQUE_SWING, caiquePose, posePoint } from './pose';
import { CAIQUE_BOX, CAIQUE_SHAPES, shallowsEdge, shoreward } from './sea';
import { foamY, swashLimit, swellAt } from './swell';
import { COAST_CARRIERS, COAST_WILDLIFE } from './wildlife';

/** A context that logs each blit with its alpha, composite, transform and world area, and each clip. */
function fakeCtx(transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) {
  const log: string[] = [];
  let clips = 0;
  let area = 0;
  let m = { ...transform };
  const stack: (typeof m)[] = [];
  const r = (x: number) => x.toFixed(3);
  const noop = () => {};
  const ctx = {
    canvas: { width: 1600, height: 1000 },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    lineWidth: 1,
    getTransform: () => ({ ...m }),
    save: () => stack.push({ ...m }),
    restore: () => (m = stack.pop() ?? m),
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      m = { a: m.a * a + m.c * b, b: m.b * a + m.d * b, c: m.a * c + m.c * d, d: m.b * c + m.d * d, e: m.a * e + m.c * f + m.e, f: m.b * e + m.d * f + m.f };
    },
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      m = { a, b, c, d, e, f };
    },
    fillStyle: null as unknown,
    createPattern: () => ({ setTransform: (q: Record<string, number>) => log.push(`pattern [${['a', 'c', 'd', 'e', 'f'].map((k) => r(q[k]!)).join(',')}]`) }),
    fillRect: (...n: number[]) => {
      area += Math.abs(n[2]! * n[3]!) * 0;
      log.push(`fill ${r(ctx.globalAlpha)} ${n.map(r).join(',')}`);
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    closePath: noop,
    stroke: () => log.push(`stroke ${r(ctx.globalAlpha)}`),
    clip: () => clips++,
    drawImage: (_img: unknown, ...n: number[]) => {
      area += Math.abs(n[2]! * n[3]!);
      log.push(`${r(ctx.globalAlpha)} ${ctx.globalCompositeOperation} [${[m.a, m.b, m.c, m.e, m.f].map(r)}] ${n.map(r).join(',')}`);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log, stats: () => ({ clips, area }) };
}

const drawn = (m: CoastMotion, t: number, transform?: Parameters<typeof fakeCtx>[0], light?: DaylightState) => {
  const { ctx, log } = fakeCtx(transform);
  m.under?.(ctx, t);
  m.draw(ctx, t, light);
  return log;
};
const at = (phase: DayPhase) => pinnedState({ sunrise: 0, midday: 0, sunset: 0, night: 0, [phase]: 1 });

function prepared(opts: Parameters<typeof createCoastMotion>[0]) {
  const rec = new PaintRecorder({ hash: false });
  const uninstall = rec.install();
  try {
    const m = createCoastMotion(opts);
    let parts = 0;
    let worst = 0;
    const it = m.prepare();
    for (;;) {
      rec.mark();
      if (it.next().done) break;
      parts++;
      worst = Math.max(worst, rec.mark().calls);
    }
    return { m, parts, worst };
  } finally {
    uninstall();
  }
}

const SHALLOWS = shoreward(shallowsEdge());
const near = (q: Pt, shape: readonly Pt[], d: number) =>
  pointInPolygon(q, shape) || [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dx, dy]) => pointInPolygon({ x: q.x + dx!, y: q.y + dy! }, shape));

/** blits a frame at most: the crests' pieces are most of them (GS1) */
const BLITS = 300;

describe('the coast’s water in motion (G6)', () => {
  let a: ReturnType<typeof prepared>;
  let b: ReturnType<typeof prepared>;
  beforeAll(async () => {
    await COAST.painters.load();
    a = prepared({ seed: 15 });
    b = prepared({ seed: 15 });
  }, 60_000);

  it('is the coast scenery’s motion, and the generic water surface is off its sea', async () => {
    expect(COAST.motion).toBeTypeOf('function');
    expect(COAST.pondSurface).toBe(0);
  });

  it('paints its sprites once, in small parts, and is ready after', () => {
    expect(a.m.ready).toBe(true);
    expect(a.parts).toBeGreaterThan(60);
    expect(a.worst).toBeLessThanOrEqual(130_000);
    expect(a.m.sprites().length).toBeGreaterThanOrEqual(40);
  });

  it('is a pure function of the animation time and the light', () => {
    for (const t of [0, 0.4, 3.7, 61.25, 3600.5]) expect(drawn(a.m, t)).toEqual(drawn(b.m, t));
    expect(drawn(a.m, 12.5)).toEqual(drawn(a.m, 12.5));
    for (const p of ['sunrise', 'sunset', 'night'] as const) expect(drawn(a.m, 77.7, undefined, at(p))).toEqual(drawn(b.m, 77.7, undefined, at(p)));
  });

  it('holds still while frozen and moves when time runs, without repeating', () => {
    const frozen = drawn(a.m, 40);
    expect(drawn(a.m, 40)).toEqual(frozen);
    expect(drawn(a.m, 40.1)).not.toEqual(frozen);
    expect(drawn(a.m, 10)).not.toEqual(drawn(a.m, 10 + 60));
  });

  it('always has swell crests, caustics, foam at the rocks and wavelets on the beach; breakers, glints, rings and pool rings come and go', () => {
    const sum = { glint: 0, ring: 0, pool: 0, breaker: 0, swirl: 0 };
    let n = 0;
    for (let t = 0; t < 240; t += 0.37) {
      const v = a.m.visibleAt(t);
      expect(v.crest, `t ${t}`).toBeGreaterThanOrEqual(25);
      expect(v.swell, `t ${t}`).toBeGreaterThanOrEqual(5);
      expect(v.caustic, `t ${t}`).toBe(1);
      expect(v.foam, `t ${t}`).toBe(WET_ROCKS.length);
      expect(v.wavelet, `t ${t}`).toBe(9);
      expect(v.boat).toBe(1);
      sum.glint += v.glint;
      sum.ring += v.ring;
      sum.pool += v.pool;
      sum.breaker += v.breaker;
      sum.swirl += v.swirl;
      n++;
    }
    // a lip forms on some reach about a quarter of the time; each crest rings every rock for a while
    expect(sum.breaker / n).toBeGreaterThan(1);
    expect(sum.breaker / n).toBeLessThan(5);
    expect(sum.swirl / n).toBeGreaterThan(1);
    expect(sum.glint / n).toBeGreaterThan(2);
    expect(sum.ring / n).toBeGreaterThan(0.1);
    expect(sum.ring / n).toBeLessThan(1);
    // a pool ring is rare: at most one on the go, and the pools are still most of the time
    expect(sum.pool / n).toBeLessThan(0.6);
    expect(sum.pool).toBeGreaterThan(0);
  });

  it('draws every mark inside its water, never on rock or the boat', () => {
    const pools = POOL_WATER;
    for (let t = 0; t < 90; t += 0.53) {
      for (const k of a.m.marksAt(t)) {
        const q = { x: k.x, y: k.y };
        const at = `${k.element} ${k.index} at ${t}: ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        if (k.element === 'swell' || k.element === 'glint') {
          expect(near(q, SEA_WATER, 3), at).toBe(true);
          expect(WET_ROCKS.some((r) => pointInPolygon(q, r.outline)), at).toBe(false);
          expect(Math.abs(q.x - CAIQUE.x) < 40 && q.y > CAIQUE.y - 20 && q.y < CAIQUE.y, at).toBe(false);
        } else if (k.element === 'crest') {
          expect(near(q, SEA_WATER, 4), at).toBe(true);
          expect(q.y, at).toBeGreaterThan(HORIZON);
        } else if (k.element === 'caustic') expect(pointInPolygon(q, SHALLOWS) && pointInPolygon(q, SEA_WATER), at).toBe(true);
        else if (k.element === 'breaker') {
          expect(q.y - foamY(q.x), at).toBeGreaterThanOrEqual(-14);
          expect(q.y - foamY(q.x), at).toBeLessThanOrEqual(0.5);
        } else if (k.element === 'wavelet') {
          // the shore wave never climbs past its line
          expect(q.y - foamY(q.x), at).toBeGreaterThanOrEqual(-0.5);
          expect(q.y - foamY(q.x), at).toBeLessThanOrEqual(swashLimit(q.x) + 0.5);
        } else if (k.element === 'swirl') expect(near(q, SEA_WATER, 4), at).toBe(true);
        else if (k.element === 'pool') expect(pointInPolygon(q, pools[k.index]!), at).toBe(true);
        else if (k.element === 'ring') expect(near(q, SEA_WATER, 1), at).toBe(true);
        else if (k.element === 'lap') expect(near(q, SEA_WATER, 4), at).toBe(true);
        else if (k.element === 'foam') expect(near({ x: q.x, y: q.y + 3 }, SEA_WATER, 4), at).toBe(true);
      }
    }
  });

  it('rocks the caique a little, smoothly, and keeps it on its plate', () => {
    let prev = caiquePose(0, { dx: 0, dy: 0, angle: 0 });
    let moved = 0;
    for (let t = 0.05; t < 300; t += 0.05) {
      const p = caiquePose(t);
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(CAIQUE_SWING.dx);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(CAIQUE_SWING.dy);
      expect(Math.abs(p.angle)).toBeLessThanOrEqual(CAIQUE_SWING.angle);
      // continuous: no jump between frames
      expect(Math.abs(p.dy - prev.dy)).toBeLessThan(0.08);
      expect(Math.abs(p.angle - prev.angle)).toBeLessThan(0.003);
      moved = Math.max(moved, Math.abs(p.dy));
      prev = p;
    }
    expect(moved).toBeGreaterThan(0.8);
    expect(CAIQUE_SWING.angle).toBeLessThan((2.5 * Math.PI) / 180);
    // the mast's top swings within the plate that hides the painted boat
    const top = CAIQUE_SHAPES.mast[1];
    for (const t of [0, 1.3, 2.9, 7.1]) {
      const q = posePoint(top, caiquePose(t));
      expect(q.x).toBeGreaterThan(CAIQUE_BOX.x);
      expect(q.y).toBeGreaterThan(PLATE_RECT.y);
    }
  });

  it('writes the boat’s pose into its carrier each frame, so a perch on the mast follows it', () => {
    const mast = COAST_WILDLIFE.perches!.find((p) => p.carrier === 'caique' && p.y < CAIQUE.y - 30)!;
    expect(mast).toBeDefined();
    const c = COAST_CARRIERS.caique!;
    try {
      for (const t of [3.2, 9.75]) {
        a.m.draw(fakeCtx().ctx, t);
        const want = posePoint(mast, caiquePose(t));
        const got = carried(mast, c);
        expect(got.x).toBeCloseTo(want.x, 6);
        expect(got.y).toBeCloseTo(want.y, 6);
      }
      expect(Math.hypot(carried(mast, c).x - mast.x, carried(mast, c).y - mast.y)).toBeGreaterThan(0.05);
    } finally {
      c.pose.dx = c.pose.dy = c.pose.angle = 0;
    }
  });

  it('draws nothing under reduced motion: the still painting stays, the boat and its perches at rest', () => {
    const { m } = prepared({ seed: 15, still: true });
    expect(m.ready).toBe(false);
    for (const t of [0, 5, 50]) expect(drawn(m, t)).toEqual([]);
    expect(COAST_CARRIERS.caique!.pose).toEqual({ dx: 0, dy: 0, angle: 0 });
  });

  it('draws nothing when the view misses the water, and only what it sees', () => {
    // a view of the olive on the top terrace
    expect(drawn(a.m, 10, { a: 4, b: 0, c: 0, d: 4, e: -1200 * 4, f: -300 * 4 })).toEqual([]);
    const all = drawn(a.m, 10).length;
    // a close view of the pools alone
    const pools = drawn(a.m, 10, { a: 6, b: 0, c: 0, d: 6, e: -180 * 6, f: -870 * 6 }).length;
    expect(pools).toBeLessThan(all / 4);
    expect(MOTION_BOUNDS.x + MOTION_BOUNDS.w).toBeLessThan(1100);
  });

  it('costs a bounded number of small blits a frame', () => {
    let worst = 0;
    let worstArea = 0;
    let worstClips = 0;
    for (let t = 0; t < 60; t += 0.29) {
      const { ctx, log, stats } = fakeCtx();
      a.m.under?.(ctx, t);
      a.m.draw(ctx, t, at(t % 2 < 1 ? 'sunset' : 'night'));
      worst = Math.max(worst, log.length);
      worstArea = Math.max(worstArea, stats().area);
      worstClips = Math.max(worstClips, stats().clips);
    }
    expect(worst).toBeLessThanOrEqual(BLITS);
    // world units²: under a quarter of the 1600 × 1000 painting, mostly the crests' and the waterline's thin, clear sprites
    expect(worstArea).toBeLessThan(400_000);
    expect(worstClips).toBeLessThanOrEqual(7);
    expect(bounds(SEA_WATER).w).toBeGreaterThan(0);
  });

  it('lays its glints on a road under the low sun and the moon, and scatters a few at noon', () => {
    const glints = (p: DayPhase) => {
      const out: Pt[] = [];
      for (let t = 0; t < 120; t += 0.21) out.push(...a.m.marksAt(t, at(p)).filter((k) => k.element === 'glint'));
      return out;
    };
    const noon = glints('midday');
    const sunset = glints('sunset');
    const night = glints('night');
    expect(sunset.length).toBeGreaterThan(2.5 * noon.length);
    expect(noon.length).toBeGreaterThan(20);
    const sx = sunDisc(at('sunset'), COAST_SKY_LAYOUT).x;
    const mx = moonDisc(at('night'), COAST_SKY_LAYOUT).x;
    const onRoad = (g: Pt[], x: number) => g.filter((q) => Math.abs(q.x - x) < 10 + 100 * Math.max(0, (q.y - HORIZON) / 350)).length / g.length;
    expect(onRoad(sunset, sx)).toBeGreaterThan(0.95);
    expect(onRoad(night, mx)).toBeGreaterThan(0.95);
    expect(onRoad(noon, sx)).toBeLessThan(0.6);
    // the road is dense far out under the sun and widens toward the beach
    expect(sunset.filter((q) => q.y < HORIZON + 60).length).toBeGreaterThan(sunset.length / 3);
  });

  it('breaks each crest on the beach in turn: a lip out on the water, a run up, the draw back', () => {
    const ups = Array.from({ length: 9 }, () => [] as number[]);
    for (let t = 0; t < 120; t += 0.1) {
      for (const k of a.m.marksAt(t)) if (k.element === 'wavelet') ups[k.index]!.push(k.y - foamY(k.x));
    }
    for (const run of ups) {
      // up past half its reach every crest, and back down to the waterline between them
      const top = Math.max(...run);
      expect(top).toBeGreaterThan(5);
      let crests = 0;
      for (let i = 1; i < run.length; i++) if (run[i - 1]! < top / 2 && run[i]! >= top / 2) crests++;
      expect(crests).toBeGreaterThanOrEqual(9);
      expect(crests).toBeLessThanOrEqual(15);
      expect(Math.min(...run)).toBeLessThan(0.5);
    }
  });

  it('heaves the caique with the swell that passes it', () => {
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let t = 0; t < 400; t += 0.25) {
      const lift = swellAt(CAIQUE_DEPTH, CAIQUE.x, t).lift;
      const dy = caiquePose(t).dy;
      sxy += -lift * dy;
      sxx += lift * lift;
      syy += dy * dy;
    }
    expect(sxy / Math.sqrt(sxx * syy)).toBeGreaterThan(0.6);
  });
});
