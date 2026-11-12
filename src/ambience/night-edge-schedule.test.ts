import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCanvas, installFakeOffscreenCanvas } from '../plants/test-canvas';
import { BLEND_MS, dayBoundaries, daylightAt, only, pinnedState } from './daylight';
import { sunTimes } from './solar';
import { EDGE_LEAD_MS, EDGE_PART_PX, createNightEdge, edgeFieldBuild, edgeStrength, edgeWanted, nightEdgeFields } from './night-edge';

/** The night edge freed by day and built again on idle before dusk (ADR 0350). */

let undo: () => void;
beforeAll(() => (undo = installFakeOffscreenCanvas()));
afterAll(() => undo());

const MIN = 60_000;
const LONDON = { lat: 51.51, lon: -0.13 };
const DAY = Date.parse('2024-06-21T12:00:00Z');

/** an idle queue the test runs by hand (no real waiting) */
function idleQueue() {
  const q: Array<() => void> = [];
  return {
    idle: (fn: () => void) => void q.push(fn),
    get size() {
      return q.length;
    },
    /** run one callback (and only the ones queued before it) */
    one() {
      q.shift()?.();
    },
    drain() {
      let n = 0;
      while (q.length) (q.shift()!(), n++);
      return n;
    },
  };
}

/** a lighting-layer canvas of `w`×`h` device px, as the engine draws the edge into */
const target = (w = 600, h = 400) => new FakeCanvas(w, h);
const ctxOf = (c: FakeCanvas) => c.ctx as unknown as CanvasRenderingContext2D;
const puts = (c: FakeCanvas) => c.ctx.calls.filter((k) => k.name === 'putImageData').map((k) => (k.args[0] as ImageData).data);

describe('night edge: the field in parts', () => {
  it('is the same field whether built in one go or a band of rows at a time', () => {
    const o = { w: 97, h: 61, cssPerPx: 2, seed: 'parts' };
    const whole = nightEdgeFields(o);
    const b = edgeFieldBuild(o);
    let parts = 0;
    while (!b.step(7)) parts++;
    expect(parts).toBe(Math.ceil(61 / 7) - 1);
    expect(b.lift).toEqual(whole.lift);
    expect(b.rim).toEqual(whole.rim);
  });
});

describe('night edge: when it is wanted', () => {
  const b = dayBoundaries(sunTimes(DAY, LONDON));
  const evening = b.find((x) => x.from === 'midday')!.at;
  const blendStarts = evening - BLEND_MS / 2;
  const state = (t: number) => daylightAt(t, LONDON);

  it('a pinned light: only when it is dark enough to show the edge', () => {
    expect(edgeWanted(pinnedState(only('midday')), null)).toBe(false);
    for (const p of ['sunrise', 'sunset', 'night'] as const) expect(edgeWanted(pinnedState(only(p)), null)).toBe(true);
  });

  it('a live day: freed through midday, wanted again a lead before the evening blend begins', () => {
    const noon = sunTimes(DAY, LONDON).noon;
    expect(edgeStrength(state(noon))).toBe(0);
    expect(edgeWanted(state(noon), noon)).toBe(false);
    const early = blendStarts - EDGE_LEAD_MS - MIN;
    expect(edgeWanted(state(early), early)).toBe(false);
    const lead = blendStarts - EDGE_LEAD_MS + MIN;
    expect(edgeStrength(state(lead))).toBe(0);
    expect(edgeWanted(state(lead), lead)).toBe(true);
    // the evening, the night and the dawn keep it
    for (const t of [evening, b.find((x) => x.to === 'night')!.at + 60 * MIN]) expect(edgeWanted(state(t), t)).toBe(true);
    // once the morning blend is over it is freed again
    const morning = b.find((x) => x.to === 'midday')!.at + BLEND_MS;
    expect(edgeWanted(state(morning), morning)).toBe(false);
  });
});

