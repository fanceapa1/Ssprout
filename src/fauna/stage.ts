/**
 * Small painted stages for looking at creatures on their own (studio), with a FaunaSim running on
 * top: the pond (a perch rock, stepping stones, flowering plants, a lily pad) and the falls (a
 * plunge pool with foam at the foot, a stream, a ledge and wet rocks; ADR 0248).
 */
import { createRng } from '../core/rng';
import type { PlantInstance } from '../core/state';
import { createPainter, lighten, makeCanvas, mix, paperTexture, PIGMENTS, type AnyCanvas } from '../paint';
import type { LayerId } from '../render/types';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { JAPANESE_FAUNA } from '../scenery/japanese-garden/fauna';
import { WATERFALL_FAUNA } from '../scenery/waterfall/fauna';
import type { Show } from './creatures/lib/def';
import type { Foam, SceneryFauna } from './habitat';
import { ledgePerch, perchesOf } from './targets';
import { pointInPolygon } from './math';
import { creatureDef } from './creatures/registry';
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
    streams: [],
    falls: null,
    structure: null,
    lights: [],
    eave: null,
    slots: [
      slot('stage-meadow-1', w * 0.12, h * 0.93, 'meadow'),
      slot('stage-meadow-2', w * 0.88, h * 0.9, 'meadow'),
      slot('stage-shore-1', cx + rx * 1.05, cy + ry * 0.4, 'shore'),
      slot('stage-water-1', cx + rx * 0.45, cy - ry * 0.1, 'water'),
    ],
    skyBand: { top: h * 0.06, bottom: h * 0.32 },
  };
}

/** Where the falls stage's cliff stands (behind the pool, left of the stream). */
function fallsCliff({ w, h }: StageSpec) {
  const back = h * 0.52;
  return [
    { x: -10, y: h * 0.06 },
    { x: w * 0.7, y: h * 0.1 },
    { x: w * 0.74, y: back - h * 0.06 },
    { x: w * 0.7, y: back },
    { x: -10, y: back + h * 0.02 },
  ];
}

/** The falls stage: a plunge pool under a narrow fall, foam at its foot, a stream running out right. */
export function fallsStage(spec: StageSpec): { scene: SceneGeometry; habitat: SceneryFauna; foam: Foam; ledge: [{ x: number; y: number }, { x: number; y: number }] } {
  const { w, h } = spec;
  const cx = w * 0.46;
  const back = h * 0.52;
  const ry = h * 0.15;
  const cy = back + ry;
  const rx = w * 0.3;
  const pool = Array.from({ length: 16 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 16) * Math.PI * 2;
    const flat = Math.sin(a) < 0 ? 0.92 : 1;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry * flat };
  });
  const sx = cx + rx * 0.82;
  const stream = [
    { x: sx - w * 0.03, y: cy - ry * 0.3 },
    { x: sx + w * 0.05, y: cy - ry * 0.45 },
    { x: w * 0.98, y: h * 1.02 },
    { x: w * 0.82, y: h * 1.02 },
  ];
  const foot = { x: w * 0.36, y: back + 2 };
  const falls = {
    outline: [
      { x: foot.x - w * 0.035, y: h * 0.1 },
      { x: foot.x + w * 0.035, y: h * 0.1 },
      { x: foot.x + w * 0.05, y: foot.y },
      { x: foot.x - w * 0.05, y: foot.y },
    ],
    lip: [
      { x: foot.x - w * 0.035, y: h * 0.1 },
      { x: foot.x + w * 0.035, y: h * 0.1 },
    ],
    foot,
  };
  const foam: Foam = { x: foot.x, y: foot.y + 4, rx: w * 0.1, ry: h * 0.045 };
  const ledge: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: w * 0.06, y: h * 0.3 },
    { x: w * 0.26, y: h * 0.31 },
  ];
  const slot = (id: string, x: number, y: number, habitat: Slot['habitat']): Slot => ({ id, x, y, habitat, maxSize: 'medium', scale: 1 });
  const rocks = [
    { id: 'falls-wet-rock', x: cx + rx * 0.35, y: cy - ry * 0.2, w: w * 0.09, h: h * 0.06, perch: true },
    { id: 'falls-stream-rock', x: w * 0.88, y: h * 0.86, w: w * 0.07, h: h * 0.05, perch: true },
  ];
  const scene: SceneGeometry = {
    pond: pool,
    waterline: back,
    rocks,
    path: [],
    streams: [stream],
    falls,
    structure: null,
    lights: [],
    eave: null,
    slots: [slot('falls-ledge-1', w * 0.16, h * 0.305, 'rock'), slot('falls-bank-1', w * 0.1, h * 0.93, 'meadow'), slot('falls-bank-2', w * 0.66, h * 0.95, 'shore')],
    skyBand: { top: h * 0.02, bottom: h * 0.2 },
  };
  const cliff = fallsCliff(spec);
  const habitat: SceneryFauna = {
    unlocks: WATERFALL_FAUNA,
    water: { still: pool, moving: [stream], avoid: [foam] },
    perches: [...perchesOf({ rocks, path: [] }), ledgePerch('falls-ledge', ledge[0], ledge[1])],
    stands: [{ x: cx + rx * 0.6, y: back + ry * 0.35, facing: -1 }],
    // the cliff stands a little farther back than the pool
    perspective: (x, y) => (pointInPolygon({ x, y }, cliff) ? 0.85 : 1),
  };
  return { scene, habitat, foam, ledge };
}

