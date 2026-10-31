/**
 * Studio: every creature alive on its own small painted stage (the real behaviour code running in
 * a FaunaSim), its painted parts / frames, and a garden stage with everyone together.
 */
import { createRng } from '../core/rng';
import { createPainter } from '../paint';
import type { StudioEntry, StudioSection } from '../studio/types';
import { drawKoiStraight, KOI_PATTERNS, paintKoi } from './creatures/koi';
import { creatureDefs } from './creatures/registry';
import { multiplyPaper, Stage, type StageSpec } from './stage';
import type { Sprite } from './sprite';
import type { FaunaKind } from './tuning';

const stages = new Map<string, Stage>();

/** An animated entry running a stage; `?t=` presimulates up to t so stills show real behaviour. */
function aliveEntry(id: string, label: string, kind: FaunaKind | null, spec: StageSpec, w: number, h: number, place: Stage['kind'] = 'pond'): StudioEntry {
  return {
    id,
    label,
    w,
    h,
    animated: true,
    render(canvas, { t, dt, seed, frame, pixelRatio }) {
      const key = `${place}:${kind ?? 'all'}:${id}`;
      let stage = stages.get(key);
      if (!stage || stage.seed !== seed || frame === 0) {
        stage = new Stage(spec, seed, kind, place);
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
      // a cheap low-resolution pass gives the layout, then paint at the resolution it needs
      let sprites = make(0.25, seed);
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

const shown = creatureDefs()
  .filter((d) => d.show)
  .sort((a, b) => (a.show!.order ?? 100) - (b.show!.order ?? 100) || a.kind.localeCompare(b.kind));

const sections: StudioSection[] = shown.map((d, i) => {
  const s = d.show!;
  const entries: StudioEntry[] = [aliveEntry('alive', `${d.title}, alone (behaviour loop)`, d.kind, s.spec, s.w, s.h, s.stage)];
  if (d.sheet) entries.push(sheetEntry('parts', `${d.title}: painted parts and frames`, d.sheet.make, d.sheet.w, d.sheet.h));
  return { id: `fauna-${d.kind}`, title: `Fauna · ${d.title}`, order: 310 + i, entries };
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

sections.splice(1, 0, {
  id: 'fauna-falls',
  title: 'Fauna · the falls (the waterfall’s table, scheduled visits)',
  order: 301,
  entries: [aliveEntry('all', 'the waterfall’s creatures that are painted so far, real pacing; still pool, foam, stream, ledge', null, { w: 900, h: 560 }, 720, 448, 'falls')],
});

export default sections;
