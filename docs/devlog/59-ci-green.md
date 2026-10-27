# 59 — L1: CI green again

From P6 (2026-10-24) every CI run on `main` failed in the unit step, so e2e never ran on CI and
Pages never deployed (ADR 0014). Four causes, found one after another on a branch
(`fix/ci-platform-pins`, CI run by hand).

## What

**1. Recorded-canvas pins were platform-dependent (unit).** `paint/parts.test.ts` (wash, stone,
foliageClump, one call and in parts) and `scene/paint-slices.test.ts` pinned hashes of every
recorded canvas call with its exact float arguments. They passed on the owner's Mac and failed on
CI with the same wrong hashes every run.
- *Cause:* V8's `Math.sin`, `cos`, `tan`, `exp`, `log`, `pow`, `atan2`, `atan`, `asin`, `acos`,
  `log10`, `expm1` and `tanh` give different last bits on arm64 and x64 (`sqrt`, `hypot`, `cbrt`
  and `log2` agree). Same Node version both ways: a probe of 200 000 inputs per function under
  Node 24.21 arm64 and Node 24.21 x64 (Rosetta, same Mac) differs for those functions. Node 24 on
  arm64 passes the old pins; Node 24 x64 reproduces CI's exact hashes (`e4ed9b77`, `b310e80d`,
  `fe1df8ac`). Dumping the wash recipe's 75 083 calls on both: 6 lines differ, all in the last
  digit, first at call 61 405 (`lineTo(199.07858887883023,119.14054330670139)` vs `…137`), a
  ragged fade front deformed with `gauss(rng)` (`Math.log`, `cos`).
- *Fix (`scene/paint-record.ts`):* by default the recorder writes fractional numbers to 7
  significant digits (`quantiseNumber`; |x| < 1e-9 is 0; integers exact), including numbers inside
  strings such as `rgba(…)` (`quantise`). `{ exact: true }` keeps every bit, for comparing two
  paintings of the same run. The pixel-read seed is the hash, so it is platform-independent too.
- *Parity kept:* the "in parts" tests now record the one-call form and the parts form in the same
  run, exact, and compare them; `dryParts` = `dry` too. The pins ("as before ADR 0238", "as before
  the split") were re-taken quantised from the same paintings: the code on arm64 still matched
  the old exact pins, so the quantised hash of today's painting is the quantised hash of the
  painting the old pins recorded. Both arches give the new pins. The drying-pass pins (byte
  hashes, no transcendentals in the result) were already the same on both and are unchanged.
- *Other pins:* the only 8-hex pins in `src` and `tests/e2e` are these two files. The backdrop
  sheet's inline snapshot (`ui/backdrop-sheet.golden.test.ts`) passes on both.

**2. Regex quantising was too slow (unit).** The first version quantised each recorded line with a
regex. `scene-cache.test.ts` paints the whole landscape on recording canvases four times; it was
at 14 s a test on CI already (20 s ceiling), and went to 22–40 s. Numbers are now quantised as
they are shown (strings only when they hold a fraction). The paint-cache tests need canvases,
not hashes: `{ hash: false }` only counts calls, 3.3 → 0.7 s a test locally.

**3. The fauna bench timed first paints (e2e, flaky).** `fauna › a busy pond renders cleanly and
the fauna stays cheap` failed once on CI (9.7 ms against < 8), passed on retry. The bench's first
60 frames paint every new creature's parts (15 parts): 6.2 ms a frame locally, 1.6 ms once
painted. The test now runs one untimed `bench(60)` before the timed one. Asserting that the timed
frames paint nothing was too strict: a creature now and then needs a new part.

**4. The e2e suite outgrew one runner.** 263 tests ran about 25 min with 2 workers; the job
timeout (20 min) cancelled it at test 197. `ci.yml` now has a `check` job (typecheck, unit,
build) and an `e2e` job in three shards (`--shard=i/3`), each on its own runner, side by side.
`ci.yml` also gained `workflow_dispatch`, so CI can run on a branch without a pull request
(`gh workflow run ci.yml --ref <branch>`); pushes to branches still run nothing. Pages still
deploys only after the whole CI run succeeded on `main`.

## Why / decisions

No ADR: quantising is a test-tool detail (docs/TESTING.md › Conventions), and sharding changes no
contract. 7 significant digits: a last-bit difference crosses a rounding boundary with odds about
1e-16 / 1e-7 per number, so a few million recorded numbers give well under a 1 % chance per
re-pin; it is still finer than any visible change (1e-4 px on a 1000-px canvas).

## Tests

- `scene/paint-record.test.ts` (new, 4 tests): the first differing wash call quantises alike;
  numbers and strings quantise the same way; integers, sizes and hex colours stay; a recording
  hashes quantised by default and exact when asked.
- `paint/parts.test.ts`, `scene/paint-slices.test.ts`: re-pinned; pass under Node 24 arm64 and
  x64.
- CI on the branch: run 40596520305 green (unit 1564 of 1564; e2e shards 88, 88 and 87 passed,
  no retries; 8.5 min end to end).

## Left open

- The suite's wall time on CI is set by its slowest shard; a fourth shard is the next step if it
  grows.
- Other wall-clock budgets in e2e (`plants.perf`, `ambience().ms`, the camera's cost at rest)
  passed on CI here; any with a first-use paint inside the timed window would fail the same way.
