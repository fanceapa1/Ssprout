import type { SceneryId } from '../scenery/ids';
import type { UIContext } from './context';
import { h, setText } from './dom';
import type { GardenChoice } from './types';

/**
 * The dock's Gardens section (ADR 0244): a card per garden to choose from, the one on view
 * marked. Choosing dispatches `scenery/view`. Thumbnails are stills of the stage as each garden
 * was last seen; a garden not yet seen shows a pale waiting wash. docs/systems/ui.md › Gardens.
 */
export interface GardensSection {
  readonly el: HTMLElement;
  /** mark the garden on view (called on every UI refresh) */
  refresh(): void;
  /** keep a still of the garden on view from the stage canvas */
  takeStill(): void;
  /** which gardens have a still (dev and tests) */
  stills(): SceneryId[];
}

const THUMB_W = 192;
const THUMB_H = 120;

export function createGardensSection(ctx: UIContext, choices: readonly GardenChoice[], canvas: HTMLCanvasElement | null): GardensSection {
  const { store, controller } = ctx.deps;
  const cards = new Map<SceneryId, { button: HTMLButtonElement; thumb: HTMLCanvasElement; mark: HTMLElement }>();
  const taken = new Set<SceneryId>();
  const list = h('ul.gardens', { role: 'list' });

  for (const c of choices) {
    const thumb = h('canvas.garden-thumb', { width: THUMB_W, height: THUMB_H, 'aria-hidden': 'true', 'data-still': 'waiting' });
    const mark = h('span.garden-mark');
    const button = h(
      'button.garden-card',
      {
        type: 'button',
        'data-scenery': c.id,
        'aria-pressed': 'false',
        'aria-describedby': `garden-blurb-${c.id}`,
        onclick: () => choose(c.id),
      },
      thumb,
      h('span.garden-name', {}, c.name),
      h('span.garden-blurb', { id: `garden-blurb-${c.id}` }, c.blurb),
      mark,
    );
    cards.set(c.id, { button, thumb, mark });
    list.append(h('li', {}, button));
  }

  function choose(id: SceneryId): void {
    if (store.get().scenery === id) return;
    takeStill();
    controller.showScenery(id);
  }

  function takeStill(): void {
    const id = store.get().scenery;
    const card = cards.get(id);
    if (!card || !canvas || canvas.width === 0 || canvas.height === 0) return;
    const g = card.thumb.getContext('2d');
    if (!g) return;
    // cover-crop the stage into the thumbnail, centred
    const scale = Math.max(THUMB_W / canvas.width, THUMB_H / canvas.height);
    const sw = THUMB_W / scale;
    const sh = THUMB_H / scale;
    g.clearRect(0, 0, THUMB_W, THUMB_H);
    g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, THUMB_W, THUMB_H);
    card.thumb.dataset.still = 'taken';
    taken.add(id);
  }

  function refresh(): void {
    const viewed = store.get().scenery;
    for (const [id, c] of cards) {
      const on = id === viewed;
      c.button.setAttribute('aria-pressed', String(on));
      c.button.dataset.viewed = String(on);
      setText(c.mark, on ? 'On view' : 'Go here');
    }
  }

  refresh();
  return { el: list, refresh, takeStill, stills: () => [...taken] };
}
