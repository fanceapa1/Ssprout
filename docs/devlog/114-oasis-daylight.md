# 114: The oasis's daylight (O5)

Lines for the orchestrator to place:

- Devlog index: `| 114 | [Oasis daylight](114-oasis-daylight.md) | O5: four desert skies over the notch (bleached dusty-blue midday, rose-gold dawn with haze over the grove, violet-coral-ember sunset, indigo night with a Milky Way and 240 extra stars), a basin plate turquoise in every phase, shadows always to the left (bluff, towers, walls, coping, the big palms' long diagonal shadows), a glowing ksar, moonlight on the basin, and the oasis's own golden grades through a new optional LightArt.grades | 0301 |`
- TESTING, §1a, after O4.2:
  - `| O5.1 | Oasis daylight: wired with its sun side; its own grades warmer and more golden by day, glowing over the notch, no heavier at night, no lantern, read by gradeFor (other sceneries keep PHASE_GRADES); sun, moon and dense stars in open sky; washes clear of the plate's lower edge and only 4 under the rock; the basin's mirrored sky turquoise in every phase; plate keys and light print; pinned recording hashes of the sky, basin and light plates per phase; plate cost under 1.5× the waterfall's | scenery/oasis/daylight (all) | — | ✔ |`
  - `| O5.2 | The oasis's noon is warm sand (red over blue), its sunset warmer still, its night darker and bluer; its sky and light plates are stored under oasis\| | — | sceneries · reduced motion › the oasis has its own daylight… | ✔ |`
  - `| O5.3 | The oasis's four phases look like desert watercolour light (skies cut to the skyline, turquoise basin, left-falling shadows, glowing ksar, moonlit basin) | — | studio oasis-daylight/* (renders; looked at) | ✔ |`
  - O1.3 now reads "Sky" rather than "Sky placeholder".

