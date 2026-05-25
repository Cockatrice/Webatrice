---
'@cockatrice/webatrice': patch
---

Drag-start latency fixes for the game board:

- Left-click drag activates on the first pointermove (`distance: 0`) — eliminates the perceptible "dead zone" between mousedown and drag preview, while pure clicks (zero-motion press→release) still flow through to the card click handler. The previous `{ distance, delay, tolerance }` combined constraint was inadvertently canceling fast-flick drags before they could activate.
- `<img draggable={false}>` + `user-drag: none` on `.card-slot` and `.card-slot__image` suppress the browser's native HTML5 image-drag that was producing a "no-drop" cursor during the pre-activation window.
- `DragOverlay` snap-back animation disabled (`dropAnimation={null}`).
- `CardSlot` split into a thin wrapper (owns the dnd-kit context subscription via `useDraggable`) and a memoized `CardSlotContent` inner (renders the image, name/annotation overlay, P/T, counters). On drag activation, the wrapper re-renders but the inner content skips for cards whose visual state didn't change — meaningful reduction in React commit work with ~60 cards on a typical board.
- Right-click arrow drag threshold `ARROW_DRAG_THRESHOLD_PX` set to 4 (now independent from the left-click sensor distance, which has different ergonomics).
