# ADR 0360: The coast's layout: low suns over the sea, a broken shoreline, the sea edge out of the margin

- Status: accepted
- Date: 2026-11-12
- Builds on: ADRs 0241 (scenery contract), 0284 (sun side), 0300 (terrace lift), 0341 (lazy painters)

## Context
G1 turns coast draft B ("Stepped terraces down to the shore", the owner's choice) into a scenery.
The draft review found three framing faults to solve in the layout, not in paint:
1. The land met the sea in one hard straight diagonal.
2. The 600-wide phone crop round the draft's focus (860, 760) held the temple and the terraces but
   none of the plantable sea edge (shallows, splash rocks, beach, pools).
3. The sky needed to stay open for the sun's and the moon's paths, with a skyline traced from the
   painting.

Two more turned up in the app:
- The paper margin (`paintMargins`) lifts the bottom 166 units and up to 320 at the sides near the
  bottom. The draft's beach and rock pools (y 800–990, x 0–600) sat in that corner and faded to
  paper, so plants in the pools would have stood in nothing.
- The painting is lit from the upper left, and the sea and the open sky are on the left.

## Decision
- **Sun side left at both low suns** (`sunSide: { sunrise: -1, sunset: -1 }`). Both suns stand
  over the sea's horizon (y 400) in the gap between the far hill's foot (x 516) and the temple's
  point (x 636): `sunsetX` 552, `sunriseX` 636. At 8–16° their discs stay in open sky, left of the
  temple, right of the leaning pine's crown, and inside the phone crop; at −3° they are under the
  horizon. The moon arcs (450, 266) → (610, 196) → (760, 252), left of the temple; the stars keep a
  gap round it.
- **Skyline** sampled every 2 units from the painted silhouette (the far hill, the horizon, the
  promontory, each column and the architrave), the lowest edge within a step either side, as the
  oasis's (devlog 107). The olive, the leaning pine and the promontory's pines cross it and take
  the sky's wash; tracing the pines left paper slivers beside their crowns.
- **A broken shoreline** (`SHORE_EDGE`): the top terrace ends in a rock shelf, the sea cuts in under
  it, the middle terrace ends in a rock bastion with a second small cove below, the lower terrace
  ends in scrub, and stone steps come down to the beach. Boulders and scrub are painted over the
  edge. The edge turns back on itself at least four times and stands at least 40 off the straight
  line between its ends (tested).
- **Focus (760, 600)**. The phone crop (x 460–1060) holds the whole temple, open sea across more than
  a third of its width, shallows, splash rocks, beach and pool slots, and beds on all three
  terraces. On a 16:9 screen (y 100–1000) the temple has 190 units of sky above it, and the olive's
  and the pine's crowns come down below the corner controls.
- **The sea edge out of the margin**: the beach's waterline runs y 742–812, the beach back y
  840–852, and the pools in the rock shelf at y 886–902, from x 230 rightward.
- **Terrace lift** as the oasis (ADR 0300): `LIFT` is the sum of the wall drops in front of each
  terrace (lower 48, middle 92, top 132). Beds, path slots on a terrace, copings and wall faces
  take `perspectiveScale(y + lift)`; the foreground, the beach, the pools and the sea edge take
  `perspectiveScale(y)`. A crack slot takes its wall's coping scale.
- **Slots are staggered by terrace**: a medium or large plant's 1.25× box reaches about 190–290
  units up, past the terrace behind. Each terrace's slots sit in the gaps between the slots of the
  terraces behind, so no plant stands over the base of one higher up. The two tree slots sit where
  nothing stands behind them: `top-1` at the top terrace's left end (its crown over the
  promontory's back, right of the temple) and `scrub-1` at the promontory's foot behind the right
  end.

## Consequences
- The painter tasks keep these shapes or move them with the tests: the coast tests pin the framing
  (crop contents, sky above the temple, suns in the crop), the broken edge, and every slot's
  ground and scale.
- The rock painter paints the shoreline's shelf, bastion, boulders and steps properly; the
  placeholder strokes a grey lip along `SHORE_EDGE` and drops stones on it.
- The daylight task lights from the left: long shadows fall right at both low suns.
- The right side of the frame (the olive, its terrace and the scrub tree) is outside the phone
  crop; phones see the temple and the sea edge instead.
