# @cockatrice/datatrice

## 4.5.0

### Minor Changes

- f2ac3f1: Store performance overhaul for busy servers: joining a thousand-game room no longer freezes the main thread.

  **Dev invariant checks disabled.** `storeMiddlewareOptions` now sets `immutableCheck: false, serializableCheck: false`. Every slice holds raw protobuf messages at server scale by design (game lists, user lists, board state), and RTK's dev-only checks deep-walk the entire state on every dispatch — O(state) per dispatch, measured at multiple seconds per walk and minutes of cumulative main-thread blockage during a busy-server join. Scoped `ignoredPaths` were tried first and proved whack-a-slice (each un-listed proto-heavy slice re-created the hang, and host-supplied extension slices can't be pre-listed). Immer already guarantees reducer immutability; production builds strip these checks regardless. `isSerializable` remains exported for consumers who re-enable a scoped check.

  **Game-list batching.** One `Event_ListGames` frame used to fan out into one dispatch per game (thousands during a join snapshot), invalidating the memoized room selectors once per game. The listener now applies the whole frame through a single `roomGamesBatchApplied` action with an ordered changes list, preserving exact per-game upsert/remove/merge semantics — one dispatch, one selector invalidation, one render per frame.

  **Cheaper and deduplicated sorts.** String sorts share a prebuilt `Intl.Collator` instead of per-comparison `localeCompare` (same default-locale ordering). The three room-games selectors (`getSortedRoomGames` / `getFilteredRoomGames` / `getRoomGameCounts`) are now layered over a single sorted base — one materialization + sort per frame instead of three; the filtered list returns the same array instance as the sorted list when filters are at defaults, and counts derive in O(1).

  **Bounded notifications.** `state.notifications` was the one unbounded collection left (grew monotonically per session); it now trims at `MAX_NOTIFICATIONS` (200), mirroring the existing message-log caps.

  **Code-review refinements.** `getRoomGameCounts` gets a `resultEqualityCheck` so count badges don't re-render each frame, and `roomGamesBatchApplied` shares one implementation with the single-game case reducers.

- f2ac3f1: New `server.connectionHealth` state surfacing the transport's keepalive health signal.

  `SessionResponseImpl` implements the new optional `updateConnectionHealth` response method, dispatching `connectionHealthChanged({ missedPongs, silentForMs })` into a new `server.connectionHealth` field (`missedPongs > 0` = the server is not answering pings while the socket stays open; `0` = healthy). Any `updateStatus` transition resets the field so stale degraded state from a previous socket cannot survive a reconnect. New selectors: `getConnectionHealth` (with a stable healthy fallback for preloaded/partial states that predate the field) and `getIsServerUnresponsive`. The healthy-connection baseline is a single shared constant.

- f2ac3f1: Dev-mode freeze guard: in-place mutation of a stored protobuf message now throws instead of failing as silent staleness.

  **The hazard.** Immer can't draft protobuf-es messages (proto2 builds them with `Object.create(prototype)` for field presence, so `isDraftable` skips them), so a reducer writing `card.x = y` on a stored message goes untracked: the reference never changes and memoized selectors keep serving the cached value. The bug class is real — the clone-and-reassign hardening pass (#49) fixed four shipped instances (`counterSet`, `adjustMod`, `replayModifyMatch`, `playerPropertiesUpdated`) that were found months later, backwards from stale-UI symptoms. With RTK's dev invariant checks off (they deep-walk proto-laden state), nothing guarded the convention.

  **The guard.** A dev-only `freezeMessagesMiddleware` in `createStore` deep-freezes every protobuf message (including nested messages and repeated-field arrays) as it enters state, after each dispatch. Violating writes now throw a `TypeError` at the offending line in dev — including writes from consumer code holding selector-returned references, which Immer's container auto-freeze never covered. Freezing happens at state entry, never at creation, so the build phase (bare `clone()` outputs patched before dispatch, optimistic plain-spread cards) stays mutable until a dispatch lands the object in state.

  **Bounded cost, dev only.** A module-scope `WeakSet` skips already-visited nodes; Immer's path-copying preserves unchanged subtree identity, so each dispatch re-walks only newly created nodes — O(changed path), not the O(state) that forced the invariant checks off. Production builds compile the middleware to a passthrough (`process.env.NODE_ENV`, the RTK convention — bundlers statically replace the expression).

  **Validated at the bridge seam.** A new integration spec drives the response bridge (`attachResponseHandlers`) through the game hot paths — join snapshot, draw, move, `SetCardAttr` clone semantics, bulk untap, reveals with auto top-reveal, counters, player properties, both optimistic-echo branches (re-key migration and in-place position patch), the rooms `updateGames` batch and sparse `UPDATE_ROOMS` merges — plus a whole-store sweep asserting no reachable message is left unfrozen. All probes are proven causally tied to the middleware: running the suite with the guard compiled out fails every test.

