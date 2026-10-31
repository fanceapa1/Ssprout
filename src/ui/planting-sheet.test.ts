// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UIContext } from './context';
import { createPlantingSheet } from './planting-sheet';
import type { PreviewCache, PreviewOptions } from './previews';
import type { PlantingDraft, UIDeps } from './types';

/**
 * The planting sheet opens at once (ADR 0222): building its cards draws no species preview the
 * old way (`paint`/`get` paint on the main thread). A card shows the waiting plot until its
 * preview is ready, cards on screen are hurried first and the rest once those have landed, and
 * `previewsReady` resolves when every card shows its preview. The preview cache is a spy.
 */

const SPECIES = ['violet', 'clover', 'iris', 'camellia', 'peony'].map((id, i) => ({
  species: { id, name: id, tier: 1, description: `${id} line`, habitats: ['meadow'] },
  locked: i === 4,
  earned: true,
  requiredMinutes: 10,
}));

/** a deferred promise per hurried preview, resolved by the test */
function spyPreviews(drawnAtOnce: ReadonlySet<string> = new Set()) {
  const hurried: Array<{ id: string; resolve: (ok: boolean) => void }> = [];
  const ready = new Set(drawnAtOnce);
  const cache = {
    get: vi.fn(() => null),
    paint: vi.fn(() => true),
    prewarm: vi.fn((_id: string, _opts: PreviewOptions) => Promise.resolve(true)),
    paintReady: vi.fn((_t: HTMLCanvasElement, id: string) => ready.has(id)),
    paintPlot: vi.fn(() => true),
    whenReady: vi.fn(
      (id: string) =>
        new Promise<boolean>((resolve) =>
          hurried.push({
            id,
            resolve: (ok) => {
              ready.add(id);
              resolve(ok);
            },
          }),
        ),
    ),
    size: 0,
    clear: vi.fn(),
  };
  return { cache: cache as unknown as PreviewCache & typeof cache, hurried };
}

