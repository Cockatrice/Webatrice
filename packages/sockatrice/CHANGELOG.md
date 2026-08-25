# @cockatrice/sockatrice

## 4.3.0

### Minor Changes

- f2ac3f1: Keepalive no longer closes the connection — missed pongs report degraded connection health instead, fixing the silent 5-10-minute disconnects.

  **Why connections were dropping.** The old keepalive tolerated exactly one missed pong per 5s tick and tore the socket down itself (`'Connection timeout'`), with the teardown flagged as intentional so the reconnect logic never engaged — one slow pong or main-thread stall became a permanent, unlogged bounce to the login page. Worse, worker ticks that queued up behind a stalled main thread drained back-to-back afterward, so the tick right after a ping was armed would declare it missed 1-2 milliseconds after it was sent (observed repeatedly in field captures).

  **New policy: the keepalive never self-disconnects.** Without credential retention a self-inflicted disconnect is strictly destructive — a lagged server that recovers resumes the session intact, while a forced close guarantees a manual re-login. The client keeps pinging indefinitely (which both feeds the server's inactivity timer and forces TCP to discover a genuinely dead connection); real death arrives via the socket's own `close`/`error` events, where the existing reconnect handling applies. A tick only counts a miss if the pending ping is at least ~one interval old, neutralizing the burst-drain false positives.

  **Connection health signal.** After two consecutive genuine misses (~10s of silence) the transport reports degraded health through a new optional `onConnectionHealth(missedPongs, silentForMs)` config callback, forwarded to the response layer via the new optional `ISessionResponse.updateConnectionHealth` (backward-compatible — existing consumers are unaffected). Any pong reports recovery.

  **Honest reconnect dead-end.** After a transport-level reconnect the server's fresh identification finds no pending connect options (they are single-use and the app retains no credentials), so the session cannot resume; that path now reads "Connection lost — please log in again" instead of the internal 'Missing connection options'.

  **Code-review refinements.** A main-thread stall queues one worker tick per interval; on drain they fired back-to-back and each armed a ping, so a long stall emitted a burst of `Command_Ping` frames that could trip the server's per-interval flood counter. `tick()` now returns early for a burst-drained tick (a pending ping younger than ~one interval), so only the first drained tick sends — genuine silence still pings every interval as the never-self-disconnect policy intends. The derivable `reportedDegraded` flag and its unreachable reset branch are gone (recovery is derived from the pre-reset miss count). `buildWebSocketUrl` no longer lists a bare `::1` as a local host, since only the bracketed `[::1]` form produces a valid `ws://` URL.

### Patch Changes

- f2ac3f1: Signal when a connection attempt never reaches the server, so the UI can tell a
  reachability problem apart from a server refusal. Both connect paths now raise it:

  - **Main game socket** (`WebSocketService`): a new optional `onConnectionUnreachable`
    fires from `onclose` whenever the socket closes without ever having opened
    (`!hasEverOpened`) — covering offline, DNS failure, refused, TLS reset, and the
    slow ≥5s hang uniformly, since `onclose` is the one terminal event
    (`onerror` always precedes it, and the connect-timer's close lands there too).
    It is suppressed for intentional disconnects, retired/superseded sockets,
    in-flight reconnects, and post-open drops.
  - **Test-connection probe** (`WebClient.testConnect`): its transport-failure
    resolutions (`onerror`, `onclose` before identification, keepalive timeout) also
    raise it via `session.connectionUnreachable()`; a protocol-version mismatch or
    decode failure does not (the server was reached, just incompatible).

  Adds `connectionUnreachable()` to the session response interface
  (`ISessionResponse`).

- f2ac3f1: Never abort a still-`CONNECTING` WebSocket. Calling `close()` on a connecting
  socket _fails_ the connection — the peer sees an abnormal 1006 with no clean close
  frame / FIN — and a reverse proxy that byte-tunnels or terminates the upgraded
  connection then holds the half-dead upstream open until its idle read timeout
  (~60s). That stranded upstream counts against Servatrice's per-IP connection cap
  (`security/max_users_per_address`), so a handful of aborted connects (rapid
  connection tests, superseded probes, retried logins) gets the client refused with
  `TOO_MANY_CONNECTIONS` until the sockets age out.

  Introduces `terminateSocket(socket)` — the mandatory safe close: it defers a clean
  `close()` to `onopen` when the socket is `CONNECTING`, closes immediately when
  `OPEN`, and no-ops when already closing/closed. Routed through every close site
  (the main connection's `closeActiveSocket`, and `WebClient.testConnect`'s
  supersede and resolve paths), with the retired CONNECTING orphan's lifecycle
  handlers detached so its deferred open→close can't emit stray status/reconnect
  events. The connect-timeout keeps its raw abort on purpose (it fires only for a
  socket that never opened, and its `onclose` drives reconnect).

  Note: this stops the client from _leaking_ half-open sockets, but a proxy that
  does not propagate even a clean close (holding every connection until a timeout)
  is a server-side concern — set `server/web_socket_ip_header = X-Real-IP` so the
  cap is per-real-client, and tune the proxy's read timeout.

## 4.2.0

### Minor Changes

- 4396583: Protocol-layer additions for the UI revamp: a heterogeneous bulk counter command, per-command options plumbing, undo-draw detection, reversed zone-view support, and a sanitizer robustness fix.

  - **New `request.game.bulkSetCardCounterEntries`** (+ exported `CardCounterEntry` type): batches per-card `Command_SetCardCounter` entries with heterogeneous `(cardId, counterId, counterValue)` values into a single `CommandContainer`, judge-wrapped per card owner — unlike `bulkSetCardCounter`, which applies one value to every target. Backs the "increment all card counters" context-menu action (Cockatrice `actIncrementAllCardCounters` parity).
  - **Command options plumbing.** `moveCard`, `setCardAttr`, `incCardCounter`, `setCardCounter`, `incCounter`, `setCounter`, `setActivePhase`, and `createArrow` gain a trailing optional `options` parameter (spread into `sendGameCommand`), so callers can attach command options — e.g. grouping actions into one undo step — that previously had no way through. Backward-compatible.
  - **Undo-draw detection.** The `moveCard` event handler inspects the event context for `Context_UndoDraw_ext` and passes a new optional `isUndoDraw` flag to `IGameResponse.cardMoved`, letting consumers log "undoes their last draw" instead of a generic move.
  - **Reversed zone views.** `dumpZone` now forwards the request's `isReversed` flag into the `zoneViewRevealed` response callback (new required parameter on `IGameResponse.zoneViewRevealed`), so bottom-N library views preserve their ordering direction.
  - **Fix: `sanitizeHtml` no longer breaks when imported before a `window` exists** (worker / test import order). DOMPurify is now created lazily and memoized on first use, the link hook (`target="_blank"` + `rel="noopener noreferrer"`) registers defensively, and if no real instance is available the input is returned unmodified rather than throwing.

## 4.1.2

### Patch Changes

- 1aa18d0: Extend the bulk card-action surface to drag-moves, P/T, annotation, and counters.

  `request.game.*` gains four more multi-card commands (one file each, in
  `commands/game/bulk/`): `bulkSetPT`, `bulkSetAnnotation`, `bulkIncCardCounter`, and
  `bulkSetCardCounter`. Each batches one per-card command into a single
  `CommandContainer` and judge-wraps per owner, matching the existing bulk commands.

  webatrice now routes these through the selection instead of acting on one card:

  - **Drag-and-drop** — every drop kind (battlefield reposition, hand/stack/popup
    reorder, and cross-zone) moves the whole selection via `bulkMove`. The dragged
    card alone is the unchanged single-card case.
  - **Set P/T** and **Set annotation** (card menu) apply the entered value to every
    selected card.
  - **Counters** — the inline +/- delta and the "Set counter" prompt apply across the
    selection.

  A multi-selection only takes effect when the acted-on card is part of it; otherwise
  each action behaves exactly as before on the single card.

- 1aa18d0: Own the bulk card-command surface and the canonical zone-name wire constants.

  `ZoneName` (and `ZoneNameValue`) — the server-defined zone wire strings
  (`table`/`grave`/`rfg`/`hand`/`deck`/`sb`/`stack`) — now live here and are exported
  from the package entry, since they are a protocol concern rather than a store one.

  A new `commands/game/bulk/` module exposes the multi-card commands on
  `request.game.*` — `bulkTap`, `bulkDoesntUntap`, `bulkFlip`, `bulkPeek`, `bulkMove`
  (one file per command). Each applies Cockatrice's collective rule (e.g. any untapped
  => tap all), skips no-op cards, and batches every per-card command into a single
  `CommandContainer` (one `cmd_id`, one atomic server response), grouping foreign-owner
  commands under one `Command_Judge` per target. Also adds `moveTargetPlayerId` (the
  Servatrice non-table move-routing rule) and the `CardLocation` / `BulkMoveDestination`
  / `JudgeTarget` types. These previously lived in webatrice; relocating them keeps the
  Cockatrice command surface defined once in the protocol layer.

## 4.1.1

### Patch Changes

- db03477: Let judges act on any player's cards, routing every action through Command_Judge.

  A judge can already join/create a game as judge, and drag opponents' cards, but
  the card context menu was hard-gated to owned cards. The writeable menu (play,
  move, tap, flip, face-down, doesn't-untap, P/T, annotation, counters, peek,
  attach) now opens on any card for a judge — parity with Cockatrice's
  `writeableCard = getLocalOrJudge()`.

  Because the per-card commands (`setCardAttr`, `flipCard`, `incCardCounter`,
  `setCardCounter`, `attachCard`, `revealCards`) carry no player id, a judge acting
  on a card they don't own now wraps the command in `Command_Judge(target_id=owner)`
  so the server executes it as the owner — exactly as Cockatrice's centralized
  `PlayerActions::sendGameCommand` does. `moveCard` is wrapped too (for correct
  forced-by-judge attribution and owner-context permission checks). Play is wrapped
  as well: a judge plays a foreign card onto its owner's table (the play path now
  targets the owner tree rather than the local player), matching Cockatrice — where
  play is gated only by `getLocalOrJudge()` with no extra restriction.

  The owner-routing and judge-wrap rules are applied uniformly across _every_
  interaction path, not just the card menu: drag-and-drop, multi-select bulk tap/move,
  double-click tap, double-click play, and the "Move to library at position…" dialog
  all resolve the move target via the owner tree and wrap foreign-card commands the
  same way. Own-card actions are unchanged and still sent bare.

