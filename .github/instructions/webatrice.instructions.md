---
applyTo: "packages/webatrice/**"
---

# Webatrice instructions

Webatrice is a **browser port of the desktop Cockatrice MTG client**. It connects to the same Servatrice server as desktop over a WebSocket. The websocket layer (transport, command/response correlation, protobuf bindings) lives in the `@cockatrice/sockatrice` workspace package at [packages/sockatrice/](../../packages/sockatrice/), which Webatrice consumes as `@cockatrice/sockatrice`, `@cockatrice/sockatrice/types`, and `@cockatrice/sockatrice/generated`.

`// @critical` source comments guard cross-file invariants — sections in this file are the anchor targets for `See …#anchor` references in code. For stack, scripts, and getting-started, see [README.md](../../README.md). Scoped instruction files load alongside this one when their `applyTo` pattern matches: [webatrice-store.instructions.md](webatrice-store.instructions.md) for `packages/webatrice/src/store/`, [webatrice-game.instructions.md](webatrice-game.instructions.md) for `packages/webatrice/src/features/game/`, [webatrice-testing.instructions.md](webatrice-testing.instructions.md) for spec files and test scaffolding.

## Desktop parity mandate

This is a **hard baseline**, not a tie-breaker. Every behavior difference from desktop is a defect unless explicitly scoped out for the current milestone.

UI ↔ websocket parity is the sharpest edge of the rule. Command shapes, field defaults, response/event handling, and the resulting state transitions must mirror desktop — a desktop player and a webclient player in the same Servatrice room must see consistent game state.

**Desktop is the spec.** Reference implementation at `../cockatrice/src/` (Cockatrice submodule). Read it before proposing any UX or websocket-interaction decision not obvious from the webclient code.

**Divergence protocol:**

1. If desktop behavior is expensive to replicate, propose a scope reduction explicitly and get agreement before coding. Record deferred gaps in the current milestone plan as "parity gap — deferred to <milestone>".
2. Phase-end reviews treat parity findings as blockers by default.
3. Categorically valid reasons to diverge without sign-off: a browser security constraint (no raw TCP), an input-model difference (touch vs. mouse), or an accessibility requirement desktop doesn't meet.

## Cross-browser parity

Default to the universal browser-API subset. Don't branch per-engine, even when one has a nicer API. Concrete: `LocalOracleImportService` deliberately avoids `FileSystemHandle` (Chromium-only) so Firefox and Safari users get the same experience — every import is a fresh user-pick.

## Architecture

### Protocol layer

Types in the app split into three flat buckets, with **no `Data` / `Enriched` / `App` namespace wrappers**:

- **Proto wire types** — `import { ServerInfo_Game, ServerInfo_CardSchema, ... } from '@cockatrice/sockatrice/generated';`. Produced by Sockatrice from the Cockatrice protobuf definitions. Consumers reach them directly — no Webatrice-side re-export layer.
- **Store-domain shapes** — `import { Room, GameEntry, PlayerEntry, ZoneEntry, GameMessage, Message, GametypeMap, ZoneName, Phase, SortDirection, ... } from '@cockatrice/datatrice';`. The normalized shapes the Redux slices maintain. Datatrice owns these because Datatrice owns the slice state.
- **Webatrice-only app types** — `import { RouteEnum, Setting, Host, Card, MagicCard, ArrowColor, ShortcutScope, ... } from '@app/types';`. UI/router/persistence/keybinding concerns that have no place in the portable Redux layer.

Websocket protocol/transport types (`StatusEnum`, `WebSocketConnectReason`, the `*ConnectOptions` family, signal-payload contexts, `GameEventMeta`, `I*Request`/`I*Response` contracts, `WebClientConfig`) live at `@cockatrice/sockatrice/types` as the `WebsocketTypes` namespace. This is the only public surface for those types.

### Layer boundaries

Enforced by [eslint.boundaries.mjs](../../packages/webatrice/eslint.boundaries.mjs); zero violations today, keep it that way.

