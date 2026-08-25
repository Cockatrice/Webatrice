---
'@cockatrice/datatrice': minor
---

Store performance overhaul for busy servers: joining a thousand-game room no longer freezes the main thread.

**Dev invariant checks disabled.** `storeMiddlewareOptions` now sets `immutableCheck: false, serializableCheck: false`. Every slice holds raw protobuf messages at server scale by design (game lists, user lists, board state), and RTK's dev-only checks deep-walk the entire state on every dispatch — O(state) per dispatch, measured at multiple seconds per walk and minutes of cumulative main-thread blockage during a busy-server join. Scoped `ignoredPaths` were tried first and proved whack-a-slice (each un-listed proto-heavy slice re-created the hang, and host-supplied extension slices can't be pre-listed). Immer already guarantees reducer immutability; production builds strip these checks regardless. `isSerializable` remains exported for consumers who re-enable a scoped check.

**Game-list batching.** One `Event_ListGames` frame used to fan out into one dispatch per game (thousands during a join snapshot), invalidating the memoized room selectors once per game. The listener now applies the whole frame through a single `roomGamesBatchApplied` action with an ordered changes list, preserving exact per-game upsert/remove/merge semantics — one dispatch, one selector invalidation, one render per frame.

**Cheaper and deduplicated sorts.** String sorts share a prebuilt `Intl.Collator` instead of per-comparison `localeCompare` (same default-locale ordering). The three room-games selectors (`getSortedRoomGames` / `getFilteredRoomGames` / `getRoomGameCounts`) are now layered over a single sorted base — one materialization + sort per frame instead of three; the filtered list returns the same array instance as the sorted list when filters are at defaults, and counts derive in O(1).

**Bounded notifications.** `state.notifications` was the one unbounded collection left (grew monotonically per session); it now trims at `MAX_NOTIFICATIONS` (200), mirroring the existing message-log caps.

**Code-review refinements.** `getRoomGameCounts` gets a `resultEqualityCheck` so count badges don't re-render each frame, and `roomGamesBatchApplied` shares one implementation with the single-game case reducers.
