import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCanvas, installFakeOffscreenCanvas } from '../plants/test-canvas';
import { createDevicePlate } from './device-plate';

let undo: () => void;
beforeAll(() => (undo = installFakeOffscreenCanvas()));
afterAll(() => undo());

/** a frame-sized target drawn through a world transform, the plate drawn into it as the lighting does */
function frame(scale = 2.6, tx = -900) {
  const target = new FakeCanvas(2824, 1584);
  const ctx = target.ctx;
  const c2d = ctx as unknown as CanvasRenderingContext2D;
  c2d.setTransform(scale, 0, 0, scale, tx, -1200);
  ctx.globalCompositeOperation = 'multiply';
  return { ctx, c2d };
}

const plateImage = {} as CanvasImageSource;
const paint = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => c.drawImage(plateImage, 0, 0, 1600, 1000);
const blits = (ctx: FakeCanvas['ctx']) => ctx.calls.filter((k) => k.name === 'drawImage').map((k) => k.args);

describe('the light plate at device resolution (ADR 0207)', () => {
  it('a resting view resamples the plate once, then lays it 1:1', () => {
    const plate = createDevicePlate();
    // first frame at a new view: drawn as it is
    let f = frame();
    plate.draw(f.c2d, 'v1', paint);
    expect(blits(f.ctx)).toEqual([[plateImage, 0, 0, 1600, 1000]]);
    // the same view again: resampled into the buffer and laid 1:1, no scaling
    for (let i = 0; i < 5; i++) {
      f = frame();
      plate.draw(f.c2d, 'v1', paint);
      const [one] = blits(f.ctx);
      expect(blits(f.ctx)).toHaveLength(1);
      expect(one![0]).not.toBe(plateImage);
      expect(one!.slice(1)).toEqual([0, 0]);
      // the 1:1 blit keeps the lighting's compositing
      expect(f.ctx.globalCompositeOperation).toBe('multiply');
    }
    expect(plate.stats()).toEqual({ direct: 1, builds: 1, blits: 5 });
  });

  it('the buffer holds the plate exactly as the frame would have drawn it', () => {
    const plate = createDevicePlate();
    plate.draw(frame().c2d, 'v1', paint);
    let into: FakeCanvas['ctx'] | null = null;
    plate.draw(frame().c2d, 'v1', (c) => {
      into = c as unknown as FakeCanvas['ctx'];
      paint(c);
    });
    const buf = into! as FakeCanvas['ctx'];
    expect(buf.canvas.width).toBe(2824);
    expect(buf.canvas.height).toBe(1584);
    // painted through the frame's own transform, plain source-over at full alpha
    const t = (buf.getTransform as () => DOMMatrix)();
    expect([t.a, t.d, t.e, t.f]).toEqual([1, 1, 0, 0]); // reset after painting
    const set = buf.calls.filter((k) => k.name === 'setTransform').map((k) => k.args);
    expect(set).toContainEqual([2.6, 0, 0, 2.6, -900, -1200]);
    expect(buf.globalCompositeOperation).toBe('source-over');
    expect(buf.globalAlpha).toBe(1);
  });

  it('a new plate, a moving view or a resized canvas draws directly again', () => {
    const plate = createDevicePlate();
    plate.draw(frame().c2d, 'v1', paint);
    plate.draw(frame().c2d, 'v1', paint);
    // the light was recomposed
    plate.draw(frame().c2d, 'v2', paint);
    expect(plate.stats()).toMatchObject({ direct: 2, builds: 1 });
    // a glide: every frame a new transform
    for (let i = 0; i < 4; i++) plate.draw(frame(2 + i * 0.1).c2d, 'v2', paint);
    expect(plate.stats()).toMatchObject({ direct: 6, builds: 1 });
    // it rests
    plate.draw(frame(2 + 3 * 0.1).c2d, 'v2', paint);
    expect(plate.stats()).toMatchObject({ direct: 6, builds: 2, blits: 2 });
  });
});
