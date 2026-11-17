/**
 * Studio: the island goats close. Every pose of every coat, the walk frame by frame and the kid's
 * skip, and the real behaviour on close crops of the promontory: the cliff top and its ledges west
 * of the olive, the ledges east of it.
 */
import type { StudioEntry, StudioSection } from '../../studio/types';
import { multiplyPaper, Stage, type StageSpec } from '../stage';
import { COATS, drawGoatSprite, GOAT_POSES, paintGoatSprite, type Coat, type GoatPose } from './goat';

const stages = new Map<string, Stage>();
const lastT = new Map<string, number>();

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
      // a jump in time (the studio's setT) runs the band forward from the start again
      const jumped = Math.abs(t - (lastT.get(key) ?? t) - dt) > 0.5;
      lastT.set(key, t);
      if (!stage || frame === 0 || jumped) {
        stage = new Stage(spec, seed, 'goat', 'coast');
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

/** Rows of goats on white over a pale limestone band, `k` px per world unit at the far measure. */
function sheet(canvas: HTMLCanvasElement, pixelRatio: number, seed: number, k: number, rows: { y: number; items: { x: number; coat: Coat; pose: GoatPose; flip?: boolean; k?: number }[] }[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const row of rows) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = 'rgba(214,209,199,0.55)';
    ctx.fillRect(0, row.y, canvas.width / pixelRatio, 10);
    for (const it of row.items) {
      const kk = it.k ?? k;
      const s = paintGoatSprite(kk * pixelRatio, it.coat, it.pose, it.coat === 'pied', 6200 + COATS.indexOf(it.coat) * 101 + (seed % 5));
      drawGoatSprite(ctx, s, it.x, row.y, kk, it.flip ? -1 : 1);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  multiplyPaper(canvas);
}

const STILL: GoatPose[] = ['stand', 'look', 'graze', 'browse', 'rear', 'lie', 'hop'];

const poses: StudioEntry = {
  id: 'poses',
  label: 'each coat (black nanny · pied billy with beard and bell · tan nanny · kid) standing · looking up · grazing · browsing high · reared on its hind legs · lying · hopping a ledge',
  w: 1200,
  h: 720,
  render(canvas, { seed, pixelRatio }) {
    sheet(
      canvas,
      pixelRatio,
      seed,
      4.2,
      COATS.map((coat, r) => ({ y: 150 + r * 170, items: STILL.map((pose, i) => ({ x: 90 + i * 160, coat, pose })) })),
    );
  },
};

const walk: StudioEntry = {
  id: 'walk',
  label: 'the walk, four frames of the diagonal gait, for the black nanny and the kid; the kid’s skip; and the overview’s size (about 1.6 px a unit) at the right',
  w: 1200,
  h: 360,
  render(canvas, { seed, pixelRatio }) {
    const frames = GOAT_POSES.filter((p) => p.startsWith('walk'));
    // at the right, the band at the overview's size (about 1.6 px a unit)
    const band: [Coat, GoatPose, number][] = [['black', 'walk1', 960], ['kid', 'graze', 1000], ['pied', 'look', 1040], ['tan', 'lie', 1090]];
    sheet(canvas, pixelRatio, seed, 4.2, [
      { y: 150, items: [...frames.map((pose, i) => ({ x: 90 + i * 160, coat: 'black' as Coat, pose })), { x: 760, coat: 'black', pose: 'hop' }] },
      { y: 310, items: [...frames.map((pose, i) => ({ x: 90 + i * 160, coat: 'kid' as Coat, pose })), { x: 760, coat: 'kid', pose: 'hop' }] },
      { y: 240, items: band.map(([coat, pose, x]) => ({ x, coat, pose, k: 1.6 })) },
    ]);
  },
};

const section: StudioSection = {
  id: 'fauna-goat-close',
  title: 'Fauna · island goats, close',
  order: 345,
  entries: [
    poses,
    walk,
    close('west', 'west of the olive: over the cliff top, along its edge to the far pines, down the ledges by short hops and out under the temple to the point', { x: 730, y: 300, w: 340, h: 160 }, 900),
    close('east', 'east of the olive: in along the ledges from off the right edge', { x: 1470, y: 300, w: 140, h: 120 }, 900),
  ],
};

export default section;
