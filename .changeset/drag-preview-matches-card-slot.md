---
"@cockatrice/webatrice": patch
---

Make the card drag preview match the resting card.

While dragging, the floating preview rendered only the card image and ignored
tapped state. It now reuses the resting slot's presentation: `CardSlotContent` is
extracted from `CardSlot` and shared with `CardDragOverlay`, so the preview shows
the same name, P/T, owner/annotation pill, and counters, and stays rotated 90°
when the dragged card is tapped.