function makeSheet(previews: PreviewCache, over: { species?: unknown[]; slots?: unknown[]; habitatWords?: () => unknown } = {}) {
  const controller = {
    recommendPlans: () => [{ id: 'p1', name: 'Steady', blocks: [{ kind: 'focus', minutes: 25 }] }],
    selectableSpecies: () => over.species ?? SPECIES,
    placementOptions: () => [{ slotId: 's1' }],
    retireTip: () => {},
    updateSettings: () => {},
  };
  const slots = over.slots ?? [{ id: 's1', habitat: 'meadow' }];
  const deps = { controller, clock: { now: () => 0 }, getSpecies: () => undefined, slots: () => slots, habitatWords: over.habitatWords } as unknown as UIDeps;
  const ctx = {
    deps,
    previews,
    announce: () => {},
    mode: () => 'planting',
    setMode: () => {},
    changed: () => {},
    delay: (ms: number) => ms,
    openDialog: (d: HTMLDialogElement) => d.setAttribute('open', ''),
    closeDialog: (d: HTMLDialogElement) => d.removeAttribute('open'),
    openDialogs: () => [],
  } as unknown as UIContext;
  const draft: PlantingDraft = { taskName: '', goalMinutes: 25, planId: null, speciesId: null, slotId: null };
  const sheet = createPlantingSheet(ctx, draft, { chooseSpot: () => {} });
  document.body.append(sheet.el);
  return sheet;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const states = (el: HTMLElement) => Object.fromEntries([...el.querySelectorAll<HTMLElement>('.plant-art')].map((a) => [a.closest<HTMLElement>('.plant-card')!.dataset.speciesId, a.dataset.preview]));

/** IntersectionObserver stand-in: the test says which cards are on screen */
function fakeIntersections() {
  const observers: Array<{ cb: IntersectionObserverCallback; targets: Element[] }> = [];
  class FakeIO {
    targets: Element[] = [];
    constructor(public cb: IntersectionObserverCallback) {
      observers.push(this);
    }
    observe(t: Element) {
      this.targets.push(t);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  return {
    /** report the cards with these species ids as on screen, the rest as off */
    show(ids: string[]) {
      const o = observers[observers.length - 1]!;
      const entries = o.targets.map((t) => ({ target: t, isIntersecting: ids.includes(t.closest<HTMLElement>('.plant-card')!.dataset.speciesId!) }));
      o.cb(entries as unknown as IntersectionObserverEntry[], o as unknown as IntersectionObserver);
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('planting sheet previews', () => {
  it('opening draws no preview on the main thread: waiting cards show the plot and fill in as they land', async () => {
    const { cache, hurried } = spyPreviews(new Set(['clover']));
    const sheet = makeSheet(cache);
    sheet.open();
    expect(cache.paint).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.paintReady).toHaveBeenCalledTimes(SPECIES.length);
    // the one already painted ahead is drawn in the open; the others wait on a plot
    expect(states(sheet.el)).toEqual({ violet: 'pending', clover: 'painted', iris: 'pending', camellia: 'pending', peony: 'pending' });
    expect(cache.paintPlot).toHaveBeenCalledTimes(4);

    // no IntersectionObserver here: every waiting card is hurried at once
    expect(hurried.map((x) => x.id).sort()).toEqual(['camellia', 'iris', 'peony', 'violet']);
    const done = sheet.previewsReady();
    for (const x of hurried) x.resolve(true);
    await done;
    expect(states(sheet.el)).toEqual({ violet: 'landed', clover: 'painted', iris: 'landed', camellia: 'landed', peony: 'landed' });
    expect(cache.paint).not.toHaveBeenCalled();
  });

  it('cards on screen are hurried first, the rest once those have landed', async () => {
    const io = fakeIntersections();
    const { cache, hurried } = spyPreviews();
    const sheet = makeSheet(cache);
    sheet.open();
    expect(hurried).toHaveLength(0); // nothing until the observer says what is on screen
    io.show(['violet', 'clover']);
    expect(hurried.map((x) => x.id)).toEqual(['violet', 'clover']);
    for (const x of hurried) x.resolve(true);
    await flush();
    expect(hurried.map((x) => x.id)).toEqual(['violet', 'clover', 'iris', 'camellia', 'peony']);
    expect(states(sheet.el)).toMatchObject({ violet: 'landed', clover: 'landed', iris: 'pending' });
  });

  it('prewarm paints every selectable preview ahead, in card order', () => {
    const { cache } = spyPreviews();
    const sheet = makeSheet(cache);
    sheet.prewarm();
    expect(cache.prewarm.mock.calls.map((c) => c[0])).toEqual(['violet', 'clover', 'iris', 'camellia', 'peony']);
    // the options key the prewarm: the card's pixel size and seed
    expect(cache.prewarm.mock.calls[0]![1]).toMatchObject({ w: 96, h: 92, seed: 'preview:violet' });
    expect(cache.paint).not.toHaveBeenCalled();
  });
});

describe('planting sheet: the garden’s flora (ADR 0250)', () => {
  const card = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`.plant-card[data-species-id="${id}"]`)!;
  const offer = (id: string, habitats: string[], native?: { name: string; lang?: string }) => ({
    species: { id, name: id, tier: 1, description: `${id} line`, habitats, ...(native ? { nativeName: native.name, nativeLang: native.lang } : {}) },
    locked: false,
    earned: true,
    requiredMinutes: 10,
  });

  it('lists the species the controller offers for the garden on view', () => {
    const sheet = makeSheet(spyPreviews().cache, { species: [offer('fern', ['rock']), offer('maple', ['back'])] });
    sheet.open();
    expect([...sheet.el.querySelectorAll<HTMLElement>('.plant-card')].map((c) => c.dataset.speciesId)).toEqual(['fern', 'maple']);
  });

  it('names only the habitats this garden’s slots have, in its own words', () => {
    const words = { water: 'in the pool', shore: 'by the pool', meadow: 'on the banks', path: 'by the trail', back: 'atop the cliff', rock: 'on the ledges' };
    const sheet = makeSheet(spyPreviews().cache, {
      species: [offer('fern', ['water', 'rock', 'meadow'])],
      slots: [{ id: 'l1', habitat: 'rock' }, { id: 'm1', habitat: 'meadow' }],
      habitatWords: () => words,
    });
    sheet.open();
    expect(card(sheet.el, 'fern').querySelector('.plant-habitat')!.textContent).toBe('on the ledges · on the banks');
  });

  it('marks the native name with the species’ language (default romanised Japanese)', () => {
    const sheet = makeSheet(spyPreviews().cache, {
      species: [offer('fern', ['meadow'], { name: 'Kujakushida' }), offer('heather', ['meadow'], { name: 'Fraoch', lang: 'gd' })],
    });
    sheet.open();
    expect(card(sheet.el, 'fern').querySelector('.plant-native')!.getAttribute('lang')).toBe('ja-Latn');
    expect(card(sheet.el, 'heather').querySelector('.plant-native')!.getAttribute('lang')).toBe('gd');
  });
});
