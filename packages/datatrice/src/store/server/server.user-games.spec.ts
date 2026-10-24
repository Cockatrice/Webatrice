import { create } from '@bufbuild/protobuf';
import { Response_GetGamesOfUserSchema } from '@cockatrice/sockatrice/generated';

import { makeServerState } from '../../testing/fixtures/server';
import { Actions } from './server.actions';
import { serverReducer } from './server.reducer';
import { Selectors } from './server.selectors';

const response = (name: string) => create(Response_GetGamesOfUserSchema, {
  roomList: [{ roomId: 7, name }],
  gameList: [{ gameId: 12, roomId: 7 }],
});

describe('user games room names', () => {
  it('retains the response room names independently for each queried user', () => {
    let state = serverReducer(makeServerState(), Actions.gamesOfUser({ userName: 'Alice', response: response('Original') }));
    state = serverReducer(state, Actions.gamesOfUser({ userName: 'Bob', response: response('Renamed') }));

    expect(state.gamesOfUserRoomNames).toEqual({ Alice: { 7: 'Original' }, Bob: { 7: 'Renamed' } });
    expect(Selectors.getGamesOfUserRoomNames({ server: state }, 'Alice')).toEqual({ 7: 'Original' });
    expect(Selectors.getGamesOfUserRoomNames({ server: state }, 'Bob')).toEqual({ 7: 'Renamed' });
  });

  it('clears the previous room names when requesting a new answer', () => {
    let state = serverReducer(makeServerState(), Actions.gamesOfUser({ userName: 'Alice', response: response('Old') }));
    state = serverReducer(state, Actions.gamesOfUser({ userName: 'Bob', response: response('Retained') }));
    state = serverReducer(state, Actions.gamesOfUserRequested({ userName: 'Alice' }));
    state = serverReducer(state, Actions.gamesOfUserFailed({ userName: 'Alice', responseCode: 16 }));

    expect(state.gamesOfUserRoomNames).toEqual({ Bob: { 7: 'Retained' } });
  });

  it('replaces room names when the next response has no rooms', () => {
    let state = serverReducer(makeServerState(), Actions.gamesOfUser({ userName: 'Alice', response: response('Old') }));
    state = serverReducer(state, Actions.gamesOfUser({ userName: 'Alice', response: create(Response_GetGamesOfUserSchema) }));

    expect(state.gamesOfUserRoomNames).toEqual({ Alice: {} });
  });

  it('returns a stable empty map for unanswered users and clears names at session end', () => {
    const state = serverReducer(makeServerState(), Actions.gamesOfUser({ userName: 'Alice', response: response('Old') }));
    const cleared = serverReducer(state, Actions.clearStore());

    expect(Selectors.getGamesOfUserRoomNames({ server: cleared }, 'Alice')).toEqual({});
    expect(Selectors.getGamesOfUserRoomNames({ server: cleared }, 'Alice'))
      .toBe(Selectors.getGamesOfUserRoomNames({ server: cleared }, 'Bob'));
  });
});
