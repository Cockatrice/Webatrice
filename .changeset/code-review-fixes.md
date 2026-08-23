---
'@cockatrice/sockatrice': patch
'@cockatrice/datatrice': patch
'@cockatrice/webatrice': patch
---

Code-review fixes across the keepalive, store, and lobby work on this branch.

**Keepalive (sockatrice).** A main-thread stall queues one worker tick per interval; on drain they fired back-to-back and each armed a ping, so a long stall emitted a burst of `Command_Ping` frames that could trip the server's per-interval flood counter. `tick()` now returns early for a burst-drained tick (a pending ping younger than ~one interval), so only the first drained tick sends — genuine silence still pings every interval as the never-self-disconnect policy intends. The derivable `reportedDegraded` flag and its unreachable reset branch are gone (recovery is derived from the pre-reset miss count). `buildWebSocketUrl` no longer lists a bare `::1` as a local host, since only the bracketed `[::1]` form produces a valid `ws://` URL.

**Store (datatrice).** The volatile ping clock now lives in a top-level `GamesState.pings` sibling map instead of inside `GameEntry`, so a ping-only tick flips no game-graph reference — `getGame` / `getActiveGames` / `getActiveGameIds` subscribers are untouched, not just the players graph. `Enriched.GameEntry` is unchanged from before the ping-split work. The ping-only fast path is now a named `isPingOnlyUpdate` predicate (set fields ⊆ ping_seconds + the redundant player_id) rather than a field-by-field scan. The no-op room-broadcast skip compares `gametypeMap` by value (a fresh map is allocated whenever the broadcast carries a gametype list, so the old reference check never fired the skip); `getRoomGameCounts` gets a `resultEqualityCheck` so count badges don't re-render each frame; `roomGamesBatchApplied` shares one implementation with the single-game case reducers; and the healthy-connection baseline is a single shared constant.

**Lobby (webatrice).** Virtualized user rows are keyed by user name, so an open user context menu can no longer retarget to a different user when the roster reshuffles under it. Room-chat rows are keyed on a stable, ingestion-assigned message id that survives the 1000-message cap trim (the old array-index key broke exactly at steady state). The games table header and its virtualized body both reserve a stable scrollbar gutter, so columns stay aligned once the list overflows. `VirtualList` is expressed over `VirtualRows`, the two user panels share a `UserRows` component, and the games row renderer is memoized.
