# Sockatrice

WebSocket client layer for [Cockatrice](https://github.com/Cockatrice/Cockatrice),
extracted from the webclient and distributed as standalone tarball releases on
GitHub.

## Installation

Sockatrice is published as a tarball asset on each GitHub Release (not to
npmjs.com). Install a specific version directly from its release URL:

```sh
npm install https://github.com/Cockatrice/Sockatrice/releases/download/v1.2.3/cockatrice-sockatrice-1.2.3.tgz
```

The URL is recorded in your `package.json` and `package-lock.json`; upgrade by
replacing it with the next release. No registry account or authentication is
required. The tarball install does **not** run the `prepare` script, so
consumers do not need git submodules or `buf`.

Available releases: <https://github.com/Cockatrice/Sockatrice/releases>

## First-run setup

```sh
git clone <sockatrice-url> Sockatrice
cd Sockatrice
npm install
```

`npm install` triggers the `prepare` script, which:

1. Initializes the `vendor/cockatrice` submodule with sparse-checkout so only
   `libcockatrice_protocol/` is materialized.
2. Runs `buf generate` to populate `src/generated/` from the proto sources.

If you ever need to refresh the submodule or regenerate manually:

```sh
npm run proto:submodule
npm run proto:generate
```

## Scripts

| Script | Purpose |
|---|---|
| `npm test` | Unit tests (vitest, jsdom). |
| `npm run test:integration` | Integration tests against a mocked WebSocket. |
| `npm run lint` | ESLint with module boundaries. |
| `npm run build` | Bundles ESM via `tsup`, then emits `.d.ts` via `tsc --emitDeclarationOnly`. Proto generation runs separately in `npm run prepare` (on install). |
| `npm run proto:generate` | Runs `buf generate`. |

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

Releases are cut by the **Release** GitHub Actions workflow at
[.github/workflows/release.yml](.github/workflows/release.yml). It runs on
manual dispatch from the Actions tab on `master` and accepts a `bump` input
(`patch` / `minor` / `major`).

The workflow:

1. Checks out the repo with submodules.
2. Runs `npm run lint`, `npm run test:coverage`, and
   `npm run test:integration:coverage`. Coverage thresholds in
   [vitest.config.ts](vitest.config.ts) and
   [vitest.integration.config.ts](vitest.integration.config.ts) gate the
   release.
3. Bumps the version with `npm version <bump>`, which creates a commit and an
   annotated tag.
4. Runs `npm pack` (which triggers `prepack` → `npm run build`) to produce
   `cockatrice-sockatrice-<version>.tgz`.
5. Pushes the version commit and tag back to `master`.
6. Creates a GitHub Release with the `.tgz` attached as an asset.

To reproduce a packaging step locally:

```sh
npm run lint
npm run test:coverage
npm run pack    # → cockatrice-sockatrice-<version>.tgz in repo root
```

`npm pack` runs the `prepare` script first (proto submodule + buf generate) and
then `prepack` (the build). Without git available or the submodule initialized,
`src/generated/` will be empty and the build will fail.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

## Module boundaries

- `src/generated/**` — proto-generated code. Imports nothing from the rest of the
  repo (enforced by `eslint-plugin-boundaries`).
- Everything else — may import from `src/generated/**` only via relative paths
  pointing at `src/generated/index.ts`.
