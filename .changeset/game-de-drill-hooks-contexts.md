---
"@cockatrice/webatrice": patch
---

Refactor the game feature out of deep prop-drilling and into hook/context layers (no behavior change).

`Game` previously threaded `gameId`, the hovered-card preview, local identity, and the entire
dialog/menu state slice (~80 props across ~10 dialogs/menus) down through the tree. These are now
sourced from focused contexts and hooks:

- `GameIdContext` (`useGameId` / `useGameIdRequired`) provides the active game id once; ~18
  board/sidebar components and the dialogs read it from context instead of a prop.
- `useLocalIdentity` consolidates `localPlayerId`/`isHost`/`isJudge`/`isSpectator`.
- `CardPreviewContext` lifts the hovered-card preview so `RightPanel` no longer forwards it.
- `GameDialogsContext` carries the dialog/menu state machine; the context menus and dialogs
  (roll-die, create-token, sideboard, reveal, game-info, deck-select, player menu) self-source and
  self-gate, rendering propless. Each dialog folds its own derived data (e.g. the sideboard's
  deck/sideboard cards, the reveal target list) in its own hook/selector.
- `BoardCellContext` provides per-seat `{ playerId, mirrored, isLocal }` so `PlayerBoard`,
  `Battlefield`, `StackColumn`, `PlayerInfoPanel`, and `ZoneStack` stop forwarding seat identity.

Re-render hygiene: the `useGameDialogs` return is memoized and the propless dialog/menu consumers
are wrapped in `React.memo`, so they no longer re-render on every `Game` render (e.g. arrow-drag
ticks). Shared helpers were extracted to remove duplication (`activePlayersOf`), and the
context-menu hooks now treat an absent `gameId` as `undefined` rather than a `0` sentinel.

Positional props (`playerId`, `zoneName`, a menu's target card/anchor, a popup's initial position)
and the generic `@app/dialogs` (`PromptDialog`, concede `ConfirmDialog`s) are intentionally left as
props.
