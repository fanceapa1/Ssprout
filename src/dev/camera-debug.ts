import type { Camera, CameraPose, CameraSnapshot } from '../render/camera';
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
