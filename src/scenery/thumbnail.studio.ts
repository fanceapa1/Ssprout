import { paintSceneSync } from '../scene/background';
import type { StudioEntry, StudioSection } from '../studio/types';
import { getScenery } from './registry';
import type { SceneryId } from './ids';
import { composeThumbnail, thumbnailView } from './thumbnail';

/** The Gardens cards' painted thumbnail (ADR 0285): each garden painted small, under the card's mask. */
const entry = (id: SceneryId): StudioEntry => ({
  id: `thumb-${id}`,
  label: `${getScenery(id).name}: the small painted overview a card shows before the garden is seen`,
  w: 224,
  h: 140,
  render(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const res = paintSceneSync(getScenery(id).art, thumbnailView(w, h), { quality: 'draft' });
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(composeThumbnail(res, w, h) as CanvasImageSource, 0, 0);
    // the card's elliptical mask (ui.css `.garden-thumb`)
    const m = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    m.addColorStop(0, '#000');
    m.addColorStop(0.66, '#000');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, w, h);
  },
});

const section: StudioSection = {
  id: 'garden-thumbnails',
  title: 'Garden thumbnails',
  order: 110,
  entries: [entry('japanese-garden'), entry('waterfall')],
};

export default section;
