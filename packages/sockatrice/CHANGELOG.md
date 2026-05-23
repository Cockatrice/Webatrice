# @cockatrice/sockatrice

## 4.0.0

### Major Changes

- **Monorepo unification.** Sockatrice is now developed alongside Datatrice and Webatrice in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) at `packages/sockatrice/`. Sockatrice and Datatrice share a major version from this release forward; subsequent releases cascade per [Changesets](../../.changeset/README.md) (`updateInternalDependencies: minor`).
- **Distribution moved to GitHub Packages.** Published under the `@cockatrice` scope at `https://npm.pkg.github.com`. The previous frozen-tarball-on-GitHub-Releases flow is discontinued. Consumers configure their `.npmrc` with `@cockatrice:registry=https://npm.pkg.github.com` and authenticate with a PAT that has `read:packages`.
- **Proto sourcing is now monorepo-shared.** The Cockatrice submodule is consolidated at the workspace root (`vendor/cockatrice`) with a broadened sparse-checkout that serves both Sockatrice's `libcockatrice_protocol/` and Webatrice's flag SVGs. `buf.gen.yaml` resolves proto sources via `../../vendor/cockatrice/...`. The package's `prepare` + `proto:submodule` scripts are removed; the root `assets:submodule` + the package's `prebuild` together cover what `prepare` used to do.

### Notes

- No functional changes to the WebSocket client, protobuf bindings, command/event surface, or `IWebClientResponse` contract. `PROTOCOL_VERSION` is unchanged at 14.
- The published `.d.ts` bundle is unchanged. Consumers upgrading from 3.x to 4.0 should see no source-level breakage; the major bump reflects the distribution and unification changes described above.
