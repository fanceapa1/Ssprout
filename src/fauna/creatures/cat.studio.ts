/**
 * Studio: the island cat close. Every pose side by side, the walk cycle frame by frame, the front
 * and back walks, the drawn changes of pose, the three coats, and the real behaviour on close crops
 * of the coast's painting.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { CAT_COATS, drawCat, inBetween, paintCat, REST_POSE, stretchPose, type CatPose } from './cat';

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
type Item = { x: number; q: Partial<CatPose>; coat?: (typeof CAT_COATS)[number]; flip?: boolean; mix?: { a: Partial<CatPose>; b: Partial<CatPose>; k: number } };

function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, rows: { y: number; items: Item[] }[]): void {
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
      const q = it.mix ? inBetween({ ...REST_POSE, ...it.mix.a }, { ...REST_POSE, ...it.mix.b }, it.mix.k) : { ...REST_POSE, ...it.q };
      drawCat(ctx, parts.get(it.coat ?? 'tabby')!, q);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const awake = { sleep: false, head: 0.08 };

const poses: StudioEntry = {
  id: 'poses',
  label: 'asleep in a loaf · loaf, awake · curled asleep · sitting · washing a paw · standing · the front stretch · its follow-through · crouched to jump · leaping up · leaping down · walking · looking up',
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
          { x: 900, q: { shape: 'stand', ...awake } },
          { x: 1090, q: stretchPose({ ...REST_POSE }, 0.4) },
        ],
      },
      {
        y: 300,
        items: [
          { x: 100, q: stretchPose({ ...REST_POSE }, 0.8) },
          { x: 290, q: { shape: 'crouch', ...awake, pitch: -0.12 } },
          { x: 460, q: { shape: 'leap', ...awake, pitch: -0.55, lift: 6, shadow: 0 } },
          { x: 660, q: { shape: 'leap', ...awake, pitch: 0.4, lift: 6, shadow: 0 } },
          { x: 860, q: { shape: 'walk', ...awake, walk: 0.1 } },
          { x: 1060, q: { shape: 'sit', sleep: false, head: -0.4 } },
        ],
      },
    ]);
  },
};

const FRAMES = 10;

const walk: StudioEntry = {
  id: 'walk',
  label: 'the walk: ten frames of one stride, a lateral sequence (near hind, near fore, far hind, far fore); a paw down sweeps back as far as the body goes, and each hind lands in its fore’s print',
  w: 1200,
  h: 170,
  render(canvas, { seed, pixelRatio }) {
    sheet(canvas, pixelRatio, seed, 2.4, [{ y: 140, items: Array.from({ length: FRAMES }, (_, i) => ({ x: 70 + i * 116, q: { shape: 'walk' as const, ...awake, walk: i / FRAMES } })) }]);
  },
};

const views: StudioEntry = {
  id: 'views',
  label: 'walking toward the viewer and away: eight frames of a stride each (down a step, up the path), the paws planted as the body comes on',
  w: 1200,
  h: 330,
  render(canvas, { seed, pixelRatio }) {
    const row = (y: number, view: 'front' | 'back') => ({ y, items: Array.from({ length: 8 }, (_, i) => ({ x: 90 + i * 145, q: { shape: 'walk' as const, ...awake, view, dir: { x: 0, y: view === 'front' ? 1 : -1 }, walk: i / 8 } })) });
    sheet(canvas, pixelRatio, seed, 2.6, [row(150, 'front'), row(310, 'back')]);
  },
};

const changes: StudioEntry = {
  id: 'changes',
  label: 'drawn changes of pose, left to right: standing to sitting, sitting to the loaf, the loaf to the front stretch (the painted pose at each end)',
  w: 1200,
  h: 480,
  render(canvas, { seed, pixelRatio }) {
    const ks = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const run = (y: number, a: Partial<CatPose>, b: Partial<CatPose>) => ({ y, items: ks.map((k, i) => ({ x: 240 + i * 145, q: {}, mix: { a: { ...awake, ...a }, b: { ...awake, ...b }, k } })) });
    const ends = (y: number, a: Partial<CatPose>, b: Partial<CatPose>) => ({ y, items: [{ x: 75, q: { ...awake, ...a } }, { x: 1125, q: { ...awake, ...b } }] });
    sheet(canvas, pixelRatio, seed, 2.4, [
      run(140, { shape: 'stand' }, { shape: 'sit' }),
      ends(140, { shape: 'stand' }, { shape: 'sit' }),
      run(290, { shape: 'sit' }, { shape: 'loaf' }),
      ends(290, { shape: 'sit' }, { shape: 'loaf' }),
      run(440, { shape: 'loaf' }, stretchPose({ ...REST_POSE }, 0.3)),
      ends(440, { shape: 'loaf' }, stretchPose({ ...REST_POSE }, 0.3)),
    ]);
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
    views,
    changes,
    coats,
    close('wall', 'the middle terrace’s coping: dozing, waking, the stretch, a stroll', { x: 1080, y: 600, w: 300, h: 150 }, 840),
    close('shade', 'the top terrace by the olive: the walks either side of the trunk', { x: 1120, y: 440, w: 380, h: 170 }, 840),
  ],
};

export default section;
