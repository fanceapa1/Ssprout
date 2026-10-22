import { describe, expect, it } from 'vitest';
import {
  clampPose,
  composeView,
  createCamera,
  easeGlide,
  framePose,
  glidePath,
  glideSeconds,
  GLIDE_MAX_S,
  GLIDE_MIN_S,
  isOverview,
  MAX_ZOOM,
  overviewPose,
  panBy,
  REST_S,
  zoomAbout,
} from './camera';
import { createViewport, WORLD_W } from './viewport';

const desk = createViewport(1440, 880, 2);
const phone = createViewport(390, 742, 3);

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe('composeView', () => {
  it('is the base viewport at the overview pose', () => {
    for (const base of [desk, phone]) {
      const v = composeView(base, overviewPose(base));
      expect(v).toBe(base);
      expect(isOverview(base, overviewPose(base))).toBe(true);
    }
  });

  it('zooms the base mapping about the pose, keeping the pose at the stage centre', () => {
    const pose = { zoom: 2, x: 500, y: 600 };
    const v = composeView(desk, pose);
    expect(v.scale).toBeCloseTo(desk.scale * 2);
    expect(v.pixelScale).toBeCloseTo(desk.pixelScale * 2);
    const c = v.worldToScreen(pose);
    expect(c.x).toBeCloseTo(720);
    expect(c.y).toBeCloseTo(440);
    expect(v.visible.w).toBeCloseTo(desk.visible.w / 2);
    // backing store and DPR are the stage's, whatever the zoom
    expect(v.pixelW).toBe(desk.pixelW);
    expect(v.dpr).toBe(desk.dpr);
    const back = v.screenToWorld(v.worldToScreen({ x: 123.4, y: 567.8 }));
    expect(back.x).toBeCloseTo(123.4);
    expect(back.y).toBeCloseTo(567.8);
  });

  it('applies the composed transform in device pixels', () => {
    const v = composeView(desk, { zoom: 2.5, x: 800, y: 560 });
    const calls: number[][] = [];
    v.applyTo({ setTransform: (...a: number[]) => calls.push(a) } as unknown as CanvasRenderingContext2D);
    expect(calls[0]![0]).toBeCloseTo(v.pixelScale);
    expect(calls[0]![4]).toBeCloseTo(v.offsetX * 2);
  });
});

describe('clampPose', () => {
  it('keeps the zoom between the overview and the maximum', () => {
    expect(clampPose(desk, { zoom: 0.4, x: 800, y: 500 }).zoom).toBe(1);
    expect(clampPose(desk, { zoom: 9, x: 800, y: 500 }).zoom).toBe(MAX_ZOOM);
    expect(clampPose(desk, { zoom: NaN, x: 800, y: 500 }).zoom).toBe(1);
  });

  it('never lets the view leave the overview frame', () => {
    for (const base of [desk, phone]) {
      for (const zoom of [1, 1.7, 3]) {
        for (const [x, y] of [
          [-500, -500],
          [3000, 3000],
          [0, 1000],
        ] as const) {
          const v = composeView(base, clampPose(base, { zoom, x, y })).visible;
          const o = base.visible;
          expect(v.x).toBeGreaterThanOrEqual(o.x - 1e-6);
          expect(v.y).toBeGreaterThanOrEqual(o.y - 1e-6);
          expect(v.x + v.w).toBeLessThanOrEqual(o.x + o.w + 1e-6);
          expect(v.y + v.h).toBeLessThanOrEqual(o.y + o.h + 1e-6);
        }
      }
    }
  });

  it('on a tall phone the zoomed view may reach the paper rows beyond the world (they are lit)', () => {
    expect(phone.visible.y).toBeLessThan(0);
    const top = composeView(phone, clampPose(phone, { zoom: 1.2, x: 300, y: -1000 })).visible;
    expect(top.y).toBeLessThan(0);
    expect(top.y).toBeCloseTo(phone.visible.y);
  });
});

