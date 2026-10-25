import { samePose, type Camera, type CameraPose, type CameraReason, type CameraSnapshot } from '../render/camera';
import type { Renderer } from '../render/renderer';
import type { Pt, Rect } from '../render/viewport';
import type { Slot } from '../scene/geometry';
import type { UI } from '../ui';
import { extendDebug } from './debug';

/** `window.sprout.camera` (?dev): the camera for tests and screenshots (docs/systems/camera.md). */
declare module './debug' {
  interface SproutDebug {
    camera: {
      /** pose, glide target, moving, overview, reason, detail view */
      state(): CameraSnapshot & { view: { scale: number; visible: Rect }; autoFocus: boolean; touchAction: string; cursor: string };
      /** frame a slot as if a seedling stood there (`{ animate: false }` cuts) */
      focusSlot(slotId: string, opts?: { animate?: boolean }): boolean;
      /** frame a plant (finished plant id or session id) */
      focusPlant(id: string, opts?: { animate?: boolean }): boolean;
      /** zoom about a stage point (default: the middle) */
      zoomTo(zoom: number, about?: Pt, opts?: { animate?: boolean }): void;
      /** glide (or cut) to an exact pose */
      glideTo(pose: CameraPose, opts?: { animate?: boolean }): void;
      overview(opts?: { animate?: boolean }): void;
      /**
       * Finish any glide now, then resolve once the frame at rest is drawn and the sharp detail
       * for the view (scene painting, light plates, plant sprites) is ready.
       */
      settle(): Promise<void>;
      /**
       * The camera's last glides, oldest first (at most GLIDE_LOG_MAX): one record per animated
       * glide when it starts, closed when it ends. Tests assert what glided where from this log
       * instead of catching `state().gliding` mid-flight, which a loaded machine may finish
       * between two round trips. Cuts (`animate: false`, reduced motion) and gestures are not glides.
       */
      glides(): GlideRecord[];
      /** forget the logged glides (call it in the same task as the action under test) */
      clearGlides(): void;
      /** follow session starts and switches (default on); tests that compare pixels at the overview turn it off */
      autoFocus(on: boolean): void;
      /** world point → client (window) CSS px, for real pointer input in tests */
      toClient(world: Pt): Pt;
      /** open a plant's card as a click would (and glide onto it) */
      openCard(id: string): boolean;
      closeCard(): void;
    };
  }
}

/** One animated glide, as `sprout.camera.glides()` reports it. */
export interface GlideRecord {
  /** what started it (`state().reason` when it began) */
  reason: CameraReason;
  /** the pose it left from */
  from: CameraPose;
  /** the pose it was heading for */
  target: CameraPose;
  /** `performance.now()` when it started and ended (null while it runs) */
  startedAt: number;
  endedAt: number | null;
  /**
   * null while it runs; `arrived`: reached its target (by frames or `settle()`); `interrupted`:
   * stopped short (input, or a cut elsewhere); `replaced`: another glide took over
   */
  end: 'arrived' | 'interrupted' | 'replaced' | null;
}

export const GLIDE_LOG_MAX = 20;

/** Log the camera's glides from its change notifications (no hook in the camera itself). */
export function recordGlides(cam: Pick<Camera, 'onChange'>, now: () => number = () => performance.now()): { list(): GlideRecord[]; clear(): void } {
  const log: GlideRecord[] = [];
  let current: GlideRecord | null = null;
  cam.onChange((s: CameraSnapshot) => {
    const heading = s.gliding ? s.target : null;
    if (current && (!heading || !samePose(heading, current.target, 1e-6))) {
      current.endedAt = now();
      current.end = heading ? 'replaced' : samePose(s.pose, current.target, 1e-4) ? 'arrived' : 'interrupted';
      current = null;
    }
    if (heading && !current) {
      // a glide is announced before its first step: the pose is still where it starts
      current = { reason: s.reason, from: { ...s.pose }, target: { ...heading }, startedAt: now(), endedAt: null, end: null };
      log.push(current);
      if (log.length > GLIDE_LOG_MAX) log.shift();
    }
  });
  return {
    list: () => log.map((g) => ({ ...g, from: { ...g.from }, target: { ...g.target } })),
    // a glide under way when the log is cleared is still followed, so it does not come back as new
    clear: () => {
      log.length = 0;
    },
  };
}

export interface CameraDebugDeps {
  renderer: Renderer;
  ui: UI;
  slots: readonly Slot[];
  /** world box a species would have in a slot / a plant's box */
  boundsForSlot(slotId: string): Rect | null;
  plantBounds(id: string): Rect | null;
  /** resolves once the detail for the resting view is painted (scene, light, sprites) */
  whenDetail(): Promise<void>;
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function installCameraDebug(d: CameraDebugDeps): void {
  const cam: Camera = d.renderer.camera;
  const glideLog = recordGlides(cam);
  extendDebug({
    camera: {
      state() {
        const v = cam.view();
        const ui = d.ui.camera?.state();
        return { ...cam.state(), view: { scale: v.scale, visible: { ...v.visible } }, autoFocus: ui?.autoFocus ?? false, touchAction: ui?.touchAction ?? '', cursor: ui?.cursor ?? '' };
      },
      focusSlot(slotId: string, opts?: { animate?: boolean }) {
        const box = d.boundsForSlot(slotId);
        if (!box) return false;
        cam.focusRect(box, { reason: 'dev', ...opts });
        return true;
      },
      focusPlant(id: string, opts?: { animate?: boolean }) {
        const box = d.plantBounds(id);
        if (!box) return false;
        cam.focusRect(box, { reason: 'dev', ...opts });
        return true;
      },
      zoomTo: (zoom: number, about?: Pt, opts?: { animate?: boolean }) => cam.zoomTo(zoom, about, { reason: 'dev', ...opts }),
      glideTo: (pose: CameraPose, opts?: { animate?: boolean }) => cam.glideTo(pose, { reason: 'dev', ...opts }),
      overview: (opts?: { animate?: boolean }) => cam.overview({ reason: 'dev', ...opts }),
      async settle() {
        cam.settle();
        // an off-screen stage draws no frames (ADR 0224): one still frame lets the systems see the rest
        if (!d.renderer.visible) d.renderer.renderOnce();
        await frame();
        await d.whenDetail();
        if (d.renderer.frozen) d.renderer.renderOnce();
        else await frame();
      },
      glides: () => glideLog.list(),
      clearGlides: () => glideLog.clear(),
      autoFocus: (on: boolean) => d.ui.camera?.setAutoFocus(on),
      toClient(world: Pt) {
        const p = d.renderer.viewport.worldToScreen(world);
        const r = d.ui.stage.el.querySelector('canvas')?.getBoundingClientRect() ?? d.ui.stage.el.getBoundingClientRect();
        return { x: p.x + r.left, y: p.y + r.top };
      },
      openCard: (id: string) => d.ui.camera?.openCard(id) ?? false,
      closeCard: () => d.ui.camera?.closeCard(),
    },
  });
}
