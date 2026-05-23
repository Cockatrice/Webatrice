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

Distributed as a `.tgz` via GitHub Releases (no npm registry):

```sh
npm install https://github.com/Cockatrice/Datatrice/releases/download/v1.0.0/cockatrice-datatrice-1.0.0.tgz
```

You also need to install [Sockatrice](https://github.com/Cockatrice/Sockatrice) (peer dependency) and `@reduxjs/toolkit`.

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
