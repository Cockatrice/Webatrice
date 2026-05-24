# Sockatrice

WebSocket client layer for [Cockatrice](https://github.com/Cockatrice/Cockatrice).
Developed inside the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice) and published independently to GitHub Packages.

## Installation

Sockatrice is published to **GitHub Packages** under the `@cockatrice` scope.
Add this to your project's `.npmrc`:

```
@cockatrice:registry=https://npm.pkg.github.com
```

…and authenticate with a GitHub personal access token that has the
`read:packages` scope (see [GitHub's docs][gh-pkg-auth]). Then:

```sh
npm install @cockatrice/sockatrice
```

[gh-pkg-auth]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages

## Development (inside the Webatrice monorepo)

Sockatrice lives at `packages/sockatrice/` in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice). Clone the monorepo, then:

```sh
npm install                                            # at the monorepo root
npm run -w @cockatrice/sockatrice proto:generate       # populates src/generated/
npm run -w @cockatrice/sockatrice build
```

The root `npm install` runs `assets:submodule`, which initializes the
shared `vendor/cockatrice` submodule with a sparse-checkout that includes
`libcockatrice_protocol/`. `proto:generate` then runs `buf generate`
against those proto sources into `src/generated/`.

## Scripts

| Script | Purpose |
|---|---|
| `npm test` | Unit tests (vitest, jsdom). |
| `npm run test:integration` | Integration tests against a mocked WebSocket. |
| `npm run lint` | ESLint with module boundaries. |
| `npm run build` | Runs `proto:generate` via the `prebuild` hook, bundles ESM with `tsup`, then emits `.d.ts` via `tsc --emitDeclarationOnly`. |
| `npm run proto:generate` | Runs `buf generate` from `../../vendor/cockatrice/libcockatrice_protocol/` into `src/generated/`. |

## Public API

```ts
import {
  WebClient,
  SessionCommands,
  RoomCommands,
  GameCommands,
  AdminCommands,
  ModeratorCommands,
  SessionEvents,
  RoomEvents,
  GameEvents,
  setPendingOptions,
  consumePendingOptions,
  generateSalt,
  passwordSaltSupported,
  hashPassword,
} from '@cockatrice/sockatrice';

import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Command_Login_ext, Command_LoginSchema } from '@cockatrice/sockatrice/generated';
```

## Releasing

Sockatrice and Datatrice both publish via [Changesets](https://github.com/changesets/changesets) from the monorepo's [release.yml](../../.github/workflows/release.yml). The mechanics are documented at [`.changeset/README.md`](../../.changeset/README.md); the short version:

1. After a change, run `npx changeset` at the monorepo root and pick a bump (`patch` / `minor` / `major`) plus a summary.
2. Commit the resulting `.changeset/*.md` file alongside your code change and merge.
3. The release workflow opens a **"Version Packages"** PR that consumes pending changesets, bumps versions, and updates each library's `CHANGELOG.md`.
4. Merging that PR triggers a publish to GitHub Packages.

## Semver policy

A **major** bump is required when any of these change:

- `PROTOCOL_VERSION` — desktop/server compatibility break.
- The `IWebClientResponse` interface (shape, method signatures, removals).
- Any exported type or function signature reachable via the `exports` map (`.`, `./generated`, `./types`, `./testing`, `./testing/setup-hooks`).

**Minor** bumps cover additive exports, additive proto fields, and new optional methods. **Patch** bumps cover bug fixes and internal refactors with no surface change.

A Sockatrice **minor** automatically cascades a Datatrice **minor** (its `Enriched.*` types embed Sockatrice protobuf types — a minor surface change here is a visible surface change there). A Sockatrice **major** does NOT auto-cascade Datatrice major — author a paired Datatrice changeset by hand.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

## Module boundaries

- `src/generated/**` — proto-generated code. Imports nothing from the rest of the
  repo (enforced by `eslint-plugin-boundaries`).
- Everything else — may import from `src/generated/**` only via relative paths
  pointing at `src/generated/index.ts`.
