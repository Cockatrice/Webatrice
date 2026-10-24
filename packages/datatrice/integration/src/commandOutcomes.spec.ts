import { expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { Event_NotifyUserSchema, Event_ServerShutdownSchema } from '@cockatrice/sockatrice/generated';
import { attachResponseHandlers, createStore, server } from '../../src';
import { Actions } from '../../src/store/server/server.actions';
import { Actions as RoomActions } from '../../src/store/rooms/rooms.actions';
import { makeServerState } from '../../src/testing/fixtures/server';

it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])('dispatches exact command failures with reason %s', (failure) => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  const dispatch = vi.spyOn(store, 'dispatch');
  response.session.deckListFailed!(3, failure);
  expect(dispatch).toHaveBeenLastCalledWith(Actions.deckListFailed({ responseCode: 3, failure }));
  response.session.deckUploadFailed!('/decks', 3, failure);
  expect(dispatch).toHaveBeenLastCalledWith(Actions.deckUploadFailed({ path: '/decks', responseCode: 3, failure }));
  for (const requestId of [undefined, 'request-7']) {
    response.session.deckDownloadFailed!(7, 3, failure, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.deckDownloadFailed({ deckId: 7, responseCode: 3, failure, requestId }));
    response.session.commandFailed!('deckShareList', 3, 'share', failure, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.sessionCommandFailed({
      command: 'deckShareList', responseCode: 3, target: 'share', failure, requestId,
    }));
    response.session.getUserInfoFailed!('alice', 3, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(Actions.getUserInfoFailed({ userName: 'alice', responseCode: 3, requestId }));
    response.room.createGameFailed!(4, 3, failure, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(RoomActions.createGameFailed({ roomId: 4, responseCode: 3, failure, requestId }));
    response.room.joinRoomFailed!(4, 3, failure, undefined, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(RoomActions.joinRoomFailed({
      roomId: 4, responseCode: 3, failure, userInitiated: true, requestId,
    }));
    response.room.joinRoomFailed!(4, 3, failure, false, requestId);
    expect(dispatch).toHaveBeenLastCalledWith(RoomActions.joinRoomFailed({
      roomId: 4, responseCode: 3, failure, userInitiated: false, requestId,
    }));
  }
  expect(store.getState().server.downloadedDeck).toBeNull();
  expect(store.getState().rooms.joinGamePending).toBe(false);
});

it.each([undefined, WebsocketTypes.CommandFailure.Timeout])('retains join error reason %s and settles pending state', (failure) => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  response.room.setJoinGamePending(true);
  const dispatch = vi.spyOn(store, 'dispatch');
  response.room.setJoinGameError(3, 'failed', failure);
  const payload = failure === undefined ? { code: 3, message: 'failed' } : { code: 3, message: 'failed', failure };
  expect(dispatch).toHaveBeenCalledExactlyOnceWith(RoomActions.setJoinGameError(payload));
  expect(store.getState().rooms.joinGameError).toStrictEqual(payload);
  expect(store.getState().rooms.joinGamePending).toBe(false);
});

it.each([undefined, 8])('preserves or initializes preloaded session epoch %s', (epoch) => {
  const preloaded = makeServerState();
  if (epoch === undefined) {
    Reflect.deleteProperty(preloaded, 'sessionEpoch');
  } else {
    preloaded.sessionEpoch = epoch;
  }
  const store = createStore({ preloadedState: { server: preloaded } });
  const response = attachResponseHandlers(store);
  expect(store.getState().server.sessionEpoch).toBe(epoch);
  expect(server.Selectors.selectSessionEpoch(store.getState())).toBe(epoch ?? 0);
  response.session.initialized();
  expect(store.getState().server.sessionEpoch).toBe(epoch ?? 0);
});

it.each(['clear', 'disconnect', 'login'] as const)('advances a legacy session epoch through %s', (event) => {
  const preloaded = makeServerState();
  Reflect.deleteProperty(preloaded, 'sessionEpoch');
  const store = createStore({ preloadedState: { server: preloaded } });
  const response = attachResponseHandlers(store);
  if (event === 'clear') {
    response.session.clearStore();
  } else if (event === 'disconnect') {
    response.session.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'closed');
  } else {
    response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'logged in');
  }
  expect(server.Selectors.selectSessionEpoch(store.getState())).toBe(1);
});

it('advances once per login transition and preserves the epoch on repeated status', () => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'logged in');
  expect(server.Selectors.selectSessionEpoch(store.getState())).toBe(1);
  response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'still logged in');
  expect(server.Selectors.selectSessionEpoch(store.getState())).toBe(1);
  response.session.clearStore();
  expect(server.Selectors.selectSessionEpoch(store.getState())).toBe(2);
});

it('selects notifications and shutdown data delivered through the response bridge', () => {
  const store = createStore();
  const response = attachResponseHandlers(store);
  expect(server.Selectors.getNotifications(store.getState())).toStrictEqual([]);
  expect(server.Selectors.getServerShutdown(store.getState())).toBeNull();
  const notification = create(Event_NotifyUserSchema, { warningReason: 'notice' });
  const shutdown = create(Event_ServerShutdownSchema, { reason: 'maintenance', minutes: 5 });
  response.session.notifyUser(notification);
  response.session.serverShutdown(shutdown);
  expect(server.Selectors.getNotifications(store.getState())).toStrictEqual([notification]);
  expect(server.Selectors.getServerShutdown(store.getState())).toStrictEqual(shutdown);
});
