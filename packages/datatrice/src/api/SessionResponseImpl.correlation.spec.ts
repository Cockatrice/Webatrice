import { create } from '@bufbuild/protobuf';
import type { Store } from '@reduxjs/toolkit';
import {
  Response_DeckDownloadSchema, Response_DeckShareCreateSchema, ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SessionResponseImpl } from './SessionResponseImpl';
import { RoomResponseImpl } from './RoomResponseImpl';
import { createStore } from '../store/createStore';
import { serverReducer } from '../store/server/server.reducer';
import { Actions } from '../store/server/server.actions';
import { roomsReducer } from '../store/rooms/rooms.reducer';
import { Actions as RoomsActions } from '../store/rooms/rooms.actions';

function setup() {
  const dispatch = vi.fn();
  const store = { dispatch } as unknown as Store;
  return { dispatch, session: new SessionResponseImpl(store), room: new RoomResponseImpl(store) };
}

it('carries download identity on success and every failure without storing it', () => {
  const { dispatch, session } = setup();
  session.downloadServerDeck(7, create(Response_DeckDownloadSchema, { deck: 'xml' }), 'download');
  const action = Actions.deckDownloaded({ deckId: 7, deck: 'xml', requestId: 'download' });
  expect(dispatch).toHaveBeenLastCalledWith(action);
  expect(serverReducer(undefined, action).downloadedDeck).toEqual({ deckId: 7, deck: 'xml' });
  for (const failure of [undefined, ...Object.values(WebsocketTypes.CommandFailure)]) {
    session.deckDownloadFailed(7, 3, failure, 'download');
    expect(dispatch).toHaveBeenLastCalledWith(Actions.deckDownloadFailed({
      deckId: 7, responseCode: 3, failure, requestId: 'download',
    }));
    session.commandFailed('deckShareList', 3, 'target', failure, 'query');
    expect(dispatch).toHaveBeenLastCalledWith(Actions.sessionCommandFailed({
      command: 'deckShareList', responseCode: 3, target: 'target', failure, requestId: 'query',
    }));
  }
});

it('carries optional room failure identities and keeps legacy calls valid', () => {
  const { dispatch, room } = setup();
  room.joinRoomFailed(7, 3, undefined, false, 'join');
  expect(dispatch).toHaveBeenLastCalledWith(RoomsActions.joinRoomFailed({
    roomId: 7, responseCode: 3, failure: undefined, userInitiated: false, requestId: 'join',
  }));
  room.createGameFailed(7, 3, undefined, 'create');
  expect(dispatch).toHaveBeenLastCalledWith(RoomsActions.createGameFailed({
    roomId: 7, responseCode: 3, failure: undefined, requestId: 'create',
  }));
  room.createGameFailed(7, 3);
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ roomId: 7 }) }));
});

it('retains the join failure reason while settling pending state for UI translation', () => {
  const { dispatch, room } = setup();
  room.setJoinGameError(3, '', WebsocketTypes.CommandFailure.Timeout);
  const action = RoomsActions.setJoinGameError({ code: 3, message: '', failure: WebsocketTypes.CommandFailure.Timeout });
  expect(dispatch).toHaveBeenLastCalledWith(action);
  const state = roomsReducer(undefined, action);
  expect(state.joinGamePending).toBe(false);
  expect(state.joinGameError).toEqual(action.payload);
});

it('carries share creation identities through success and failure actions', () => {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  const response = new SessionResponseImpl(store);
  response.deckShareCreated(create(Response_DeckShareCreateSchema, { token: 'secret' }), 'create-b');
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
    payload: expect.objectContaining({ requestId: 'create-b' }),
  }));
  response.commandFailed('deckShareCreate', 7, '', WebsocketTypes.CommandFailure.Timeout, 'create-a');
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
    payload: expect.objectContaining({ requestId: 'create-a', failure: WebsocketTypes.CommandFailure.Timeout }),
  }));
});

it('carries upload identities through success and failure actions', () => {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  const response = new SessionResponseImpl(store);
  response.uploadServerDeck('', create(ServerInfo_DeckStorage_TreeItemSchema, { id: 2, name: 'Unnamed deck' }), 'import-b');
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
    payload: expect.objectContaining({ requestId: 'import-b' }),
  }));
  response.deckUploadFailed('', 7, WebsocketTypes.CommandFailure.Timeout, 'import-a');
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
    payload: expect.objectContaining({ requestId: 'import-a', failure: WebsocketTypes.CommandFailure.Timeout }),
  }));
});
