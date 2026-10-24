---
applyTo: "packages/webatrice/src/features/game/**"
---

# Game-feature instructions

Applies in addition to [webatrice.instructions.md](webatrice.instructions.md) when editing `packages/webatrice/src/features/game/`.

This is the most parity-sensitive feature in the webclient — desktop and webclient players sit side-by-side in the same Servatrice room. Desktop reference at `../cockatrice/src/game/`. Read it before changing layout math, phase wiring, dialog defaults, or event handling.

## Battlefield grid

Port of `cockatrice/src/game/zones/table_zone.cpp`.

**Wire encoding** (what Servatrice sends and consumes):

- `x = stackColumn × MAX_SUBPOS + subPosition`, `subPosition ∈ {0, 1, 2}`
- `y ∈ {0, 1, 2}` (pre-inversion)
- `MAX_SUBPOS = 3`: desktop packs up to three cards into a single stack column before overflowing. A card at desktop `x=9` is at visual column 3, not column 0 — render empty columns as placeholders so the encoding stays positional.

Constants in [gridMath.ts](../../packages/webatrice/src/features/game/components/battlefield/Battlefield/gridMath.ts) preserve desktop's geometry at 2× nominal size. The one deliberate divergence: `STACKED_CARD_OFFSET_Y_PX = 12` (~6%) vs desktop's `PADDING_Y/3 = 10` (~10%) — tuned for a readable diagonal at typical browser zoom.

**Drop-point math** (ports of `table_zone.cpp`):

- `mapToGridX` adds `paddingX/2` to the pointer x before walking the stack columns — that's how desktop snaps a pointer near a stack boundary to the **nearer** stack rather than the leftmost.
- `closestGridPoint` returns `null` when all `MAX_SUBPOS` slots in the target stack are occupied. Desktop drops the card from the drag list at `card_drag_item.cpp:115` (silent reject). Callers must skip dispatching `moveCard` on `null`, not log an error.
- `stackCountsForRow` does **not** filter — the caller must exclude attached children from `cards` before passing them in. Attached children share their parent's stack column and don't claim a slot of their own.
- `applyInvertY` is the only place y-inversion happens. Rendering already flips a mirrored board's rows in `useBattlefieldLayout`; inverting again at render double-flips. Invert only when sending a move to a mirrored board (or when `invertVerticalCoordinate` is set and the board isn't mirrored).

## Attachment stack

Port of `table_zone.cpp:153-185`.

