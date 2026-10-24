# Webatrice

The Cockatrice web client — a React/TypeScript SPA that connects to a Servatrice server over a WebSocket.

## Application Architecture

![Application Architecture](architecture/simple.png?raw=true "Application Architecture")

For the full set of diagrams (detailed layer map + command/response/event sequence) and the `npm run diagram` scripts that regenerate them, see [architecture/](architecture/). For prose — WebSocket layering, Redux store shape, test conventions — see [.github/instructions/root.instructions.md](.github/instructions/root.instructions.md).

## Stack

React 19 + TypeScript, built with [Vite](https://vite.dev/) 8. State via Redux Toolkit + RxJS, UI via MUI v9, tests via Vitest. Protobuf bindings come pre-built from the [`sockatrice`](https://github.com/seavor/Sockatrice) npm package as `sockatrice/generated`.

## Prerequisites

- Node.js and npm

## Supported browsers

Current Chrome, Edge, Firefox and Safari: Chrome/Edge 111, Firefox 114 and Safari 16.4 (macOS and iOS) or newer. They
are declared in `packages/webatrice/package.json` `browserslist` (which also drives autoprefixer) and pinned as the Vite
build target in `vite.config.ts`. The e2e suite runs on Chromium, Firefox and WebKit.

Before the app loads, a small classic script (`public/preflight.js`) checks that the browser can run it. When something
required is missing (modern JavaScript syntax, ES modules, BigInt, WebSocket, IndexedDB, ResizeObserver, …), it shows an
"Unsupported Browser" screen naming what is missing, and the app bundle is not downloaded.

Serve the page over `https://` (or from `localhost`) where you can. Over plain `http://`, e.g. on a LAN, browsers hide
Web Crypto, so the client cannot hash passwords and sends them to the server unhashed; the app warns about this at
startup. The clipboard copy buttons also need a secure context.

## Getting started

```bash
npm install
npm start
```

`npm install` initializes the `vendor/cockatrice` git submodule (sparse-checked-out to `libcockatrice_protocol/` for Sockatrice's proto generation) via the `prepare` hook. `servatrice.sql` no longer lives in the submodule — the e2e stack extracts it from the pinned `ghcr.io/cockatrice/servatrice` image at compose time. `npm start` runs Turborepo (`turbo run dev`), which builds the `@cockatrice/*` packages in dependency order, then boots the Vite dev server and opens a browser tab at [http://localhost:5173](http://localhost:5173) automatically (configured via `server.open` in `vite.config.ts`). The first start runs `prebuild.js` via webatrice's `predev` hook to merge i18n catalogs, so give it a moment.

## Scripts

### Dev & build

- `npm start` — build packages in dependency order + start the Vite dev server via Turborepo (`turbo run dev`; runs `prebuild.js` first via `predev`)
- `npm run build` — production build into `build/` (also runs the prebuild hooks)
- `npm run preview` — serve the built `build/` output locally to smoke-test a production build

### Tests

- `npm test` — one-shot Vitest run (unit specs)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:integration` — integration specs via `vitest.integration.config.ts`
- `npm run test:coverage` / `npm run test:integration:coverage` — the above with v8 coverage

End-to-end tests live in the [Sockatrice](https://github.com/seavor/Sockatrice) repo, which vendors servatrice and runs the Playwright suite against a Webatrice dev server on `:5173`.

### Quality

- `npm run lint` / `npm run lint:fix` — ESLint over `src/`
- `npm run golden` — `lint` + `test` + `test:integration`; the fast CI-equivalent gate to run before declaring work done

### i18n

- `npm run translate` — re-run the i18n merge only (`prebuild.js -i18nOnly`)

## Generated files

Produced by `prebuild.js` on every `npm start` / `npm run build`. Don't edit them by hand:

| File | Tracked? | Notes |
|---|---|---|
| `src/server-props.json` | Gitignored | Build metadata including the current git SHA. Written by `prebuild.js`; only appears after a first local run. |
| `src/images/countries/*.svg` | Gitignored | Country flag SVGs copied from `vendor/cockatrice/cockatrice/resources/countries/` (sparse-checkout from the Cockatrice submodule). Materialized by `prebuild.js`. |
| `src/i18n-default.json` | **Committed** | Merged i18n catalog. Regenerate with `npm run translate` and commit whenever it changes. |

## Further reading

- [.github/instructions/root.instructions.md](.github/instructions/root.instructions.md) — architecture deep dive, conventions, and domain-knowledge invariants for working in this directory (the canonical AI-tool instruction surface for this package)
- [Vite docs](https://vite.dev/guide/) · [React docs](https://react.dev/) · [Vitest docs](https://vitest.dev/)