- f2ac3f1: In-game steady-state performance: the server's per-second broadcast streams no longer invalidate the render tree.

  **Ping clock split out of the player graph.** Servatrice broadcasts `Event_PlayerPropertiesChanged` carrying only `ping_seconds` roughly once per second for every seated player and spectator — ~5 events/second per open game, doubling with each additional game. That volatile clock lived inside `player.properties`, so every tick cloned the player entry and flipped the `players` reference, re-rendering every `getPlayers`/`getPlayer` subscriber (chat log, battlefield, arrow overlay, board cells) several times a second. The clock now lives in a top-level `GamesState.pings` sibling map, outside the game graph entirely: `playerPropertiesUpdated` routes a set `pingSeconds` there and, when the update carries nothing else (an `isPingOnlyUpdate` allowlist of ping_seconds plus the redundant player_id, matching the documented ping-tick wire shape), returns without touching `player.properties` — the `games` map and every game/player reference stay identical, so the tick stream invalidates nobody. Mixed payloads keep the existing sparse-merge semantics plus the pings write. New selectors `getPings(gameId)` and `getPlayerPing(gameId, playerId)` read the sibling map and are the authoritative read path; the `properties.pingSeconds` snapshot inside the graph is stale after join by design. Field-measured: ~290 ping events/minute that previously drove 13-20s/minute of main-thread long tasks now drive under one second per minute.

  **No-op room re-broadcasts skipped.** Servatrice re-sends `Event_ListRooms` every few seconds whether or not anything changed. The `updateRooms` listener now compares the sparse-merge result against the stored room (protobuf `equals`, plus order and gametype map) and skips the `roomUpserted` dispatch when nothing changed, so steady-state broadcasts stop flipping room references and re-rendering rooms subscribers.

  **Code-review refinements.** The volatile ping clock lives in a top-level `GamesState.pings` sibling map instead of inside `GameEntry`, so a ping-only tick flips no game-graph reference — `getGame` / `getActiveGames` / `getActiveGameIds` subscribers are untouched, not just the players graph. `Enriched.GameEntry` is unchanged from before the ping-split work. The ping-only fast path is a named `isPingOnlyUpdate` predicate (set fields ⊆ `ping_seconds` + the redundant `player_id`) rather than a field-by-field scan. The no-op room-broadcast skip compares `gametypeMap` by value (a fresh map is allocated whenever the broadcast carries a gametype list, so the old reference check never fired the skip).

- f2ac3f1: Sort user and game lists using the active UI language's collation instead of the OS/browser default.

  **datatrice.** `SortUtil` now accepts an optional BCP-47 `locale` (per-locale `Intl.Collator` cache; `undefined` keeps the environment default). The server slice gains a `locale` field and a `setLocale` action (preserved across `initialized`/`clearStore`/`disconnected` resets so it survives a reconnect), and the memoized sorted selectors (`getSortedUsers`/`getSortedBuddyList`/`getSortedIgnoreList`, `getSortedRoomGamesBase`/`getSortedRoomUsers`) take `locale` as an input so a language change re-collates immediately rather than waiting for the next roster/sort change.

  **webatrice.** A `useSyncLocaleToStore` hook mirrors the active i18next language (normalized via `toBcp47`) into `server.locale` on mount and on every language change. The app's `<Suspense>` boundary moved from inside `AppShell` up to `index.tsx` — below `DatatriceProvider`/`WebClientProvider` but above all of `AppShell` — so a translation-load suspension (a non-bundled language fetching its namespace) resolves to that fallback without tearing down and reconstructing the `WebClient` singleton. Loading UX is unchanged.

  **ICU fallback.** When an ICU message fails to parse or format — e.g. a malformed Transifex translation such as a missing `select` comma or localized ICU keywords — the i18next-icu `parseErrorHandler` now re-renders it from the bundled, validated English source instead of emitting the raw `{…}` template to users. A failing English source (our own bug) is left visible rather than masked.

