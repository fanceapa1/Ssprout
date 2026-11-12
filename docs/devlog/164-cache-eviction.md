# 164 · Z17: Paint-cache eviction at DPR 2

Phase 14, optimization pass. ADR 0351.

## Measured (before)
Production build, headless Chrome, `nice -n 19`, a fresh context, cap 48 MiB (50.33 MB). The
viewed garden (Japanese) through all four phases, then the Gardens section (the pre-paint), then
four close views, then a visit to the waterfall and to the oasis (four phases, two close views
each), then back to the Japanese garden. Entries and IndexedDB deletes read from the page
(a scratch spec, not committed). Sizes are PNG bytes.

**1440×900 @2**

| step | entries | stored | evictions |
|---|---|---|---|
| Japanese garden, 4 phases | 11 | 11.2 MB: landscape 6.37, sprites 0.44, thumb 0.29, 4 sky plates 3.57, 4 light plates 0.52 | 0 |
| + pre-paint | 17 | 25.4 MB: + oasis 7.39, waterfall 5.87, their sprites 0.35 (the oasis's is empty, Z19) and thumbs | 0 |
| + 4 close views | 22 | 48.7 MB: + details 22.0 (7.4, 7.3, 4.1, 3.2) and the sprites at 2.8× 1.36 | 0 |
| + waterfall visit | 21 | 45.8 MB | 12 |
| + oasis visit | 28 | 46.9 MB | 18 |
| + back to the Japanese garden | 30 | 50.2 MB | 23 |

Evicted in this order: **the Japanese landscape, its sprites, all eight of its plates, its
thumbnail** (the garden on view), then the oasis landscape and thumbnail, only then the Japanese
close views; on the way back the waterfall's sprites, landscape, its midday plates and thumbnail.
While the Japanese garden's own landscape was gone, its 22 MB of close views were kept. The
return to it repainted it (cache miss, painters chunk loaded).

**390×844 @3 (phone)**

| step | entries | stored | evictions |
|---|---|---|---|
| Japanese garden, 4 phases | 12 | 11.2 MB: two overviews at one scale (the strip 899×1247 the phone boots with, 1.95 MB, and the full world it extends to, 4.5 MB), sprites 0.32, plates 4.09 | 0 |
| + pre-paint | 18 | 16.2 MB: + the oasis and waterfall strips 2.36 and 1.94 | 0 |
| + 4 close views | 24 | 29.1 MB: + details 10.4, sprites at the close scales 2.78 | 0 |
| + waterfall visit | 39 | 48.0 MB | 0 |
| + oasis visit | 39 | 50.0 MB | 14 |
| + back to the Japanese garden | 41 | 47.8 MB | 20 |

Same order: the Japanese strip first, all its plates, its full overview, sprites and thumbnail,
then the waterfall and oasis strips, and the close views last.

So eviction did hit the viewed set, at both sizes, with the plain LRU: the landscape is put once
at the first paint and read once per visit, while close views and plates are put later.

## Changed
- `src/paint/evict.ts` (new): each entry's tier from its kind and key, and the eviction order.
  - **landscape** (kept longest): per garden, every overview at the scale of its most recently
    used one, the sprite atlas of that scale, the thumbnails;
  - **plates**: sky and light plates;
  - **detail**: close views, sprites of other scales, overviews at an older scale, other kinds.

  Lowest tier first, least recently used within a tier. A put evicts only its own tier or lower
  and is skipped when that cannot make room. No tag is stored and no other module changed: every
  key already starts with the scenery id, and `TIER_KINDS` names the kinds (checked against
  `SCENE_CACHE`, `SKY_PLATE_KIND`, `LIGHT_PLATE_KIND`, `THUMB_KIND` in `evict.test.ts`).
- `src/paint/persist.ts`: `makeRoom` uses it. `?dev&paintcachemb=N` gives the app's cache a smaller
  cap (e2e).
- No "viewed garden" hint (ADR 0351 › Rejected): three landscapes are about 21 MB with their
  sprites and thumbs at DPR 2, so they never compete under 48 MB; recency inside the plates tier
  keeps the viewed garden's current phases over its far phases and over gardens not visited lately.
- `src/paint` changed, so the paint version changes: every cache repaints once.

## Measured (after)
The same 1440×900 @2 run on the change:

| step | entries | stored | evictions |
|---|---|---|---|
| up to 4 close views | 22 | 48.7 MB (as before) | 0 |
| + waterfall visit | 29 | 48.4 MB | 4 |
| + oasis visit | 37 | 46.9 MB | 7 |
| + back to the Japanese garden | 37 | 46.9 MB | 7 (none more) |

Only close views and the sprites at 2.8× were evicted: the Japanese ones first, then the
waterfall's oldest two. Every landscape, sprite atlas, thumbnail and all 24 plates (three gardens,
four phases) stayed, so the return to the Japanese garden took it from the cache (no new entry,
no eviction), where before it was repainted. A reload afterwards: `cacheHits: 1`, `paints: 0`.

## Tests
- Vitest `src/paint/evict.test.ts` (new): the kinds and key shapes of the real key builders; the
  tiers (a phone's strip and full overview both kept, an older scale and close views are details);
  the eviction order with sizes and caps as numbers; a put held to its tier, refused when it
  cannot fit, a resize letting the old overview go; on open every tier may go.
- Vitest `src/paint/persist.test.ts`: a close view is evicted before plates and a landscape, a
  close view that does not fit is skipped, `devMaxBytes`.
- e2e `tests/e2e/cache-eviction.spec.ts` (new, ~2 min): 1440×900 @2, cap 26 MB, the pre-paint and
  one close view reach the cap (evictions or skips > 0), all three landscapes are still stored, and
  a repeat visit has `cacheHits: 1`, `paints: 0` and never requests the garden's painters chunk.
- Run: the two Vitest files, `cache-eviction.spec.ts` alone (one worker, port 4191), `npm run
  typecheck`. Full suites not run (CPU rule).

## Left open
- At DPR 2 the base set and every garden's plates take about 33 MB of the 48, which leaves room for
  about two close views. A close view that does not fit is skipped and repaints on the next zoom
  there, as before.
- When Z24 pre-paints the other gardens' sky plates, they will be the most recent plates and would
  outlive the viewed garden's far phases; the viewed garden's current phases are read on each visit,
  so they still stay.
- The phone run after the change was not repeated (timebox); the unit tests cover its two-overview case.

## Rows for the orchestrator
`| 164 | [Z17: Paint-cache eviction at DPR 2](164-cache-eviction.md) | Measured at 1440×900 @2 and 390×844 @3: plain LRU evicted the viewed garden's landscape and plates first once the pre-paint and close views filled the 48 MB; now evicted by tier (close views, then plates, landscapes last), LRU within, a put never evicts above its tier |`

`| Z17.1 | Paint-cache eviction tiers: landscapes (latest scale per garden, its sprites, thumbs) kept over plates over close views; LRU within a tier; a put never evicts a higher tier; a repeat visit at DPR 2 after the pre-paint and a close view over the cap still hits and loads no painters | unit: src/paint/evict.test.ts, src/paint/persist.test.ts | e2e: tests/e2e/cache-eviction.spec.ts | ✔ |`

`| [0351](0351-paint-cache-eviction-tiers.md) | The paint cache evicts by tier: close views first, then plates, landscapes last | accepted | Tiers from kind and key (`evict.ts`): per garden the overviews and sprites of its latest scale and the thumbnails, then sky/light plates, then close views and the rest; LRU within a tier; a put evicts only its own tier or lower, else it is skipped; no viewed-garden hint; `?dev&paintcachemb=N` for e2e |`