describe('night edge: freed by day, rebuilt on idle', () => {
  it('builds a part per idle callback, and draws what a build in one go draws', () => {
    const q = idleQueue();
    const edge = createNightEdge('sched', { idle: q.idle });
    const c = target();
    edge.keep(true, c);
    expect(edge.stats().building).toBe(true);
    expect(edge.stats().sizes).toEqual([]);
    const rows = Math.ceil(EDGE_PART_PX / 600);
    let parts = 0;
    while (q.size) {
      q.one();
      parts++;
      if (q.size) expect(edge.stats().sizes).toEqual([]);
    }
    expect(parts).toBe(Math.ceil(400 / rows));
    const s = edge.stats();
    expect(s).toMatchObject({ building: false, bytes: 2 * 600 * 400 * 4, sizes: ['600x400@1.000'], frees: 0 });
    expect(s.last).toMatchObject({ parts, sync: false });

    // the same canvases a draw at night would have built at once
    const at = createNightEdge('sched');
    const d = target();
    at.draw(ctxOf(d), 1);
    expect(at.stats().last).toMatchObject({ parts: 1, sync: true });
    const draw = (e: typeof edge) => {
      const f = target();
      e.draw(ctxOf(f), 1);
      return f.ctx.calls.filter((k) => k.name === 'drawImage').map((k) => k.args[0] as FakeCanvas);
    };
    const [rimA, liftA] = draw(edge);
    const [rimB, liftB] = draw(at);
    expect(puts(liftA!)).toEqual(puts(liftB!));
    expect(puts(rimA!)).toEqual(puts(rimB!));
    expect(puts(liftA!)[0]!.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });

  it('frees its canvases when not wanted, and a stale idle part does nothing', () => {
    const q = idleQueue();
    const edge = createNightEdge('free', { idle: q.idle });
    const c = target();
    edge.keep(true, c);
    q.drain();
    const held = edge.stats().bytes;
    expect(held).toBeGreaterThan(0);
    const kept = edge.stats().sizes.length;
    edge.keep(false, c);
    expect(edge.stats()).toMatchObject({ bytes: 0, sizes: [], building: false, frees: 1 });
    expect(kept).toBe(1);
    // freed while a rebuild was half done: the queued part finds nothing to do
    edge.keep(true, c);
    q.one();
    expect(edge.stats().building).toBe(true);
    edge.keep(false, c);
    expect(q.drain()).toBeLessThanOrEqual(1);
    expect(edge.stats()).toMatchObject({ bytes: 0, building: false, frees: 2 });
  });

  it('a jump to night mid-build finishes the build at once, in that frame', () => {
    const q = idleQueue();
    const edge = createNightEdge('jump', { idle: q.idle });
    const c = target();
    edge.keep(true, c);
    q.one();
    edge.draw(ctxOf(c), 1);
    expect(edge.stats()).toMatchObject({ building: false, sizes: ['600x400@1.000'] });
    expect(edge.stats().last).toMatchObject({ parts: 2, sync: true });
    expect(c.ctx.count('drawImage')).toBe(2);
    q.drain();
    expect(edge.stats().last!.parts).toBe(2);
  });

  it('over a whole live day: never drawn without being ready, and nothing held at noon', () => {
    const q = idleQueue();
    const edge = createNightEdge('day', { idle: q.idle });
    const c = target();
    const noon = sunTimes(DAY, LONDON).noon;
    let syncBuilds = 0;
    let heldAtNoon = -1;
    // a frame a minute from 03:00 UTC to 23:00 UTC, the idle queue run between frames
    for (let t = Date.parse('2024-06-21T03:00:00Z'); t <= Date.parse('2024-06-21T23:00:00Z'); t += MIN) {
      const light = daylightAt(t, LONDON);
      edge.keep(edgeWanted(light, t), c);
      const before = edge.stats().last;
      edge.draw(ctxOf(c), edgeStrength(light));
      if (edge.stats().last !== before && edge.stats().last!.sync) syncBuilds++;
      if (Math.abs(t - noon) < MIN / 2 + 1) heldAtNoon = edge.stats().bytes;
      q.drain();
    }
    expect(heldAtNoon).toBe(0);
    // the only build at once is the very first frame (it opens in the night's dawn)
    expect(syncBuilds).toBe(1);
    expect(edge.stats().frees).toBe(1);
    expect(edge.stats().bytes).toBeGreaterThan(0);
  });
});
