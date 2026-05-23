# Sockatrice instructions

Sockatrice is the **WebSocket transport layer** for [Cockatrice](https://github.com/Cockatrice/Cockatrice) — protobuf-over-WebSocket against a Servatrice host, command/response correlation, keep-alive, and reconnect policy. Extracted from the webclient; shipped as a standalone tarball release.

Sibling to [Webatrice](https://github.com/seavor/Webatrice) (the React webclient, consumes the singleton via `useWebClient()`) and [Datatrice](https://github.com/seavor/Datatrice) (the Redux store, consumes response callbacks via `attachResponseHandlers(store)`). Sockatrice owns no UI and no Redux.

## Position in the Cockatrice ecosystem

Cockatrice protocol is vendored, not re-implemented. `vendor/cockatrice` is a sparse-checkout submodule pinned to a Cockatrice release; `src/generated/**` is produced by `buf generate` from `libcockatrice_protocol/`. Never hand-edit generated output; never re-derive proto types from documentation. When desktop behavior overlaps with Sockatrice, read the desktop source as ground truth.

## Public API surface

| Subpath | Contents |
|---|---|
| `@cockatrice/sockatrice` | `WebClient`, `*Commands` namespaces, `*Events` namespaces, `PROTOCOL_VERSION`, `SOCKATRICE_FEATURES`, `setPendingOptions` / `consumePendingOptions`, password-hash utilities |
| `@cockatrice/sockatrice/generated` | Raw proto types/schemas |
| `@cockatrice/sockatrice/types` | `WebsocketTypes` (status enum, connect-options families, signal-payload contexts, request/response contracts) |
| `@cockatrice/sockatrice/testing` | Proto builders + mock-WebSocket helpers (side-effect-free) |
| `@cockatrice/sockatrice/testing/setup-hooks` | vitest `setupFiles` entry — installs global mock WebSocket, registers `beforeEach`/`afterEach` |

## Protocol version and feature flags

`PROTOCOL_VERSION` (currently `14`) is the protocol Sockatrice speaks; the `serverIdentification` event mismatches it and disconnects. `SOCKATRICE_FEATURES` declares the features Sockatrice's command/event handlers actually implement — consumers spread it into their `ClientConfig.clientfeatures` and append identity/policy declarations on top (Webatrice adds e.g. `2.7.0_min_version`).

Servatrice's `Event_ServerIdentification.serverOptions` is a bitmask, not a struct: `passwordSaltSupported(serverOptions)` reads `SupportsPasswordHash` and is the only sanctioned way to check it. An empty `passwordSalt` string in the response means the server advertised support but couldn't actually produce one — fall through to plain-password rather than failing (see `serverIdentification.ts`).

## Server message sanitization

Server-injected HTML (MOTD, server messages) flows through `sanitizeHtml` before display. Desktop renders raw via Qt `QTextBrowser`; the web client hardens via a DOMPurify allowlist restricted to `https?:` URIs (ftp is dead and would only widen attack surface from a hostile server). `ADD_URI_SAFE_ATTR: ['color']` is load-bearing — DOMPurify applies `ALLOWED_URI_REGEXP` to every attribute it isn't told is URI-safe, so `color="red"` would be stripped without it. Removing the entry breaks the `<font color="red">` sanitizer test.

## Public testing surface

Sockatrice exposes its test scaffolding as two distinct subpaths. `@cockatrice/sockatrice/testing` is the side-effect-free barrel — proto message builders, mock-WebSocket helpers, command-capture decoders, web-client stubs. `@cockatrice/sockatrice/testing/setup-hooks` is the vitest `setupFiles` entry: importing it installs a global mock `WebSocket`, registers `beforeEach` (fake timers + fresh `WebClient` singleton) and `afterEach` (`_resetAll()` + `vi.clearAllMocks()` + real timers). Only `globalThis.WebSocket` is mocked; everything downstream (`ProtobufService`, event registries, status transitions) runs as real code.

`clearAllMocks` is the only sanctioned per-test reset; `resetAllMocks` resets `vi.fn()` instances created inside `vi.mock(...)` factories at file load and breaks every spec.

## Module boundaries

- `src/generated/**` imports from nothing (leaf).
- Everything else may import generated code, but only via the relative path to `src/generated/index.ts`.
- Spec files are exempt.

## Build, test, release

| Command | Purpose |
|---|---|
| `npm install` | Triggers `prepare`: submodule sparse-checkout + `buf generate`. Required before anything else works. |
| `npm run lint` | ESLint with module boundaries. |
| `npm test` | Vitest unit tests (jsdom). |
| `npm run test:integration` | Integration suites against mocked WebSocket. |
| `npm run test:e2e` | Spins up Servatrice via `e2e/docker/docker-compose.e2e.yml`, runs e2e, tears down. |
| `npm run golden` | `lint` + `test` + `test:integration` — pre-commit/PR gate. |
| `npm run build` | `tsup` ESM bundle + `tsc --emitDeclarationOnly` for `.d.ts`. |
| `npm run proto:generate` | Re-run `buf generate` after a vendor bump. |

Releases are cut by `.github/workflows/release.yml` (manual dispatch). Tarball is `cockatrice-sockatrice-<version>.tgz`; consumers install directly from the GitHub Release URL, not npmjs.

## Conventions

- TypeScript, ESM only (`"type": "module"`, `sideEffects: false`).
- ESLint enforces 2-space indent, single quotes, semicolons, max line 140.
- proto3 unset fields surface as `0` / `""` — never assume `-1`. Detect absence via `isFieldSet` or string check before writing a sentinel.