- `feature-widgets/` — multi-file capabilities composed by ≥2 features (known-hosts, shortcuts, card-import). Pull from root layers; never from features or other widgets.
- `feature-wrappers/` — page-chrome wrappers (currently `layout/`, holding Layout + TopBar). Composes feature-widgets; consumed by features. Module-level feature caches register cleanup with `onSessionEnd` in `services/session`; `AppShell` hosts `SessionScope`, which runs cleanup when the session epoch changes.
- `features/` — vertical slices, one per route. Pull from root layers + `feature-wrappers` + `feature-widgets`. Only `AppShell` pulls from features, and a feature never imports another feature (each `src/features/<name>` folder is its own boundary element); a capability two features need moves to a root owner (e.g. `services/cards`, `services/decks`).
- **Shortcut focus guards** (`feature-widgets/shortcuts/focusGuards.ts`): the provider's window listener ignores Tab / Shift+Tab when focus is inside `[role=dialog]`, `[role=menu]`, `[aria-modal]` or on a form control, button or any other tab stop (`[tabindex]` ≥ 0: spin buttons, the game log, the sidebar resizer), but not on the board (`[data-game-board]`) or a card (`[data-card-id]`), whatever role dnd-kit gives it. It fires only GLOBAL registrations while an `aria-modal="true"` element is mounted (Escape reaches the modal). This is the sanctioned accessibility divergence from desktop's Tab = Next Phase; keep every custom modal marked `aria-modal="true"` and every floating panel `role="dialog"`.
- **The board's Tab rule.** Precedence: inside a dialog, menu or modal, Tab moves focus; then on the board itself or a card (each seat zone's cards are a listbox with one roving tab stop, `useCardFocus`), Tab is Next Phase and Shift+Tab Next Phase Action, as on desktop; on any other tab stop (piles, life, mana, the log, controls) Tab moves focus. On a card the arrow keys move between cards and select (Shift extends the range; Ctrl moves focus alone and Space marks or unmarks the focused card, for a selection with gaps; Ctrl+Space stays Next Phase), and **F6 / Shift+F6 leave the zone** for the next or previous tab stop, which is how a keyboard user gets off the board. Keep both halves: a card that keeps normal Tab loses desktop's binding, and a zone without F6 traps focus.
- **The board's keyboard move.** Every move a drag can make has a keyboard path: **M** on a focused card (a seat zone, a card view, or a lent card, where Enter and Space do it too) opens `MoveCardsDialog` for that card, or the selection it is in. It offers what a drop accepts (`moveDestinations`: every player's battlefield, the owner's hand, stack, library, graveyard and exile; a lent card only the borrower's battlefield, every battlefield for a judge) and a position: a battlefield row (named by what desktop plays there) and column, a hand or stack index, a library position from the top. Columns come from the grid each battlefield publishes (`BattlefieldGeometryContext`), and the hand order from the store, as the strip shows it. `moveTarget` turns the choice into the `SeatDropTarget` the drop zone would resolve, and `useGameDnd.moveSeatCards` sends it through `planSeatMove` and the same commands as the drop, judge and lender rules included; a multi-card hand or library reorder is planned card by card against Servatrice's sequential insert (`planHandReorder`, `planPositionalReorder`). The dialog layers above the card views (`layerClassName`). One rule: a keyboard move sends exactly the commands the equivalent pointer move sends, so keep new drop rules in `planSeatMove` and never add parallel math in the dialog; desktop has no keyboard move, so its drag is the reference.
- Shortcuts persistence lives in the feature layer (not a store listener) because boundaries forbid `store/* → hooks/*`. Anything that needs to bridge persistence into Redux belongs in a feature hook.

### UI → server layering invariant

1. UI layers call `useWebClient()` from `@cockatrice/datatrice/react` to get the Sockatrice `WebClient`, then `client.request.<scope>.<method>(…)`. Type-only `import type { WebClient } from '@cockatrice/sockatrice'` is allowed everywhere; the runtime class is restricted by `@typescript-eslint/no-restricted-imports` in [eslint.config.mjs](../../packages/webatrice/eslint.config.mjs). `new WebClient(...)` is called only inside `WebClientProvider`, never at module load.
2. Sockatrice fires response callbacks into the `IWebClientResponse` instance built by Datatrice's `attachResponseHandlers(store)`. The per-scope `*ResponseImpl` classes (session / room / game / admin / moderator) live inside Datatrice and are the only place that dispatches to the Redux store.

