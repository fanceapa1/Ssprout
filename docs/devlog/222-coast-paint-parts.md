# 222 · Coast paint parts (GR2, phase 15)

## What
GR1 (devlog 218) listed the coast's parts over ADR 0330's 20 ms at 1440×900 @2: `shore` 108,
`land` 37, `maquis` 33, `pine` 24 (and `promontory`, backlog). This task found which of them are
the step's own work and split the two that are. No pixel changed.

## Measured: own work or backlog
A throwaway build (never committed) read one pixel of the job canvas after every part, so a part
pays for its own queued calls and no one else's (GR1's method). Longest part, ms, 1440×900 @2:

| step | as shipped | with a flush after each part | verdict |
|---|---|---|---|
| shore | 108 (1 part) | 108 | own work: one part |
| land | 37 | 16.6 | backlog; its own longest part is 16.6 |
| maquis | 33 | 17.7 | backlog; its own longest part is 17.8 |
| pine | 24 | 28.7 | own work: `paintSkeleton`, the limbs in one part |

`land` and `maquis` have no part over budget of their own, so nothing changed there. Their long
parts are the first pixel read of a layer after queued composites, as in the promontory; spreading
that is the paint job's (ADR 0330 › Rejected, devlog 218 › Left open).

## Changes
- **`shore`** (`paint-placeholder.ts`) is a generator now: the beach's wet-in-wet in its own parts
  (`p.parts.wetInWet`), the 80 shingle dabs in batches of 20 (`pacer`), a pause after each wet-line
  stroke, and each pool's wash, wet-in-wet and lift as parts. 245 parts at 1440×900, longest 5.5
  to 13.5 ms (was one part of 107 to 175).
- **`pine`** (`paint-veg.ts`): the leaning pine's limbs came from the species'
  `paintSkeleton` in one part (every branch in one wet layer, its drying, then bark strokes on the
  thick limbs). `skeletonParts` is the same steps with a pause after the fills, inside the drying
  (`dryParts`) and after each limb's bark, under the same transform. The species file is
  untouched; the scenery step only calls its helpers (`visibleBranches`, `stableLayer`,
  `stableTarget`) in parts. 154 parts (was 128), longest 15 to 16 ms (was 24 to 38; 28.7 own).
- Pins: the recorded marks of `shore`, `land`, `maquis` and `pine` hash as before in three views
  (overview, the beach, the pine's window), and no pin in `coast`, `rock`, `veg`, `water`, `land`,
  `daylight` or `motion` tests was edited. `parts.test.ts` adds one new pin, the shore's (it had
  none: no earlier test records the `shore` step).

## Before and after (production build, cold coast, `sceneStats().timings`; total / longest part / parts)
Three runs each, 1 min load average beside each.

1440×900 @2, before (load 4.1, 5.8, 6.0): shore 148–175 / 148–175 / 1; land 348–440 / 42–54 / 583;
maquis 316–372 / 45–51 / 491; pine 99–113 / 29–38 / 128.
1440×900 @2, after (load 5.9, 5.8, 6.2): shore 118–124 / 7.6–13.5 / 245; land 363–379 / 40–46 /
583; maquis 324–336 / 34–46 / 491; pine 100–104 / 15–16 / 154.

1470×750 @2, before (load 5.8, 5.0, 4.5): shore 107–125 / 107–125 / 1; land 287–334 / 35–45 / 583;
maquis 249–253 / 33 / 491; pine 76–77 / 23.5–24 / 128.
1470×750 @2, after (load 3.8, 3.5, 3.5): shore 91–100 / 5.5–5.6 / 245; land 286–289 / 35–37 /
583; maquis 252–253 / 33 / 491; pine 76 / 11.6–11.8 / 153.

The machine was busy (other jobs), so the 1440×900 runs are noisier than GR1's; totals did not rise
beyond the noise (shore and pine fell or held, land and maquis are unchanged code).

## The "placeholder" file
`paint-placeholder.ts` holds G1's draft-B steps moved onto the coast's layout (devlog 170). G3
(176) replaced the sea, caique, beach and pools, G4 (177) the land, walls, beds, olive, pine and
promontory green; each left the old function in place, unused. `paintShore` is the only one still
called, and it is still the draft's shore (the beach's sand wash, pebbles, the lap line and the
pools' rims, which the beach and `shore-rocks` paint over). It is not a real painter under an old
name; it is the last placeholder step. It was not renamed or moved: the file also carries the
unused draft functions, so a rename would be a clean-up of its own (delete the unused ones and
move `paintShore` into `paint-water.ts`), not a pure file move.

## Left open
- Over 20 ms in a cold run: `land` (35–46) and `maquis` (33–46) are backlog, own parts 17 ms
  or less; `promontory` and `cliff-foot` as in devlog 218. A flush in the paint job would fix all of
  them at once.
- `maquis` has a part with 45 pixel reads (small marks dried one by one); its own longest part is
  17.8 ms, so it was left as is.
- The shore is a placeholder still; a real shore painter would replace the file.

## Tests
`parts.test.ts`: part counts (shore 150, land 200, maquis 100, pine 120 at the overview), a cap on
pixel reads per part, the shore's recorded-marks pin. No timing test.
