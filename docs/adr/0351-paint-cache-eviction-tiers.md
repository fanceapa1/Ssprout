# ADR 0351: The paint cache evicts by tier: close views first, then plates, landscapes last

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0227 (persistent paint cache), for its eviction

## Context
The paint cache (ADR 0227) evicted the least recently used entries under its 48 MB cap. Since
ADR 0339 the Gardens section pre-paints the gardens not on view into it, and close views store
their detail paintings (ADR 0228). Measured at 1440×900 @2 (devlog 164): the viewed garden with
its four phases is 11 MB, the pre-paint brings it to 25 MB, four close views to 49 MB. A visit to
the waterfall then evicted the viewed garden's landscape, its sprites, all eight of its plates and
its thumbnail first, the oldest entries, while 22 MB of its close views stayed. A phone at DPR 3
did the same. The next visit to the garden repaints it for seconds and loads its painters chunk.

Recency alone gets this wrong: the landscape is put once, at the first paint, and read once per
visit, while close views are put later and more often.

## Decision
- Every entry gets a tier from its kind and key alone (`src/paint/evict.ts`), no app state:
  - **landscape** (kept longest): per garden, every overview (`scene`) at the scale of its most
    recently used one, the sprite atlas of that scale, and the thumbnails;
  - **plates**: `sky-plate` and `light-plate`;
  - **detail** (evicted first): `scene-detail`, sprite atlases of other scales, overviews at an
    older scale, and any kind the tiers do not name.
- Eviction takes the lowest tier first, least recently used first within a tier.
- A put may evict only its own tier or lower. When that cannot make room it is skipped
  (`stats().skipped`). Opening the store with a smaller cap evicts every tier, lowest first.
- The garden is the key's text before its first `|`, which every key already starts with.
- `?dev&paintcachemb=N` sets a smaller cap, so e2e reaches eviction without painting 48 MB.

### Rejected
- **A "viewed garden" hint from the app** (`cache.setViewed(id)`): it would rank the viewed garden's
  landscape over the others, but the landscapes of three gardens are 20 MB at DPR 2 and never
  compete with each other under 48 MB. Recency inside the plates tier already keeps the viewed
  garden's current phases over its far ones and over gardens not visited lately. Inferring the
  viewed garden from the last `scene` put fails because the pre-paint puts other gardens last.
- **Only the latest overview per garden as landscape**: a phone stores the strip it boots with and
  the full world it extends to, at the same scale, and needs both on the next visit.
- **A larger cap at DPR 2**: it delays the problem without fixing the order, and costs disk on
  the devices with the least of it.
- **A tag stored with each entry**: the tier depends on what else is stored (the latest scale), so
  it is computed at eviction time, from the index already in memory.

## Consequences
- At 1440×900 @2 the base set (three landscapes, their sprites, thumbnails) is about 21 MB and
  every garden's four phases of plates about 12 MB, which leaves about 14 MB for close views.
  Close views churn among themselves (about 7 MB each) and never push the base set out.
- A close view that does not fit beside the base set is not stored: zooming there again repaints
  it, as before.
- Overviews from an old window size fall to the detail tier and go first.
- `src/paint` changed, so the paint version changes: every cached painting repaints once.
- A future kind is a detail until `TIER_KINDS` names it; `evict.test.ts` checks the names and key
  shapes against the modules that build them.
