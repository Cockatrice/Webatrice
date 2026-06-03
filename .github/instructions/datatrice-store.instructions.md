---
applyTo: "packages/datatrice/src/store/**"
---

# Store-layer instructions

Slice authoring patterns and reducer-author hazards for the `server`, `rooms`, and `games` slices in `src/store/`.

## Slice authoring

**Reducers extracted as typed `CaseReducer` constants.** Slice reducers are extracted into typed `CaseReducer<State, Action>` constants and spread into `createSlice` rather than inlined. Inlining triggers TS7056 (`The inferred type cannot be named without a reference to ...`) once a slice grows past ~10 reducers — the serializer's length limit is hit by the full inferred Slice type. Explicit `CaseReducer` annotations collapse each reducer into a small named type. Pattern: `inlineReducers` / `primitiveReducers` constants per slice, spread together in `createSlice({ reducers: { ...inlineReducers, ...primitiveReducers } })`.

**Flat type re-exports alongside namespaces.** Slice state shapes (`GamesState`, `RoomsState`, `ServerState`, `GameFilters`, etc.) are re-exported flat at the package root, *in addition to* the namespace re-exports (`server`, `rooms`, `games`). tsup bundles `export * as X` namespaces with type members declared as `typeof X`, which prevents `games.GamesState` from resolving in a type position at the consumer. Consumers do `import type { GamesState } from '@cockatrice/datatrice'`, runtime symbols via the namespace.

## Reducer-author hazards

**Immer can't draft protobuf-es messages — to change a stored message, reassign a fresh clone.** proto2 messages are built with `Object.create(prototype)` (to track field presence), so their non-`Object.prototype` prototype makes Immer's `isDraftable` skip them. A `card.field = X` mutation in a reducer passes straight through untracked: the stored reference never changes, so the memoized selectors in [game.selectors.ts](../../packages/datatrice/src/store/games/game.selectors.ts) (the `zoneCardsCache` WeakMap and the `lruMemoize`d `selectAllAttachments`) keep serving the cached value and the UI doesn't re-render. **Fix:** never mutate a stored message in place. Reassign a fresh copy via `cloneWith(schema, message, patch)` in [src/common/cloneWith.ts](../../packages/datatrice/src/common/cloneWith.ts) (e.g. `zone.byId[cardId] = cloneWith(ServerInfo_CardSchema, card, fields)`); for `mergeSetFields`-style merges, `clone` first then merge then reassign. This applies to **all three slices** (`games`, `rooms`, `server`).

- `clone` is used (not a spread) because spreading a proto2 message **drops unset optional fields** — they live on the prototype, not as own properties. `clone` copies everything, so documented defaults like `attachCardId: -1` survive.
- Stored objects stay **real protobuf-es messages**, so reflection (`isFieldSet`, `toBinary`, `clone`) on values read out of state remains valid.

**proto3 unset surfaces as `0` / `""` — never assume `-1`.** Detect "field actually arrived" via `isFieldSet(message, schema.field.<name>)`, not by checking the value against `0` / `''` / `false`. The `mergeSetFields` helper in [src/common/mergeSetFields.ts](../../packages/datatrice/src/common/mergeSetFields.ts) wraps the same check for full-message merges (merge into a `clone`, then reassign).

**`UPDATE_ROOMS` is a sparse update.** Cockatrice's `server_room.cpp` `addClient`/`removeClient` emits `Event_ListRooms` with only `room_id` / `player_count` / `game_count` populated; a wholesale `info` replacement would blank `name` / `description` / `permissionlevel` until the next full listing. The `roomUpserted` listener uses `mergeSetFields` (`isFieldSet`-driven) so unset fields preserve their existing value. The `gametypeMap` follows the same rule — only replaced when `gametypeList` is non-empty.

## Data structure invariants

`Enriched.Room` and `Enriched.GameEntry` embed the raw protobuf snapshot under `.info` *and* normalize the same data into top-level sibling fields. The two are not interchangeable.

- `info` is the **wire snapshot at the moment the entry was created** (room created, game joined). Repeated collections inside it (`gameList`, `playerList`, `cardList`) go stale the moment a downstream event mutates the corresponding normalized state — they are never updated in place.
- The top-level normalized siblings (`Room.games`, `Room.users`, `GameEntry.players`, `GameEntry.activePhase`, etc.) are the **live values**. Game events (`Event_PlayerJoined`, `Event_GameStateChanged`, `Event_SetActivePhase`, …) update only those.

Selectors and consumers read from the siblings, not from `info`. Use `info` only when you need the original join-time payload (rare; mostly for replay/inspection).
