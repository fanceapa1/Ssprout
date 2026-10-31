import type { PressedFlower } from '../core/state';
import { nativeLang } from '../plants/types';
import type { UIContext } from './context';
import { clear, h, setText } from './dom';
import { formatDay, inSentence } from './format';
import { createSheet, type Sheet } from './sheet';

/**
 * Pressed Flowers: a small herbarium book. Every plant that was replaced by a swap is shown as
 * a pressed specimen (its own sprite, desaturated and laid flat) with the dates it grew. One book
 * holds every garden's; once it holds more than one garden's, each specimen names its garden.
 */
const SPECIMEN = { w: 132, h: 150 };

export function createHerbarium(ctx: UIContext): Sheet {
  const { store, controller, getSpecies } = ctx.deps;
  const count = h('p.sheet-sub');
  const sheet = createSheet(ctx, {
    name: 'herbarium',
    title: 'Pressed Flowers',
    subtitle: count,
    className: 'book',
    onOpen: () => {
      fill();
      controller.retireTip('pressed');
    },
  });
  const pages = h('ol.specimens', { role: 'list' });
  const empty = h(
    'p.empty-note',
    {},
    'Nothing pressed yet. When you replant a spot, the plant that grew there is pressed between these pages and kept.',
  );
  sheet.body.append(pages, empty);

  function specimen(p: PressedFlower, i: number, gardens: boolean): HTMLLIElement {
    const def = getSpecies(p.speciesId);
    const garden = gardens ? ctx.deps.sceneries?.find((g) => g.id === p.sceneryId) : undefined;
    const canvas = h('canvas.specimen-art', { 'aria-hidden': 'true' });
    canvas.style.width = `${SPECIMEN.w}px`;
    canvas.style.height = `${SPECIMEN.h}px`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const painted = ctx.previews.paint(canvas, p.speciesId, { ...SPECIMEN, dpr, seed: p.seed, pressed: true });
    const name = def?.name ?? 'An unknown specimen';
    return h(
      'li.specimen',
      { 'data-species-id': p.speciesId, 'data-scenery-id': p.sceneryId, style: { '--tilt': `${((i * 37) % 7) - 3}deg` } },
      h('span.tape', { 'aria-hidden': 'true' }),
      painted ? canvas : h('span.specimen-missing', { 'aria-hidden': 'true' }),
      h(
        'span.specimen-label',
        {},
        h('span.specimen-name', {}, name),
        def?.nativeName ? h('span.specimen-native', { lang: nativeLang(def) }, def.nativeName) : null,
        p.taskName ? h('span.specimen-task', {}, `for “${p.taskName}”`) : null,
        h('span.specimen-date', {}, `pressed ${formatDay(p.removedAt)}`),
        h('span.specimen-grew', {}, `grew from ${formatDay(p.plantedAt)}`),
        garden ? h('span.specimen-garden', {}, `in the ${inSentence(garden.name)}`) : null,
      ),
    );
  }

  function fill(): void {
    const pressed = store.get().pressed;
    clear(pages);
    const gardens = new Set(pressed.map((p) => p.sceneryId)).size > 1;
    // newest first, like turning to the latest page
    [...pressed].reverse().forEach((p, i) => pages.appendChild(specimen(p, i, gardens)));
    pages.hidden = pressed.length === 0;
    empty.hidden = pressed.length > 0;
    setText(count, pressed.length === 0 ? 'an empty book' : pressed.length === 1 ? 'one specimen' : `${pressed.length} specimens`);
  }

  return sheet;
}
