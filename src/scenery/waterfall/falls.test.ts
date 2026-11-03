/**
 * The falls in motion (S9, ADR 0282): a pure function of the animation time, nothing under
 * reduced motion, unchanged while frozen, skipped off screen, sprites painted in small parts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PaintRecorder } from '../../scene/paint-record';
import { WATERFALL } from '.';
import { createFallsMotion, dropAt, FALL_FOOT, FALL_S, FALL_TOP, type FallsMotion } from './falls';

/** A context that logs what is drawn: each blit with its alpha and transform. */
function fakeCtx(transform = { a: 2, b: 0, c: 0, d: 2, e: -900, f: -500 }) {
  const log: string[] = [];
  let m = { ...transform };
  const stack: (typeof m)[] = [];
  const r = (x: number) => x.toFixed(3);
  const ctx = {
    canvas: { width: 1600, height: 1000 },
    globalAlpha: 1,
    getTransform: () => ({ ...m }),
    save: () => stack.push({ ...m }),
    restore: () => (m = stack.pop() ?? m),
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      m = { a: m.a * a + m.c * b, b: m.b * a + m.d * b, c: m.a * c + m.c * d, d: m.b * c + m.d * d, e: m.a * e + m.c * f + m.e, f: m.b * e + m.d * f + m.f };
    },
    drawImage: (_img: unknown, ...n: number[]) => log.push(`${r(ctx.globalAlpha)} [${[m.a, m.c, m.e, m.f].map(r)}] ${n.map(r).join(',')}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

const drawn = (m: FallsMotion, t: number, transform?: Parameters<typeof fakeCtx>[0]) => {
  const { ctx, log } = fakeCtx(transform);
  m.draw(ctx, t);
  return log;
};

function prepared(opts: Parameters<typeof createFallsMotion>[0]) {
  const rec = new PaintRecorder({ hash: false });
  const uninstall = rec.install();
  try {
    const m = createFallsMotion(opts);
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

describe('the falls in motion (S9)', () => {
  let a: ReturnType<typeof prepared>;
  let b: ReturnType<typeof prepared>;
  beforeAll(() => {
    a = prepared({ seed: 'waterfall' });
    b = prepared({ seed: 'waterfall' });
  });

  it('is the waterfall scenery’s motion', () => {
    expect(WATERFALL.motion).toBeTypeOf('function');
  });

  it('paints its sprites once, in small parts, and is ready after', () => {
    expect(a.m.ready).toBe(true);
    expect(a.parts).toBeGreaterThan(20);
    expect(a.worst).toBeLessThanOrEqual(130_000);
    expect(a.m.sprites().length).toBeGreaterThanOrEqual(15);
  });

  it('is a pure function of the animation time', () => {
    for (const t of [0, 3.7, 61.25, 3600.5]) expect(drawn(a.m, t)).toEqual(drawn(b.m, t));
    expect(drawn(a.m, 12.5)).toEqual(drawn(a.m, 12.5));
  });

  it('holds still while frozen (the same time draws the same frame) and moves when time runs', () => {
    const frozen = drawn(a.m, 40);
    expect(drawn(a.m, 40)).toEqual(frozen);
    expect(drawn(a.m, 40.15)).not.toEqual(frozen);
  });

  it('always has water falling, foam churning and some mist, and passes differ', () => {
    for (let t = 0; t < 120; t += 0.7) {
      const v = a.m.visibleAt(t);
      expect(v.fallers, `t ${t}`).toBeGreaterThan(8);
      expect(v.puffs, `t ${t}`).toBeGreaterThan(8);
    }
    let wisps = 0;
    for (let t = 0; t < 60; t += 1) wisps += a.m.visibleAt(t).wisps;
    expect(wisps).toBeGreaterThan(30);
    // the same moment of two passes of the cycle is not drawn alike
    expect(drawn(a.m, 10)).not.toEqual(drawn(a.m, 10 + 37));
  });

  it('draws nothing under reduced motion: the still painting stays', () => {
    const { m } = prepared({ seed: 'waterfall', still: true });
    expect(m.ready).toBe(false);
    for (const t of [0, 5, 50]) expect(drawn(m, t)).toEqual([]);
  });

  it('draws nothing when the view misses the falls', () => {
    expect(drawn(a.m, 10, { a: 2, b: 0, c: 0, d: 2, e: -2600, f: 0 })).toEqual([]);
    expect(drawn(a.m, 10).length).toBeGreaterThan(10);
  });

  it('falls from under the lip to the foam, gathering speed', () => {
    expect(dropAt(0)).toBe(FALL_TOP);
    expect(dropAt(FALL_S)).toBeCloseTo(FALL_FOOT);
    expect(dropAt(FALL_S + 3)).toBeCloseTo(FALL_FOOT);
    const early = dropAt(0.5) - dropAt(0);
    const late = dropAt(FALL_S) - dropAt(FALL_S - 0.5);
    expect(late).toBeGreaterThan(early * 2);
  });
});
