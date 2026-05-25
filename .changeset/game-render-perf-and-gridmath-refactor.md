---
'@cockatrice/webatrice': patch
---

Game board: reduce drag-time re-renders by memoizing `BattlefieldStackColumn` and `AttachmentStack`, stabilizing `BattlefieldRow`'s droppable data, and collapsing the per-card inline callback wrappers in `Game`, `HandZone`, and `AttachmentStack` to bare references via a unified `CardSlot` handler signature `(ownerPlayerId, zone, card[, event])`. Also: extract battlefield grid math out of `playCard`, `useBattlefield`, `useGameDnd`, `BattlefieldStackColumn`, and `AttachmentStack` into `gridMath` (new helpers: `getStackColumn`, `getSubPosition`, `gridXFromColumn`, `nextAvailableColumn`, `attachmentStackFactor`, `effectiveCardDimensions`, `roundPercent`).
