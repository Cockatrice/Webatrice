
import { describe, it, expect } from 'vitest';
import type { Mock } from 'vitest';

import { AuthenticationCommands, SessionCommands, WebClient } from '../../dist/index.js';
import { WebsocketTypes } from '../../dist/types/index.js';
import { generateUniqueUser, waitForStatus } from '../helpers/e2e-client';

const RESP_OK = 1;

async function registerAndLogin(): Promise<void> {
  const user = generateUniqueUser();
  AuthenticationCommands.register({
    host: 'localhost',
    port: '4749',
    userName: user.userName,
    password: user.password,
    email: user.email,
    country: 'us',
    realName: 'E2E Capabilities',
  });
  await waitForStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 25_000);
}

function reportedServerVersion(): string {
  const calls = (WebClient.instance.response.session.updateInfo as unknown as Mock).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as string;
}

function speaks31(version: string): boolean {
  const [major, minor] = version.split(/[.\s-]/).map(Number);
  return major > 3 || (major === 3 && minor >= 1);
}

function clearCardArt(): Promise<number> {
  return new Promise((resolve) => {
    SessionCommands.setCardArtParams({ cardName: '' }, () => resolve(RESP_OK), (code) => resolve(code));
  });
}

async function waitForCall(fn: unknown, timeoutMs: number): Promise<unknown[]> {
  const mock = fn as Mock;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (mock.mock.calls.length > 0) {
      return mock.mock.calls[0];
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for a response handler call.`);
}

describe('protocol-capabilities', () => {
  it('reports a parseable server version for capability gating', async () => {
    await registerAndLogin();
    expect(reportedServerVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('round-trips a 3.1 session command on 3.1 and fails it cleanly on 3.0', async () => {
    await registerAndLogin();
    const version = reportedServerVersion();

    const code = await clearCardArt();

    if (speaks31(version)) {
      expect(code).toBe(RESP_OK);

      SessionCommands.reportMyList();
      const [reports] = await waitForCall(WebClient.instance.response.session.reportMyList, 10_000);
      expect(reports).toEqual([]);
    } else {
      expect(code).not.toBe(RESP_OK);
      expect(code).toBeGreaterThan(RESP_OK);
    }

    expect(WebClient.instance.status).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
  });
});
