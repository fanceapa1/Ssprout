import { describe, expect, it } from 'vitest';
import { createCamera, overviewPose } from '../render/camera';
import { createViewport } from '../render/viewport';
import { GLIDE_LOG_MAX, recordGlides } from './camera-debug';

const desk = createViewport(1440, 880, 2);
const close = { zoom: 2.4, x: 600, y: 640 };
const other = { zoom: 2, x: 1000, y: 560 };

function setup(reducedMotion = false) {
  const cam = createCamera({ base: desk, reducedMotion });
  let t = 0;
  const log = recordGlides(cam, () => t);
  const tick = (ms: number) => {
    t += ms;
    cam.update(ms / 1000);
  };
  return { cam, log, tick };
}

describe('sprout.camera.glides(): the glide log (dev)', () => {
  it('records a glide when it starts, with its reason, origin and target, and closes it on arrival', () => {
    const { cam, log, tick } = setup();
    cam.glideTo(close, { reason: 'session' });
    const target = cam.state().target!;
    expect(log.list()).toEqual([{ reason: 'session', from: overviewPose(desk), target, startedAt: 0, endedAt: null, end: null }]);
    for (let i = 0; i < 400 && cam.state().gliding; i++) tick(16);
    const [g] = log.list();
    expect(g!.end).toBe('arrived');
    expect(g!.endedAt).toBeGreaterThan(0);
    expect(cam.pose()).toEqual(target);
  });

  it('a glide finished by settle() arrived; one stopped by input was interrupted; a new one replaces it', () => {
    const { cam, log, tick } = setup();
    cam.glideTo(close, { reason: 'plant' });
    cam.settle();
    cam.glideTo(other, { reason: 'switch' });
    tick(100);
    cam.interrupt();
    cam.glideTo(close, { reason: 'session' });
    tick(100);
    cam.glideTo(other, { reason: 'dev' });
    expect(log.list().map((g) => [g.reason, g.end])).toEqual([
      ['plant', 'arrived'],
      ['switch', 'interrupted'],
      ['session', 'replaced'],
      ['dev', null],
    ]);
  });

  it('cuts, reduced motion and gestures log nothing', () => {
    const { cam, log, tick } = setup();
    cam.glideTo(close, { reason: 'session', animate: false });
    cam.zoomBy(1.2, { x: 300, y: 300 });
    tick(500);
    cam.panBy(20, 0);
    expect(log.list()).toEqual([]);
    const reduced = setup(true);
    reduced.cam.focusRect({ x: 300, y: 600, w: 90, h: 110 }, { reason: 'session' });
    expect(reduced.log.list()).toEqual([]);
  });

  it('clearing forgets the log but keeps following a glide under way; the log keeps the last few', () => {
    const { cam, log, tick } = setup();
    cam.glideTo(close, { reason: 'session' });
    tick(100);
    log.clear();
    tick(100);
    cam.settle();
    expect(log.list()).toEqual([]);
    for (let i = 0; i < GLIDE_LOG_MAX + 5; i++) {
      cam.glideTo(i % 2 ? close : other, { reason: 'dev' });
      cam.settle();
    }
    expect(log.list()).toHaveLength(GLIDE_LOG_MAX);
    // records are copies
    log.list()[0]!.target.zoom = 9;
    expect(log.list()[0]!.target.zoom).not.toBe(9);
  });
});
