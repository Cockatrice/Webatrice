# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets) for the two published libraries in this monorepo: `@cockatrice/sockatrice` and `@cockatrice/datatrice`. The root `@cockatrice/webatrice` package is private and lives outside the `packages/*` workspace set, so Changesets ignores it automatically.

## Adding a changeset

When you make a change to either library, add a changeset describing the change:

```
npx changeset
```

This is interactive: pick which library/libraries changed, pick the bump level (patch / minor / major), and write a short summary. A `.md` file lands in this directory; commit it with your code change.

## How releases happen

On every push to `master`, the `release.yml` workflow runs `changesets/action`. If there are pending changesets, it opens (or updates) a **"Version Packages"** PR that:

- bumps the relevant package versions
- updates Datatrice's peer-dep range on Sockatrice if Sockatrice is in the release
- writes/updates `CHANGELOG.md` for each library
- consumes (deletes) the changeset files

Merging that PR triggers `changesets/action` again, which publishes the bumped libraries to **GitHub Packages** (`https://npm.pkg.github.com`) under the `@cockatrice` scope.

## Cross-package cascade

`updateInternalDependencies: "minor"` means a Sockatrice **minor** release triggers a **minor** bump of Datatrice (because Datatrice's `Enriched.*` types embed Sockatrice protobuf types — a minor surface change in Sockatrice is a visible surface change in Datatrice).

**Major Sockatrice releases do NOT cascade-major Datatrice automatically.** If a Sockatrice `major` change breaks Datatrice's public API, author a paired Datatrice changeset (`major`) by hand alongside the Sockatrice one.

## Semver policy

A `major` bump is required when any of these change:

- `PROTOCOL_VERSION` (Sockatrice)
- The `IWebClientResponse` interface shape (Sockatrice)
- Any exported type or function signature in either library's `exports` map

Other changes (additive exports, internal refactors, bug fixes) are `minor` or `patch`.
