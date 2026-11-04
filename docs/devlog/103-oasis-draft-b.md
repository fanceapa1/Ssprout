# 103 · Oasis draft B: the dune lake

**Idea.** A still, deep blue-teal lake held in a bowl of huge golden dunes (Erg Chebbi, the Ubari
lakes): a star dune behind, its sharp arms sweeping the skyline, mirrored in the water. A tended
palm garden sits on the near and side banks. Open sand and still water, no cliffs.

## What's in it
- `src/scenery/oasis/drafts/b/layout.ts`: the composition in world units (crests, lake, shaduf,
  walls, fences, palms, plantable zones, focus, phone crop).
- `src/scenery/oasis/drafts/b/paint.ts`: twelve paint steps, back to front, seeded by
  `createRng(seed).fork(label)`. Sky placeholder, lilac far range, the bowl's floor, the right
  linear dune with a lee rim, the star dune (lit east facet, west facet in rust-violet shade, a
  slip-face rim under the east arm), the near left dune, the lake (dunes mirrored and squeezed
  under the far shore, deep teal where it mirrors the sky, lifted wind lines), salt crust and
  reeds, 13 date palms (a cluster on the right bank, two on the west bank), a near-corner dune,
  the garden (walled beds with watered furrows, mud-brick walls, two afrag fences, the
  irrigation channel) and the shaduf (mud pillars, crossbeam, sweep pole, counterweight, bucket).
- `src/scenery/oasis/drafts/b/draft.studio.ts`: studio section `oasis-draft-b` with the world, the
  phone crop, the composition map and a close view of the shaduf.

## Plantable ground (≈ 25 slots)
Near-left walled beds (6), the near sand bank under the lake (6), the near shore (3), the
shallows by the bay (2), the right walled garden (5), the west bank behind the fence (3). All
of it is in the lower 45% of the world.

**Focus point:** the lake's near shore by the shaduf, (760, 650). The 600-wide phone crop shows
the star dune's peak, the lake, the shaduf and the near sand bank.

## Looked at
- r1: the star dune ended in a hard vertical edge over the right dune. The lake was murky olive,
  the west facet too heavy and red. Walls and beds were flat planks, the fences invisible, and
  the shaduf posts looked like blobs.
- r2: the lake is now blue (the reflection is squeezed to 0.3, with deep teal below it). Fixed
  fences and pillars. Dune bodies still reached into the lake, beds were blurry ovals, and a
  vertical edge was left where the right dune started.
- r3: dune feet stop at the far shore. Beds are perspective plots with furrows, walls are runs
  shaded by facing. A rounded "dome" appeared where the right dune overlapped the star dune, and
  the peak had a doubled edge.
- r4–r5: the right dune now starts behind the star dune's flank. Lower deform on the dune washes
  and the facet glaze, a lighter west facet and left dune, smaller crown hubs.

## Left open
- The star dune reads a little like a smooth cone. It wants more facets, sand-blown crest edges
  and stronger ripple texture.
- A faint lilac tip still shows at the peak. The reflection is a flat olive band and wants the
  facets mirrored more clearly, with broken edges.
- Palm crowns are all the same green and the trunks are thin. The cluster wants depth (haze at
  the back, darker in front) and a reflection where it meets the lake.
- The walls on the right bank still read as planks. Corners, gates and a well-house would help.
- The sky is a placeholder. No light plates and no sun.

## Round 2: the close view (owner feedback: round 1 was too far away for planting)
- The viewer now stands on the near shore. The lake fills the centre (x 390–1220, near shore at
  y 600–650). The star dune rises right behind the far shore with its peak at y 64, its shade face
  strong (opacity 0.62) and its south arm a sharp ridge down to the water. The dune behind the
  grove shows between the crowns. Only a sliver of far range is left.
- Six close palms on the right, 300–680 tall, with trunks about 30 wide and crowns cut by the top
  edge (in the icon area, but that is backdrop). Two small far palms on the west shore give depth.
- The shaduf is near and big: two mud pillars 160 tall, an 8-wide pole, a counterweight and a
  bucket over the water. The frond fence (96 tall) sits on the left bank. Mud-walled beds with
  furrows fill the near-left and near-right corners and the bank under the grove.
- The reflection is broken now: a ragged mirrored skyline, ripple bands of deep teal through the
  golden reflection, gold fragments in the blue, and lifted wind lines.
- The map shows the 25 slots as true-size plant boxes (`slotBox`: size class × perspective × 1.25),
  and a second `ghosts` entry shows them as silhouettes over the painting.
- Looked at (2 rounds, 20-minute timebox). v2r1: there was a hard rectangle where the star dune
  met the right dune, and the reflection was a flat olive band. v2r2: the star dune's body now
  runs to the right edge with the right dune above it, and the reflection reads golden and broken.
- Left open: the walls still look like planks. The bottom-centre sand is a bit bare (the guiding
  path will run there). The palm trunks are stiff and their crowns show the frond layer's edge.
  There is a faint box where the far-range sliver sits.
