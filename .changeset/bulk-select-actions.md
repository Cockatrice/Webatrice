---
'@cockatrice/webatrice': minor
---

Rubber-band multi-select on the battlefield, stack, hand, and open zone-view dialogs, with bulk tap/untap and move-to-zone.

- Drag an empty-space box to select multiple cards; Ctrl/Shift adds to the current selection. Dragging over card art/text no longer triggers the browser's native text selection.
- Hit-testing is scoped to the zone the drag started in (`[data-zone-box-select]` on the battlefield, stack, hand, and zone-view dialog body), so a drag in one zone never selects cards in another and drags inside a popup work correctly. The band overlay renders `position: fixed` above dialogs and is clamped to its origin zone so it never paints into neighboring zones.
- Collapse-unless-selected governs every single-card interaction (click, double-click, drag-start, right-click): acting on a card outside the selection collapses to it; acting on a card already in the selection preserves it.
- Bulk actions reach the existing card context menu — Tap/Untap uses Cockatrice's collective rule (untap-all only if every selected TABLE card is tapped, else tap all) and Move-to-zone groups by source and emits one `moveCard` per group.