- **Parent ends up rightmost (highest z)**; attached cards fan to the left, first-attached child closest to the parent. Matches desktop's "j=1 = closest to parent" ordering.
- `useBattlefieldLayout` owns both halves of the fan, so they cannot drift: `computeCellWidths` widens the parent's cell by one `STACK_OFFSET_PX` (desktop's `STACKED_CARD_OFFSET_X`, 24 px at scale 1) per attached child (when the parent is alone in its cell; a stacked cell keeps its stack width, as in desktop's `computeCardStackWidths`), and the card positions shift the parent right by the same amount and fan each child one offset further left.
- **Vertical fan offsets** port `table_zone.cpp:166-185` (`if (numberAttachedCards) actualY += 15` and `childY = y + 5`, scaled with the cards). Two rules to preserve: (a) the parent shifts down **only when N > 0** — without that guard, every standalone card would render shifted; (b) children sit on the **parent's** row, whatever slot the wire gives them.
- **Cross-player attach** (e.g. your aura on opponent's creature): the child still lives in the **original owner's** `TABLE` zone — Servatrice never moves it. Click/drag/arrow wiring must use the child's owner (`BattlefieldCardViewModel.ownerPlayerId`), while the fan renders under the parent's owner.

## Phase model

`PHASE_COUNT = 11`. Desktop parity rules:

- Phase 0 (Untap) double-click → "untap all"; phase 2 (Draw) double-click → "draw a card".
- **`canPassTurn`** (drives `cmdNextTurn` / `cmdReverseTurn`): any non-conceded participant or judge. Does **not** require the active-player flag. Matches `server_player.cpp`.
- **`canAdvancePhase`** (drives `cmdSetActivePhase`): local player must be the active player **or** a judge. Different gate from `canPassTurn` — easy to conflate.
- **Next phase with action** ([phaseActions.ts](../../packages/webatrice/src/features/game/components/PhaseTrack/phaseActions.ts), desktop `actNextPhaseAction`): advance one phase (wrapping past End sends `cmdNextTurn`, not phase 0), then run the new phase's double-click action. The whole action is gated on `canAdvancePhase`, plus `canPassTurn` on the wrap — stricter than desktop, which lets the server reject the phase change while the draw or untap still lands.

## Lifecycle

**`useLeaveGame` optimistic dispatch** ([src/hooks/useLeaveGame.ts](../../packages/webatrice/src/hooks/useLeaveGame.ts)): send `Command_LeaveGame` **and** immediately dispatch `gameLeft` locally. Servatrice strips the leaver from the broadcast list before sending `Event_Leave`, so the leaver never sees the confirmation — without the local dispatch, lifecycle hooks never fire and the tab stays stuck on `/game/:gameId`. The one documented exception to "store mutation flows from server response" (see [webatrice.instructions.md](webatrice.instructions.md)).

## Dialog parity

- **CreateTokenDialog** color dropdown: `White → Blue → Black → Red → Green → Multicolor → Colorless`, default White. Matches desktop `DlgCreateToken`.
- **Reveal recipients**: the seat reveal menus' "All players" entry is `ALL_PLAYERS` (-1, `ui/PlayerBoard/revealRecipient.ts`); `topCards === -1` means "all cards in the zone". Desktop convention for full-hand / full-grave reveals. On the wire, "all players" **omits** `player_id` (`toRecipient` gives `'all'`, which `usePlayerZoneCommands`' `reveal` sends without one): it is proto2 with default -1, protobuf-es serialises an explicit -1, and Servatrice answers a present `player_id` naming no player with `RespNameNotFound`.
- **Move-to-library-at-position prompt is 1-indexed.** Desktop's `DlgMoveCard` collects a 1-indexed position from the user and subtracts 1 before sending `Command_MoveCard.x`. The server speaks 0-indexed; off-by-one regressions silently land cards one slot away.
- **`Command_RevealCards.cardId = [-2]` is the desktop `RANDOM_CARD_FROM_ZONE` sentinel.** Servatrice resolves it server-side to a uniformly-random card in the named zone. Used for "Reveal Random Hand Card" and "Reveal Random Graveyard Card".
- **The card menu's "Move to" submenu is desktop's move menu** (`move_menu.cpp`), built by `buildCardContextMenu` (`cardContextMenu.model.ts`): Top of library in random order, X cards from the top of library..., Bottom of library in random order, Table, Hand, Graveyard, Exile. Every game menu is that item model drawn on the shared `Menu` (`ContextMenuPopup`). `Game.cardMenus.spec.tsx` pins each menu tree (labels, order, shortcuts, disabled rows); the wire payloads are pinned only by command assertions (`Game.cardOps.characterization.spec.tsx` and the seat specs), so a payload change needs one of those. Labels may diverge from desktop ("Table").
- **Card-menu affordance gates mirror `card_menu.cpp`.** Mutators (tap/flip/counters/attrs/P-T/annotation/attach/move) require `ownerPlayerId === localPlayerId`; `actAttach` only on TABLE-zone cards; `actPlay`/`actPlayFaceDown` only on **non-TABLE** owned cards; `actPeek` only on face-down TABLE cards. Read-only actions (Draw arrow) stay available regardless of ownership.

## Servatrice game-event quirks

Affecting Datatrice's [game.listeners.zones.ts](../../packages/datatrice/src/store/games/game.listeners.zones.ts), [cardMove.ts](../../packages/datatrice/src/store/games/cardMove.ts) and [messageLog.ts](../../packages/datatrice/src/store/games/messageLog.ts).

- **`target_zone` omitted on intra-zone moves.** Servatrice strips it when it equals `start_zone` (proto3 default elision). Fall back to `start_zone || target_zone` — without it, intra-zone moves silently bail at the zone lookup.
- **Zone-exit zeroing is client-side.** Servatrice doesn't reliably emit `cardCounterChanged` events when a card leaves the battlefield, so the reducer clears `counterList` on `TABLE → non-TABLE`. Mirrors desktop's `CardItem::resetState()`.
- **`card.annotation` carries owner name on enemy battlefield.** Servatrice populates it server-side; render the owner pill by reading `annotation` directly — do not build a parallel overlay.
- **Attach unset surfaces as `-1` / `""`.** Treat `attachCardId < 0 || !attachZone` as "unattached". Same proto3/proto2 trap as in [webatrice-store.instructions.md](webatrice-store.instructions.md).
- **`-1` is the proto2 "no actor" sentinel** for `GameEvent.player_id`. Webclient speaks proto3 (unset → `0`, a valid player id). Detect absent explicitly before writing `-1`.
- **Hidden zones**: `zone.cardCount` is authoritative; `zone.order.length` only reflects what the local client knows. Render hand/library counts off `cardCount`.
- **Hidden-zone command addressing is positional.** `Command_MoveCard` / `Command_SetTopCard` / `Command_SetBottomCard` use `card_id = 0` for top, `card_id = size - 1` for bottom — Servatrice resolves these against its own zone ordering. The local enriched `deck.order` reflects insertion history, not deck position, and must not be used to compute these indices.
- **Play-from-top deliberately ignores `tablerow`.** Cards played via the deck context-menu route to the stack/table at `x=-1`; desktop reserves tablerow-based row routing for the double-click-from-hand path (where the card name is known to the local player). Don't "fix" this to consult `CardDTO`.
- **Arrow from local-hand → non-hand plays the card AND draws the arrow.** Mirrors desktop `arrow_item.cpp:434-446` (`ArrowDragItem::mouseReleaseEvent` → `playCard(false)`, `player_actions.cpp:72-80`): client sends `moveCard` (via `autoPlayCard`, honouring the `playToStack` preference) then `createArrow` with `startZone` rewritten to the post-play zone (STACK, or TABLE for a land or with `playToStack` off) and the original hand-side `startCardId` — Servatrice resolves it against the freshly-moved card. Planned once in `hooks/arrowResolution.ts` (`planArrow`) for both the right-button drag (`useArrowDrag`) and the menu / shortcut target pick (`usePendingTarget`), and sent through `PlayerTargetCommands.playAndCreateArrow`.
- **Spectators never see the hand zone.** The hand zone is the local-player's hand UI; spectators are always viewing someone else's side, so `showHandZone` is gated on `!isSpectator && slotA === localPlayerId`. Servatrice's `spectators_omniscient` still controls what card data is shipped (`server_game.cpp:298-315`), but the client doesn't render a hand-zone strip for spectators in either case.
- **Ping indicator color is HSV-derived to match desktop.** Hue = `120 × (1 - clamp(ping, 0, 10) / 10)` (green→red); negative ping renders black (disconnected). Mirrors `pixel_map_generator.cpp` `PingPixmapGenerator`. Don't switch to a discrete threshold scheme — desktop and web players see the same gradient mid-call.
- **Per-counter coloring**: each of the 6 counter types (A-F) has a user colour (Appearance › Card counters, desktop's `card_counters.ini`), defaulting to desktop's `QColor::fromHsv(id × 60, 150, 255)` (`#FF6969`, `#FFFF69`, …). `counterColorForId` returns `var(--card-counter-<id>, <default>)`; `useApplyCardPresentation` sets the variables at the app root. Hardcoded count of 6 matches `card_counter_settings.cpp`. Adding a 7th counter type requires updating both desktop and webclient.

## Pointer / click-vs-drag

**Left-click and right-click use independent click-vs-drag thresholds.** They serve different gestures and have different ergonomics:

- **Left-click** (`useGame`'s `GamePointerSensor`, `activationDistance: 0`): any motion at all activates a drag; a pure click (pointerdown → pointerup with no `pointermove`) never starts one, so the click event flows through to the card (and, while a target pick is pending, to `usePendingTarget`'s capture-phase click resolver). No "dead zone" between press and visible drag feedback.
- **Seat cards and piles** (PlayerBoard, through `useSeatDragSource`): the drag data sets `activationDistance: 4`, so the pointer must leave a 4px box around the press point along either axis; a release inside it is a click, delivered to the source's `onRelease` (selection, pending attach). Same sensor, same coordinator (`useGameDnd`).
- **Right-click** (`useArrowDrag`'s `ARROW_DRAG_THRESHOLD_PX = 4`): 4px of motion budget before a right-click promotes from "open context menu" to "drag-to-draw-arrow." More grace because menus need a confirmation gesture.

A regression on either side silently breaks its corresponding click-through path (left: card click for arrow source/target; right: context menu open) because a drag start fires `cancelPendingOnDragStart` before the pending pick's click resolver runs.

Press-and-hold-without-motion as an alternative activation path was attempted via dnd-kit's combined `{ distance, delay, tolerance }` constraint but surfaces a latent double-`handleStart` bug (the delay-timer's `setTimeout` is never cleared when motion activates first). Implementing press-and-hold requires a custom sensor — deferred until requested.

## Message log

Formatters in [messageLog.ts](../../packages/webatrice/src/store/game/messageLog.ts) mirror desktop `message_log_widget.cpp` — each `format*` function corresponds to a `log*` slot. Returning `null` means "desktop doesn't log this case" (e.g. same-zone table reorders). Preserve the null semantics when adding new formatters; callers rely on it to suppress lines.
