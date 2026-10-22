/**
 * The camera over the 1600×1000 world (docs/systems/camera.md, ADRs 0160–0164).
 *
 * The renderer's cover viewport (`createViewport`, ADR 0123) is the **overview**: zoom 1, what the
 * stage shows today. The camera is a pose on top of it — a zoom ≥ 1 and the world point at the
 * stage's centre — and `composeView(base, pose)` turns the two into an ordinary `Viewport`, so
 * every world-unit drawing, DOM overlay and pointer conversion follows it unchanged.
 *
 * The view never leaves the painting: a pose is clamped so the zoomed view stays inside the
 * overview's visible rect (which on tall phones includes the paper rows above and below the world
 * that the light layer keeps lit). Glides follow van Wijk & Nuij's smooth zoom-and-pan path, eased
 * in time; user input interrupts them. Zoom gestures (ctrl/⌘ + wheel, trackpad pinch) approach
 * their target with a short exponential follow so wheel steps don't jump. Pure maths at the top,
 * the stateful controller (`createCamera`) below; time enters only as frame `dt` (animation
 * seconds), never the app clock.
 */
import { viewportFrom, WORLD_H, WORLD_W, type Pt, type Rect, type Viewport } from './viewport';

/** Zoom limits: the overview is the floor (you can never see less than the whole painting's frame). */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
/** Seconds a glide takes, at least / at most (scaled by the path length). */
export const GLIDE_MIN_S = 0.75;
export const GLIDE_MAX_S = 1.9;
/** van Wijk & Nuij's ρ: how much a long move zooms out on the way (√2 is their recommendation). */
export const GLIDE_RHO = 1.35;
/** Time constant (s) of the zoom-gesture follow (wheel steps ease in instead of jumping). */
export const FOLLOW_TAU = 0.075;
/** Zoom by which a view may reach the whole painted world (not only the overview's crop). */
export const FULL_REACH_ZOOM = 1.25;
/** Seconds without camera movement after which the view counts as resting (detail repaints start). */
export const REST_S = 0.25;

