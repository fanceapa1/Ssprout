/**
 * The generic water surface's strength (ADR 0302): a scenery may play it down or turn it off for a
 * still pond, and the gardens that leave it out draw exactly what they drew before.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DaylightState } from '../ambience/daylight';
import { JAPANESE_GARDEN } from '../scenery/japanese-garden';
import { OASIS } from '../scenery/oasis';
import { WATERFALL } from '../scenery/waterfall';
import { PaintRecorder } from './paint-record';
import { createWaterSurface, type WaterOptions } from './water';

function fakeCtx() {
  const log: string[] = [];
  let clips = 0;
  const noop = () => {};
  const ctx = {
    globalAlpha: 1,
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    clip: () => clips++,
    drawImage: (_img: unknown, ...n: number[]) => log.push(`${ctx.globalAlpha} ${n.join(',')}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log, clips: () => clips };
}

const light = (midday: number) => ({ weights: { midday, sunrise: 0, sunset: 0, night: 1 - midday } }) as unknown as DaylightState;
const TIMES = [0, 2.5, 7, 11.3, 19.8, 40, 95.5];

function blits(opts: WaterOptions) {
  const surface = createWaterSurface(JAPANESE_GARDEN.geometry, opts);
  const out: string[][] = [];
  let clips = 0;
  for (const t of TIMES) {
    for (const l of [null, light(1), light(0)]) {
      const f = fakeCtx();
      surface.draw(f.ctx, t, l);
      out.push(f.log);
      clips += f.clips();
    }
  }
  return { out, clips };
}

describe('the water surface’s strength (ADR 0302)', () => {
  const rec = new PaintRecorder({ hash: false });
  let uninstall: () => void;
  beforeAll(() => (uninstall = rec.install()));
  afterAll(() => uninstall());

  it('draws exactly the same blits at strength 1 as when it is left out', () => {
    const plain = blits({ seed: 3 });
    expect(plain.out.flat().length).toBeGreaterThan(20);
    expect(blits({ seed: 3, strength: 1 })).toEqual(plain);
  });

  it('draws nothing at strength 0: a still mirror', () => {
    expect(blits({ seed: 3, strength: 0 })).toEqual({ out: TIMES.flatMap(() => [[], [], []]), clips: 0 });
  });

  it('scales every blit’s alpha and nothing else in between', () => {
    const alpha = (s: string) => Number(s.split(' ')[0]);
    const rest = (s: string) => s.split(' ')[1];
    const full = blits({ seed: 3 }).out.flat();
    const half = blits({ seed: 3, strength: 0.5 }).out.flat();
    expect(half.map(rest)).toEqual(full.map(rest));
    half.forEach((s, i) => expect(alpha(s)).toBeCloseTo(alpha(full[i]!) * 0.5, 9));
  });

  it('is off over the oasis’s basin, and the garden and the waterfall leave it out', () => {
    expect(OASIS.pondSurface).toBe(0);
    expect(JAPANESE_GARDEN.pondSurface).toBeUndefined();
    expect(WATERFALL.pondSurface).toBeUndefined();
  });
});