## 4.1.0

### Minor Changes

- 63e77cb: Fix the View Library flow so the deck's cards are actually revealed.

  Opening "View library…" now sends `Command_DumpZone` and consumes the
  `Response_DumpZone` card list the server returns to the requester, routing it
  into the store (new `ZoneEntry.revealedCards` with `zoneViewRevealed` /
  `zoneViewCleared` reducers and a `getRevealedCards` selector). The popup reads
  the revealed cards from the store and renders them face-up, and a Cockatrice-
  parity "Shuffle on close" checkbox (deck only, default on) sends
  `Command_Shuffle` when the view is closed.

  Also stops pre-bundling the `@cockatrice/*` workspace packages in webatrice's
  vite `optimizeDeps` so `npm run start` reliably reflects dependency rebuilds
  instead of serving a stale pre-bundle.

## 4.0.1

### Patch Changes

- 2d235dc: Consolidated E2E docker infrastructure across the monorepo:

  - **Shared compose stack.** E2E docker stacks merged into a single `docker/servatrice/` directory at the monorepo root. Each package keeps only a tiny per-package env file (compose project name + host port) and invokes the shared compose via `docker compose --env-file <pkg>/.env.e2e -f ../../docker/servatrice/docker-compose.e2e.yml ...`. One servatrice image tag, one schema, one ini.
  - **`servatrice.sql` from the image.** The init SQL now comes from the pinned `ghcr.io/cockatrice/servatrice` image (extracted by a `servatrice-sql` sidecar into a shared volume mounted at `/docker-entrypoint-initdb.d/`) instead of the Cockatrice submodule. Image tag is the single source of truth — schema and binary can't drift. The submodule still materializes `libcockatrice_protocol/` for proto generation.
  - **Image tag in env.** The servatrice image tag moved out of `docker-compose.e2e.yml` into the root `.env.e2e` (substituted via `${SERVATRICE_IMAGE}`). Bumping the Servatrice release is now a one-line edit at the monorepo root.
  - **Env files at package root.** Per-package env files moved from `packages/<pkg>/e2e/docker/.env` to `packages/<pkg>/.env.e2e`. The `.env.e2e` suffix (not plain `.env`) prevents Vite/vitest from auto-loading the compose vars during dev/test/build.

  After pulling, run `docker volume prune` once to clean up the old project-prefixed volumes (`webatrice-e2e_webatrice_e2e_mysql`, `sockatrice-e2e_cockatrice_e2e_mysql`); the new stacks use `*_mysql_data`. The shared ini sets `maxnamelength=16` (was 12 for Sockatrice) — Sockatrice's 10-char generated usernames still fit, no behavioral change.

