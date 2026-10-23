import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * Close-view art (ADRs 0185–0189): no seams in the resting view's painting, and plants as solid
 * at 3× as at 1×. Pixels are read from the garden canvas at a pinned view and phase; nothing
 * waits on time (`camera.settle()` waits for the detail of the resting view).
 */

type Pt = { x: number; y: number };

/** Cut the camera to a pose, pin the light, settle every detail, and draw one still frame. */
async function restAt(page: Page, pose: { zoom: number; x: number; y: number } | null, phase: string) {
  await page.evaluate(
    async ({ pose, phase }) => {
      const s = window.sprout!;
      s.unfreeze();
      s.camera.autoFocus(false);
      s.setTime(phase as never);
      if (pose) s.camera.glideTo(pose, { animate: false });
      else s.camera.overview({ animate: false });
      await s.camera.settle();
      await s.plantsReady();
      s.settleAmbience();
      await s.camera.settle();
      await s.freeze();
    },
    { pose, phase },
  );
}

/**
 * Column means of the garden canvas over a band of world rows, across a run of world columns
 * (device pixels; the paper's grain is muted so only the painting is measured).
 */
function columnProfile(page: Page, x0: number, x1: number, y0: number, y1: number) {
  return page.evaluate(
    ({ x0, x1, y0, y1 }) => {
      const c = document.querySelector<HTMLCanvasElement>('#garden')!;
      const ctx = c.getContext('2d')!;
      const a = window.sprout!.camera.toClient({ x: x0, y: y0 });
      const b = window.sprout!.camera.toClient({ x: x1, y: y1 });
      const r = c.getBoundingClientRect();
      const k = c.width / r.width;
      const px0 = Math.max(0, Math.round((a.x - r.left) * k));
      const px1 = Math.min(c.width, Math.round((b.x - r.left) * k));
      const py0 = Math.max(0, Math.round((a.y - r.top) * k));
      const py1 = Math.min(c.height, Math.round((b.y - r.top) * k));
      const { data } = ctx.getImageData(px0, py0, px1 - px0, py1 - py0);
      const w = px1 - px0;
      const h = py1 - py0;
      const out: number[] = [];
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          sum += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
        }
        out.push(sum / h);
      }
      return out;
    },
    { x0, x1, y0, y1 },
  );
}

/**
 * The largest step in a column profile once its slow trend is taken out (the margin's lift and
 * the light's grade are ramps, not seams): the jump between the means of `k` columns either side
 * of a point, after subtracting a moving average `w` columns wide each way.
 */
function seamStep(col: number[], k = 8, w = 30) {
  const res: number[] = [];
  for (let i = w; i < col.length - w; i++) {
    let sum = 0;
    for (let j = i - w; j <= i + w; j++) sum += col[j]!;
    res.push(col[i]! - sum / (2 * w + 1));
  }
  let max = 0;
  let at = 0;
  for (let i = k; i < res.length - k; i++) {
    let l = 0;
    let r = 0;
    for (let j = 0; j < k; j++) {
      l += res[i - 1 - j]!;
      r += res[i + j]!;
    }
    const v = Math.abs(r - l) / k;
    if (v > max) {
      max = v;
      at = i + w;
    }
  }
  return { max, at };
}

test.describe('close views', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  test('the meadow has no seams where the paper margin used to band, zoomed (ADR 0185)', async ({ page }) => {
    await openDev(page);
    // the view the seams were reported in: the left bank at 2×, its paper margin's former bands
    // (nine nested, nearly straight frames 24–38 units apart) at x ≈ 40–260
    for (const phase of ['sunset', 'night']) {
      await restAt(page, { zoom: 2, x: 300, y: 470 }, phase);
      expect((await page.evaluate(() => window.sprout!.sceneDetail())).view).not.toBeNull();
      // a tall band: a ragged front wanders across it and averages out, a seam stays a step
      const st = seamStep(await columnProfile(page, 40, 260, 500, 640));
      console.log(`${phase}: largest detrended step ${st.max.toFixed(2)} at column ${st.at}`);
      // the banded margins measured 2.6–3.3 levels here; the continuous field about 1.2–1.7
      expect(st.max, `${phase}: a step of ${st.max.toFixed(2)} levels at column ${st.at}`).toBeLessThan(2.2);
    }
  });

  test('a plant is as solid at 3× as at 1× (ADR 0187)', async ({ page }) => {
    await openDev(page);
    await page.evaluate(async () => {
      const s = window.sprout!;
      s.camera.autoFocus(false);
      const now = s.now();
      s.setState({ plants: [{ id: 'p', speciesId: 'tree-peony', slotId: 'meadow-16', seed: 1077, plantedAt: now - 3_600_000, sessionMinutes: 60, taskName: 'Probe', completedAt: now }] });
      await s.plants.settle();
      s.mute({ fauna: '*', ambience: '*' });
    });
    const box = (await page.evaluate(() => window.sprout!.plants.bounds('p')))!;
    /** mean |with plant − without| over a grid of world points inside the plant's box */
    const presence = async (pose: { zoom: number; x: number; y: number } | null) => {
      const sample = () =>
        page.evaluate((b) => {
          const c = document.querySelector<HTMLCanvasElement>('#garden')!;
          const ctx = c.getContext('2d')!;
          const r = c.getBoundingClientRect();
          const k = c.width / r.width;
          const vals: number[] = [];
          for (let fy = 0.3; fy <= 0.9; fy += 0.04) {
            for (let fx = 0.2; fx <= 0.8; fx += 0.04) {
              const p = window.sprout!.camera.toClient({ x: b.x + b.w * fx, y: b.y + b.h * fy });
              const d = ctx.getImageData(Math.round((p.x - r.left) * k), Math.round((p.y - r.top) * k), 1, 1).data;
              vals.push(d[0]!, d[1]!, d[2]!);
            }
          }
          return vals;
        }, box);
      await restAt(page, pose, 'midday');
      const withPlant = await sample();
      await page.evaluate(() => window.sprout!.mute({ fauna: '*', ambience: '*', plants: '*' }));
      const without = await sample();
      await page.evaluate(() => window.sprout!.mute({ fauna: '*', ambience: '*' }));
      let sum = 0;
      for (let i = 0; i < withPlant.length; i++) sum += Math.abs(withPlant[i]! - without[i]!);
      return sum / withPlant.length;
    };
    const centre: Pt = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const at1 = await presence(null);
    const at3 = await presence({ zoom: 3, ...centre });
    console.log(`plant presence: 1x ${at1.toFixed(1)}, 3x ${at3.toFixed(1)}`);
    expect(at1).toBeGreaterThan(8);
    // the sharp close-view sprite covers the landscape as much as the 1× one does
    expect(at3 / at1).toBeGreaterThan(0.8);
    expect(at3 / at1).toBeLessThan(1.25);
  });
});