### Patch Changes

- f2ac3f1: Track whether the most recent connection attempt never reached the server, for
  the login screen's reachability hint. `SessionResponseImpl.connectionUnreachable()`
  dispatches a new `connectUnreachable` action; a `connectUnreachable` boolean on
  `ServerState` is set by its reducer and exposed via the `getConnectUnreachable`
  selector.

  The flag reflects only the latest attempt: it is cleared at the start of every
  attempt — both `connectionAttempted` (login/reconnect) and `testConnectionStarted`
  (the known-hosts probe) — and carried through the `disconnected()` rebuild that
  accompanies the failure. That carry is load-bearing: the failure's own DISCONNECTED
  triggers the listener-dispatched `disconnected()` rebuild in the same tick, which
  would otherwise reset the freshly-set flag before any component reads it.
  `clearStore`/`initialized` deliberately reset it to `false`.

- f2ac3f1: Carry `testConnectionStatus` through the `disconnected()` / `clearStore()` reset
  reducers (like `status` and `locale`) so a transient game-socket drop no longer
  nulls the login screen's connection-probe result. Previously these resets
  rebuilt server state from scratch and wiped `testConnectionStatus` to `null`,
  which disabled the login button (LoginForm gates on `'success'`) and fired a
  known-hosts recovery effect that opened a fresh probe WebSocket on every
  disconnect. Repeated disconnects produced a burst of probe sockets that, behind
  the same public IP as the game socket and other tabs, exceeded Servatrice's
  per-IP connection cap (`security/max_users_per_address`, default 4) and got
  refused with `TOO_MANY_CONNECTIONS` (self-healing only once idle sockets aged
  out ~60–120s later). The probe result now survives a transient drop, so the
  login button stays enabled and there is nothing for a recovery effect to
  recover.

## 4.4.0

### Minor Changes

