// Playwright global setup. Polls the Servatrice WebSocket port until the
// server is accepting binary frames before any spec runs. The first message
// Servatrice emits on a new connection is its `Event_ServerIdentification`,
// so its advertised version also supplies capability checks to the specs.
//
// The shared e2e compose at `docker/servatrice/docker-compose.e2e.yml`
// already waits for MySQL inside the container before launching servatrice,
// but `up -d` returns as soon as the containers exist — not when the binary
// is ready to accept clients. Hence the additional poll here.

import WebSocket from 'ws';
import { fromBinary, getExtension, hasExtension } from '@bufbuild/protobuf';

const E2E_WS_URL = 'ws://localhost:4748';
const READINESS_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

async function probe(): Promise<string | null> {
  const { Event_ServerIdentification_ext, ServerMessageSchema } = await import('@cockatrice/sockatrice/generated');
  return new Promise((resolve) => {
    const ws = new WebSocket(E2E_WS_URL);
    let settled = false;
    const done = (version: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // A socket that never opened has nothing to close.
      }
      resolve(version);
    };
    const timer = setTimeout(() => done(null), 5_000);
    ws.binaryType = 'arraybuffer';
    ws.on('message', (data) => {
      const bytes = Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data as ArrayBuffer);
      const message = fromBinary(ServerMessageSchema, bytes);
      if (message.sessionEvent && hasExtension(message.sessionEvent, Event_ServerIdentification_ext)) {
        done(getExtension(message.sessionEvent, Event_ServerIdentification_ext).serverVersion || null);
      }
    });
    ws.on('error', () => done(null));
    ws.on('close', () => done(null));
  });
}

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const version = await probe();
    if (version) {
      process.env.SERVATRICE_ADVERTISED_VERSION = version;
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Servatrice did not become ready on ${E2E_WS_URL} within ${READINESS_TIMEOUT_MS}ms. ` +
    'Did `npm run test:e2e:up` finish? Check `npm run test:e2e:up` output and ' +
    '`docker compose --env-file ../../.env.e2e --env-file .env.e2e -f ../../docker/servatrice/docker-compose.e2e.yml logs`.',
  );
}
