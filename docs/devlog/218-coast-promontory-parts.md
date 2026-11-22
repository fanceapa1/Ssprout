# 218 · Coast promontory parts (GR1, phase 15)

## What
A measurement task: the coast's `promontory` step showed one 56 ms part (about 250 ms in all) at
1440×900 @2, against ADR 0330's 20 ms. Finding: the part is not the promontory's own work, and no
split inside `paint-rocks.ts` can remove it. The only code change is a guard test.

## Measured (production build, cold coast via `showScenery('coast')`, `sceneStats().timings`)
Total ms / longest part ms / parts. Three runs each; load average (1 min) 5.5 to 8.2 at 1440×900,
10.7 to 13.1 at 1470×750 (other jobs were running, so the 1470×750 numbers are inflated).

| step | 1440×900 | 1470×750 (loaded) |
|---|---|---|
| far-hill | 45–49 / 3.6 / 249 | 60–80 / 5.6 / 249 |
| sea | 267–271 / 14.7 / 752 | 357–426 / 20.6 / 752 |
| village | 19–20 / 0.8 / 822 | 23–31 / 1.2 / 822 |
| promontory | 249–271 / 57 / 721 | 324–407 / 73–91 / 721 |
| temple | 27–28 / 3.1 / 314 | 38–43 / 4.3 / 314 |
| shore | 108 / 108 / 1 | 153–172 / 172 / 1 |
| beach | 93 / 7.6 / 282 | 119–148 / 11.8 / 282 |
| land | 283–287 / 36.6 / 583 | 363–469 / 60 / 583 |
| walls | 316–362 / 12.2 / 679 | 407–531 / 12.4 / 679 |
| beds | 99–103 / 5.0 / 310 | 118–164 / 7.1 / 310 |
| cliff-foot | 45–47 / 16.3 / 192 | 58–78 / 20.9–28.7 / 192 |
| shore-rocks | 212–215 / 7.9 / 937 | 252–369 / 12.4 / 937 |
| maquis | 250–260 / 33.2 / 491 | 308–395 / 52 / 491 |
| olive | 71 / 12.2 / 31 | 78–112 / 20 / 31 |
| pine | 79–80 / 24.2 / 128 | 88–117 / 39 / 128 |
| margins | 56–57 / 17.1 / 91 | 48–76 / 24 / 77 |

Parts over 20 ms at 1440×900: `promontory` 57, `land` 37, `maquis` 33, `pine` 24, `shore` 108 (one
part: the placeholder `paintShore`). The `promontory` and `cliff-foot` entries are not their own work.

## Why the promontory's part cannot be split
Timing each sub-part (a temporary probe, reverted) showed every promontory part at 8 ms or less, bar
one: the composite of the third plane layer (`paintPlanes`, shade marks), 56 ms. That is a
`drawImage` onto the job canvas, which only queues the call. Chromium rasterises the canvas's
queued calls when it decides to, and at that call it pays for all of them, from the sea, the far
hill, the village and the promontory so far. With a one-pixel `getImageData` on the job canvas after
every wet batch, the promontory's longest part fell to 8.8 ms, its total stayed at about 250 to
268 ms, and the whole 56 ms came out in `village`'s first read instead (`village` 20 → 84 ms). So the
backlog moves, it does not shrink, and `cliff-foot`'s 16 to 29 ms is the same effect from the steps
before it.

A read costs one extra recorded canvas call, which changes the pinned hashes of `rock.test.ts`,
`coast.test.ts` and the rest, and the task forbids editing a pin. Spreading the backlog means
reads in the steps that queue it (the sea, the land, the walls), and the owner of that is the paint
job (`background.ts`), as ADR 0330 already says for the oasis. Nothing was changed for it here.

## Left open
- Decide whether the paint job may flush the job canvas every few parts (a one-pixel read between
  parts once enough canvas calls are queued), on real canvases only, and re-pin if it goes into
  the recorded path. That would bring `promontory`, `cliff-foot` and probably the 20 to 30 ms parts
  of `land`, `maquis` and `pine` under budget.
- The `shore` step is one 108 ms part (`paint-placeholder.ts`, not touched here).

## Tests
`rock.test.ts`: the promontory keeps at least 300 parts (overview) and 450 (detail), the cliff's
foot at least 140, and no part of the promontory, temple or cliff's foot holds more than one pixel
read. No timing test. No pin was edited.
