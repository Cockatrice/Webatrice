# @cockatrice/sockatrice

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
