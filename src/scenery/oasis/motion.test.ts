/**
 * The oasis's water in motion (O6, ADR 0282): a pure function of the animation time, every
 * element moving, every mark inside its water, nothing under reduced motion, skipped off screen,
 * sprites painted in small parts and a frame only a bounded number of small blits.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint';
import type { Pt } from '../../render/viewport';
import { PaintRecorder } from '../../scene/paint-record';
import { OASIS } from '.';
import { SEGUIA, SLUICE_WATER } from './geometry';
import { BAR_HEADS, createOasisMotion, FALLS, fallDropAt, INLET, MOTION_BOUNDS, type OasisMotion } from './motion';
import { OUED_BARS, WATER_SHAPES } from './paint-water';
import { SLUICE_GATE } from './shapes';

/** A context that logs each blit with its alpha, transform and world area, and each clip. */
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
    getTransform: () => ({ ...m }),
    save: () => stack.push({ ...m }),
    restore: () => (m = stack.pop() ?? m),
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      m = { a: m.a * a + m.c * b, b: m.b * a + m.d * b, c: m.a * c + m.c * d, d: m.b * c + m.d * d, e: m.a * e + m.c * f + m.e, f: m.b * e + m.d * f + m.f };
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    clip: () => clips++,
    drawImage: (_img: unknown, ...n: number[]) => {
      area += Math.abs(n[2]! * n[3]!);
      log.push(`${r(ctx.globalAlpha)} [${[m.a, m.c, m.e, m.f].map(r)}] ${n.map(r).join(',')}`);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log, stats: () => ({ clips, area }) };
}

const drawn = (m: OasisMotion, t: number, transform?: Parameters<typeof fakeCtx>[0]) => {
  const { ctx, log } = fakeCtx(transform);
  m.draw(ctx, t);
  return log;
};

function prepared(opts: Parameters<typeof createOasisMotion>[0]) {
  const rec = new PaintRecorder({ hash: false });
  const uninstall = rec.install();
  try {
    const m = createOasisMotion(opts);
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

const near = (q: Pt, shape: readonly Pt[], d: number) =>
  pointInPolygon(q, shape) || [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dx, dy]) => pointInPolygon({ x: q.x + dx!, y: q.y + dy! }, shape));