- 4396583: State-layer support for the UI revamp: optimistic card moves, a segmented Cockatrice-parity message log, reveal/peek plumbing, private-chat selectors, and a batch of reducer fixes. Unit test coverage is now ~90%.

  **Optimistic mutations.** New `store/games/optimistic.ts` registry (`beginOptimistic` / `isOptimisticPending` / `consumeOptimistic` / `rollbackOptimistic`, key builders `moveOpKey` / `attrOpKey`). The `cardMoved` listener consumes matching pending ops so the server echo of a cross-zone move is not double-applied, reconciles server-corrected positions/ids (a cross-player table-to-table move migrates the optimistic entry to the server's new card id, preserving client-tracked fields like the owner annotation), and the wire layer rolls back on command error.

  **Segmented message log.** Every `messageLog.ts` formatter now returns a `LogEntry { text, segments }` (segment kinds `plain`/`player`/`card`/`number`) so the UI can style tokens individually, and `classifyLogTone` buckets lines into `phase`/`turn`/`system`/`action` for color-coding. Log wording is rewritten to Cockatrice-desktop parity (move lines with from-clauses and per-zone phrasing, "turns … face-down", counter totals as "now", coin-flip wording for 2-sided dice, P/T changes reported "from OLD to NEW", possessive arrow lines, translated counter names). New formatters: `formatCardsRevealed`, `formatCardPeeked`, `formatCardUndoneDraw`. `gameMessageAppended` accepts `string | LogEntry`.

  **Reveal / zone-view plumbing.** A new `cardsRevealed` listener detects Servatrice auto-top-reveals (suppressing chat spam and the dialog, tracking a persistent `topRevealedCard` per zone), logs peeks per card, and dispatches a new `incomingReveal` state slot (+ `getIncomingReveal` selector) when another player reveals cards to you. Reversed (bottom-N) library views now index correctly (`zoneViewRevealed` carries `isReversed`; reveal ids offset by `cardCount − N`), hidden bottom-view drags reorder within the snapshot, and a cross-zone move into a viewed zone inserts into it (`zoneViewCardInserted`). `PlayerEntry` gains `drawSeq` / `lastDrawCount` (draw beacon), with a `drawBeaconBumped` action.

  **New server selectors** for the revamped UI: `getPrivateMessagesForUser` (conversations keyed by the other user's name — backs private chats), `getIsUserAdmin`, `getBanHistoryByUser`, `getWarnHistoryByUser`, `getAdminNotesByUser`.

  **Fixes.**

  - Bulk untap-all now skips cards flagged "doesn't untap", matching the server's rule.
  - Orphan arrows no longer block new arrows after a cross-player move (arrow sweep now also runs on same-zone cross-player moves).
  - Moving a card to the stack keeps its annotation (`resetCardState` gains a keep-annotations carve-out); all other non-table zones still clear it.
  - A stale top-card face no longer lingers on a pile after a draw, a move from the top, or a shuffle.
  - An opponent's undo-draw is now logged for observers (`cardMoved` carries `isUndoDraw`, detected from the event context) instead of being swallowed by the hidden-card early return.

  Note: `zoneViewRevealed` (action payload and `GameResponseImpl` bridge method) gains a required `isReversed` argument, and `cardMoved` an optional `isUndoDraw`.

## 4.3.0

### Minor Changes

- 1aa18d0: Move the canonical zone-name wire constants to sockatrice.

  `ZoneName` and `ZoneNameValue` were defined here and re-exported via the `Enriched`
  namespace, but the zone wire strings are a Cockatrice protocol concern, so they now
  live in `@cockatrice/sockatrice`. `Enriched.ZoneName` and `Enriched.ZoneNameValue` are
  no longer exported — import `ZoneName` / `ZoneNameValue` from `@cockatrice/sockatrice`
  instead (no convenience alias is kept). All internal datatrice references
  (listeners, reducers, selectors, message log) were repointed; the `Enriched`
  namespace is otherwise unchanged.

## 4.2.4

### Patch Changes

- b2a9b58: Close four behavior gaps in the game reducer layer found while reviewing the
  opponent-mulligan fix.

  - A shuffle now clears the shuffled zone's known-card tracking (order/byId) and any
    open "View library" snapshot, preserving cardCount. Servatrice reveals real card ids
    to the owner when cards move from the hand (a PrivateZone) into the library (a
    HiddenZone), so the client tracked them and rendered a face-up known card on top of
    the library after a mulligan; Event_Shuffle is the only post-shuffle signal, so the
    client must drop those now-randomized positions on it.
  - getSeatedPlayers is memoized so an unchanged seating returns the prior array by
    reference, sparing board/reveal consumers a re-render on every unrelated mutation.
  - activePlayerSet no longer logs a turn change before the game has started, matching the
    existing activePhaseSet guard.
  - A full gameStateChanged resync (e.g. a spectator joining) now carries an open "View
    library" snapshot (revealedCards) forward per zone, the same way it preserves userInfo,
    instead of dropping it.

- b2a9b58: Keep an opponent's hand and library counts in sync through a mulligan.

  When an opponent mulligans, Servatrice returns their whole hand to the library and
  redraws (N x `Event_MoveCard` hand-to-library, then `Event_Shuffle`, then
  `Event_DrawCards`). For an observer the hand and library are hidden zones, so each
  hand-to-library `Event_MoveCard` carries `card_id = -1` with an unresolvable position.
  The `cardMoved` listener previously early-returned on any move it couldn't tie to a
  known card, so those transfers never adjusted the zone totals -- the subsequent draw
  then inflated the hand and shrank the library (a same-size mulligan left the hand at
  double size and the library short by a full hand).

  The listener now performs a count-only transfer for genuinely hidden cross-zone moves,
  decrementing the source zone's `cardCount` and incrementing the target's (reusing the
  existing `zoneCardCountAdjusted` primitive). The fix is general: it also corrects any
  other hidden opponent move, such as a discard from hand or a hand to top-of-library
  move. The local player's own mulligan was unaffected because their cards carry real ids.

## 4.2.3

### Patch Changes

- e0a1d55: Track server seat/join order in the games slice.

  `GameEntry` gains a `seatOrder: number[]` maintained by the reducers (`gameJoined` inits it,
  `playerJoined` appends, `playerLeft` removes, `gamePlayersReplaced` accepts an optional `order`),
  populated from the server's ordered `playerList` in the full-sync listener. A new pure helper
  `games.seatedPlayersOf(game)` and selector `games.Selectors.getSeatedPlayers(state, gameId)` return
  the active (non-spectator, non-conceded) players in that seat order — the single authority consumed
  by the board layout and the reveal-target list, replacing per-consumer numeric-key ordering.

- 7e02622: Harden the game store against the Immer / protobuf-es hazard and optimize game-board rendering.

  - **Store (datatrice):** reducers across the games/rooms/server slices now clone-and-reassign protobuf-es messages instead of mutating them in place. Immer can't draft proto2 messages, so in-place writes (`counterSet`, `adjustMod`, `replayModifyMatch`, `playerPropertiesUpdated`, and the room/game list merges) went untracked, and several spreads dropped unset proto2 fields. Adds a `cloneWith` helper and a `dequal` dependency.
  - **Attachment selector:** `getAttachmentsByParent` returns a stable reference when the attachment graph is unchanged (reselect `lruMemoize` + `dequal`), so a single card mutation no longer rebuilds-and-re-renders the whole battlefield.
  - **Render (webatrice):** battlefield row/column card arrays are reference-stabilized, and `Battlefield`/`HandZone`/`PlayerList`/`PlayerInfoPanel` are memoized, so tapping one creature re-renders only that card's subtree instead of the entire board and sidebar.

## 4.2.2

### Patch Changes

- 32a61bc: Reset a card's battlefield-only state when it leaves the battlefield.

  Webatrice previously preserved a card's `tapped` status (and other battlefield-only
  attributes) when it moved zones, so a tapped creature stayed "tapped" in the graveyard
  or hand. `Event_MoveCard` carries none of these fields and Servatrice emits no
  per-attribute reset event, so — exactly as Cockatrice's desktop client does via
  `CardItem::resetState()` — the client now wipes the transient state on a
  `TABLE → non-TABLE` move.

  A new `resetCardState()` helper clears `tapped`, `attacking`, `doesntUntap`, `pt`,
  `color`, `annotation`, and `counterList` (previously only `counterList` was cleared).
  Moves within the battlefield and between non-table zones are unaffected.

## 4.2.1

### Patch Changes

- d382725: Make zone-view popups (graveyard / exile / library) full drag participants and
  route zone moves to the card's owner, matching Servatrice.

  Cards in a popup are now draggable — out to the battlefield, into another open
  popup, or reordered in place — and a popup is itself a drop target, so cards can
  be dragged into it. Moves into a non-table zone (graveyard, hand, exile, library)
  now target the card's owner tree rather than the acting player: a controlled
  opponent card sent to a non-table zone lands in the owner's zone, never a third
  party's, mirroring Servatrice's move rules (`server_abstract_player.cpp`). TABLE
  keeps cross-player targeting so giving a card to an opponent (a control-change)
  still works.

  The open "View library" popup now stays in sync with the deck: when a card
  leaves it the snapshot is pruned and re-indexed, and dragging within the popup
  reorders the library — both mirroring Cockatrice's live `ZoneViewZone`.

  Drag collision detection now respects the popup's stacking: because a zone-view
  popup floats above the board, a card dropped onto it routes into the popup's zone
  (rather than the board droppable underneath), and a card dropped on visible board
  lands there even when a popup overlaps elsewhere on screen.

## 4.2.0

### Minor Changes

- 63e77cb: Fix the View Library flow so the deck's cards are actually revealed.

  Opening "View library…" now sends `Command_DumpZone` and consumes the
  `Response_DumpZone` card list the server returns to the requester, routing it
  into the store (new `ZoneEntry.revealedCards` with `zoneViewRevealed` /
  `zoneViewCleared` reducers and a `getRevealedCards` selector). The popup reads
  the revealed cards from the store and renders them face-up, and a Cockatrice-
  parity "Shuffle on close" checkbox (deck only, default on) sends
  `Command_Shuffle` when the view is closed.

  Also stops pre-bundling the `@cockatrice/*` workspace packages in webatrice's
  vite `optimizeDeps` so `npm run start` reliably reflects dependency rebuilds
  instead of serving a stale pre-bundle.

## 4.1.3

### Patch Changes

- c19c819: Hand and stack zones now support drag-and-drop reordering. Dragging a card within your hand or side-pile sends a same-zone `Command_MoveCard` with the target index, and a bright pale-yellow insertion bar lights up in the gap where the card will land — on the after-edge of the hovered slot when moving forward, on the before-edge when moving back. A new `cardMovedInSameZone` reducer handles the intra-zone splice without going through the cross-zone path, so no arrow sweep or attachment reparent fires on a simple reorder.

  Under the hood, `useGameDnd.handleDragEnd` is split into a `classifyDrop` dispatcher plus small `resolveTableGridX` / `sendMoveCard` helpers. The DndContext also gets a custom `collisionDetection` that prefers reorder-slot droppables over their enclosing zone — without it, a 64×88 stack slot loses dnd-kit's default IoU tiebreaker against the wider stack column whenever the 146×204 drag overlay is in flight, which is why stack reorders silently failed before this change.

## 4.1.2

### Patch Changes

- fa879b2: Untap-all now matches Cockatrice's wire protocol. Pressing F5 or double-clicking the Untap phase sends a single bulk `Command_SetCardAttr` with `card_id = -1` instead of one command per tapped card, so peers see every card untap in one frame and the chat log shows a single "untaps their permanents" line instead of N per-card lines. The inbound listener detects the bulk variant via `isFieldSet` (Servatrice omits `card_id` on the broadcast event for bulk operations) and applies the attribute to every card in the named zone in one reducer pass via a new `cardFieldsUpdatedBulk` action, so the local Webatrice UI now refreshes immediately on bulk untap without requiring a page reload.

## 4.1.1

### Patch Changes

- 6c8484f: Arrows can now be drawn from a card to a player. The player info panel header acts as the drop/click target during a right-click-drag or pending arrow click; the rendered line anchors to the life counter. Several supporting fixes were needed to make the round-trip work:

  - proto2 field presence: `Command_CreateArrow` now omits `targetZone`/`targetCardId` for player targets so Servatrice routes the command via `has_target_zone()`/`has_target_card_id()` (omitting → player) rather than treating the empty defaults as a card lookup.
  - Live `arrowCreated` reducer assigns the raw `ServerInfo_Arrow` proto into the store instead of `{ ...arrowInfo }`. Spreading a bufbuild proto2 message drops unset optional fields entirely, which caused live player-targeted arrows to land in state without `targetZone`/`targetCardId` and silently fail to render until the next game-state refresh.
  - The cardMoved arrow-cleanup sweep now only runs on actual cross-zone moves, so repositioning a card within the battlefield no longer locally deletes its attached arrows.

## 4.1.0

### Minor Changes

- 73513b3: Removed the `Data` re-export namespace. Import protobuf types directly from `@cockatrice/sockatrice/generated`.

## 4.0.0

### Major Changes

- **Monorepo unification.** Datatrice is now developed alongside Sockatrice and Webatrice in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) at `packages/datatrice/`. Datatrice and Sockatrice share a major version from this release forward; subsequent releases cascade per [Changesets](../../.changeset/README.md) (`updateInternalDependencies: minor`).
- **Distribution moved to GitHub Packages.** Published under the `@cockatrice` scope at `https://npm.pkg.github.com`. The previous frozen-tarball-on-GitHub-Releases flow is discontinued. Consumers configure their `.npmrc` with `@cockatrice:registry=https://npm.pkg.github.com` and authenticate with a PAT that has `read:packages`.
- **Peer dependency on Sockatrice tightened.** `peerDependencies["@cockatrice/sockatrice"]` is now `^4.0.0` (was `*`). The wildcard accepted any Sockatrice version on the most tightly-coupled boundary in the stack (the `*ResponseImpl` classes bind directly to `IWebClientResponse` and protobuf types); the new range expresses real compatibility and is install-enforced.

### Notes

- The store slices (`server`, `rooms`, `games`), the React glue (`DatatriceProvider`, `WebClientProvider`, `useWebClient`), `attachResponseHandlers`, and the `Enriched.*` / `App.*` / `Data` namespaces are unchanged. The major bump reflects the distribution, peer-range, and monorepo unification.

### Updated dependencies

- Bumped peer `@cockatrice/sockatrice` to `^4.0.0`.
