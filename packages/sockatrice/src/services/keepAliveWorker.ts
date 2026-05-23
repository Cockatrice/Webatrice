/*
 * Keep-alive worker entrypoint — bootstrap only.
 *
 * The worker only runs a setInterval (in `createWorkerHandler`, separate
 * file) and posts ticks back. All connection state (lastPingPending,
 * isOpen, ping send) stays on the main thread.
 *
 * Why a worker at all: backgrounded tabs clamp main-thread setInterval to
 * ~1 minute, which makes the keepalive ping miss the server idle threshold.
 * Dedicated worker timers are not subject to the same clamping.
 *
 * Why the bootstrap is the ONLY top-level statement here (no exports, no
 * helper definitions): Sockatrice's `package.json` declares
 * `"sideEffects": false`, and tsup's `splitting: true` factors any
 * exported function out into a shared chunk. If `createWorkerHandler` were
 * defined here AND called here, tsup would split both into a chunk and
 * Vite — given the sideEffects:false hint — would tree-shake the resulting
 * worker chunk down to 0 bytes in consumer builds (Webatrice). The keepalive
 * worker would construct successfully but its script body would be empty
 * and no ticks would fire. Splitting the pure handler into a separate file
 * and keeping only the bootstrap `self.onmessage = ...` here makes the
 * top-level side effect part of the worker entry itself, which Vite's
 * worker bundler always preserves.
 *
 * KeepAliveService references this file via
 * new URL('./keepAliveWorker.js', import.meta.url) so the consumer's
 * bundler (Vite, webpack 5, Rollup, esbuild, Parcel) emits it as a separate
 * worker chunk. Production code never imports this module on the main thread;
 * tests do, and the self.onmessage assignment is harmless under jsdom.
 */

import { createWorkerHandler } from './keepAliveWorkerHandler';

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
};
ctx.onmessage = createWorkerHandler((msg) => ctx.postMessage(msg));
