---
applyTo: "packages/datatrice/src/store/games/**"
---

# Game-slice instructions

Game-slice listeners, reducers, and Servatrice-derived behavior. Most of the rules below are desktop-parity invariants â€” when in doubt, the desktop Cockatrice source at the cited `cockatrice/src/*:line` is ground truth.

## Servatrice game-event quirks

**`gameStateChanged` resync omits `userInfo`.** Servatrice's `Server_Game::sendGameStateToPlayers` (`server_game.cpp:280`) emits `playerList` with `withUserInfo=false` on every resync â€” game start, post-concede/unconcede, judge promotion. The wire payload's `properties.userInfo` is `undefined` for every player. The listener carries the previously-known `userInfo` forward per `playerId` so names don't flip to "(unknown)" mid-game; individual `Event_PlayerJoined` still carries full `userInfo`.

**`Event_AttachCard` unattach is detected via empty `targetZone`.** Desktop's `actUnattach` sends the event with all `target_*` fields unset; proto3 makes the numerics indistinguishable from "attach to player 0, card 0" (a valid combination). The only reliable signal is `!targetZone` â€” every real attach specifies a zone. Listeners write `attachPlayerId = -1`, `attachZone = ''`, `attachCardId = -1` explicitly so the `isAttachedChild` selector recognizes the detach. Same convention applied to fresh tokens in `Actions.tokenCreated`.

**`Event_DrawCards` reveals fewer cards than it draws for opponents.** Own draws emit `cards.length === drawCount` (full reveal). Opponent draws emit `cards.length === 0` and only the count. The listener inserts every revealed card and then bumps `hand.cardCount` by `drawCount - cards.length` so the hidden-slot count matches the authoritative server state. Render hand size off `zone.cardCount`, not `zone.order.length`.

**`Event_MoveCard` for an opponent's hidden card carries `card_id = -1` and an unresolvable position.** When a card moves between an opponent's hidden zones (e.g. hand â†’ library during a mulligan), the server can't reveal its identity, so `card_id` is `-1` and the position doesn't resolve against the empty `order`. The `cardMoved` listener can't move an identified card, so for a genuine cross-zone move it adjusts `cardCount` by `-1`/`+1` on the two zones instead. Without this, opponent hand/library totals desync (a same-size mulligan would leave the hand at `2Ã—` and the library short by a full hand).

**Cross-player TABLEâ†’TABLE moves do not emit unattach events for children.** Servatrice's `server_abstract_player.cpp:376` skips the unattach when source and target zone names match, and `:449` reassigns the parent's id on cross-player move. Desktop's Qt pointer linkage (`card_zone.cpp:19`) survives this implicitly; the Datatrice wire-data model does not. The `cardAttachmentReparented` primitive walks every player's table on intra-table moves and rewrites each child's `attachPlayerId` / `attachCardId` to the new parent.

**`GameEvent.player_id` defaults to `-1` (proto2), not `0`.** `0` is a valid player id, so listeners must check for `-1` to identify system-injected events. `EVENT_PLAYER_ID_SYSTEM = -1` in [src/store/games/messageLog.ts](../../packages/datatrice/src/store/games/messageLog.ts) is the canonical constant. Sockatrice's `ProtobufService` coerces unset `playerId` to `-1` when building the `GameEventMeta`, so downstream listeners can treat `meta.playerId === -1` as "system".

## Listener patterns

**One listener per inbound event, grouped by domain.** `game.listeners.ts` is a barrel over `game.listeners.{zones,cards,counters,arrows,players,phases}.ts`, each exporting `register<Domain>Listeners(mw)`. Keep exactly one listener per event action (`game.listeners.characterization.spec.ts` pins it), so the order the domains register in can't change what an event dispatches. Keep planning out of the effects: card-move planning and the arrow sweep's state scan (`arrowsTouchingCard`) live in `cardMove.ts`, payload planners (`cardAttrFields`, `mergeCardCounter`, `buildTokenCard`, â€¦) in `game.reducer.helpers.ts`. Planners return data; the one exception is `carryForwardResyncState`, which writes into the freshly normalized players it is handed.

**Pre-mutation reads via `api.getOriginalState()`.** Listeners that log on a deletion must read pre-mutation state via `api.getOriginalState()`. `playerLeft`, `cardDestroyed`, and `cardFlipped` (when the name is changing) all delete or overwrite the data they need to format the log line. The pattern: capture from `api.getOriginalState()` *before* dispatching the mutation primitive, format the log entry, then dispatch `gameMessageAppended`. Descriptors capture player ids and names before deletion. Departures preserve the stored name verbatim (including an empty name), as desktop `message_log_widget.cpp:444` does; a missing player makes both the reducer and listener no-op, as `game_event_handler.cpp:469` does. Other events retain their `logPlayer` fallback behavior.
