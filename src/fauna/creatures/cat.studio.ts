/**
 * Studio: the island cat close. Every pose side by side, the walk cycle frame by frame, the three
 * coats, and the real behaviour on close crops of the coast's painting: a coping, the olive's shade.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { CAT_COATS, drawCat, paintCat, REST_POSE, type CatPose } from './cat';

const stages = new Map<string, Stage>();

function close(id: string, label: string, spec: StageSpec, w: number): StudioEntry {
  const h = Math.round((w * spec.h) / spec.w);
  return {
    id,
    label,
    w,
    h,
    animated: true,
    render(canvas, { t, dt, seed, frame }) {
      const key = `${id}:${seed}`;
      let stage = stages.get(key);
      if (!stage || frame === 0) {
        stage = new Stage(spec, seed, 'cat', 'coast');
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

/** Draw poses in rows on white, `k` px per unit, each at its feet's point. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, rows: { y: number; items: { x: number; q: Partial<CatPose>; coat?: (typeof CAT_COATS)[number]; flip?: boolean }[] }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const parts = new Map(CAT_COATS.map((c, i) => [c, paintCat(k * pixelRatio, 3700 + i * 40 + (seed % 7), c)]));
  ctx.strokeStyle = 'rgba(120,110,100,0.3)';
  for (const row of rows) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.beginPath();
    ctx.moveTo(20, row.y);
    ctx.lineTo(canvas.width / pixelRatio - 20, row.y);
    ctx.stroke();
    for (const it of row.items) {
      ctx.setTransform(pixelRatio * k * (it.flip ? -1 : 1), 0, 0, pixelRatio * k, pixelRatio * it.x, pixelRatio * row.y);
      drawCat(ctx, parts.get(it.coat ?? 'tabby')!, { ...REST_POSE, ...it.q });
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const poses: StudioEntry = {
  id: 'poses',
  label: 'asleep in a loaf · loaf, awake · curled asleep · sitting · washing a paw · the front stretch · the hind-leg reach · crouched to jump · leaping up · leaping down · walking',
  w: 1200,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 3, [
      {
        y: 140,
        items: [
          { x: 80, q: { shape: 'loaf' } },
          { x: 250, q: { shape: 'loaf', sleep: false, tip: 0.5 } },
          { x: 420, q: { shape: 'curl' } },
          { x: 580, q: { shape: 'sit', sleep: false } },
          { x: 730, q: { shape: 'wash', paw: 0.9 } },
          { x: 920, q: { shape: 'bow', sleep: false } },
          { x: 1100, q: { shape: 'reach', sleep: false, pitch: 0.08 } },
        ],
      },
      {
        y: 300,
        items: [
          { x: 100, q: { shape: 'crouch', sleep: false, pitch: -0.12 } },
          { x: 300, q: { shape: 'leap', sleep: false, pitch: -0.55, lift: 6, shadow: 0 } },
          { x: 520, q: { shape: 'leap', sleep: false, pitch: 0.4, lift: 6, shadow: 0 } },
          { x: 740, q: { shape: 'walk', sleep: false, walk: 0.1, head: 0.08 } },
          { x: 960, q: { shape: 'sit', sleep: false, head: -0.4 } },
        ],
      },
    ]);
  },
};

const walk: StudioEntry = {
  id: 'walk',
  label: 'the walk cycle: eight frames of one stride (lateral sequence, the tail up)',
  w: 1200,
  h: 170,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 2.4, [{ y: 140, items: Array.from({ length: 8 }, (_, i) => ({ x: 80 + i * 145, q: { shape: 'walk' as const, sleep: false, walk: i / 8, head: 0.08 } })) }]);
  },
};

const coats: StudioEntry = {
  id: 'coats',
  label: 'the three coats (one per garden, from its seed): ginger and white, tabby and white with a tipped ear, black and white',
  w: 1200,
  h: 190,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 2.4, [
      {
        y: 150,
        items: CAT_COATS.flatMap((coat, i) => [
          { x: 70 + i * 390, q: { shape: 'loaf' as const }, coat },
          { x: 190 + i * 390, q: { shape: 'sit' as const, sleep: false }, coat },
          { x: 310 + i * 390, q: { shape: 'walk' as const, sleep: false, walk: 0.2 }, coat },
        ]),
      },
    ]);
  },
};

const section: StudioSection = {
  id: 'fauna-cat-close',
  title: 'Fauna · island cat, close',
  order: 343,
  entries: [
    poses,
    walk,
    coats,
    close('wall', 'the middle terrace’s coping: dozing, waking, the stretch, a stroll', { x: 1080, y: 600, w: 300, h: 150 }, 840),
    close('shade', 'the top terrace by the olive: the walks either side of the trunk', { x: 1120, y: 440, w: 380, h: 170 }, 840),
  ],
};

export default section;
