import { create } from '@bufbuild/protobuf';
import type { Store } from '@reduxjs/toolkit';
import { ServerInfo_ReplayMatchSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SessionResponseImpl } from './SessionResponseImpl';
import { Actions } from '../store/server/server.actions';
import { serverReducer } from '../store/server/server.reducer';

function setup() {
  const dispatch = vi.fn();
  return { dispatch, session: new SessionResponseImpl({ dispatch } as unknown as Store) };
}

describe('replay-list outcome identity', () => {
  it('carries out-of-order success identities on actions without storing them', () => {
    const { dispatch, session } = setup();
    const newMatches = [create(ServerInfo_ReplayMatchSchema, { gameId: 2 })];
    const oldMatches = [create(ServerInfo_ReplayMatchSchema, { gameId: 1 })];

    session.replayList(newMatches, 'second');
    session.replayList(oldMatches, 'first');

    expect(dispatch).toHaveBeenNthCalledWith(1, Actions.replayList({ matchList: newMatches, requestId: 'second' }));
    expect(dispatch).toHaveBeenNthCalledWith(2, Actions.replayList({ matchList: oldMatches, requestId: 'first' }));
    for (const [action] of dispatch.mock.calls) {
      expect(serverReducer(undefined, action)).toEqual(
        serverReducer(undefined, Actions.replayList({ matchList: action.payload.matchList })),
      );
    }
  });

  it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])(
    'carries failure %s identity without changing domain state', (failure) => {
      const { dispatch, session } = setup();
      session.replayListFailed(7, failure, 'first');
      const action = Actions.replayListFailed({ responseCode: 7, failure, requestId: 'first' });
      expect(dispatch).toHaveBeenCalledWith(action);
      const state = serverReducer(undefined, { type: 'init' });
      expect(serverReducer(state, action)).toBe(state);
    },
  );

  it('keeps legacy response calls valid', () => {
    const { dispatch, session } = setup();
    session.replayList([]);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.replayList({ matchList: [] }));
    session.replayListFailed(7);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.replayListFailed({ responseCode: 7, failure: undefined }));
  });
});
