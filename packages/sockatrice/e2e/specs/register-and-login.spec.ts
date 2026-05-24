import { describe, it, expect } from 'vitest';

import { AuthenticationCommands, WebClient } from '../../dist/index.js';
import { WebsocketTypes } from '../../dist/types/index.js';
import { generateUniqueUser, waitForStatus } from '../helpers/e2e-client';

describe('register-and-login', () => {
  it('registers a fresh user and ends up logged in against local servatrice', async () => {
    const user = generateUniqueUser();

    AuthenticationCommands.register({
      host: 'localhost',
      port: '4749',
      userName: user.userName,
      password: user.password,
      email: user.email,
      country: 'us',
      realName: 'E2E Test',
    });

    await waitForStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 25_000);
    expect(WebClient.instance.status).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
  });
});
