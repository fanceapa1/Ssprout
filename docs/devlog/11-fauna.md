# 11 — Fauna

## What
- `src/fauna/`: a `FaunaSystem` (one line in `main.ts`) over a renderer-independent `FaunaSim`.
  Residents: up to 3 koi, 3 water striders, a frog on a lily pad. Visitors on long, tunable
  schedules: drifting leaves, dragonfly, butterflies (cabbage white, swallowtail), bees, small birds
  (wagtail, sparrow), swallows, a rare grey heron. Night rest, livelier during a session, reduced
  motion far calmer. All pacing in `tuning.ts`.
- Every creature painted with the engine into cached parts, composed per frame (koi on a
  trail-following spine; foreshortened wings; frame swaps).
- Koi reworked on the owner's request to read unmistakably as koi: torpedo body with a broad rounded
  head, barbels, long flowing pectorals, a soft two-lobed tail, a continuous dorsal ridge; varieties
  Kohaku, Sanke, Yamabuki ogon, Showa, Asagi as wet-in-wet patches; muted and cooler when deep,
  brighter near the surface. Studio entry `fauna-koi/varieties`.
- `window.sprout.fauna` (`spawn`, `list`, `step`, `setHour`, `roster`, `schedule`, `bench`, …).
- Studio: per creature an `alive` stage and a `parts` sheet; `fauna-garden/all` with real pacing.
- Tests: 5 unit files (math, schedule + roster, targets, sim), 6 Playwright specs.
- Docs: `docs/systems/fauna.md`, ADRs 0070–0074.

## Why (non-obvious)
ADR 0070 (sim with its own clock, so stepping and presimulation are exact), 0071 (painted parts
composed per frame; scratch compositing for seamless faded koi), 0072 (pond plane), 0073 (visits:
first-visit window, cap with retries, multipliers), 0074 (perched depth = support's base y).

## Art review
Rounds per creature on studio stages and in the garden (`npm run shots`, frame sequences):
- koi: invisible deep white body → shallower depth range and lighter deep tint; seams at segment
  overlaps → full-opacity scratch compose; detached oversized tail → shorter, rooted inside the
  body; then the koi rework (barbels, fins, five varieties, softer wet-in-wet patches, darker Showa);
  gold koi turning green deep → lighter tint.
- dragonfly: stubby abdomen, eyes floating ahead of the thorax, leafy wings → slender abdomen,
  compact head, narrow glassy petal wings.
- butterflies: boxy root shading, heavy swallowtail ink → clipped soft shading, lighter bands.
- bee: stripes spilling outside the abdomen, single paddle wing → clipped stripes, paired wings.
- birds: round "chick" blobs → one painted silhouette with clipped markings; detached flight tail;
  tail flipping up when pecking → level tail, wing folded along the flank.
- heron: cloud-like ragged body and egg-shaped wings → smooth tilted body, wing foreshortened
  through edge-on for slow beats; faint reflection.
- frog, swallows: ragged lumps → low-deform washes; swallows became crescent-winged with streamers.

## Performance
`sprout.fauna.bench(300)`: 0.88 ms per frame (update 0.01 + draw 0.87) with 17 creatures at
1440×900 DPR 2 (budget 1.5 ms).

## Real scene pass
After the rebase onto the painted scene and the 25 species: tests moved to `gardenScene`; the heron
now wades only on the far edge, between the boulders and clear of far-bank plants (it had settled in
the lobe by the pavilion); `pondSquash` 0.42 → 0.36 for the wide kidney pond; koi 60 → 66 and
small birds ~12 % larger so they read against 60–150-unit boulders; heron stands are cached (they were
recomputed every frame — the long sims got 7× faster). Verified with `sprout.fauna.targets()`: 33
flower heads, 5 water-lily pads (the frog sits on one), 10 perches (5 boulder tops, 5 stones), 10
wading spots, all from the contract. Studio stage backdrops are shared across reseeds.

## Left
- The arrival line ("A koi has found your pond.") is for the UI (`controller.announceFauna`).
- Look again once the plant system draws plants in the garden (frog on a visible lily, bees on
  visible flowers).
- `sprout.setTime` (ambience) should also pin `sprout.fauna.setHour`.