## What
- `src/scenery/oasis/sky.ts` replaces O1's placeholder plates, in the same language as the
  garden's and the waterfall's skies, on white:
  - *Midday*: a high, dusty blue (cerulean with a dust grey) wet into a bleached sand white, a
    deeper blue only at the top edge, and a warm dust haze over the horizon and the notch.
  - *Sunrise*: pale lilac-rose into rose-gold, a gold glow round the sun (x 990), a low rose haze
    along the far range over the grove, two faint streaks.
  - *Sunset*: violet overhead, a coral band, an ember glow round the sun (x 920), three violet
    streaks with coral undersides.
  - *Night*: granulating indigo into violet-blue at the horizon, a darker top, a Milky Way lifted
    in nine soft drifts from the upper left toward the notch (`MILKY_WAY`), the shared 30 stars
    and 240 smaller ones (`OASIS_NIGHT_STARS`).
  - Clipped to `plateSky()`: 4 units under the bluff and the ksar, up to 44 over the far range
    (it takes the distance's colour), never onto the bluff's shoulder.
  - *Basin*: `OASIS_WATER_SKY`. The basin stays turquoise in every phase, with only a little of
    the horizon at the far edge and the zenith nearer. The sky's colour goes on as broken streaks
    (bleach, rose-gold, coral), then lifted streaks.
- `src/scenery/oasis/light.ts` replaces the placeholder light:
  - *Shadows*, always to the left. Every lit phase: the walls' faces and a strip below them, the
    basin's far coping on the water, the bluff's foot. At a low sun: the right coping on the water,
    the left ridge turned away, each tower onto its neighbour, and the four big palms' trunks and
    crowns. Those run diagonally toward the viewer, because the sun stands beyond the grove,
    clipped off the basin's water. Midday: short pools under the palms.
  - *Lights*, sunrise and sunset: the ksar glows (a broad warmth, a rim down each flank and along
    each parapet), the shoulder, the left crown, the palms' trunks and crowns on the sun side.
    The far range and the dunes are glazed in the sky's colour (they read as a pale strip).
    The basin's water is lifted so the warm grade does not grey it (midday too).
  - *Night*: a cool sheen and streaks on the basin, the coping and the pisé, the Milky Way's
    glow, and the extra stars reserved.
  - **Grades** `OASIS_GRADES`: midday a thin gold (0.09), sunrise rose with its glow over the
    notch, sunset a deeper amber (0.36) glowing over the notch rather than on the left, night 0.5
    (the garden's is 0.54), no lantern.
- **Contract (ADR 0301)**: `LightArt.grades?` (a scenery's own phase grades). `cast.ts` paints
  the wash and the lantern strength from it, `gradeFor(weights, own?)` blends it, and `ambience.ts`
  passes the scenery's light art. The light print includes the grades only when they are present,
  so the garden's and the waterfall's keys and pixels are unchanged. `docs/ARCHITECTURE.md`
  updated.
- Studio `oasis-daylight` (146): the four phases over the painting, dusk, and each sky, basin and
  light plate alone.
- Tests: `daylight.test.ts` (O5.1), e2e `sceneries.spec.ts` › the oasis has its own daylight (O5.2).

## Why
- **Own grades, not a glaze in the hook.** A warm glaze painted by `lights` would warm the plate
  but not the UI tint, and the garden's sunset glow sits on the left, where the oasis has no sun.
- **The basin.** The light plates multiply over everything, and amber over turquoise is olive.
  Lifting the plate over the water, plus a turquoise mirror, keeps it turquoise.
- **Palm crowns not cut out.** At night the sky tint turns the crowns blue-dark against the
  sky. That reads as night, so they stay as O2 left them.

## Looked at
Shots in `artifacts/o5/` (`o5-<phase>-r<N>-<viewport>.png`, studio `entry-oasis-daylight_*`):
- **r0** (the placeholder): the midday sky a greenish grey, the sunset basin grey-green, no shadows.
- **r1**, 1440×900: midday sky grey with almost no blue in view; night stars sparse; sunset palm
  shadows invisible; the trunk lights in the plate (`entry-…cast-sunset`) read as polka dots; the
  bluff-foot shade a hard band.
- **r2**: the palm shadows were there but flat along the sand and under the plants, too faint to
  read. Night still had few stars in view (most sat above y −50, out of a desktop crop). The ksar
  was the same tone as the coral sky behind it.
- **r3**: the shadows angled toward the viewer and darker, the ksar warmer, the stars moved down
  into view, the Milky Way lifted harder: all read.
- **r4**, all three viewports, all four phases: phone sunset has violet over coral above the ksar.
  Phone and desktop night show dense stars and the Milky Way. 1920 sunset: the long palm shadows
  read, but the far range under the sun is a pale, almost white strip against the coral.
- **r5/r6**, 1920: the far range glazed in the sky's colour. A straight-edged band first (r5,
  a line through the palm crowns), then a soft blob (r6), which reads as haze.

## Left open
- **The moon at 1920×1080**: the top of its arc (y 110) sits behind the corner controls and the
  top paper edge, so the moon barely shows on wide screens (`o5-night-r4-1920x1080`). The arc is
  O2's layout. Lowering its top to about y 150 would fix it.
- **Far range under the sun**: still paler than the sky at sunset on wide screens. The range and
  dunes are painted pale and lost into haze (O4), so a stronger range there would help more than
  more glaze.
- **Plant shadows and rims** follow the sky's sun side through the shared contract (right at both
  low suns, ADR 0284). They were not checked by eye separately; the plants' blots are small at
  the overview.
- **Close views**: the sky detail plate punches only the shared 30 stars, so the extra ones are
  the upscaled plate's (softer) when zoomed in. No close-view shots were taken.
- **The sunset streaks** at the top left are cut by a 16:10 frame and read as a thin line there.
- Not run: the full unit and e2e suites (CPU rule). Run: typecheck; vitest `src/scenery/oasis`,
  `src/ambience`, `src/scene/sky-light`, `src/scenery/waterfall/daylight.test.ts`; e2e
  `sceneries.spec.ts` once with `E2E_WORKERS=1`.
- `src/main.ts` unchanged.