describe('the oasis’s water in motion (O6)', () => {
  let a: ReturnType<typeof prepared>;
  let b: ReturnType<typeof prepared>;
  beforeAll(() => {
    a = prepared({ seed: 13 });
    b = prepared({ seed: 13 });
  });

  it('is the oasis scenery’s motion', () => {
    expect(OASIS.motion).toBeTypeOf('function');
  });

  it('paints its sprites once, in small parts, and is ready after', () => {
    expect(a.m.ready).toBe(true);
    expect(a.parts).toBeGreaterThan(15);
    expect(a.worst).toBeLessThanOrEqual(130_000);
    expect(a.m.sprites().length).toBeGreaterThanOrEqual(18);
  });

  it('is a pure function of the animation time', () => {
    for (const t of [0, 0.4, 0.8, 3.7, 61.25, 3600.5]) expect(drawn(a.m, t)).toEqual(drawn(b.m, t));
    expect(drawn(a.m, 12.5)).toEqual(drawn(a.m, 12.5));
  });

  it('holds still while frozen and moves when time runs', () => {
    const frozen = drawn(a.m, 40);
    expect(drawn(a.m, 40)).toEqual(frozen);
    expect(drawn(a.m, 40.1)).not.toEqual(frozen);
  });

  it('always has water falling, a splash, the spill, rings and the oued moving, and passes differ', () => {
    const sum = { fall: 0, splash: 0, gate: 0, ring: 0, oued: 0 };
    let n = 0;
    for (let t = 0; t < 120; t += 0.37) {
      const v = a.m.visibleAt(t);
      expect(v.fall, `t ${t}`).toBeGreaterThanOrEqual(6);
      expect(v.splash, `t ${t}`).toBeGreaterThanOrEqual(4);
      expect(v.ring, `t ${t}`).toBeGreaterThanOrEqual(1);
      expect(v.oued, `t ${t}`).toBeGreaterThanOrEqual(12);
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += v[k];
      n++;
    }
    expect(sum.gate / n).toBeGreaterThan(2);
    expect(drawn(a.m, 10)).not.toEqual(drawn(a.m, 10 + 37));
  });

  it('draws every mark inside its water', () => {
    const splashZone = FALLS.map((f, i) => [...(i === 0 ? [SEGUIA[1]!] : []), f.sheet]);
    const gate = [SLUICE_GATE.cut, SLUICE_GATE.spill, SLUICE_WATER];
    for (let t = 0; t < 60; t += 0.53) {
      for (const k of a.m.marksAt(t)) {
        const q = { x: k.x, y: k.y };
        const at = `${k.element} ${k.index} at ${t}: ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        if (k.element === 'fall') expect(near(q, FALLS[k.index]!.sheet, 1), at).toBe(true);
        else if (k.element === 'splash') {
          const f = FALLS[k.index]!;
          expect(Math.abs(q.x - f.x) < 20 && Math.abs(q.y - f.foot) < 8 || splashZone[k.index]!.some((s) => near(q, s, 2)), at).toBe(true);
        } else if (k.element === 'gate') expect(gate.some((s) => near(q, s, 3)), at).toBe(true);
        else if (k.element === 'ring') expect(pointInPolygon(q, WATER_SHAPES.basin), at).toBe(true);
        else {
          expect(pointInPolygon(q, WATER_SHAPES.oued), at).toBe(true);
          if (k.index === 0) expect(OUED_BARS.some((bar) => pointInPolygon(q, bar)), at).toBe(false);
        }
      }
    }
  });

  it('spreads the rings from the inlet, slowly', () => {
    const xs = [0, 1, 2, 3].map((t) => a.m.marksAt(t).filter((k) => k.element === 'ring').map((k) => k.x));
    for (const r of xs) for (const x of r) expect(x).toBeGreaterThan(INLET.x);
    expect(Math.max(...xs.flat()) - INLET.x).toBeLessThan(160);
  });

  it('is livelier at the bars’ heads than over the deep braids', () => {
    let heads = 0;
    let rest = 0;
    const box = bounds(WATER_SHAPES.oued);
    for (let t = 0; t < 120; t += 0.5) {
      for (const k of a.m.marksAt(t)) {
        if (k.element !== 'oued') continue;
        if (BAR_HEADS.some((h) => Math.hypot(k.x - h.x, k.y - h.y) < 40)) heads++;
        else rest++;
      }
    }
    // the heads' discs are a small part of the oued, yet hold a good share of its marks
    const headArea = BAR_HEADS.length * Math.PI * 40 * 40;
    expect(heads / headArea).toBeGreaterThan((3 * rest) / (box.w * box.h));
  });

  it('falls from the lip to the foot, gathering speed', () => {
    for (const f of FALLS) {
      expect(fallDropAt(f, 0)).toBe(f.top);
      expect(fallDropAt(f, f.s)).toBeCloseTo(f.foot);
      expect(fallDropAt(f, f.s - 0.2) - fallDropAt(f, f.s - 0.4)).toBeGreaterThan(fallDropAt(f, 0.2) - fallDropAt(f, 0));
    }
  });

  it('draws nothing under reduced motion: the still painting stays', () => {
    const { m } = prepared({ seed: 13, still: true });
    expect(m.ready).toBe(false);
    for (const t of [0, 5, 50]) expect(drawn(m, t)).toEqual([]);
  });

  it('draws nothing when the view misses the water, and only what it sees', () => {
    // a view of the sky over the ksar
    expect(drawn(a.m, 10, { a: 4, b: 0, c: 0, d: 4, e: -2400, f: -400 })).toEqual([]);
    const all = drawn(a.m, 10).length;
    // a close view of the oued alone
    const oued = drawn(a.m, 10, { a: 3, b: 0, c: 0, d: 3, e: -1250 * 3, f: -650 * 3 }).length;
    expect(oued).toBeGreaterThan(5);
    expect(oued).toBeLessThan(all);
    expect(MOTION_BOUNDS.w).toBeLessThan(1500);
  });

  it('costs a bounded number of small blits a frame', () => {
    let worst = 0;
    let worstArea = 0;
    let worstClips = 0;
    for (let t = 0; t < 60; t += 0.29) {
      const { ctx, log, stats } = fakeCtx();
      a.m.draw(ctx, t);
      worst = Math.max(worst, log.length);
      worstArea = Math.max(worstArea, stats().area);
      worstClips = Math.max(worstClips, stats().clips);
    }
    expect(worst).toBeLessThanOrEqual(110);
    // world units²: under 2 % of the 1600 × 1000 painting
    expect(worstArea).toBeLessThan(32_000);
    expect(worstClips).toBeLessThanOrEqual(7);
  });
});
