---
applyTo: "**/*.spec.ts,**/*.spec.tsx,src/__test-utils__/**,integration/**"
---

# Testing instructions

Applies in addition to [root.instructions.md](root.instructions.md) when writing or editing tests.

Vitest + Testing Library + jsdom. [src/setupTests.ts](../../src/setupTests.ts) registers jest-dom matchers and installs a global Dexie mock.

## Vitest configuration

- Unit specs run under [vite.config.ts](../../vite.config.ts) with `test.isolate: true`: every spec file gets a fresh module graph, but tests **within the same file share it**. `vi.clearAllMocks()` runs in the global `afterEach` and is safe.
- Integration specs run under [vitest.integration.config.ts](../../vitest.integration.config.ts) via `npm run test:integration` — slower; exercise the wired-up `WebClient` against fakes in [src/__test-utils__/](../../src/__test-utils__/).
- `npm run golden` (lint + unit + integration) is the CI gate — run it before declaring work done.

## Mocking footguns

- **Never add `vi.resetAllMocks()` to `setupTests.ts`.** It resets `vi.fn()` instances created inside `vi.mock(...)` factories at file load, breaking any spec that mocks something once (e.g. `store.dispatch`) and expects it to persist across tests in the file.
- **`vi.restoreAllMocks()` only restores `vi.spyOn` targets.** Bare `Object.defineProperty` writes (e.g. on `window.location`) and global reassignments (e.g. `globalThis.WebSocket = ...`) leak between tests in the same file. Use `withMockLocation` from [src/__test-utils__/globalGuards.ts](../../src/__test-utils__/globalGuards.ts) for scoped overrides that clean up after themselves.

## Shared scaffolding

[src/__test-utils__/](../../src/__test-utils__/) provides render helpers, a mock-client builder, and global guards. Prefer these over hand-rolling providers — the integration suite depends on injecting pre-built `WebClient` instances through them.

Store slices have co-located `__mocks__/fixtures.ts` files exposing `make*` factories that build protobuf messages via `create(Schema, overrides)`. Reuse them instead of hand-rolling proto objects.

## Integration suite specifics

[integration/src/helpers/protobuf-builders.ts](../../integration/src/helpers/protobuf-builders.ts) emits real protobuf bytes — no `@bufbuild/protobuf` mocking — so the wire is byte-for-byte identical to what Servatrice would send. The full ProtobufService → event-registry → reducer pipeline runs as shipped code.

- Only `globalThis.WebSocket` is mocked. Everything downstream of it (ProtobufService, event registries, persistence, store, reducers) runs as real code — the whole point of the integration suite.
- `fake-indexeddb` polyfills `globalThis.indexedDB`. It **must** be imported before any module that opens a Dexie database (Dexie opens on first table access). Harmless for the websocket suite, which doesn't touch Dexie.
- Dexie is a real singleton, the database a real (fake-indexeddb) instance. State leaks between tests otherwise — reset via [integration/src/services/dexie/resetDexie.ts](../../integration/src/services/dexie/resetDexie.ts).
- The app integration suite ([integration/src/app/helpers.tsx](../../integration/src/app/helpers.tsx)) provides `WebClientContext` directly rather than wrapping in `<WebClientProvider>` (the shared setup already instantiates the WebClient singleton in `beforeEach`) and passes **`setup.ts`'s store** so assertions hit the same store the WebClient dispatches against.
