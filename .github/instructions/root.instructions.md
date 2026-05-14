# Webatrice instructions

Webatrice is a **browser port of the desktop Cockatrice MTG client**. It connects to the same Servatrice server as desktop over a WebSocket. The websocket layer (transport, command/response correlation, protobuf bindings) lives in the [`sockatrice`](https://github.com/seavor/Sockatrice) npm package, which Webatrice consumes as `sockatrice`, `sockatrice/types`, and `sockatrice/generated`.

`// @critical` source comments guard cross-file invariants — sections in this file are the anchor targets for `See …#anchor` references in code. For stack, scripts, and getting-started, see [README.md](../../README.md). Scoped instruction files load alongside this one when their `applyTo` pattern matches: [store.instructions.md](store.instructions.md) for `src/store/`, [game.instructions.md](game.instructions.md) for `src/features/game/`, [testing.instructions.md](testing.instructions.md) for spec files and test scaffolding.

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

Enforced by [eslint.boundaries.mjs](../../eslint.boundaries.mjs); zero violations today, keep it that way.

- `feature-widgets/` — multi-file capabilities composed by ≥2 features (known-hosts, shortcuts, card-import). Pull from root layers; never from features or other widgets.
- `feature-core/` — foundational chrome (Layout, LeftNav). Composes feature-widgets; consumed by features.
- `features/` — vertical slices, one per route. Pull from root layers + `feature-core` + `feature-widgets`. Only `AppShell` pulls from features.
- Shortcuts persistence lives in the feature layer (not a store listener) because boundaries forbid `store/* → hooks/*`. Anything that needs to bridge persistence into Redux belongs in a feature hook.

### UI → server layering invariant

1. UI layers call `useWebClient()` ([src/hooks/useWebClient.tsx](../../src/hooks/useWebClient.tsx)) to get the Sockatrice `WebClient`, then `client.request.<scope>.<method>(…)`. The `WebClient` value may only be imported by `useWebClient.tsx` itself; type-only `import type { WebClient } from '@cockatrice/sockatrice'` is allowed everywhere. Enforced by `@typescript-eslint/no-restricted-imports` in [eslint.config.mjs](../../eslint.config.mjs). `new WebClient(...)` is called only inside `WebClientProvider`, never at module load.
2. Sockatrice fires response callbacks into the `IWebClientResponse` instance built by Datatrice's `attachResponseHandlers(store)`. The per-scope `*ResponseImpl` classes (session / room / game / admin / moderator) live inside Datatrice and are the only place that dispatches to the Redux store.

**Documented exception**: `useLeaveGame` optimistically dispatches `gameLeft` on send because Servatrice removes the leaving player from the broadcast list before sending `Event_Leave` — the leaver never sees confirmation. Without the optimistic dispatch, the lifecycle hook never fires and the tab stays on `/game/:gameId`.

### Public API

The response layer (one `*ResponseImpl` per inbound scope — session, room, game, admin, moderator) lives in Datatrice. `attachResponseHandlers(store)` (`@cockatrice/datatrice` main export) builds the `IWebClientResponse` Sockatrice consumes. Webatrice supplies `CLIENT_CONFIG` (clientid, clientver, clientfeatures) and `CLIENT_OPTIONS` (autojoin, keepalive) from [src/clientConfig.ts](../../src/clientConfig.ts). **UI code never constructs a `WebClient` directly — use `useWebClient()`.**

### State (`src/store/`)

The three server-data slices (`server`, `rooms`, `games`) live in **Datatrice** and are consumed as namespace re-exports: `import { server, rooms, games } from '@cockatrice/datatrice'` then `server.Selectors.X`, `rooms.Actions.Y`, `games.Types.Z`. Webatrice's local slices (`action`, `shortcuts`) live in `src/store/` and reach consumers through the `@app/store` barrel (typed hooks `useAppSelector`/`useAppDispatch`, the `store` singleton, `RootState`/`AppDispatch` types). Slice shapes and reducer-author hazards live in [store.instructions.md](store.instructions.md).

### Local persistence

Dexie (IndexedDB) holds cards, sets, tokens, known hosts, and settings; separate from Redux (persists across reloads). Stubbed globally in [src/setupTests.ts](../../src/setupTests.ts) so unit specs never hit a real IndexedDB.

**Schema migrations can't change a primary key in place.** Dexie throws "Not yet support for changing primary key" — drop the affected tables and recreate under the new key, accepting a clean re-import. The v1→v2→v3 migration of `cards`/`sets` to the XSD v4 shape is the worked example. Dexie tables that use `mapToClass(DTO)` (HostDTO, SettingDTO, …) return DTO instances — not plain interface shapes. Widen call-site types to the DTO when callbacks need `.save()` or instance methods.

### UI

Route-level UI in `src/features/<slice>/` (one per route — account, decks, game, login, logs, player, rooms, server, settings, shell). Page chrome (Layout, LeftNav) in `src/feature-core/`. Root orchestration at [src/AppShell.tsx](../../src/AppShell.tsx) with route registration in [src/AppShellRoutes.tsx](../../src/AppShellRoutes.tsx). Load-bearing hooks: **`useWebClient`** (the only way UI reaches the server; see the layering invariant) and **`useAutoLogin`** (owns the once-per-session gate). `WebClientContext` is exported so integration tests can inject a pre-built `WebClient`. UI kit: MUI v9 + `@emotion`; i18n via `react-i18next` + ICU (Transifex).

### Forms (react-hook-form + Zod)

All forms use `useForm` + `zodResolver` + `<Controller>`. Patterns enforced across the forms surface:

- **Defaults are explicit per field** (`defaultValues: { foo: '' }`). RHF treats `undefined` as uncontrolled and warns on text inputs.
- **Conditional schemas**: when a field's requirement flips at runtime (e.g. server demanded MFA), rebuild the resolver via `useMemo(() => buildXSchema(t, flag), [t, flag])`. The resolver is reattached when the memo re-runs.
- **Server-driven errors** mirror onto the form via `setError(field, { type: 'server', message })` in a `useEffect` keyed on the `*Error` selector. `Controller`'s `fieldState.error` picks it up like a Zod error.

## Hooks and effects

- **`useReduxEffect`** synchronously inspects current `state.action` on mount so an action dispatched between render and effect-commit is still observed — this is what lets `<Server />` catch a `JOIN_ROOM` fired during a route transition.
- **`useAutoLogin` session gate**: auto-login runs at most once per JS session; logout does not re-trigger. `autoLoginGate.hasChecked` lives at module scope in [src/features/login/useAutoLogin.ts](../../src/features/login/useAutoLogin.ts) and flips after the check completes regardless of outcome (so a "don't auto-connect" check still latches the gate). The gate is exported as a mutable object so integration tests can reset without `vi.resetModules()`. Settings are read via `getSettings()` (one-shot); editing the persisted auto-connect preference is a preference write, not a login signal.

## Build pipeline

`npm start` / `npm run build` chain a `prestart`/`prebuild` hook that runs [prebuild.js](../../prebuild.js): writes `src/server-props.json` (gitignored — git SHA, build metadata), merges `**/*.i18n.json` → `src/i18n-default.json` (**committed; duplicate keys throw at build time**), and copies country flags from the Cockatrice submodule via `vendor/cockatrice` sparse-checkout. Full file table in [README.md § Generated files](../../README.md#generated-files).

## i18n

`src/i18n-default.json` is generated — **never edit directly**. Translations live in co-located `*.i18n.json` files; `npm run translate` (or the prebuild hook) regenerates the rollup. Namespace your keys to avoid the build-time duplicate-key throw.

## Initialization order

Protobuf-ES maps proto `int64` / `uint64` fields to native `BigInt`. `BigInt.prototype` has no `toJSON`, so `JSON.stringify` throws on any state that contains one — which Redux DevTools, structured logging, and React error-boundary dumps all do. [src/polyfills.ts](../../src/polyfills.ts) installs a `BigInt.prototype.toJSON` that returns `this.toString()`, coercing to string on serialize.

Coercion is one-way: `JSON.parse` does not round-trip back to `BigInt`. Acceptable because in-memory state still holds real `BigInt`s; only serialized surfaces see the coerced form.

The polyfill must execute before any module creates the store, or the first devtools dump throws. Enforced by making `./polyfills` the first import in [src/index.tsx](../../src/index.tsx) and [src/setupTests.ts](../../src/setupTests.ts).

## Shared store pattern

`createSharedStore` in [src/hooks/useSharedStore.ts](../../src/hooks/useSharedStore.ts) exposes two surfaces with different semantics:

- **`subscribe` / `getSnapshot` (via `useSharedStore`)** — reactive. Component re-renders on every store update. Use from inside render.
- **`whenReady()`** — one-shot. Resolves with the first loaded value, then never fires again. Use from code that must read the loaded value exactly once and must NOT re-run on later updates (startup orchestrators reading persisted preferences).

Subscribing in a startup orchestrator turns a later user action (ticking a preference) into a re-evaluation of startup logic, which is almost always wrong.

## Protocol quirks

Servatrice-side behavior the client has to accommodate:

- **System-injected user messages can omit the username** (ban notifications targeting the current user, server announcements). [src/store/common/normalizers.ts](../../src/store/common/normalizers.ts) `normalizeUserMessage` handles this at the dispatch layer so the store always holds a clean string.
- **Card images**: prefer Oracle's per-printing `picurl` when present; fall back to a Scryfall by-name lookup. [src/services/ScryfallService.ts](../../src/services/ScryfallService.ts) `getScryfallUrl` is the dispatcher; tokens.xml entries have their `(Token)` suffix stripped before the by-name request because Scryfall uses the unsuffixed printed name.
