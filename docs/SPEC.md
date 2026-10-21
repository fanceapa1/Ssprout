# Study Sprout — Product Specification

Study Sprout is a browser study timer wrapped in a living Japanese watercolour garden.
The garden starts serene but sparse. Every completed study session blooms a new plant.
Over many sessions the garden fills, and wildlife slowly moves in.

**Guiding principle: subtlety.** Nothing shouts. No confetti, no badges, no streak guilt.
Rewards are quiet and beautiful, like a real garden changing over time.

Reference mood: hand-painted Japanese watercolour / sumi-e on warm washi paper — soft
sage greens, grey-blue water, warm grey stones, muted pinks/violets/whites for flowers,
a small wooden pavilion, stepping stones leading to a pond. (Owner's reference image lives
outside the repo at `/Users/tudor/Downloads/image (1).png`; do not copy it, use it for mood.)

---

## 1. The garden (initial state)

- One fixed scene (not scrolling): sky wash, distant hills, two groups of thin-trunked trees
  (left, right), a wooden pavilion/engawa corner at the right, grassy banks, a central pond
  with boulders around it, a stepping-stone path from the bottom-centre to the pond.
- Barren but serene: a few grass tufts, a couple of shrubs. No flowers.
- Scene composition is responsive: landscape shows the full scene; portrait crops around
  the pond (focus point) without distorting.

## 2. Study sessions

| Rule | Behaviour |
|---|---|
| Duration picker | Slider 10–180 min in 5-min steps. Quick-pick chips: 25, 50, 90. Remembers last value. |
| Start | Starts a session. First start asks (gently) for notification permission. |
| Pause | Unlimited. Paused time does not count. After 30 min paused, a soft "Still with us?" prompt offering Resume / End session. |
| Cancel | Requires a light confirmation. Nothing grows. No penalty, no shaming copy. Counted in stats only. |
| Complete | When studied time ≥ goal: notification + chime (if unmuted) + reward flow. |
| Persistence | Session is timestamp-based and saved. Reload/close and return → session continues correctly (or is completed if time elapsed while away; reward is waiting). |

### Active-session ambience (subtle!)
While a session runs, the garden visibly "works with you":
- Weather variant chosen per session: **sun** (most common: soft diagonal light shafts, warmer
  light, gentle glints on water), **soft rain** (fine slanted strokes, ripple rings on the
  pond, slightly cooler/greyer palette), **mist** (low drifting haze).
- Photosynthesis: faint light motes rising slowly from existing plants; plants sway a touch more.
- Paused session: ambience fades to stillness (a held breath), not off abruptly.
- All of this is low-contrast and slow. It must never compete with the plants.

## 3. Rewards

Tier by **goal duration** of the completed session:

| Tier | Goal minutes | Character | Examples |
|---|---|---|---|
| 1 | 10–24 | Small wildflowers, ground plants | violets, clover, forget-me-nots, wild strawberry, moss with tiny flowers |
| 2 | 25–49 | Classic perennials | Japanese iris, anemone, bellflower (balloon flower), dianthus, cosmos, spider lily |
| 3 | 50–89 | Flowering shrubs, showy flowers | peony, hydrangea, azalea, camellia, chrysanthemum, lotus (water) |
| 4 | 90–180 | Spectacular centrepieces | weeping cherry, Japanese maple, wisteria (on a trellis), pine bonsai-like, ginkgo |

- On completion the user is offered **3 species** (2 when the pool is too small) from the earned
  tier, preferring species they don't own yet. Each card shows a painted preview, name,
  a short poetic line, and the habitat it likes.
- After choosing, the user picks a **location**.

### Placement
- The scene has ~50–60 predefined **slots** (not free placement), each with a habitat:
  `water` (on the pond: lotus, water lily), `shore` (pond edge: iris, reeds),
  `meadow` (grassy banks), `path` (beside stepping stones), `back` (far bank, for tall/trees),
  `rock` (crevices next to boulders, small plants).
