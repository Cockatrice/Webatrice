import { create } from '@bufbuild/protobuf';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { server } from '@cockatrice/datatrice';
import {
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag as Flag,
} from '@cockatrice/sockatrice/generated';
import { Logs } from '@app/features/logs';

import { renderFeatureScreen, simulateLoggedIn, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
  store.dispatch(server.Actions.updateInfo({ info: { name: 'TestServer', version: '3.1.0 ()' } }));
  store.dispatch(server.Actions.updateUser({
    user: create(ServerInfo_UserSchema, {
      name: 'moderator',
      userLevel: Flag.IsUser | Flag.IsRegistered | Flag.IsModerator,
    }),
  }));
});

describe('Logs (integration)', () => {
  it('renders the moderator log search form and the results tabs', () => {
    renderFeatureScreen(<Logs />);

    expect(screen.getByRole('heading', { name: 'Logs.pageTitle' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Logs\.tab\.rooms/ }),
    ).toBeInTheDocument();
  });
});
