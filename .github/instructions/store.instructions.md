---
applyTo: "src/store/**"
---

# Store-layer instructions

Applies in addition to [root.instructions.md](root.instructions.md) when editing `src/store/`.

Webatrice's `src/store/` holds exactly two host-level extension slices: `action` and `shortcuts`. They mount on Datatrice's root reducer via `<DatatriceProvider extensions={extensions}>` from [src/store/index.ts](../../src/store/index.ts). The `server`, `rooms`, and `games` slices live in **Datatrice** — consume via `import { server, rooms, games } from '@cockatrice/datatrice'`.

## Slices owned by Webatrice

- **`action`** — backs `useReduxEffect` bookkeeping. Holds deep-cloned action snapshots so hooks can observe an action dispatched between render and effect-commit. Without the clone, Immer mutations in downstream slices are detected as mutations of the stale payload still referenced from `action`.
- **`shortcuts`** — keybinding overrides and recording state for the shortcuts feature.

## Slices owned by Datatrice

The `server`, `rooms`, and `games` slices live in the `@cockatrice/datatrice` package — namespace-imported as `server`, `rooms`, `games` (e.g. `server.Selectors.X`, `rooms.Actions.Y`, `games.Types.Z`).

Reducer-author hazards (proto3 unset, Immer doesn't draft protobuf-es messages, sparse-merge `UPDATE_ROOMS`, `mergeSetFields`, etc.) live in the Datatrice repo's `store.instructions.md` and `game.instructions.md`. Do not duplicate the rules here — when working in Webatrice, you're consuming these slices, not authoring them.

## Public store types

`RootState`, `AppDispatch`, and the typed `useAppSelector` / `useAppDispatch` hooks come from the `@app/store` barrel. Don't deep-import from `src/store/<slice>/*` — add the symbol to the barrel's [index.ts](../../src/store/index.ts) instead.
