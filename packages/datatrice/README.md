# Datatrice

Redux Toolkit server-data layer for [Sockatrice](https://github.com/Cockatrice/Sockatrice)-based webclients (Cockatrice ecosystem).

Datatrice owns the **server data** slices of a Cockatrice webclient's Redux store: `server`, `rooms`, and `games`. It also internalizes the Sockatrice-to-store bridge (the `*ResponseImpl` classes), so consumers can wire a `WebClient` to a store in one call:

```ts
import { createStore, attachResponseHandlers, server } from '@cockatrice/datatrice';
import { WebClient } from '@cockatrice/sockatrice';

const store = createStore();
const client = new WebClient(attachResponseHandlers(store), CLIENT_CONFIG, CLIENT_OPTIONS);

const buddies = server.selectors.selectBuddyList(store.getState());
```

## Install

Datatrice is published to **GitHub Packages** under the `@cockatrice` scope. Add this to your project's `.npmrc`:

```
@cockatrice:registry=https://npm.pkg.github.com
```

…and authenticate with a GitHub personal access token that has the `read:packages` scope (see [GitHub's docs][gh-pkg-auth]). Then:

```sh
npm install @cockatrice/datatrice @cockatrice/sockatrice @reduxjs/toolkit
```

`@cockatrice/sockatrice` and `@reduxjs/toolkit` are peer dependencies; `react` + `react-redux` are optional peers (only needed if you use `@cockatrice/datatrice/react`).

[gh-pkg-auth]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages

## Development (inside the Webatrice monorepo)

Datatrice lives at `packages/datatrice/` in the [Webatrice monorepo](https://github.com/Cockatrice/Webatrice). After cloning and `npm install` at the root:

```sh
npm run -w @cockatrice/datatrice test
npm run -w @cockatrice/datatrice build
```

Datatrice's build depends on Sockatrice's `dist/`, so run `npm run -w @cockatrice/sockatrice build` first if you're starting from a clean checkout.

## Semver policy

A **major** bump is required when any of these change:

- The `Enriched.*` shapes consumers depend on (these embed Sockatrice protobuf types, so a Sockatrice **major** typically forces a Datatrice **major** too — author a paired changeset).
- The `App.*` enum surface.
- `attachResponseHandlers` or any exported store/action/selector signature.
- Any export reachable via the `exports` map (`.`, `./react`, `./types`, `./testing`).

**Minor** bumps cover additive exports and new optional fields. **Patch** bumps cover bug fixes and internal refactors with no surface change. A Sockatrice **minor** automatically cascades a Datatrice **minor** via Changesets (`updateInternalDependencies: minor`).

## Public API

- `createStore(options?)` — returns a configured RTK store with listeners pre-registered.
- `rootReducer` — for consumers embedding Datatrice in a larger `combineReducers`.
- `attachResponseHandlers(store)` — returns a `WebsocketTypes.IWebClientResponse` wired to the given store.
- `isSerializable`, `storeMiddlewareOptions` — protobuf-tolerant middleware helpers.
- `server`, `rooms`, `games` — per-slice `{ actions, selectors }` namespaces.

Opt-in React glue via `@cockatrice/datatrice/react`:

- `<StoreProvider store={...}>` — `react-redux` wrapper.
- `useAppSelector`, `useAppDispatch` — typed hooks.

Re-exported Sockatrice types via `@cockatrice/datatrice/types`.

## License

GPL-2.0-or-later. See [LICENSE](./LICENSE).
