import { create } from '@bufbuild/protobuf';
import { Response_GetServerStatsSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { createStore } from '../store/createStore';
import { Actions as ServerActions } from '../store/server/server.actions';
import { attachResponseHandlers } from './attachResponseHandlers';
import { DeveloperResponseImpl } from './DeveloperResponseImpl';

describe('DeveloperResponseImpl', () => {
  it('serverStats dispatches the serverStats action with the snapshot', () => {
    const store = createStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const stats = create(Response_GetServerStatsSchema, { usersCount: 3n });

    new DeveloperResponseImpl(store).serverStats(stats);

    expect(dispatch).toHaveBeenCalledWith(ServerActions.serverStats({ stats }));
  });

  it('commandFailed dispatches developerCommandFailed with the transport reason', () => {
    const store = createStore();
    const dispatch = vi.spyOn(store, 'dispatch');

    new DeveloperResponseImpl(store).commandFailed('getServerStats', -1, '', WebsocketTypes.CommandFailure.Timeout);

    expect(dispatch).toHaveBeenCalledWith(ServerActions.developerCommandFailed({
      command: 'getServerStats', responseCode: -1, target: '', failure: WebsocketTypes.CommandFailure.Timeout,
    }));
  });

  it('is wired into the response handlers', () => {
    expect(attachResponseHandlers(createStore()).developer).toBeInstanceOf(DeveloperResponseImpl);
  });
});