const FLOWER: TargetSpecies = { pollinators: true, habitats: ['meadow', 'shore'], size: { w: 50, h: 80 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: PIGMENTS.sakura };
const LILY: TargetSpecies = { pollinators: false, habitats: ['water'], size: { w: 46, h: 20 }, anchor: { x: 0.5, y: 0.6 }, bloomColor: PIGMENTS.petalWhite };
const stageLookup = (id: string) => (id === 'stage-lily' ? LILY : id === 'stage-flower' ? FLOWER : undefined);

function stagePlants(scene: SceneGeometry): PlantInstance[] {
  return scene.slots.map((s, i) => ({
    id: `stage-${i}`,
    speciesId: s.habitat === 'water' ? 'stage-lily' : 'stage-flower',
    sceneryId: 'japanese-garden',
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

/** Paint the falls stage on white: the wet cliff with the fall left as paper, the ledge, the pool and stream, the foam reserved. */
function paintFallsBackdrop(canvas: AnyCanvas, spec: StageSpec, k: number, seed: number): void {
  const { scene, foam, ledge } = fallsStage(spec);
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
      { x: -10, y: h * 0.5 },
      { x: w + 10, y: h * 0.42 },
      { x: w + 10, y: h + 10 },
      { x: -10, y: h + 10 },
    ],
    PIGMENTS.sageLight,
    lighten(PIGMENTS.sap, 0.2),
    { rng, opacity: 0.3, edge: 0.15, fade: { angle: -Math.PI / 2, start: 0.5 } },
  );
  p.wetInWet(fallsCliff(spec), PIGMENTS.stone, mix(PIGMENTS.stoneDark, PIGMENTS.sage, 0.3), { rng, opacity: 0.55, edge: 0.3 });
  p.lift(scene.falls!.outline, { rng, amount: 0.9, layers: 4 });
  for (let i = 0; i < 5; i++) {
    const x = scene.falls!.foot.x + rng.range(-0.03, 0.03) * w;
    p.inkLine([{ x, y: h * 0.11 }, { x: x + rng.range(-3, 3), y: scene.falls!.foot.y - 4 }], { rng, width: 0.6, pigment: PIGMENTS.celadonMid, opacity: 0.35 });
  }
  p.inkLine([ledge[0], ledge[1]], { rng, width: 1.6, pigment: PIGMENTS.stoneDark, opacity: 0.7 });
  p.wash([ledge[0], ledge[1], { x: ledge[1].x - 4, y: ledge[1].y + 10 }, { x: ledge[0].x + 4, y: ledge[0].y + 12 }], mix(PIGMENTS.sage, PIGMENTS.olive, 0.4), { rng, opacity: 0.6 });
  p.wash(scene.streams[0]!, mix(PIGMENTS.celadonMid, PIGMENTS.celadon, 0.5), { rng, opacity: 0.55 });
  p.waterBody(scene.pond, { rng, ripples: 2 });
  p.lift({ cx: foam.x, cy: foam.y, rx: foam.rx, ry: foam.ry }, { rng, amount: 0.8, layers: 4 });
  for (const r of scene.rocks) p.stone({ x: r.x, y: r.y, w: r.w, h: r.h }, { rng });
  for (const s of scene.slots) p.grassTuft({ x: s.x, y: s.y }, { rng, height: 30 });
}

const paperCache = new Map<string, AnyCanvas>();
const backdrops = new Map<string, AnyCanvas>();

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
    readonly kind: NonNullable<Show['stage']> = 'pond',
  ) {
    const view = { x: 0, y: 0, w: spec.w, h: spec.h };
    if (kind === 'falls') {
      const falls = fallsStage(spec);
      this.scene = falls.scene;
      this.sim = new FaunaSim({ scene: this.scene, seed, auto: only === null, view, habitat: falls.habitat });
      // the waterfall's rows (a single creature: its own, so it takes the waterfall's variant)
      this.sim.setGarden(stagePlants(this.scene), WATERFALL_FAUNA.filter((f) => only === null || f.kind === only), stageLookup);
    } else {
      this.scene = stageScene(spec);
      this.sim = new FaunaSim({ scene: this.scene, seed, auto: only === null, view });
      this.sim.setGarden(stagePlants(this.scene), only === null ? JAPANESE_FAUNA : [], stageLookup);
    }
    this.sim.hourOverride = 12;
  }

  /** Single-creature stages bring the creature back a moment after it has left. */
  tickRespawn(t: number): void {
    if (!this.only) return;
    if (this.sim.creatures.some((c) => c.kind === this.only)) return;
    if (this.respawnAt < 0) this.respawnAt = t < 0.05 ? t : t + 1.5;
    if (t >= this.respawnAt) {
      this.sim.spawn(this.only, { count: creatureDef(this.only)?.show?.group ?? 1 });
      this.respawnAt = -1;
    }
  }

  /** Advance and draw into a studio canvas (logical size × pixelRatio). */
  render(canvas: HTMLCanvasElement, t: number, dt: number): void {
    const k = canvas.width / this.spec.w;
    this.sim.setResolution(k);
    const key = `${canvas.width}x${canvas.height}`;
    if (!this.backdrop || this.key !== key) {
      // the backdrop doesn't depend on the seed: shared across reseeds and stages of one size
      const shared = `${this.kind}:${this.spec.w}x${this.spec.h}@${key}`;
      let bd = backdrops.get(shared);
      if (!bd) {
        bd = makeCanvas(canvas.width, canvas.height);
        if (this.kind === 'falls') paintFallsBackdrop(bd, this.spec, k, 1);
        else paintBackdrop(bd, this.scene, this.spec, k, 1);
        backdrops.set(shared, bd);
      }
      this.backdrop = bd;
      this.key = key;
    }
    this.tickRespawn(t);
    this.sim.update(Math.min(dt, 0.1), 0);
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
