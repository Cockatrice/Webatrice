---
applyTo: "packages/sockatrice/src/services/**,packages/sockatrice/src/WebClient.ts,packages/sockatrice/src/utils/buildWebSocketUrl.ts"
---

# Transport instructions

WebSocket lifecycle, reconnect policy, keep-alive worker, and URL construction rules. Cross-file invariants live here so refactors of any one piece don't silently break the others.

## WebSocket lifecycle

Reconnect and status-emission rules in `WebSocketService` are interlocked.

1. `retiringForReconnect` suppresses both the `DISCONNECTED` emission and the reconnect schedule when `connect()` is cycling a prior socket out — without it, the orphan socket's `onclose` clobbers the `connectionAttempted()` the caller just dispatched.
2. `hasReportedError` suppresses a duplicate `DISCONNECTED` after `onerror` (browsers fire `onerror` then `onclose` on failed connects).
3. `hasEverOpened` gates reconnect — never retry a connection that never established; that path falls through to `DISCONNECTED`.
4. `closeActiveSocket()` deliberately nulls only `onmessage` before `socket.close()`, leaving `onopen`/`onclose`/`onerror` attached — async close-frame buffering would otherwise re-enter `WebClient` after singleton teardown and surface as `Processing failed: WebClient has not been initialized` in e2e teardown.

## Keep-alive worker

The keepalive ping runs in a dedicated `Worker` because backgrounded tabs clamp main-thread `setInterval` to ~1 minute, which exceeds the Servatrice idle threshold; dedicated worker timers aren't clamped. The worker only runs the interval and posts ticks back — every connection-state decision (`lastPingPending`, `isOpen`, ping send) stays on the main thread in `KeepAliveService`.

The worker URL is resolved relative to whichever chunk `KeepAliveService` ends up bundled into; [tsup.config.ts](../../packages/sockatrice/tsup.config.ts) therefore emits `keepAliveWorker` as a top-level `dist/` entry so the URL resolves regardless of how splitting groups other modules. If you change the entry list, validate the URL still resolves at runtime; if `Worker` is unavailable (jsdom, SSR), `KeepAliveService` falls back to a main-thread `setInterval`.

**`keepAliveWorker.ts` is bootstrap-only by design.** The file contains exactly one top-level statement (`ctx.onmessage = createWorkerHandler(...)`); the handler factory itself lives in [keepAliveWorkerHandler.ts](../../packages/sockatrice/src/services/keepAliveWorkerHandler.ts). Sockatrice's `package.json` declares `"sideEffects": false` and tsup's `splitting: true` factors any exported helper into a shared chunk — if the handler were defined *and* immediately invoked in `keepAliveWorker.ts`, Vite (on the consumer side) would tree-shake the resulting worker chunk down to 0 bytes. The keepalive `Worker` constructs successfully but its script body is empty, so no ticks fire. Keeping the bootstrap as the sole top-level statement makes the side effect part of the worker entry itself, which Vite's worker bundler always preserves.

## WebSocket URL construction

Known hosts come in two shapes: a direct endpoint (`mtg.chickatrice.net` + port `4748` → `ws://mtg.chickatrice.net:4748`) or a reverse-proxied endpoint where the host string already encodes a path (`server.cockatrice.us/servatrice` → `wss://server.cockatrice.us/servatrice`). For the second shape, `port` is dev-convenience only — public TLS reaches the proxy on default `:443` and a naive `${protocol}://${host}:${port}` produces `wss://server.cockatrice.us/servatrice:4748`, which browsers parse as `path=/servatrice:4748`, bypassing the proxy and failing the WS upgrade. `buildWebSocketUrl` switches on whether `host` contains `/`. Anything that constructs a Sockatrice WS URL outside this helper must apply the same rule.

## WebClient lifecycle

`WebClient` is a singleton enforced in the constructor — re-instantiating throws. `WebClient.dispose()` is the only sanctioned reset (test-harness boundaries, SPA hot-reload, explicit logout-and-reset). It closes the open socket and nulls the static instance so the next `new WebClient(...)` succeeds; no-op when no instance exists.

`WebClient.testConnect(target)` is a separate socket from the main connection and supersedes any in-flight prior test — without the eager `testSocket.close()`, a re-clicked test leaks the prior socket until its keepalive timeout. `testConnect` is also where the `Event_ServerIdentification` `serverOptions` bitmask is resolved into a domain-level `supportsHashedPassword` boolean before dispatch — the websocket layer owns protocol details, downstream consumers receive a boolean.

## Send semantics

`WebSocketService.send()` is fire-and-forget: when the socket isn't `OPEN` (closed, closing, still connecting) it logs a warning and drops the frame rather than throwing. This matches desktop's TCP-queued semantics conservatively — upstream code (commands, ping) has always treated send as best-effort.
