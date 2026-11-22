# ADR 0385: A shared species may give a garden its own native name and line

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0167 (plant notes), 0250 (flora per scenery: `nativeLang`), 0251 (a note per
  garden, `in`), 0348 (species metadata as plain data)

## Context
Five species grow in both the oasis and the Greek coast: the caper, the southern maidenhair, the
grapevine, the pomegranate and the oleander. Their definitions were written for the oasis, so at
the coast their cards showed Darija native names ("Dalia", "Rremman", "Defla") and lines about palm
posts, the palms' shade and the bed of the oued. A note can already differ per garden
(`SpeciesNote.in`, ADR 0251); the native name, its language and the card's line could not: they
are fields of `SpeciesDef`, read as they are by the plant card, the planting sheet, Your plant and
the herbarium.

## Decision
- **`SpeciesDef.in?: Partial<Record<SceneryId, SpeciesWords>>`**, optional and plain data, where
  `SpeciesWords` is `{ description?, nativeName?, nativeLang? }` and a native name always comes with
  its language (the type requires both or neither).
- **`speciesWords(def, sceneryId?)`** (`src/plants/types.ts`) returns `{ nativeName, nativeLang,
  description }`: the garden's word where it gives one, else the species' own, word by word. The
  language follows the name it belongs to: a garden that gives only a line keeps the species' name
  and language.
- **Which garden.** Each reader asks for the garden the plant belongs to: the plant card for the
  plant's or the session's `sceneryId`, Your plant for the active session's or the latest bloom's,
  the herbarium for the pressed flower's, the planting sheet for the garden on view (`state.scenery`,
  where the session will grow). The studio and the plant view's tools ask with no garden and get the
  species' own words.
- The English `name` stays one per species. Notes keep their own `in` (ADR 0251).
- `words.test.ts` checks the rule and every species' entries: a garden that exists and offers the
  species, a native name with its language, a line under 80 characters led by the species' name.

## Consequences
- A species written for one garden keeps its words there by a character: a garden without an entry
  reads exactly what it read before. Devlog 227 dumps every card text in all four gardens before and
  after: only coast lines differ.
- Nothing is stored: plants, sessions and pressed flowers already carry their `sceneryId`. No schema
  change, no paint version change (`species/` is uncached, ADR 0251).
- A production build extracts `in` with the rest of the metadata (ADR 0348) as JSON.
- Announcements, the hover label, the calendar and the widget use only the English name, so they do
  not read it.
