# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets) for the three published packages in this monorepo:

- `@cockatrice/sockatrice` — protobuf + WebClient transport layer
- `@cockatrice/datatrice` — Redux Toolkit server-data layer (peerDeps on Sockatrice)
- `@cockatrice/webatrice` — the React web client app

All three are versioned independently (no `linked` or `fixed` group). Each release cycle bumps only the packages whose changesets touched them — plus any downstream package whose dep ranges break.

## Adding a changeset

When you make a change to any of the three packages, add a changeset describing the change:

```
npx changeset
```

This is interactive: pick which package(s) changed, pick the bump level (patch / minor / major) for each, and write a short summary. A `.md` file lands in this directory; commit it with your code change.

## How releases happen

On every push to `master`, the `release.yml` workflow runs `changesets/action`. If there are pending changesets, it opens (or updates) a **"Version Packages"** PR that:

- bumps the relevant package versions
- updates internal dep ranges (datatrice's peerDep on Sockatrice, webatrice's deps on both) when their targets bump
- writes/updates `CHANGELOG.md` for each package
- consumes (deletes) the changeset files

Merging that PR triggers `changesets/action` again, which publishes the bumped packages to **GitHub Packages** (`https://npm.pkg.github.com`) under the `@cockatrice` scope.

## Cross-package coordination

The cascade Changesets runs is **range-aware**:

- **Sockatrice patch** → no downstream auto-bump (datatrice and webatrice ranges still satisfy; consumers transparently get the new sockatrice via npm).
- **Sockatrice minor or major that breaks downstream ranges** → downstream gets bumped automatically. For datatrice (peerDep), the bump level depends on the `onlyUpdatePeerDependentsWhenOutOfRange` flag (set in `config.json`, see below).
- **Datatrice changes** never cascade upstream to sockatrice.

If a single conceptual change spans multiple packages (e.g. a new proto field that you want surfaced in datatrice's `Enriched.*` types AND consumed by webatrice in the same release), **author one changeset that lists all the affected packages**:

```markdown
---
'@cockatrice/sockatrice': minor
'@cockatrice/datatrice': minor
'@cockatrice/webatrice': minor
---

Added <field> to <message>; surfaces in Enriched.X and used by webatrice's <Y> component.
```

This is the canonical pattern for paired releases.

## Why `linked: []` instead of a linked group

Early versions of this config grouped all three packages with `linked: [["@cockatrice/sockatrice", "@cockatrice/datatrice", "@cockatrice/webatrice"]]`. That combined with datatrice's peerDep on sockatrice produced a cascade bug: any `minor` changeset on any package promoted the whole linked group to **major** (via Changesets' `shouldBumpMajor` rule firing during linked propagation).

`linked: []` avoids that. Each package's version reflects only its own changes plus range-breaking upstream changes.

## Why the `onlyUpdatePeerDependentsWhenOutOfRange` flag

Changesets' default `shouldBumpMajor` rule is range-blind: any non-patch bump of a peerDep target promotes the peer-dependent to **major**, regardless of whether the new version still satisfies the dep range. With datatrice peerDepping sockatrice at `^4.0.0`, that means a sockatrice minor (e.g. 4.1.0) would force datatrice to major (5.0.0) — wrong, since `^4.0.0` still satisfies 4.1.0.

Setting `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange: true` makes the check range-aware: datatrice only escalates to major when sockatrice's new version actually exits the dep range (i.e. on sockatrice major). This matches the semver policy below.

The flag is "experimental" by name but has been stable since `@changesets/cli@2.6.0` (Aug 2020). The Changesets v4 roadmap ([discussion #1473](https://github.com/changesets/changesets/discussions/1473)) plans to make this behavior the default. `@changesets/cli` is tilde-pinned to `~2.31.0` so minor upgrades require a CHANGELOG review.

**On any `@changesets/cli` minor or major upgrade**, re-verify with `npx changeset status --verbose` that bump levels still match this policy. If the flag becomes default or is renamed, update the config accordingly.

## Semver policy

A `major` bump is required when any of these change:

- `PROTOCOL_VERSION` (Sockatrice)
- The `IWebClientResponse` interface shape (Sockatrice)
- Any exported type or function signature in any package's `exports` map

Other changes (additive exports, internal refactors, bug fixes) are `minor` or `patch`.
