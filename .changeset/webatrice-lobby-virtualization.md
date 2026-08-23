---
'@cockatrice/webatrice': minor
---

Virtualized lobby lists: the games table and user panels render only the visible window, so busy servers no longer cost a full re-render of thousands of rows per update.

**`VirtualRows`.** A render-prop variant of the existing `VirtualList` component — rows are built lazily for the visible window only (prebuilding `items: ReactNode[]` is itself O(N)), backed by react-window.

**Games list.** The room's games table (previously a full `<table>` re-rendering every game per list-update frame — thousands of rows on a busy server) is now a fixed-grid header above a `VirtualRows` body sharing one grid template. Sorting, selection, double-click join, filters, and the empty state are unchanged.

**User panels.** The server page's Players Online panel and the room page's Buddies + Players Online panels render through `VirtualRows` (28px rows) — a thousand-user server costs a viewport of rows per join/leave event instead of the full population.

**Room chat.** Chat rows wrap to variable heights and every message must stay reachable in scrollback (deliberately not windowed), so the per-append cost is bounded by memoizing rows instead: existing messages skip re-render on append.

**Code-review refinements.** Virtualized user rows are keyed by user name, so an open user context menu can no longer retarget to a different user when the roster reshuffles under it. Room-chat rows are keyed on a stable, ingestion-assigned message id that survives the 1000-message cap trim (the old array-index key broke exactly at steady state). The games table header and its virtualized body both reserve a stable scrollbar gutter, so columns stay aligned once the list overflows. `VirtualList` is expressed over `VirtualRows`, the two user panels share a `UserRows` component, and the games row renderer is memoized.
