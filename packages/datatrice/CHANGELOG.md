# @cockatrice/datatrice

## 4.0.0

### Major Changes

- **Monorepo unification.** Datatrice is now developed alongside Sockatrice and Webatrice in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) at `packages/datatrice/`. Datatrice and Sockatrice share a major version from this release forward; subsequent releases cascade per [Changesets](../../.changeset/README.md) (`updateInternalDependencies: minor`).
- **Distribution moved to GitHub Packages.** Published under the `@cockatrice` scope at `https://npm.pkg.github.com`. The previous frozen-tarball-on-GitHub-Releases flow is discontinued. Consumers configure their `.npmrc` with `@cockatrice:registry=https://npm.pkg.github.com` and authenticate with a PAT that has `read:packages`.
- **Peer dependency on Sockatrice tightened.** `peerDependencies["@cockatrice/sockatrice"]` is now `^4.0.0` (was `*`). The wildcard accepted any Sockatrice version on the most tightly-coupled boundary in the stack (the `*ResponseImpl` classes bind directly to `IWebClientResponse` and protobuf types); the new range expresses real compatibility and is install-enforced.

### Notes

- The store slices (`server`, `rooms`, `games`), the React glue (`DatatriceProvider`, `WebClientProvider`, `useWebClient`), `attachResponseHandlers`, and the `Enriched.*` / `App.*` / `Data` namespaces are unchanged. The major bump reflects the distribution, peer-range, and monorepo unification.

### Updated dependencies

- Bumped peer `@cockatrice/sockatrice` to `^4.0.0`.