describe('zoomAbout and panBy', () => {
  it('keeps the world point under the pointer still while zooming', () => {
    const start = { zoom: 1.4, x: 700, y: 520 };
    const at = { x: 1100, y: 300 };
    const before = composeView(desk, start).screenToWorld(at);
    const next = zoomAbout(desk, start, 2.2, at);
    const after = composeView(desk, next).screenToWorld(at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBeCloseTo(2.2);
  });

  it('zooming out about a point lands on the overview at zoom 1', () => {
    const p = zoomAbout(desk, { zoom: 2, x: 300, y: 300 }, 0.5, { x: 10, y: 10 });
    expect(isOverview(desk, p)).toBe(true);
  });

  it('a drag moves the painting with the pointer, within the frame', () => {
    const start = { zoom: 2, x: 800, y: 560 };
    const p = panBy(desk, start, 100, -40);
    const v0 = composeView(desk, start);
    const v1 = composeView(desk, p);
    const w = { x: 800, y: 560 };
    expect(v1.worldToScreen(w).x - v0.worldToScreen(w).x).toBeCloseTo(100);
    expect(v1.worldToScreen(w).y - v0.worldToScreen(w).y).toBeCloseTo(-40);
    // at the overview there is nowhere to pan
    const o = overviewPose(desk);
    expect(panBy(desk, o, 300, 300)).toEqual(o);
  });
});

describe('framePose', () => {
  const plant = { x: 300, y: 600, w: 90, h: 110 };

  it('zooms so the plant takes a good part of the stage, slightly off-centre', () => {
    const p = framePose(desk, plant);
    expect(p.zoom).toBeGreaterThan(1.5);
    expect(p.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    const v = composeView(desk, p);
    const c = v.worldToScreen({ x: plant.x + plant.w / 2, y: plant.y + plant.h / 2 });
    // inside the stage, left of centre (it stands on the garden's left), a little low
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(720);
    expect(c.y).toBeGreaterThan(440);
    // all of it is in view
    const tl = v.worldToScreen(plant);
    const br = v.worldToScreen({ x: plant.x + plant.w, y: plant.y + plant.h });
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(1440);
    expect(br.y).toBeLessThanOrEqual(880);
  });

  it('a plant on the right of the garden sits right of centre', () => {
    const p = framePose(desk, { ...plant, x: 1150 });
    const c = composeView(desk, p).worldToScreen({ x: 1150 + 45, y: 655 });
    expect(c.x).toBeGreaterThan(720);
  });

  it('a big tree gets a lower zoom so it fits', () => {
    const tree = { x: 1000, y: 120, w: 520, h: 640 };
    const small = framePose(desk, plant);
    const big = framePose(desk, tree, { minZoom: 1 });
    expect(big.zoom).toBeLessThan(small.zoom);
    const v = composeView(desk, big);
    expect(v.worldToScreen(tree).y).toBeGreaterThanOrEqual(-1);
  });

  it('keeps clear of an inset (a card docked at the bottom on phones)', () => {
    const pl = { x: 700, y: 640, w: 80, h: 90 };
    const free = framePose(phone, pl);
    const docked = framePose(phone, pl, { inset: { bottom: 320 } });
    const y = (p: typeof free) => composeView(phone, p).worldToScreen({ x: 740, y: 685 }).y;
    expect(y(docked)).toBeLessThan(y(free));
    expect(y(docked)).toBeLessThan(742 - 320);
  });
});

describe('glides', () => {
  it('the path starts and ends at the poses and stays smooth in between', () => {
    const a = { zoom: 1, x: 800, y: 500 };
    const b = { zoom: 2.6, x: 400, y: 640 };
    const path = glidePath(desk, a, b);
    expect(path.at(0)).toEqual(a);
    expect(path.at(1)).toEqual(b);
    let prev = path.at(0);
    for (let i = 1; i <= 50; i++) {
      const p = path.at(i / 50);
      // no jumps: each step moves the view a small fraction of its width
      const w = WORLD_W / Math.max(p.zoom, prev.zoom);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(w * 0.08);
      expect(Math.abs(Math.log(p.zoom / prev.zoom))).toBeLessThan(0.08);
      prev = p;
    }
  });

  it('a long move at high zoom eases out on the way (the eye keeps its place)', () => {
    const a = { zoom: 3, x: 250, y: 600 };
    const b = { zoom: 3, x: 1350, y: 600 };
    const mid = glidePath(desk, a, b).at(0.5);
    expect(mid.zoom).toBeLessThan(3);
  });

  it('a zoom in place is log-linear and has a length', () => {
    const p = glidePath(desk, { zoom: 1, x: 800, y: 500 }, { zoom: 2, x: 800, y: 500 });
    expect(p.at(0.5).zoom).toBeCloseTo(Math.SQRT2);
    expect(p.length).toBeGreaterThan(0);
  });

  it('eases like a breath: still at both ends, never linear', () => {
    expect(easeGlide(0)).toBe(0);
    expect(easeGlide(1)).toBe(1);
    expect(easeGlide(0.5)).toBeCloseTo(0.5);
    expect(easeGlide(0.05)).toBeLessThan(0.05 * 0.2);
    expect(1 - easeGlide(0.95)).toBeLessThan(0.05 * 0.2);
  });

  it('takes longer for longer paths, within bounds', () => {
    expect(glideSeconds(0)).toBe(GLIDE_MIN_S);
    expect(glideSeconds(100)).toBe(GLIDE_MAX_S);
    expect(glideSeconds(2)).toBeGreaterThan(glideSeconds(0.5));
  });
});

describe('createCamera', () => {
  const run = (cam: ReturnType<typeof createCamera>, seconds: number, dt = 1 / 60) => {
    for (let t = 0; t < seconds; t += dt) cam.update(dt);
  };

  it('starts at the overview and its view is the base viewport', () => {
    const cam = createCamera({ base: desk });
    expect(cam.isOverview()).toBe(true);
    expect(cam.view()).toBe(desk);
    expect(cam.moving()).toBe(false);
  });

  it('glides to a framed rect and arrives exactly; the detail view is the destination from the start', () => {
    const cam = createCamera({ base: desk });
    const v0 = cam.detailVersion;
    cam.focusRect({ x: 300, y: 600, w: 90, h: 110 }, { reason: 'session' });
    expect(cam.state().gliding).toBe(true);
    expect(cam.detailVersion).toBeGreaterThan(v0);
    const dest = cam.state().target!;
    expect(cam.detailView().scale).toBeCloseTo(desk.scale * dest.zoom);
    cam.update(0.2);
    const mid = cam.pose().zoom;
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(dest.zoom);
    run(cam, GLIDE_MAX_S + 0.1);
    expect(cam.pose()).toEqual(dest);
    expect(cam.state().gliding).toBe(false);
    expect(cam.state().reason).toBe('session');
    run(cam, REST_S + 0.05);
    expect(cam.moving()).toBe(false);
  });

  it('user input interrupts a glide and takes over from where it is', () => {
    const cam = createCamera({ base: desk });
    cam.zoomTo(2.5);
    cam.update(0.3);
    const here = cam.pose();
    cam.panBy(40, 0);
    expect(cam.state().gliding).toBe(false);
    expect(cam.pose().zoom).toBeCloseTo(here.zoom);
    run(cam, 2);
    expect(cam.pose().zoom).toBeCloseTo(here.zoom);
  });

  it('a gesture zoom eases toward its target about the pointer', () => {
    const cam = createCamera({ base: desk });
    const at = { x: 400, y: 600 };
    const under = desk.screenToWorld(at);
    cam.zoomBy(2, at);
    cam.update(1 / 60);
    const z1 = cam.pose().zoom;
    expect(z1).toBeGreaterThan(1);
    expect(z1).toBeLessThan(2);
    run(cam, 1);
    expect(cam.pose().zoom).toBeCloseTo(2, 2);
    const still = cam.view().screenToWorld(at);
    expect(still.x).toBeCloseTo(under.x, 1);
    expect(still.y).toBeCloseTo(under.y, 1);
    // successive wheel steps accumulate on the target, not on the current pose
    cam.zoomBy(1.2, at);
    cam.zoomBy(1.2, at);
    expect(cam.state().target!.zoom).toBeCloseTo(Math.min(MAX_ZOOM, 2 * 1.44), 1);
  });

  it('cuts instead of gliding under reduced motion', () => {
    const cam = createCamera({ base: desk, reducedMotion: true });
    cam.zoomTo(2);
    expect(cam.pose().zoom).toBeCloseTo(2);
    expect(cam.state().gliding).toBe(false);
    cam.zoomBy(1.25, { x: 100, y: 100 });
    expect(cam.pose().zoom).toBeCloseTo(2.5);
    cam.overview();
    expect(cam.isOverview()).toBe(true);
  });

  it('settle() finishes a glide at once; overview() returns to zoom 1', () => {
    const cam = createCamera({ base: desk });
    cam.zoomTo(2.4, { x: 200, y: 200 });
    cam.settle();
    expect(cam.pose().zoom).toBeCloseTo(2.4);
    expect(cam.moving()).toBe(false);
    cam.overview();
    cam.settle();
    expect(cam.isOverview()).toBe(true);
    expect(cam.view()).toBe(desk);
  });

  it('the detail view follows a drag only once the camera rests', () => {
    const cam = createCamera({ base: desk });
    cam.zoomTo(2, undefined, { animate: false });
    const v = cam.detailVersion;
    cam.panBy(50, 0);
    cam.update(1 / 60);
    expect(cam.detailVersion).toBe(v);
    run(cam, REST_S + 0.1);
    expect(cam.detailVersion).toBeGreaterThan(v);
    expect(cam.detailView().focus.x).toBeCloseTo(cam.pose().x);
  });

  it('keeps its world point on resize and stays at the overview when it was there', () => {
    const cam = createCamera({ base: desk });
    cam.setBase(createViewport(1200, 800, 2));
    expect(cam.isOverview()).toBe(true);
    cam.zoomTo(2, undefined, { animate: false });
    const p = cam.pose();
    const next = createViewport(1300, 820, 2);
    cam.setBase(next);
    expect(cam.pose().x).toBeCloseTo(p.x, 0);
    expect(cam.pose().zoom).toBeCloseTo(2);
  });

  it('notifies listeners on every move', () => {
    const cam = createCamera({ base: desk });
    const seen: number[] = [];
    cam.onChange((s) => seen.push(s.pose.zoom));
    cam.zoomTo(2);
    run(cam, 0.5);
    expect(seen.length).toBeGreaterThan(5);
  });
});