export interface CameraPose {
  /** ≥ 1 (1 = overview) */
  zoom: number;
  /** world point at the centre of the stage */
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/** The overview pose for a base (cover) viewport: zoom 1, centred on what it shows. */
export function overviewPose(base: Viewport): CameraPose {
  const v = base.visible;
  return { zoom: 1, x: v.x + v.w / 2, y: v.y + v.h / 2 };
}

/** CSS px of the stage a panel covers (a card): the view may reach that far past the painting's edge there. */
export type Inset = Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

/**
 * Where a view at `zoom` may go: the overview's visible rect at zoom 1 (so the overview is one
 * view), widening to the overview's rect ∪ the world by `FULL_REACH_ZOOM` — a phone's overview
 * crops the garden's sides, a wide stage its top and bottom, and a closer look may go there. On
 * tall phones the overview's rect includes the lit paper rows beyond the world.
 */
export function reachRect(base: Viewport, zoom: number): Rect {
  const v = base.visible;
  const x0 = Math.min(v.x, 0);
  const y0 = Math.min(v.y, 0);
  const x1 = Math.max(v.x + v.w, WORLD_W);
  const y1 = Math.max(v.y + v.h, WORLD_H);
  const t = clamp((zoom - 1) / (FULL_REACH_ZOOM - 1), 0, 1);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const x = lerp(v.x, x0);
  const y = lerp(v.y, y0);
  return { x, y, w: lerp(v.x + v.w, x1) - x, h: lerp(v.y + v.h, y1) - y };
}

/**
 * Keep a pose inside the limits: zoom in [1, maxZoom], the view inside `reachRect` — or, by
 * `slack` (CSS px), past its edge on a side a card covers, so a plant near the edge can still be
 * framed beside the card (what lies under the card is not seen).
 */
export function clampPose(base: Viewport, pose: CameraPose, maxZoom = MAX_ZOOM, slack: Inset = {}): CameraPose {
  const zoom = clamp(finite(pose.zoom, 1), MIN_ZOOM, Math.max(MIN_ZOOM, maxZoom));
  const o = base.visible;
  const v = reachRect(base, zoom);
  const k = 1 / (base.scale * zoom);
  const hw = o.w / zoom / 2;
  const hh = o.h / zoom / 2;
  const l = v.x - (slack.left ?? 0) * k;
  const r = v.x + v.w + (slack.right ?? 0) * k;
  const t = v.y - (slack.top ?? 0) * k;
  const b = v.y + v.h + (slack.bottom ?? 0) * k;
  return {
    zoom,
    x: clamp(finite(pose.x, o.x + o.w / 2), l + hw, Math.max(l + hw, r - hw)),
    y: clamp(finite(pose.y, o.y + o.h / 2), t + hh, Math.max(t + hh, b - hh)),
  };
}

/** Whether two poses show (practically) the same view. */
export function samePose(a: CameraPose, b: CameraPose, eps = 1e-6): boolean {
  return Math.abs(a.zoom - b.zoom) <= eps * Math.max(1, a.zoom) && Math.abs(a.x - b.x) <= eps * 1000 && Math.abs(a.y - b.y) <= eps * 1000;
}

export const isOverview = (base: Viewport, pose: CameraPose): boolean => samePose(pose, overviewPose(base));

/**
 * The view a pose shows: the base viewport zoomed by `pose.zoom` with `pose` at the stage's
 * centre. At the overview pose it is the base viewport itself.
 */
export function composeView(base: Viewport, pose: CameraPose): Viewport {
  if (isOverview(base, pose)) return base;
  const scale = base.scale * pose.zoom;
  return viewportFrom({
    cssW: base.cssW,
    cssH: base.cssH,
    dpr: base.dpr,
    scale,
    offsetX: base.cssW / 2 - pose.x * scale,
    offsetY: base.cssH / 2 - pose.y * scale,
    focus: { x: pose.x, y: pose.y },
  });
}

/** Zoom to `zoom` keeping the world point under `screen` (CSS px on the stage) where it is. */
export function zoomAbout(base: Viewport, pose: CameraPose, zoom: number, screen: Pt, maxZoom = MAX_ZOOM): CameraPose {
  const z = clamp(finite(zoom, pose.zoom), MIN_ZOOM, maxZoom);
  const world = composeView(base, pose).screenToWorld(screen);
  const scale = base.scale * z;
  return clampPose(base, { zoom: z, x: world.x - (screen.x - base.cssW / 2) / scale, y: world.y - (screen.y - base.cssH / 2) / scale }, maxZoom);
}

/** Move the view with a drag of (dx, dy) CSS px (the painting follows the pointer). */
export function panBy(base: Viewport, pose: CameraPose, dx: number, dy: number, maxZoom = MAX_ZOOM): CameraPose {
  const scale = base.scale * pose.zoom;
  return clampPose(base, { zoom: pose.zoom, x: pose.x - dx / scale, y: pose.y - dy / scale }, maxZoom);
}

export interface FrameOptions {
  /** fraction of the frame's height (and 0.9 × of its width) the rect should take (default 0.46) */
  fill?: number;
  /** where the rect's centre lands across the frame, 0..1 (default: a third-ish toward the side it is on) */
  anchorX?: number;
  /** where the rect's centre lands down the frame, 0..1 (default 0.54: a little low, ground under it) */
  anchorY?: number;
  /** CSS px of the stage kept clear (e.g. a card docked at the bottom on phones) */
  inset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  /** zoom bounds for the framing (default 1.6 … MAX_ZOOM) */
  minZoom?: number;
  maxZoom?: number;
}

/**
 * A pose that frames a world rect (a plant's sprite box) with some garden around it: zoomed so
 * it fills about `fill` of the frame, its centre placed slightly off-centre — on the side of the
 * stage it already stands on, a rule-of-thirds feel that keeps more garden toward the middle —
 * and a little low. The frame is the stage minus `inset`.
 */
export function framePose(base: Viewport, rect: Rect, opts: FrameOptions = {}): CameraPose {
  const fill = opts.fill ?? 0.46;
  const maxZoom = opts.maxZoom ?? MAX_ZOOM;
  const minZoom = Math.min(opts.minZoom ?? 1.6, maxZoom);
  const inset = { top: 0, right: 0, bottom: 0, left: 0, ...opts.inset };
  const fw = Math.max(40, base.cssW - inset.left - inset.right);
  const fh = Math.max(40, base.cssH - inset.top - inset.bottom);
  const w = Math.max(1, rect.w);
  const h = Math.max(1, rect.h);
  const zoom = clamp(Math.min((fw * Math.min(0.9, fill * 1.6)) / (w * base.scale), (fh * fill) / (h * base.scale)), minZoom, maxZoom);
  const cx = rect.x + w / 2;
  const cy = rect.y + h / 2;
  const v = base.visible;
  const side = cx < v.x + v.w / 2 ? 0.42 : 0.58;
  const sx = inset.left + fw * (opts.anchorX ?? side);
  const sy = inset.top + fh * (opts.anchorY ?? 0.54);
  const scale = base.scale * zoom;
  return clampPose(base, { zoom, x: cx - (sx - base.cssW / 2) / scale, y: cy - (sy - base.cssH / 2) / scale }, maxZoom, inset);
}

// ---------------------------------------------------------------------------------------------
// Glides

/** A view as the path sees it: centre and width in world units. */
interface PathView {
  x: number;
  y: number;
  w: number;
}

export interface GlidePath {
  /** path length in van Wijk & Nuij's units (≈ how far the eye travels) */
  length: number;
  /** the pose at s ∈ [0, 1] along the path */
  at(s: number): CameraPose;
}

/**
 * The smooth zoom-and-pan path from one pose to another (van Wijk & Nuij 2003, as in d3's
 * `interpolateZoom`): a long move at high zoom first eases out a little, travels, then eases in,
 * so the eye never loses its place. Poses are not clamped here (the caller clamps each frame).
 */
export function glidePath(base: Viewport, from: CameraPose, to: CameraPose, rho = GLIDE_RHO): GlidePath {
  const W = base.visible.w;
  const a: PathView = { x: from.x, y: from.y, w: W / from.zoom };
  const b: PathView = { x: to.x, y: to.y, w: W / to.zoom };
  const pose = (v: PathView): CameraPose => ({ zoom: W / v.w, x: v.x, y: v.y });
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const d1 = Math.sqrt(d2);
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;
  if (d1 < 1e-6 * W) {
    // zoom in place (log-linear), centre moves straight
    const k = Math.log(b.w / a.w);
    return {
      length: Math.abs(k) / rho,
      at: (s) => pose({ x: a.x + dx * s, y: a.y + dy * s, w: a.w * Math.exp(k * s) }),
    };
  }
  const b0 = (b.w * b.w - a.w * a.w + rho4 * d2) / (2 * a.w * rho2 * d1);
  const b1 = (b.w * b.w - a.w * a.w - rho4 * d2) / (2 * b.w * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const cosh0 = Math.cosh(r0);
  const sinh0 = Math.sinh(r0);
  return {
    length: S,
    at(s) {
      if (s <= 0) return { ...from };
      if (s >= 1) return { ...to };
      const t = s * S;
      const u = (a.w / (rho2 * d1)) * (cosh0 * Math.tanh(rho * t + r0) - sinh0);
      return pose({ x: a.x + u * dx, y: a.y + u * dy, w: (a.w * cosh0) / Math.cosh(rho * t + r0) });
    },
  };
}

/** Ease in and out like a breath (sine): gentle start, gentle landing, never linear. */
export function easeGlide(u: number): number {
  const t = clamp(u, 0, 1);
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** How long a glide along a path of this length takes (s). */
export function glideSeconds(length: number): number {
  return clamp(0.7 + 0.42 * Math.abs(finite(length, 0)), GLIDE_MIN_S, GLIDE_MAX_S);
}

// ---------------------------------------------------------------------------------------------
// The controller

export type CameraReason = 'user' | 'session' | 'switch' | 'plant' | 'placement' | 'overview' | 'dev';

export interface CameraSnapshot {
  pose: CameraPose;
  /** where a glide or gesture is heading, else null */
  target: CameraPose | null;
  /** a glide, gesture follow or drag is under way (or stopped less than REST_S ago) */
  moving: boolean;
  gliding: boolean;
  overview: boolean;
  /** what last moved the camera */
  reason: CameraReason;
  maxZoom: number;
  /** the pose caches are kept sharp for (the glide's destination, else the resting view) */
  detail: CameraPose;
  /** bumps whenever `detail` changes */
  detailVersion: number;
}

export interface GlideOptions {
  /** false: cut there now (also the default under reduced motion) */
  animate?: boolean;
  reason?: CameraReason;
}

/** What a system sees of the camera (SystemContext.camera): read-only, live. */
export interface CameraView {
  /** this frame's world → screen mapping (the overview composed with the camera) */
  view(): Viewport;
  /** the view caches should be sharp for: the glide's destination, else the view once it rests */
  detailView(): Viewport;
  /** bumps whenever `detailView()` changes */
  readonly detailVersion: number;
  /** the camera is moving (caches should wait; draw what they have) */
  moving(): boolean;
  /** zoom 1 */
  isOverview(): boolean;
}

export interface Camera extends CameraView {
  pose(): CameraPose;
  state(): CameraSnapshot;
  /** the overview viewport the camera composes with (replaced on resize) */
  base(): Viewport;
  setBase(base: Viewport): void;
  /** advance glides and follows by `dt` animation seconds; true when the pose changed */
  update(dt: number): boolean;
  /** glide (or cut) to a pose */
  glideTo(pose: CameraPose, opts?: GlideOptions): void;
  /** frame a world rect (a plant) — see `framePose` */
  focusRect(rect: Rect, opts?: GlideOptions & FrameOptions): void;
  overview(opts?: GlideOptions): void;
  /** zoom to an absolute zoom about a stage point (default: the stage centre), gliding */
  zoomTo(zoom: number, about?: Pt, opts?: GlideOptions): void;
  /** gesture zoom by a factor about a stage point: eases in quickly (wheel / pinch); `instant` applies it now */
  zoomBy(factor: number, about: Pt, opts?: { instant?: boolean }): void;
  /** drag by CSS px (immediate) */
  panBy(dx: number, dy: number): void;
  /** finish the current glide or follow now (tests, screenshots) */
  settle(): void;
  /**
   * A card covers this much of the stage (CSS px per side): the view may reach past the painting
   * there. `null` when it closes: a view that relied on it glides back inside.
   */
  setInset(inset: Inset | null): void;
  /** stop a glide or follow where it is (user input takes over) */
  interrupt(): void;
  /** called after every pose change (and when a move starts or rests) */
  onChange(fn: (s: CameraSnapshot) => void): () => void;
  readonly maxZoom: number;
}

export interface CameraOptions {
  base: Viewport;
  reducedMotion?: boolean;
  maxZoom?: number;
}

interface Glide {
  path: GlidePath;
  from: CameraPose;
  to: CameraPose;
  t: number;
  dur: number;
}

interface Follow {
  zoom: number;
  about: Pt;
}

export function createCamera(opts: CameraOptions): Camera {
  const maxZoom = opts.maxZoom ?? MAX_ZOOM;
  const reduced = opts.reducedMotion ?? false;
  let base = opts.base;
  let pose = overviewPose(base);
  let view: Viewport = base;
  let glide: Glide | null = null;
  let follow: Follow | null = null;
  let quiet = Infinity;
  let reason: CameraReason = 'overview';
  let detail: CameraPose = pose;
  let detailVersion = 0;
  let detailViewCache: { pose: CameraPose; base: Viewport; view: Viewport } | null = null;
  const listeners = new Set<(s: CameraSnapshot) => void>();
  let inset: Inset = {};

  const clampP = (p: CameraPose) => clampPose(base, p, maxZoom, inset);

  const followTarget = (f: Follow): CameraPose => zoomAbout(base, pose, f.zoom, f.about, maxZoom);

  const target = (): CameraPose | null => (glide ? glide.to : follow ? followTarget(follow) : null);

  const moving = () => glide !== null || follow !== null || quiet < REST_S;

  const snapshot = (): CameraSnapshot => ({
    pose: { ...pose },
    target: target(),
    moving: moving(),
    gliding: glide !== null,
    overview: isOverview(base, pose),
    reason,
    maxZoom,
    detail: { ...detail },
    detailVersion,
  });

  const notify = () => {
    if (listeners.size === 0) return;
    const s = snapshot();
    for (const fn of [...listeners]) fn(s);
  };

  /** the pose caches should be sharp for; bump the version when it changes */
  const refreshDetail = () => {
    const next = glide ? glide.to : follow ? followTarget(follow) : quiet >= REST_S ? pose : detail;
    if (!samePose(next, detail, 1e-4)) {
      detail = { ...next };
      detailVersion++;
    }
  };

  const setPose = (p: CameraPose) => {
    const next = clampP(p);
    if (samePose(next, pose, 1e-9)) return false;
    pose = next;
    view = composeView(base, pose);
    quiet = 0;
    return true;
  };

  const startGlide = (to: CameraPose, o: GlideOptions = {}) => {
    const dest = clampP(to);
    reason = o.reason ?? 'user';
    follow = null;
    if (o.animate === false || reduced) {
      glide = null;
      setPose(dest);
      quiet = REST_S; // a cut rests at once
      refreshDetail();
      notify();
      return;
    }
    if (samePose(dest, pose, 1e-6)) {
      glide = null;
      refreshDetail();
      notify();
      return;
    }
    const path = glidePath(base, pose, dest);
    glide = { path, from: { ...pose }, to: dest, t: 0, dur: glideSeconds(path.length) };
    refreshDetail();
    notify();
  };

  const cam: Camera = {
    maxZoom,
    pose: () => ({ ...pose }),
    state: snapshot,
    base: () => base,
    view: () => view,
    detailView() {
      if (!detailViewCache || detailViewCache.base !== base || !samePose(detailViewCache.pose, detail, 1e-9)) {
        detailViewCache = { pose: { ...detail }, base, view: composeView(base, clampP(detail)) };
      }
      return detailViewCache.view;
    },
    get detailVersion() {
      return detailVersion;
    },
    moving,
    isOverview: () => isOverview(base, pose),
    setBase(next) {
      if (next === base) return;
      const wasOverview = isOverview(base, pose);
      // keep the same world point centred at the same zoom (clamped to the new frame)
      base = next;
      glide = glide ? { ...glide, path: glidePath(base, glide.from, glide.to) } : null;
      pose = wasOverview ? overviewPose(base) : clampP(pose);
      view = composeView(base, pose);
      if (wasOverview) detail = { ...pose };
      detailVersion++;
      detailViewCache = null;
      notify();
    },
    update(dt) {
      const step = Math.max(0, finite(dt, 0));
      let changed = false;
      const wasMoving = moving();
      if (glide) {
        glide.t += step;
        const u = glide.dur > 0 ? glide.t / glide.dur : 1;
        if (u >= 1) {
          changed = setPose(glide.to);
          glide = null;
        } else {
          changed = setPose(glide.path.at(easeGlide(u)));
        }
      } else if (follow) {
        const goal = followTarget(follow);
        const k = step > 0 ? 1 - Math.exp(-step / FOLLOW_TAU) : 0;
        const z = Math.exp(Math.log(pose.zoom) + (Math.log(follow.zoom) - Math.log(pose.zoom)) * k);
        if (Math.abs(Math.log(goal.zoom / pose.zoom)) < 0.002) {
          changed = setPose(goal);
          follow = null;
        } else {
          changed = setPose(zoomAbout(base, pose, z, follow.about, maxZoom));
        }
      }
      if (!changed) quiet += step;
      refreshDetail();
      if (changed || wasMoving !== moving()) notify();
      return changed;
    },
    glideTo: (p, o) => startGlide(p, o),
    focusRect(rect, o = {}) {
      startGlide(framePose(base, rect, { ...o, maxZoom: Math.min(o.maxZoom ?? maxZoom, maxZoom) }), o);
    },
    overview: (o) => startGlide(overviewPose(base), { reason: 'overview', ...o }),
    zoomTo(zoom, about, o) {
      const at = about ?? { x: base.cssW / 2, y: base.cssH / 2 };
      startGlide(zoomAbout(base, pose, zoom, at, maxZoom), o);
    },
    zoomBy(factor, about, o = {}) {
      glide = null;
      reason = 'user';
      const from = follow ? follow.zoom : pose.zoom;
      const zoom = clamp(from * (Number.isFinite(factor) && factor > 0 ? factor : 1), MIN_ZOOM, maxZoom);
      if (o.instant || reduced) {
        follow = null;
        setPose(zoomAbout(base, pose, zoom, about, maxZoom));
        refreshDetail();
        notify();
        return;
      }
      follow = { zoom, about: { ...about } };
      refreshDetail();
      notify();
    },
    panBy(dx, dy) {
      glide = null;
      follow = null;
      reason = 'user';
      if (setPose(panBy(base, pose, dx, dy, maxZoom))) notify();
    },
    settle() {
      if (glide) setPose(glide.to);
      else if (follow) setPose(followTarget(follow));
      glide = null;
      follow = null;
      quiet = REST_S;
      refreshDetail();
      notify();
    },
    setInset(next) {
      inset = next ? { ...next } : {};
      if (next) return;
      const inside = clampP(pose);
      const goal = glide ? clampP(glide.to) : null;
      if (goal && !samePose(goal, glide!.to, 1e-6)) startGlide(goal, { reason });
      else if (!glide && !samePose(inside, pose, 1e-6)) startGlide(inside, { reason });
    },
    interrupt() {
      if (!glide && !follow) return;
      glide = null;
      follow = null;
      refreshDetail();
      notify();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  return cam;
}
