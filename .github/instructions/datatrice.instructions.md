---
applyTo: "packages/datatrice/**"
---

# Datatrice instructions

Datatrice is the **Redux state package** for the Cockatrice ecosystem — slice definitions (`server`, `rooms`, `games`), the listener middleware, and the protobuf-message-to-action translation layer. Extracted from Webatrice and shipped as the `@cockatrice/datatrice` npm package.

Sibling to [Webatrice](https://github.com/seavor/Webatrice) (the React webclient, consumes the public store API) and [Sockatrice](https://github.com/seavor/Sockatrice) (the WebSocket transport, fires response callbacks into `attachResponseHandlers(store)`). Datatrice owns no UI and no socket — UI lives in Webatrice, transport lives in Sockatrice.

## Position in the Cockatrice ecosystem

Desktop Cockatrice is the reference implementation. When porting reducer behavior, read the desktop source as ground truth; do not re-derive the rule from documentation. The Webatrice parity mandate extends through this package — slice transitions must mirror desktop so a desktop player and a webclient player in the same Servatrice room see consistent game state.

## Public API surface

Four entry points (see [package.json](../../packages/datatrice/package.json) `exports`):

| Subpath | Contents |
|---|---|
| `@cockatrice/datatrice` | `createStore`, slice namespaces (`server`, `rooms`, `games`), `App`/`Data`/`Enriched` types, `common` utilities, `attachResponseHandlers` |
| `@cockatrice/datatrice/react` | `DatatriceProvider`, `WebClientProvider`, `WebClientContext`, typed `useAppSelector`/`useAppDispatch` |
| `@cockatrice/datatrice/types` | Type-only entry |
| `@cockatrice/datatrice/testing` | Redux state-shape fixture builders |

**Internal-only:** the per-scope `*ResponseImpl` classes (session / room / game / admin / moderator) in [src/api/](../../packages/datatrice/src/api/). Sockatrice fires response callbacks into the `IWebClientResponse` instance built by `attachResponseHandlers(store)`; consumers use `attachResponseHandlers` and never import the impl classes directly.

## Initialization order

**Listener-middleware singleton.** The `listenerMiddleware` exported from [src/store/listenerMiddleware.ts](../../packages/datatrice/src/store/listenerMiddleware.ts) is a module-scoped singleton, not a per-store instance. `createStore()` registers slice listeners against it via a `listenersRegistered` latch — without that guard, calling `createStore()` twice in the same process (test harnesses, hot reload) attaches every listener again and every matching action fires twice.

**Protobuf-aware serializable check.** Protobuf-es v2 messages are plain JS objects decorated with `$typeName` / `$unknown` siblings; their `bytes` fields surface as `Uint8Array` and `int64`/`uint64` as `BigInt`. The RTK `serializableCheck` rejects all four by default. [src/store/isSerializable.ts](../../packages/datatrice/src/store/isSerializable.ts) widens the predicate to accept proto messages, `Uint8Array`, and `BigInt` so wire payloads can travel through actions and live in state without warnings. Used by `createStore()` and re-exported for test harnesses that build their own store.

## Layer boundaries

Enforced by [eslint.boundaries.mjs](../../packages/datatrice/eslint.boundaries.mjs):

- `slice → {common, types, slice}` — reducers and selectors are leaf layers
- `api → {common, types, slice, api, root}` — response impls dispatch into slices
- `react → {common, types, slice, api, root}` — providers wire the store
- `common → {common, types}` — shared utilities (normalizers, sort, `mergeSetFields`)
- `types → {types}` — leaf
- Spec files are exempt.

Other invariants:
- No React in slice files.
- No `getState()` outside the listener middleware.
- Listener middleware is a singleton; `createStore` wires it once per store instance.

## Protocol quirks

Servatrice protocol behaviors the data layer accommodates:

- **System-injected user messages can omit the username** (ban notifications targeting the current user, server announcements). [src/common/normalizers.ts](../../packages/datatrice/src/common/normalizers.ts) `normalizeUserMessage` preserves the omission as a no-op so the store always holds a clean string regardless of whether the server attributes the message to a user.

## Build, test, release

| Command | Purpose |
|---|---|
| `npm install` | Install deps. |
| `npm run lint` | ESLint with module boundaries. |
| `npm test` | Vitest unit tests. |
| `npm run test:integration` | Integration suites in `integration/`. |
| `npm run build` | `tsup` ESM bundle + `tsc --emitDeclarationOnly` for `.d.ts`. |

ESM-only (`"type": "module"`, `sideEffects: false`), Node ≥20, GPL-2.0-or-later.
