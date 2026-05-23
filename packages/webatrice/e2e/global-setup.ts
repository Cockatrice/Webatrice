// Playwright global setup. Polls the Servatrice WebSocket port until the
// server is accepting binary frames before any spec runs. The first message
// Servatrice emits on a new connection is its `Event_ServerIdentification`,
// so receiving any data within the timeout means it is fully ready.
//
// `e2e/docker/docker-compose.e2e.yml` already waits for MySQL inside the
// container before launching servatrice, but `up -d` returns as soon as the
// containers exist — not when the binary is ready to accept clients. Hence
// the additional poll here.

import WebSocket from 'ws';

const E2E_WS_URL = 'ws://localhost:4748';
const READINESS_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

async function probe(): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(E2E_WS_URL);
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve(ok);
    };
    ws.binaryType = 'arraybuffer';
    ws.on('message', () => done(true));
    ws.on('error', () => done(false));
    ws.on('close', () => done(false));
    setTimeout(() => done(false), 5_000);
  });
}

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Servatrice did not become ready on ${E2E_WS_URL} within ${READINESS_TIMEOUT_MS}ms. ` +
    'Did `npm run test:e2e:up` finish? Check `docker compose -f e2e/docker/docker-compose.e2e.yml logs`.',
  );
}