- Each species lists allowed habitats. Only compatible slots are shown, as softly glowing seed
  markers. Each slot also has a max size class so trees only go where they fit.
- Occupied compatible slots can be chosen too → **swap**: the old plant is gently removed and
  saved to the **Pressed Flowers** collection (a small herbarium book view).
- Choosing a higher-tier plant for an occupied slot is how "upgrades" happen.
- Placement can be postponed ("Plant later"): the reward stays pending and is persisted.
- New plants **bloom in** with a slow growth animation (a few seconds), then sway gently.

## 4. Wildlife (gradual, subtle)

Wildlife is unlocked by garden progress, introduced one at a time, rare at first. Animals behave
like real animals: koi drift and turn slowly, bees visit flowers that attract pollinators, birds
land on rocks then leave, dragonflies hover over water. Never more than a handful visible at once.
Unlock table (initial; tune in `src/core/fauna-unlocks.ts`):

| Unlocks at | Creature |
|---|---|
| always | water striders / tiny ripples, drifting leaf |
| 2 plants | dragonfly (occasional, near water) |
| 3 plants | first koi |
| 4 pollinator flowers | butterflies (cabbage white, swallowtail) |
| 6 pollinator flowers | bees visiting flowers |
| 7 plants | second koi |
| 8 plants | small birds (wagtail/sparrow) landing on rocks & path |
| any water plant + 10 plants | frog on a lily pad |
| 14 plants | swallows crossing the sky occasionally |
| 20 plants | grey heron, rare visit at the pond edge |
| 25 plants | third koi, more frequent birds |

When a new creature first appears, a single quiet line may appear ("A koi has found your pond.").

## 5. Time of day
Lighting follows the user's local clock, very subtly: cool soft morning, neutral midday,
warm golden evening, blue dusk; at night a deep indigo wash with a small lantern glow at the
pavilion. Plants remain readable at all times. No seasons in v1.

## 6. Timer visibility & notifications
- **Floating widget** (Chrome/Edge): Document Picture-in-Picture window — a small painted
  card with the remaining time, a tiny growing sprout, pause/resume. Opened by a button.
- **Fallback** (Firefox/Safari): countdown in the tab title (`24:13 · Study Sprout`) and a
  painted favicon that fills as time passes.
- **Notifications**: Notification API (via service worker registration when available) at
  completion. Works with tab in background. Closed tab → no notification (no server); the
  reward waits on return. Timer ticks use a Web Worker so background throttling doesn't delay
  completion.

## 7. Tooltips / onboarding
- Very subtle, small handwritten-feel hints near the relevant control, only for non-obvious
  features: duration slider/presets, the floating widget, placement (choose a glowing spot),
  swapping, pressed flowers, sound toggle.
- Each tip shows until the user first uses that mechanism, then is retired. Retired tips are
  reachable via a small ⓘ which lists them all.

## 8. Sound
Procedural Web Audio ambience (no audio files): soft water, wind in leaves, occasional distant
bird; light rain during rain sessions; a gentle bloom chime. **Muted by default**, speaker
toggle in the corner; setting remembered.

## 9. Persistence
- `localStorage` only (key `studysprout:v1`), versioned schema with migrations.
- Export garden → downloads `study-sprout-garden-YYYY-MM-DD.json`; Import restores (validated).
- Hidden dev mode `?dev` exposes speed-up (`?speed=60`) and a debug API for tests.

## 10. Platforms
Desktop-first; works on phones (touch, portrait crop, controls reachable). Modern evergreen
browsers. Respects `prefers-reduced-motion` (ambience/fauna reduced, no sway).

## 11. Developer tools
- **Studio** (`/Ssprout/studio.html`): a review page showing every sprite, creature, effect and
  paint primitive with seed/reseed, play/pause, speed, background and scale controls.

## Non-goals (v1)
Accounts, sync, server push, seasons, social features, streaks/penalties.
