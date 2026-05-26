---
'@cockatrice/webatrice': patch
---

Game feature cleanup — collapse over-engineered state and prop drilling, no behavior change:

- `useGameArrowInteractions`: `pendingArrow` and `pendingAttach` merged into one `Pending` discriminated union; the ref-flag + always-on `contextmenu` listener replaced by a one-shot `{ once: true }` listener registered at right-drag mouseup.
- `useGameDnd`: removed the `activeCard` state mirror, `handleDragStart`, and `handleDragCancel`. `<CardDragOverlayHost>` reads the active draggable from dnd-kit's own context via `useDndContext()`.
- New `GameInteractionContext` carries the 6-handler bag (`onCardHover`, `onCardClick`, `onCardContextMenu`, `onCardDoubleClick`, `onZoneClick`, `onZoneContextMenu`). `PlayerBoard`, `Battlefield`, `BattlefieldStackColumn`, `HandZone`, `StackColumn`, `PlayerInfoPanel`, and `AttachmentStack` stop forwarding these as props. Context value is memoized so existing `memo()` boundaries (AttachmentStack, BattlefieldStackColumn) still skip re-renders. Slot-specific handlers (`onPlayerContextMenu`, `onHandContextMenu`) remain explicit props.
- `attachmentSlotLayout(N, index)` added to `gridMath.ts`; `AttachmentStack` becomes a thin render loop instead of duplicating parent/child positioning math inline.
