---
"@cockatrice/sockatrice": patch
"@cockatrice/webatrice": patch
---

Extend the bulk card-action surface to drag-moves, P/T, annotation, and counters.

`request.game.*` gains four more multi-card commands (one file each, in
`commands/game/bulk/`): `bulkSetPT`, `bulkSetAnnotation`, `bulkIncCardCounter`, and
`bulkSetCardCounter`. Each batches one per-card command into a single
`CommandContainer` and judge-wraps per owner, matching the existing bulk commands.

webatrice now routes these through the selection instead of acting on one card:

- **Drag-and-drop** — every drop kind (battlefield reposition, hand/stack/popup
  reorder, and cross-zone) moves the whole selection via `bulkMove`. The dragged
  card alone is the unchanged single-card case.
- **Set P/T** and **Set annotation** (card menu) apply the entered value to every
  selected card.
- **Counters** — the inline +/- delta and the "Set counter" prompt apply across the
  selection.

A multi-selection only takes effect when the acted-on card is part of it; otherwise
each action behaves exactly as before on the single card.
