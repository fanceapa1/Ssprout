/**
 * A small painted stage for looking at creatures on their own (studio): a pond, a perch rock,
 * stepping stones, a few flowering plants and a lily pad, with a FaunaSim running on top.
 */
import { createRng } from '../core/rng';
import type { PlantInstance } from '../core/state';
import { createPainter, lighten, makeCanvas, mix, paperTexture, PIGMENTS, type AnyCanvas } from '../paint';
import type { LayerId } from '../render/types';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { FaunaSim } from './sim';
import type { TargetSpecies } from './targets';
import type { FaunaKind } from './tuning';

export interface StageSpec {
  /** world units shown */
  w: number;
  h: number;
}

export function stageScene({ w, h }: StageSpec): SceneGeometry {
  const cx = w * 0.52;
  const cy = h * 0.6;
  const rx = w * 0.34;
  const ry = h * 0.17;
  const wob = [1, 0.95, 1.04, 0.98, 0.92, 1.03, 1.06, 0.97, 1, 0.94, 1.02, 1.05];
  const pond = wob.map((k, i) => {
    const a = (i / wob.length) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k };
  });
  const slot = (id: string, x: number, y: number, habitat: Slot['habitat']): Slot => ({ id, x, y, habitat, maxSize: 'medium', scale: 1 });
  return {
    pond,
    waterline: cy,
    rocks: [{ id: 'stage-rock', x: cx - rx * 0.92, y: cy + ry * 0.55, w: w * 0.1, h: h * 0.07, perch: true }],
    path: [
      { x: cx + rx * 0.25, y: cy + ry * 1.75, rx: w * 0.035, ry: h * 0.014 },
      { x: cx + rx * 0.05, y: cy + ry * 2.2, rx: w * 0.04, ry: h * 0.016 },
    ],
    pavilion: { x: w, y: 0, w: 1, h: 1, lantern: { x: w, y: 0 } },
    slots: [
      slot('stage-meadow-1', w * 0.12, h * 0.93, 'meadow'),
      slot('stage-meadow-2', w * 0.88, h * 0.9, 'meadow'),
      slot('stage-shore-1', cx + rx * 1.05, cy + ry * 0.4, 'shore'),
      slot('stage-water-1', cx + rx * 0.45, cy - ry * 0.1, 'water'),
    ],
    skyBand: { top: h * 0.06, bottom: h * 0.32 },
  };
}

