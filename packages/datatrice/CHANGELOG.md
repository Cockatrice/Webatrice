# @cockatrice/datatrice

## 4.1.1

### Patch Changes

- 6c8484f: Arrows can now be drawn from a card to a player. The player info panel header acts as the drop/click target during a right-click-drag or pending arrow click; the rendered line anchors to the life counter. Several supporting fixes were needed to make the round-trip work:

  - proto2 field presence: `Command_CreateArrow` now omits `targetZone`/`targetCardId` for player targets so Servatrice routes the command via `has_target_zone()`/`has_target_card_id()` (omitting → player) rather than treating the empty defaults as a card lookup.
  - Live `arrowCreated` reducer assigns the raw `ServerInfo_Arrow` proto into the store instead of `{ ...arrowInfo }`. Spreading a bufbuild proto2 message drops unset optional fields entirely, which caused live player-targeted arrows to land in state without `targetZone`/`targetCardId` and silently fail to render until the next game-state refresh.
  - The cardMoved arrow-cleanup sweep now only runs on actual cross-zone moves, so repositioning a card within the battlefield no longer locally deletes its attached arrows.

## 4.1.0

### Minor Changes

- 73513b3: Removed the `Data` re-export namespace. Import protobuf types directly from `@cockatrice/sockatrice/generated`.

## 4.0.0

### Major Changes

- **Monorepo unification.** Datatrice is now developed alongside Sockatrice and Webatrice in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) at `packages/datatrice/`. Datatrice and Sockatrice share a major version from this release forward; subsequent releases cascade per [Changesets](../../.changeset/README.md) (`updateInternalDependencies: minor`).
- **Distribution moved to GitHub Packages.** Published under the `@cockatrice` scope at `https://npm.pkg.github.com`. The previous frozen-tarball-on-GitHub-Releases flow is discontinued. Consumers configure their `.npmrc` with `@cockatrice:registry=https://npm.pkg.github.com` and authenticate with a PAT that has `read:packages`.
- **Peer dependency on Sockatrice tightened.** `peerDependencies["@cockatrice/sockatrice"]` is now `^4.0.0` (was `*`). The wildcard accepted any Sockatrice version on the most tightly-coupled boundary in the stack (the `*ResponseImpl` classes bind directly to `IWebClientResponse` and protobuf types); the new range expresses real compatibility and is install-enforced.

### Notes

- The store slices (`server`, `rooms`, `games`), the React glue (`DatatriceProvider`, `WebClientProvider`, `useWebClient`), `attachResponseHandlers`, and the `Enriched.*` / `App.*` / `Data` namespaces are unchanged. The major bump reflects the distribution, peer-range, and monorepo unification.

### Updated dependencies

- Bumped peer `@cockatrice/sockatrice` to `^4.0.0`.