## 4.0.0

### Major Changes

- **Monorepo unification.** Sockatrice is now developed alongside Datatrice and Webatrice in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) at `packages/sockatrice/`. Sockatrice and Datatrice share a major version from this release forward; subsequent releases cascade per [Changesets](../../.changeset/README.md) (`updateInternalDependencies: minor`).
- **Distribution moved to GitHub Packages.** Published under the `@cockatrice` scope at `https://npm.pkg.github.com`. The previous frozen-tarball-on-GitHub-Releases flow is discontinued. Consumers configure their `.npmrc` with `@cockatrice:registry=https://npm.pkg.github.com` and authenticate with a PAT that has `read:packages`.
- **Proto sourcing is now monorepo-shared.** The Cockatrice submodule is consolidated at the workspace root (`vendor/cockatrice`) with a broadened sparse-checkout that serves both Sockatrice's `libcockatrice_protocol/` and Webatrice's flag SVGs. `buf.gen.yaml` resolves proto sources via `../../vendor/cockatrice/...`. The package's `prepare` + `proto:submodule` scripts are removed; the root `assets:submodule` + the package's `prebuild` together cover what `prepare` used to do.

### Notes

- No functional changes to the WebSocket client, protobuf bindings, command/event surface, or `IWebClientResponse` contract. `PROTOCOL_VERSION` is unchanged at 14.
- The published `.d.ts` bundle is unchanged. Consumers upgrading from 3.x to 4.0 should see no source-level breakage; the major bump reflects the distribution and unification changes described above.
