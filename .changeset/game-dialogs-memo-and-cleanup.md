---
"@cockatrice/webatrice": patch
---

Make the game dialog/menu memoization pay off during play, restore reveal seat order, and clean up
context boilerplate (no behavior change).

- Reveal-target dropdown and board layout now seat from datatrice's `seatedPlayersOf` /
  `getSeatedPlayers`, restoring server seat/join order (it had regressed to numeric-key order).
  `utils/activePlayers.ts` is removed in favor of the shared datatrice helper.
- `useGameDialogs` action handlers no longer close over the whole `game`/`localPlayer`; they read
  the latest values from the store at call time. The hook now returns a stable `actions` object
  merged with the dialog state, so the propless `React.memo`'d dialogs and context menus stop
  re-rendering on every `Game` render (e.g. card moves, arrow-drag ticks) and only update when
  dialog state changes. The `GameDialogs` type is split into `GameDialogsState` &
  `GameDialogsActions` so the shape, the hook return, and the test no-op default stop being
  hand-synced.
- A `createRequiredContext` factory replaces the duplicated throw-if-absent boilerplate in
  `BoardCellContext`, `GameDialogsContext`, `GameDialogActionsContext`, and `GameInteractionContext`.
  A shared `playerName(player)` helper unifies the `userInfo?.name ?? \`p${id}\`` fallback used by
  the reveal list, turn controls, and the game-info dialog. `GameInfoDialog` and `CardContextMenu`
  reuse `useCurrentGame`, and the dead `DeckSelectDialog` close prop is removed.