**Documented exception**: `useLeaveGame` optimistically dispatches `gameLeft` on send because Servatrice removes the leaving player from the broadcast list before sending `Event_Leave` — the leaver never sees confirmation. Without the optimistic dispatch, the lifecycle hook never fires and the tab stays on `/game/:gameId`.

### Public API

The response layer (one `*ResponseImpl` per inbound scope — session, room, game, admin, moderator) lives in Datatrice. `attachResponseHandlers(store)` (`@cockatrice/datatrice` main export) builds the `IWebClientResponse` Sockatrice consumes. Webatrice supplies `CLIENT_CONFIG` (clientid, clientver, clientfeatures) and `CLIENT_OPTIONS` (autojoin, keepalive) from [src/clientConfig.ts](../../packages/webatrice/src/clientConfig.ts). **UI code never constructs a `WebClient` directly — use `useWebClient()`.**

### State (`src/store/`)

The three server-data slices (`server`, `rooms`, `games`) live in **Datatrice** and are consumed as namespace re-exports: `import { server, rooms, games } from '@cockatrice/datatrice'` then `server.Selectors.X`, `rooms.Actions.Y`, `games.Types.Z`. Webatrice's local slices (`action`, `shortcuts`) live in `src/store/` and reach consumers through the `@app/store` barrel (typed hooks `useAppSelector`/`useAppDispatch`, the `store` singleton, `RootState`/`AppDispatch` types). Slice shapes and reducer-author hazards live in [webatrice-store.instructions.md](webatrice-store.instructions.md).

### Local persistence

Dexie (IndexedDB) holds cards, sets, tokens, known hosts, settings and the local replay library; separate from Redux (persists across reloads). The library (schema v5, additive) is two tables: `replays` (`++id, parentId` — folder and replay entries, a tree under `REPLAY_LIBRARY_ROOT`) and `replayData` (`id` — the `.cor` bytes, kept apart so folder listings never load them); go through `ReplayFileDTO`. Stubbed globally in [src/setupTests.ts](../../packages/webatrice/src/setupTests.ts) so unit specs never hit a real IndexedDB.

**Schema migrations can't change a primary key in place.** Dexie throws "Not yet support for changing primary key" — drop the affected tables and recreate under the new key, accepting a clean re-import. The v1→v2→v3 migration of `cards`/`sets` to the XSD v4 shape is the worked example. Dexie tables that use `mapToClass(DTO)` (HostDTO, SettingDTO, …) return DTO instances — not plain interface shapes. Widen call-site types to the DTO when callbacks need `.save()` or instance methods.

### Replay playback

A replay is played into a **local game** in the Datatrice games slice, never a server game:

- **Negative game id.** `openReplay` gives each opened replay its own id below `-1000`, so it can never collide with a Servatrice game id. The entry is flagged `replay: true`, is left out of `getActiveGameIds`/`getActiveGames` (no game tab, no leave command) and survives `clearStore`/disconnects.
- **Through the response layer.** The replay game is created, rewound and removed with `WebClient.loadReplayGame` / `unloadReplayGame`, and recorded containers go through `WebClient.replayGameEventContainer`; Datatrice's `GameResponseImpl` dispatches, so replays need no exception to the [layering invariant](#ui--server-layering-invariant).
- **Lifetime.** An opened replay (`services/replay/openedReplays.ts`) owns its `ReplayEngine` and local game until `closeReplay` — the replay tab's close button or "Close replay". Leaving the replay view keeps it playing, like a desktop replay tab; a reload drops it (in memory only).
- **Read-only board.** `GameReplay` renders the regular board inside `GameReadOnlyProvider` ([GameReadOnlyContext.tsx](../../packages/webatrice/src/features/game/components/ui/GameReadOnlyContext.tsx)): the board swallows input, the sidebar and chat drop their live-game controls, and `useGameAffordances` turns every affordance off, so nothing on a replay can send a game command or an optimistic update.

### UI

