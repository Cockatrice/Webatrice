# @cockatrice/datatrice

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
