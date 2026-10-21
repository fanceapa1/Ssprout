/**
 * Studio: every creature alive on its own small painted stage (the real behaviour code running in
 * a FaunaSim), its painted parts / frames, and a garden stage with everyone together.
 */
import { createRng } from '../core/rng';
import { createPainter } from '../paint';
import type { StudioEntry, StudioSection } from '../studio/types';
import { drawKoiStraight, KOI_PATTERNS, paintKoi } from './creatures/koi';
import { SHEETS } from './creatures/sheets';
import { multiplyPaper, Stage, type StageSpec } from './stage';
import type { Sprite } from './sprite';
import type { FaunaKind } from './tuning';

const stages = new Map<string, Stage>();

/** An animated entry running a stage; `?t=` presimulates up to t so stills show real behaviour. */
function aliveEntry(id: string, label: string, kind: FaunaKind | null, spec: StageSpec, w: number, h: number): StudioEntry {
  return {
    id,
    label,
    w,
    h,
    animated: true,
    render(canvas, { t, dt, seed, frame, pixelRatio }) {
      const key = `${kind ?? 'all'}:${id}`;
      let stage = stages.get(key);
      if (!stage || stage.seed !== seed || frame === 0) {
        stage = new Stage(spec, seed, kind);
        stages.set(key, stage);
        for (let s = 0; s < t; s += 1 / 30) {
          stage.tickRespawn(s);
          stage.sim.update(1 / 30, 0);
        }
      }
      stage.render(canvas, t, dt);
    },
  };
}

/** A static sheet of painted parts / frames laid out in a row. */
function sheetEntry(id: string, label: string, make: (res: number, seed: number) => Sprite[], w: number, h: number): StudioEntry {
  return {
    id,
    label,
    w,
    h,
    render(canvas, { seed, pixelRatio }) {
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // first pass at a guess, then repaint at the resolution the layout needs
      let sprites = make(2, seed);
      const pad = 10;
      const total = sprites.reduce((s, sp) => s + sp.w, 0);
      const tall = Math.max(...sprites.map((sp) => sp.h));
      const k = Math.min((w - pad * (sprites.length + 1)) / total, (h - pad * 2) / tall);
      sprites = make(k * pixelRatio, seed);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      let x = pad;
      for (const sp of sprites) {
        const y = (h - sp.h * k) / 2;
        ctx.drawImage(sp.img as CanvasImageSource, x, y, sp.w * k, sp.h * k);
        x += sp.w * k + pad;
      }
      multiplyPaper(canvas);
    },
  };
}

interface Show {
  kind: FaunaKind;
  title: string;
  spec: StageSpec;
  w: number;
  h: number;
}

const SHOWS: Show[] = [
  { kind: 'koi', title: 'koi', spec: { w: 380, h: 230 }, w: 570, h: 345 },
  { kind: 'strider', title: 'water striders', spec: { w: 260, h: 160 }, w: 520, h: 320 },
  { kind: 'leaf', title: 'drifting leaf', spec: { w: 360, h: 240 }, w: 540, h: 360 },
  { kind: 'dragonfly', title: 'dragonfly', spec: { w: 380, h: 240 }, w: 570, h: 360 },
  { kind: 'butterfly', title: 'butterflies', spec: { w: 380, h: 240 }, w: 570, h: 360 },
  { kind: 'bee', title: 'bees', spec: { w: 240, h: 150 }, w: 560, h: 350 },
  { kind: 'bird', title: 'small birds', spec: { w: 300, h: 190 }, w: 570, h: 361 },
  { kind: 'frog', title: 'frog', spec: { w: 220, h: 140 }, w: 550, h: 350 },
  { kind: 'swallow', title: 'swallows', spec: { w: 700, h: 320 }, w: 560, h: 256 },
  { kind: 'heron', title: 'grey heron', spec: { w: 560, h: 360 }, w: 560, h: 360 },
];

const sections: StudioSection[] = SHOWS.map((s, i) => {
  const entries: StudioEntry[] = [aliveEntry('alive', `${s.title}, alone (behaviour loop)`, s.kind, s.spec, s.w, s.h)];
  const sheet = SHEETS[s.kind];
  if (sheet) entries.push(sheetEntry('parts', `${s.title}: painted parts and frames`, sheet.make, sheet.w, sheet.h));
  return { id: `fauna-${s.kind}`, title: `Fauna · ${s.title}`, order: 310 + i, entries };
});

/** Every koi variety side by side: near the surface (top row) and deeper down (bottom row). */
const varieties: StudioEntry = {
  id: 'varieties',
  label: 'koi varieties: Kohaku, Yamabuki ogon, Sanke, Showa, Asagi — near the surface / deeper',
  w: 760,
  h: 250,
  render(canvas, { seed, pixelRatio }) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = createPainter(canvas, { seed });
    p.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    p.waterBody({ cx: 380, cy: 125, rx: 400, ry: 150 }, { rng: createRng(seed), ripples: 0, reflection: 0 });
    ctx.setTransform(pixelRatio * 1.9, 0, 0, pixelRatio * 1.9, 0, 0);
    KOI_PATTERNS.forEach((pattern, i) => {
      const parts = paintKoi(pixelRatio * 1.9, seed + i * 17, pattern, 60);
      for (const deep of [false, true]) {
        ctx.save();
        ctx.globalAlpha = deep ? 0.55 : 0.95;
        drawKoiStraight(ctx, parts, 6 + i * 79, deep ? 95 : 35, deep);
        ctx.restore();
      }
    });
    multiplyPaper(canvas);
  },
};

sections.find((s) => s.id === 'fauna-koi')!.entries.splice(1, 0, varieties);

sections.unshift({
  id: 'fauna-garden',
  title: 'Fauna · everyone (scheduled visits)',
  order: 300,
  entries: [aliveEntry('all', 'all creatures unlocked, real pacing', null, { w: 900, h: 560 }, 720, 448)],
});

export default sections;