Route-level UI in `src/features/<slice>/` (one per route — account, decks, game, login, logs, player, rooms, server, settings, shell). Page chrome (Layout, TopBar and its data-driven user menu, `userMenuEntries.ts`) in `src/feature-wrappers/layout/`. Root orchestration at [src/AppShell.tsx](../../packages/webatrice/src/AppShell.tsx) with route registration in [src/AppShellRoutes.tsx](../../packages/webatrice/src/AppShellRoutes.tsx). Load-bearing hooks: **`useWebClient`** (the only way UI reaches the server; see the layering invariant) and **`useAutoLogin`** (owns the once-per-session gate). Datatrice's `WebClientContext` is consumed directly from `@cockatrice/datatrice/react` so integration tests and per-test `renderHook` wrappers can inject a pre-built `WebClient`. **Don't double-portal MUI components.** MUI's Snackbar/Tooltip/Popover already portal themselves; wrapping them in our own `createPortal` leaks DOM nodes under React 18 StrictMode (effects fire twice; the inner portal's mount runs before the outer's cleanup). UI kit: MUI v9 + `@emotion`; i18n via `react-i18next` + ICU (Transifex).

### Virtualized lists

Large live collections (a busy server's thousands of games/users) render through `VirtualList` / `VirtualRows` ([src/components/VirtualList/](../../packages/webatrice/src/components/VirtualList/)), which wrap `react-window`. Rows are built lazily for the visible window only, so each delta frame costs O(viewport) instead of O(collection) — prefer this over prebuilding an `items: ReactNode[]` array (itself O(N)) for large live collections. Two hard rules:

- **Pass a referentially stable `renderRow`** (a module-level function or a `useCallback` whose deps are only what changes a row's drawing) so `react-window`'s row memoization holds across parent re-renders. Handing it a fresh closure each render defeats the memoization.
- **Key rows by stable domain identity, not slot index.** `react-window` recycles row slots by index; keying by index lets an open action menu (e.g. `UserDisplay`) silently rebind to whoever slides into that slot when the roster reshuffles. Keying by e.g. `user.name` remounts the row instead, tearing the menu down cleanly. Variable-height rows (chat) can't use fixed-height virtualization — memoize rows instead and keep every entry reachable in scrollback.

### Forms (react-hook-form + Zod)

All forms use `useForm` + `zodResolver` + `<Controller>`. Patterns enforced across the forms surface:

- **Defaults are explicit per field** (`defaultValues: { foo: '' }`). RHF treats `undefined` as uncontrolled and warns on text inputs.
- **Conditional schemas**: when a field's requirement flips at runtime (e.g. server demanded MFA), rebuild the resolver via `useMemo(() => buildXSchema(t, flag), [t, flag])`. The resolver is reattached when the memo re-runs.
- **Server-driven errors** mirror onto the form via `setError(field, { type: 'server', message })` in a `useEffect` keyed on the `*Error` selector. `Controller`'s `fieldState.error` picks it up like a Zod error.
- **Persisted-vs-form preference writes**: form-state writes (`setValue`) must never leak into Dexie. Persistence happens only on the native `onChange` of a controlled checkbox, never inside a watch effect or a parent `setValue` chain. The exception (LoginForm clearing `autoConnect` when switching to a proven-naked server) requires the `supportsHashedPassword === false` test result; `undefined` means "not yet known" and must leave the persisted preference alone.

## Hooks and effects

- **`useReduxEffect`** synchronously inspects current `state.action` on mount so an action dispatched between render and effect-commit is still observed — this is what lets `<Server />` catch a `JOIN_ROOM` fired during a route transition.
- **`useAutoLogin` session gate**: auto-login runs at most once per JS session; logout does not re-trigger. `autoLoginGate.hasChecked` lives at module scope in [src/features/login/useAutoLogin.ts](../../packages/webatrice/src/features/login/useAutoLogin.ts) and flips after the check completes regardless of outcome (so a "don't auto-connect" check still latches the gate). The gate is exported as a mutable object so integration tests can reset without `vi.resetModules()`. Settings are read via `getSettings()` (one-shot); editing the persisted auto-connect preference is a preference write, not a login signal.

## Build pipeline

`npm start` / `npm run build` chain a `predev`/`prebuild` hook that runs [prebuild.js](../../packages/webatrice/prebuild.js): writes `src/server-props.json` (gitignored — git SHA, build metadata), merges `**/*.i18n.json` → `src/i18n-default.json` (**committed; duplicate keys throw at build time**), and copies country flags from the Cockatrice submodule via `vendor/cockatrice` sparse-checkout. Full file table in [README.md § Generated files](../../README.md#generated-files).

## i18n

`src/i18n-default.json` is generated — **never edit directly**. Translations live in co-located `*.i18n.json` files; `npm run translate` (or the prebuild hook) regenerates the rollup. Namespace your keys to avoid the build-time duplicate-key throw.

## Initialization order

Protobuf-ES maps proto `int64` / `uint64` fields to native `BigInt`. `BigInt.prototype` has no `toJSON`, so `JSON.stringify` throws on any state that contains one — which Redux DevTools, structured logging, and React error-boundary dumps all do. [src/polyfills.ts](../../packages/webatrice/src/polyfills.ts) installs a `BigInt.prototype.toJSON` that returns `this.toString()`, coercing to string on serialize.

Coercion is one-way: `JSON.parse` does not round-trip back to `BigInt`. Acceptable because in-memory state still holds real `BigInt`s; only serialized surfaces see the coerced form.

The polyfill must execute before any module creates the store, or the first devtools dump throws. Enforced by making `./polyfills` the first import in [src/boot.tsx](../../packages/webatrice/src/boot.tsx) and [src/setupTests.ts](../../packages/webatrice/src/setupTests.ts).

Before any of that, [public/preflight.js](../../packages/webatrice/public/preflight.js) runs as a classic script and checks that the browser can run the client (syntax, ES modules, BigInt, WebSocket, …). The module entry [src/index.tsx](../../packages/webatrice/src/index.tsx) only reads its result and dynamic-imports `./boot` when nothing required is missing; otherwise the preflight renders the unsupported screen itself and the app bundle is never fetched. Keep `index.tsx` free of other static imports, and keep `preflight.js` ES5 (lint parses it as ES5).

## Shared store pattern

`createSharedStore` in [src/hooks/useSharedStore.ts](../../packages/webatrice/src/hooks/useSharedStore.ts) exposes two surfaces with different semantics:

- **`subscribe` / `getSnapshot` (via `useSharedStore`)** — reactive. Component re-renders on every store update. Use from inside render.
- **`whenReady()`** — one-shot. Resolves with the first loaded value, then never fires again. Use from code that must read the loaded value exactly once and must NOT re-run on later updates (startup orchestrators reading persisted preferences).

Subscribing in a startup orchestrator turns a later user action (ticking a preference) into a re-evaluation of startup logic, which is almost always wrong.

## Protocol quirks

Servatrice-side behavior the client has to accommodate:

- **System-injected user messages can omit the username** (ban notifications targeting the current user, server announcements). [src/store/common/normalizers.ts](../../packages/webatrice/src/store/common/normalizers.ts) `normalizeUserMessage` handles this at the dispatch layer so the store always holds a clean string.
- **Card images**: prefer Oracle's per-printing `picurl` when present; fall back to a Scryfall by-name lookup. [src/services/scryfall/imageUrls.ts](../../packages/webatrice/src/services/scryfall/imageUrls.ts) `getScryfallUrl` is the dispatcher; tokens.xml entries have their `(Token)` suffix stripped before the by-name request because Scryfall uses the unsuffixed printed name. Scryfall requests and image URLs are built in [src/services/scryfall/](../../packages/webatrice/src/services/scryfall/) (`client.ts` for the API, `imageUrls.ts` for images; the one exception is the deck editor's autocomplete and card search in `features/decks/search.ts`, which move onto the client in PR 31), so two views of one card share a URL and the browser cache; don't build a Scryfall URL inline. The raw client is internal: `@app/services` exports only the image-URL builders and the card-detail fetch, and an eslint `no-restricted-imports` rule lets only the card catalog (`src/services/cards/catalog/`) and the deck pricing and bracket modules import `client.ts`; everything else looks cards up through the catalog, which owns the cache, session memo and retry cap.
