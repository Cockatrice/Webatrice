---
'@cockatrice/webatrice': minor
---

Declare the supported browsers (Chrome/Edge 111, Firefox 114, Safari 16.4 or newer) and check, before the app loads, that the browser can run it. `browserslist` now lists those versions, and it drives autoprefixer, so the CSS carries fewer vendor prefixes. The Vite build target is pinned to the same versions.

A small classic script (`public/preflight.js`) runs before the app bundle. A browser that cannot parse modern JavaScript, has no ES module support, or lacks BigInt, WebSocket, secure random numbers, TextEncoder, structuredClone, fetch, IndexedDB or ResizeObserver gets an "Unsupported Browser" screen naming what is missing. The app bundle is not downloaded, where before the page stayed blank or the client failed later. The screen uses the app's theme colours and the user's language when a translation is available.

When an optional feature is missing (Web Workers, BroadcastChannel, the clipboard, or Web Crypto), the app boots and a warning names what is degraded. Web Crypto is missing when the page is served over plain http:// (e.g. on a LAN). Such deployments keep working, but passwords are then sent to the server unhashed (see the `@cockatrice/sockatrice` changeset), and the warning says so.
