# 59 — Rename a study plant

## What and why
Added Rename beside “Its story” in the plant card. Growing, waiting and completed garden plants
can edit their study session name inline with Save / Cancel, Enter to save and Escape to cancel.
The existing name rules apply: normalize whitespace, cap at 40 characters, and use “Study session”
when blank. Drafts survive progress ticks and are discarded when closing or changing cards.

`controller.rename` dispatches a pure `session/rename` action that changes only the selected
session / plant's task name and its matching log entry. Existing subscriptions update the other
views and existing persistence saves the edit; no state schema change or migration is needed.
Later bloom and pressing carry the name forward. `src/main.ts` was not changed.

## Validation and status
- Typecheck passed.
- All 115 unit test files passed (1,384 tests), including rename normalization, targeting active /
  waiting / completed plants, preserving unrelated state, no-ops, history, bloom / press and save / load.
- Desktop and phone edit / saved screenshots reviewed in `artifacts/rename/`.
- Full browser suite attempted, then stopped after the existing ambience frame-budget check
  exceeded its 1.5 ms limit (1.72 ms measured). That performance code was not changed.
- All nine focused browser checks passed (`rename.spec.ts` and `plant-card-phone.spec.ts`):
  desktop / phone saves and reloads, Enter, Cancel / Escape, blank defaults, drafts surviving
  ticks, waiting-session edits without switching, and existing card scrolling / touch controls.

## Scope
Follow-up: added an inline Rename control beside the active session name in Study after the
card-only entry point proved difficult to find. Desktop / phone coverage checks editing without
opening a plant card, Escape, draft stability, saving and reloading. The actual Chrome localhost
tab was checked through its accessibility tree and exposes the new Rename button beside the task.
The follow-up typecheck, both new browser checks (desktop and phone), and the ten focused core /
plant-card unit tests passed. Both Study-section screenshots were visually reviewed.
The published GitHub site has not been deployed from these local changes.

Renaming is available on garden plant cards. Pressed flowers have no card or stable session id
and are outside this edit flow (ADR 0240).

## PR preparation on current main
The feature is isolated on `feat/rename-study-plants`, based on `fdc74b7`. Newer main changes
are preserved. The decision and devlog are numbered 0240 and 59 to avoid collisions with the
new main documentation. Typecheck and the production build pass; the browser rerun on this
base hit timeouts in existing phone-card checks. The PR remains a draft while fresh validation
is checked. The development results above describe the original local base.
Current-main rerun: both desktop rename flows passed. Existing phone-card checks timed out, and the unit rerun reported a failure in the susuki-grass growth artwork test; validation is not green.
