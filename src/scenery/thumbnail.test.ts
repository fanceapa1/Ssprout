import { describe, expect, it } from 'vitest';
import type { SceneryId } from './ids';
import { cacheStore, createThumbnails, replaces, thumbKey, THUMB_KIND, type ThumbnailsOptions } from './thumbnail';
import type { PaintCache } from '../paint/persist';

type Img = { from: string };

function setup(over: Partial<ThumbnailsOptions<Img>> = {}) {
  let viewed: SceneryId = 'japanese-garden';
  const stored = new Map<SceneryId, Img>();
  const calls = { paint: [] as SceneryId[], store: [] as Array<[SceneryId, string]> };
  let liveOk = true;
  const t = createThumbnails<Img>({
    ids: ['japanese-garden', 'waterfall'],
    viewed: () => viewed,
    live: () => (liveOk ? { from: `live:${viewed}` } : null),
    stored: async (id) => stored.get(id) ?? null,
    store: (id, img) => void calls.store.push([id, img.from]),
    paint: async (id) => {
      calls.paint.push(id);
      return { from: `painted:${id}` };
    },
    ...over,
  });
  return {
    t,
    calls,
    stored,
    view: (id: SceneryId) => (viewed = id),
    liveFails: () => (liveOk = false),
  };
}

const ticks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('garden thumbnails: where each comes from (ADR 0285)', () => {
  it('ranks live over stored over painted over waiting', () => {
    expect(replaces('waiting', 'painted')).toBe(true);
    expect(replaces('painted', 'stored')).toBe(true);
    expect(replaces('stored', 'live')).toBe(true);
    expect(replaces('live', 'live')).toBe(true);
    expect(replaces('live', 'stored')).toBe(false);
    expect(replaces('stored', 'painted')).toBe(false);
  });

  it('a cache hit: the stored thumbnail, nothing painted', async () => {
    const s = setup();
    s.stored.set('waterfall', { from: 'stored:waterfall' });
    await s.t.fill();
    expect(s.t.source('waterfall')).toBe('stored');
    expect(s.t.image('waterfall')).toEqual({ from: 'stored:waterfall' });
    expect(s.calls.paint).toEqual([]);
  });

  it('a cache miss: a garden not on view is painted small and stored; the one on view waits for its live take', async () => {
    const s = setup();
    await s.t.fill();
    expect(s.t.source('waterfall')).toBe('painted');
    expect(s.calls.store).toEqual([['waterfall', 'painted:waterfall']]);
    expect(s.t.source('japanese-garden')).toBe('waiting');
    expect(s.calls.paint).toEqual(['waterfall']);
    expect(s.t.takeLive()).toBe(true);
    expect(s.t.source('japanese-garden')).toBe('live');
    expect(s.calls.store).toContainEqual(['japanese-garden', 'live:japanese-garden']);
  });

  it('the live take replaces a stored one; a late lookup never replaces a live one', async () => {
    const answers = new Map<SceneryId, (img: Img | null) => void>();
    const s = setup({ stored: (id) => new Promise((done) => answers.set(id, done)) });
    const filling = s.t.fill();
    s.t.takeLive();
    await ticks();
    answers.get('japanese-garden')!({ from: 'stored:japanese-garden' });
    await ticks();
    expect(s.t.source('japanese-garden')).toBe('live');
    answers.get('waterfall')!({ from: 'stored:waterfall' });
    await filling;
    expect(s.t.source('waterfall')).toBe('stored');
  });

  it('fallback: no renderer frame and no paint gives the waiting wash', async () => {
    const s = setup({ paint: async () => null });
    s.liveFails();
    expect(s.t.takeLive()).toBe(false);
    await s.t.fill();
    expect(s.t.source('japanese-garden')).toBe('waiting');
    expect(s.t.source('waterfall')).toBe('waiting');
    expect(s.t.image('waterfall')).toBeNull();
  });

  it('a garden left keeps its last live thumbnail; the next takes its own', () => {
    const s = setup();
    s.t.takeLive();
    s.view('waterfall');
    s.t.takeLive();
    expect(s.t.source('japanese-garden')).toBe('live');
    expect(s.t.image('japanese-garden')).toEqual({ from: 'live:japanese-garden' });
    expect(s.t.image('waterfall')).toEqual({ from: 'live:waterfall' });
  });

  it('tells listeners which garden changed', async () => {
    const s = setup();
    const seen: SceneryId[] = [];
    s.t.onChange((id) => seen.push(id));
    await s.t.fill();
    s.t.takeLive();
    expect(seen).toEqual(['waterfall', 'japanese-garden']);
  });

  it('stores under scenery-thumb with the scenery first in the key (ADR 0242)', async () => {
    const puts: string[] = [];
    const gets: string[] = [];
    const cache = {
      get: async (kind: string, key: string) => (gets.push(`${kind}:${key}`), null),
      put: async (kind: string, key: string) => (puts.push(`${kind}:${key}`), true),
    } as unknown as PaintCache;
    const store = cacheStore(cache, 448, 280);
    await store.stored('waterfall');
    store.store('japanese-garden', {} as never);
    expect(gets).toEqual([`${THUMB_KIND}:waterfall|448x280`]);
    expect(puts).toEqual(['scenery-thumb:japanese-garden|448x280']);
    expect(thumbKey('waterfall', 1, 2)).toBe('waterfall|1x2');
  });
});