const FLOWER: TargetSpecies = { pollinators: true, habitats: ['meadow', 'shore'], size: { w: 50, h: 80 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: PIGMENTS.sakura };
const LILY: TargetSpecies = { pollinators: false, habitats: ['water'], size: { w: 46, h: 20 }, anchor: { x: 0.5, y: 0.6 }, bloomColor: PIGMENTS.petalWhite };
const stageLookup = (id: string) => (id === 'stage-lily' ? LILY : id === 'stage-flower' ? FLOWER : undefined);

function stagePlants(scene: SceneGeometry): PlantInstance[] {
  return scene.slots.map((s, i) => ({
    id: `stage-${i}`,
    speciesId: s.habitat === 'water' ? 'stage-lily' : 'stage-flower',
    slotId: s.id,
    seed: 11 + i,
    plantedAt: 0,
    sessionMinutes: 25,
    taskName: 'stage',
    completedAt: 0,
  }));
}

/** Paint the stage backdrop on white (the paper is multiplied at the end of each frame). */
function paintBackdrop(canvas: AnyCanvas, scene: SceneGeometry, spec: StageSpec, k: number, seed: number): void {
  const p = createPainter(canvas, { seed });
  const ctx = p.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const rng = createRng(seed);
  const { w, h } = spec;
  p.wetInWet(
    [
      { x: -10, y: h * 0.42 },
      { x: w + 10, y: h * 0.38 },
      { x: w + 10, y: h + 10 },
      { x: -10, y: h + 10 },
    ],
    PIGMENTS.sageLight,
    lighten(PIGMENTS.sap, 0.2),
    { rng, opacity: 0.35, edge: 0.15, fade: { angle: -Math.PI / 2, start: 0.5 } },
  );
  p.waterBody(scene.pond, { rng, ripples: 2 });
  for (const s of scene.path) p.stone({ cx: s.x, cy: s.y, rx: s.rx, ry: s.ry }, { rng, moss: 0, groundShadow: false });
  for (const r of scene.rocks) p.stone({ x: r.x, y: r.y, w: r.w, h: r.h }, { rng });
  for (const s of scene.slots) {
    if (s.habitat === 'water') {
      p.wash({ cx: s.x, cy: s.y, rx: 22, ry: 8 }, mix(PIGMENTS.sap, PIGMENTS.celadonMid, 0.3), { rng, opacity: 0.8, blooms: 1 });
      continue;
    }
    const bx = s.x;
    const by = s.y;
    p.grassTuft({ x: bx, y: by }, { rng, height: 34 });
    for (let i = 0; i < 3; i++) {
      const sx = bx + rng.range(-14, 14);
      const top = by - rng.range(48, 70);
      p.inkLine([{ x: bx + rng.range(-3, 3), y: by }, { x: sx, y: top }], { rng, width: 0.9, pigment: PIGMENTS.olive, opacity: 0.6 });
      for (let k2 = 0; k2 < 5; k2++) p.dab({ x: sx, y: top }, PIGMENTS.sakura, { rng, variant: 'petal', angle: (k2 / 5) * Math.PI * 2, length: 7, opacity: 0.8 });
    }
  }
}

const paperCache = new Map<string, AnyCanvas>();

export class Stage {
  readonly sim: FaunaSim;
  readonly scene: SceneGeometry;
  private backdrop: AnyCanvas | null = null;
  private key = '';
  respawnAt = -1;

  constructor(
    readonly spec: StageSpec,
    readonly seed: number,
    readonly only: FaunaKind | null,
  ) {
    this.scene = stageScene(spec);
    this.sim = new FaunaSim({ scene: this.scene, seed, auto: only === null, view: { x: 0, y: 0, w: spec.w, h: spec.h } });
    const all = ['striders', 'dragonfly', 'koi-1', 'butterflies', 'bees', 'koi-2', 'small-birds', 'frog', 'swallows', 'heron', 'koi-3'];
    this.sim.setGarden(stagePlants(this.scene), only === null ? all : [], stageLookup);
    this.sim.hourOverride = 12;
  }

  /** Single-creature stages bring the creature back a moment after it has left. */
  tickRespawn(t: number): void {
    if (!this.only) return;
    if (this.sim.creatures.some((c) => c.kind === this.only)) return;
    if (this.respawnAt < 0) this.respawnAt = t < 0.05 ? t : t + 1.5;
    if (t >= this.respawnAt) {
      this.sim.spawn(this.only, { count: this.only === 'swallow' ? 3 : this.only === 'bee' ? 2 : 1 });
      this.respawnAt = -1;
    }
  }

  /** Advance and draw into a studio canvas (logical size × pixelRatio). */
  render(canvas: HTMLCanvasElement, t: number, dt: number): void {
    const k = canvas.width / this.spec.w;
    this.sim.setResolution(k);
    const key = `${canvas.width}x${canvas.height}`;
    if (!this.backdrop || this.key !== key) {
      this.backdrop = makeCanvas(canvas.width, canvas.height);
      paintBackdrop(this.backdrop, this.scene, this.spec, k, this.seed);
      this.key = key;
    }
    this.tickRespawn(t);
    this.sim.update(Math.min(dt, 0.1), t, 0);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop as CanvasImageSource, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const layers: LayerId[] = ['underwater', 'waterSurface'];
    for (const l of layers) {
      ctx.save();
      this.sim.draw(l, ctx);
      ctx.restore();
    }
    const ents = this.sim.entities().sort((a, b) => a.depth - b.depth);
    for (const d of ents) {
      ctx.save();
      d.draw(ctx, { t, dt, now: 0 });
      ctx.restore();
    }
    ctx.save();
    this.sim.draw('air', ctx);
    ctx.restore();
    multiplyPaper(canvas);
  }
}

export function multiplyPaper(canvas: HTMLCanvasElement): void {
  const key = `${canvas.width}x${canvas.height}`;
  let paper = paperCache.get(key);
  if (!paper) {
    paper = paperTexture(canvas.width, canvas.height, 1);
    paperCache.set(key, paper);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paper as CanvasImageSource, 0, 0);
  ctx.restore();
}
