---
applyTo: "src/store/**"
---

# Store-layer instructions

Applies in addition to [root.instructions.md](root.instructions.md) when editing `src/store/`.

Slices stay portable: no imports from `hooks/`, `features/`, or `api/`. App-specific coupling belongs in `*.dispatch.ts` or `*ResponseImpl`, never in reducers or selectors. The [eslint.boundaries.mjs](../../eslint.boundaries.mjs) rules enforce this — `store` may only import from `types` and `utils`.

## Slice shapes

Slices: `server/`, `rooms/`, `game/`, `actions/`. Consumers import through the `@app/store` barrel (`GameSelectors`, `GameDispatch`, `GameTypes`, same for `Server`/`Rooms`). **Don't deep-import from `src/store/<slice>/*` — add the symbol to the barrel's `index.ts` instead.**

- `game/` is deeply normalized: `games[gameId].players[playerId].zones[zoneName].cards`. Selectors are plain O(1) getters; `createSelector` is reserved for derived lists (e.g. `getActiveGameIds`).
- `rooms/` is **partially** normalized: keyed by ID, but each room carries denormalized `gameList`/`userList` arrays. Server updates often omit those lists; the reducer merges metadata while preserving the existing arrays. Standing TODO.
- `server/` is mostly flat maps keyed by username plus connection state.
- `actions/` deep-clones every payload before storing. Without the clone, Immer mutations in target slices are detected as mutations of the stale payload still referenced from the action slice.

Selectors return module-scope `EMPTY_ARRAY` / `EMPTY_OBJECT` constants for missing data to preserve referential equality and avoid spurious re-renders.

## Reducer-author hazards

The protobuf/Immer/server-semantics traps below apply to every reducer in this layer.

- **Proto3 unset surfaces as `0` / `""`.** Never assume `-1`. Cockatrice's desktop client speaks proto2 (where `-1` is the wire default for `player_id`); web speaks proto3 (where the same field arrives as `0`). When porting reducer logic from desktop, detect absent via string-field presence or `isFieldSet`, then write the sentinel explicitly.
- **Immer doesn't draft protobuf-es messages.** Don't mutate `card.field = X` in reducers — assign a new object to `zone.byId[cardId]` instead.
- **`mergeSetFields`** ([src/store/common/mergeSetFields.ts](../../src/store/common/mergeSetFields.ts)) for partial proto events. Servatrice often sends only the changed fields; naive `Object.assign` wipes existing state via proto3 defaults.
- **UPDATE_ROOMS merges metadata only.** The repeated `gameList`/`userList`/`gametypeList` on the wire may be absent or stale; [src/store/rooms/rooms.reducer.ts](../../src/store/rooms/rooms.reducer.ts) replaces `info`/`gametypeMap`/`order` while preserving the normalized `games` and `users` maps (those are maintained by `updateGames`/`userJoined`/`userLeft`).

Game-event-specific quirks (zone-exit zeroing, `card.annotation` owner, `target_zone` fallback, `-1` system-actor sentinel) live in [game.instructions.md](game.instructions.md) — the `game.listeners.ts` slice straddles both files.

## Data structure invariants

`Enriched.Room` and `Enriched.GameEntry` compose a raw proto (`info`) with client-side sibling fields. The TypeScript types can't distinguish which fields stay fresh and which go stale, so this is a convention:

- **`info` is a wire snapshot at one point in time.** For `Room` it's the last `UPDATE_ROOMS` / `JOIN_ROOM` payload; for `GameEntry` it's the `Event_GameJoined` payload.
- **Fields on `info` that evolve via later events immediately go stale.** Read the sibling, never `info.*`:

| Type | Stale on `info` | Read instead |
|---|---|---|
| `Room` | `info.gameList` | `room.games` |
| `Room` | `info.userList` | `room.users` |
| `Room` | `info.gametypeList` | `room.gametypeMap` |
| `GameEntry` | `info.started` | `game.started` |
| `GameEntry` | `info.activePlayerId` etc. | top-level twin fields |

Adding a new field that updates via events means adding a top-level twin in [src/types/enriched.ts](../../src/types/enriched.ts) and never reading `info.<same-name>` after the initial snapshot.
