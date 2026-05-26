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
- `applyInvertY` is the only place y-inversion happens. Rendering already reverses `rowOrder` in `useBattlefield`; inverting again at render double-flips. Invert only when sending a move to a mirrored board (or when `invertVerticalCoordinate` is set and the board isn't mirrored).

## Attachment stack

Port of `table_zone.cpp:153-185`.

- **Parent ends up rightmost (highest z)**; attached cards fan to the left, first-attached child closest to the parent. Matches desktop's "j=1 = closest to parent" ordering.
- `ATTACH_OFFSET_FRACTION = 1/3` (desktop's `STACKED_CARD_OFFSET_X / WIDTH = 24/72`) is the **single source of truth** for both visual layout (`AttachmentStack`) and footprint sizing (`BattlefieldStackColumn`). Changing one without the other desyncs row widths from card positions.
- **Vertical fan offsets** `ATTACH_PARENT_OFFSET_Y_PX = 14` / `ATTACH_CHILD_OFFSET_Y_PX = 6` are ports of `table_zone.cpp:166-185` (`if (numberAttachedCards) actualY += 15` and `childY = y + 5`). Two rules to preserve: (a) parent shifts down **only when N > 0** — without that guard, every standalone card would render shifted; (b) keep the ~3:1 parent:child ratio so children peek above the parent's top edge the way desktop does.
- **Cross-player attach** (e.g. your aura on opponent's creature): the child still lives in the **original owner's** `TABLE` zone — Servatrice never moves it. Click/drag/arrow wiring must use the child's owner (`AttachedChild.ownerPlayerId`), while the fan renders under the parent's owner.

## Phase model

`PHASE_COUNT = 11`. Desktop parity rules:

- Phase 0 (Untap) double-click → "untap all"; phase 2 (Draw) double-click → "draw a card".
- **`canPassTurn`** (drives `cmdNextTurn` / `cmdReverseTurn`): any non-conceded participant or judge. Does **not** require the active-player flag. Matches `server_player.cpp`.
- **`canAdvancePhase`** (drives `cmdSetActivePhase`): local player must be the active player **or** a judge. Different gate from `canPassTurn` — easy to conflate.

## Lifecycle

**`useLeaveGame` optimistic dispatch** ([src/hooks/useLeaveGame.ts](../../packages/webatrice/src/hooks/useLeaveGame.ts)): send `Command_LeaveGame` **and** immediately dispatch `gameLeft` locally. Servatrice strips the leaver from the broadcast list before sending `Event_Leave`, so the leaver never sees the confirmation — without the local dispatch, lifecycle hooks never fire and the tab stays stuck on `/game/:gameId`. The one documented exception to "store mutation flows from server response" (see [webatrice.instructions.md](webatrice.instructions.md)).

## Dialog parity

- **CreateTokenDialog** color dropdown: `White → Blue → Black → Red → Green → Multicolor → Colorless`, default White. Matches desktop `DlgCreateToken`.
- **RevealCardsDialog**: `targetPlayerId === -1` means "all players"; `topCards === -1` means "all cards in the zone". Desktop convention for full-hand / full-grave reveals.
- **SideboardDialog** `applyMoves`: **identify-by-name, one copy per entry** — mirrors desktop `DeckView::applyPlan`. The server protocol speaks names, not ids; don't switch to id-based matching.
- **Move-to-library-at-position prompt is 1-indexed.** Desktop's `DlgMoveCard` collects a 1-indexed position from the user and subtracts 1 before sending `Command_MoveCard.x`. The server speaks 0-indexed; off-by-one regressions silently land cards one slot away.
- **`Command_RevealCards.cardId = [-2]` is the desktop `RANDOM_CARD_FROM_ZONE` sentinel.** Servatrice resolves it server-side to a uniformly-random card in the named zone. Used for "Reveal Random Hand Card" and "Reveal Random Graveyard Card".
- **Card move-to-zone menu is the desktop 7-entry list.** `CARD_MOVE_TARGETS` in `useCardContextMenu` mirrors `move_menu.cpp:32-42`: Hand, Battlefield (`x=0,y=0`), Graveyard, Exile, Library top (`x=0`), Library bottom (`x=-1`), plus the "Move to library at position…" prompt. Wire payloads must stay identical — labels may diverge ("Battlefield" vs desktop's "Table").
- **Card-menu affordance gates mirror `card_menu.cpp`.** Mutators (tap/flip/counters/attrs/P-T/annotation/attach/move) require `ownerPlayerId === localPlayerId`; `actAttach` only on TABLE-zone cards; `actPlay`/`actPlayFaceDown` only on **non-TABLE** owned cards; `actPeek` only on face-down TABLE cards. Read-only actions (Draw arrow) stay available regardless of ownership.

## Board rotation

**90° board rotation is view-only.** `.game__board-inner--rotated` is a pure CSS transform — no server call, no state change. Mirrors desktop `Player::actRotateLocal`.

## Servatrice game-event quirks

Affecting [src/store/game/game.listeners.ts](../../packages/webatrice/src/store/game/game.listeners.ts) and [src/store/game/messageLog.ts](../../packages/webatrice/src/store/game/messageLog.ts).

- **`target_zone` omitted on intra-zone moves.** Servatrice strips it when it equals `start_zone` (proto3 default elision). Fall back to `start_zone || target_zone` — without it, intra-zone moves silently bail at the zone lookup.
- **Zone-exit zeroing is client-side.** Servatrice doesn't reliably emit `cardCounterChanged` events when a card leaves the battlefield, so the reducer clears `counterList` on `TABLE → non-TABLE`. Mirrors desktop's `CardItem::resetState()`.
- **`card.annotation` carries owner name on enemy battlefield.** Servatrice populates it server-side; render the owner pill by reading `annotation` directly — do not build a parallel overlay.
- **Attach unset surfaces as `-1` / `""`.** Treat `attachCardId < 0 || !attachZone` as "unattached". Same proto3/proto2 trap as in [webatrice-store.instructions.md](webatrice-store.instructions.md).
- **`-1` is the proto2 "no actor" sentinel** for `GameEvent.player_id`. Webclient speaks proto3 (unset → `0`, a valid player id). Detect absent explicitly before writing `-1`.
- **Hidden zones**: `zone.cardCount` is authoritative; `zone.order.length` only reflects what the local client knows. Render hand/library counts off `cardCount`.
- **Hidden-zone command addressing is positional.** `Command_MoveCard` / `Command_SetTopCard` / `Command_SetBottomCard` use `card_id = 0` for top, `card_id = size - 1` for bottom — Servatrice resolves these against its own zone ordering. The local enriched `deck.order` reflects insertion history, not deck position, and must not be used to compute these indices.
- **Play-from-top deliberately ignores `tablerow`.** Cards played via the deck context-menu route to the stack/table at `x=-1`; desktop reserves tablerow-based row routing for the double-click-from-hand path (where the card name is known to the local player). Don't "fix" this to consult `CardDTO`.
- **Arrow from local-hand → non-hand auto-plays the card and drops the arrow.** Mirrors desktop `card_item.cpp:243-250`: the move re-keys the card on the server, so a follow-up `createArrow` would target a stale id. This branch lives in both right-click-drag (`useGameArrowInteractions`) and click-target (`handleCardClick`); both must stay in sync.
- **Spectators never see the hand zone.** The hand zone is the local-player's hand UI; spectators are always viewing someone else's side, so `showHandZone` is gated on `!isSpectator && slotA === localPlayerId`. Servatrice's `spectators_omniscient` still controls what card data is shipped (`server_game.cpp:298-315`), but the client doesn't render a hand-zone strip for spectators in either case.
- **Ping indicator color is HSV-derived to match desktop.** Hue = `120 × (1 - clamp(ping, 0, 10) / 10)` (green→red); negative ping renders black (disconnected). Mirrors `pixel_map_generator.cpp` `PingPixmapGenerator`. Don't switch to a discrete threshold scheme — desktop and web players see the same gradient mid-call.
- **Per-counter coloring**: `hue = id × 60°` for IDs 0-5 (A-F). Desktop uses `QColor::fromHsv(hue, 150, 255)`; the CSS equivalent is `hsl(hue, 59%, 70%)`. Hardcoded count of 6 matches `card_counter_settings.cpp`. Adding a 7th counter type requires updating both desktop and webclient.

## Pointer / click-vs-drag

**Left-click and right-click use independent click-vs-drag thresholds.** They serve different gestures and have different ergonomics:

- **Left-click** (`useGame`'s `PointerSensor`): `activationConstraint: { distance: 0 }`. Any motion at all activates a drag; a pure click (pointerdown → pointerup with no `pointermove`) never calls dnd-kit's `handleStart`, so the click event flows through to `arrows.handleCardClick`. No "dead zone" between press and visible drag feedback.
- **Right-click** (`useGameArrowInteractions`'s `ARROW_DRAG_THRESHOLD_PX = 4`): 4px of motion budget before a right-click promotes from "open context menu" to "drag-to-draw-arrow." More grace because menus need a confirmation gesture.

A regression on either side silently breaks its corresponding click-through path (left: card click for arrow source/target; right: context menu open) because `pointerdown` fires `cancelPendingOnDragStart` before `handleCardClick` runs.

Press-and-hold-without-motion as an alternative activation path was attempted via dnd-kit's combined `{ distance, delay, tolerance }` constraint but surfaces a latent double-`handleStart` bug (the delay-timer's `setTimeout` is never cleared when motion activates first). Implementing press-and-hold requires a custom sensor — deferred until requested.

## Message log

Formatters in [messageLog.ts](../../packages/webatrice/src/store/game/messageLog.ts) mirror desktop `message_log_widget.cpp` — each `format*` function corresponds to a `log*` slot. Returning `null` means "desktop doesn't log this case" (e.g. same-zone table reorders). Preserve the null semantics when adding new formatters; callers rely on it to suppress lines.
