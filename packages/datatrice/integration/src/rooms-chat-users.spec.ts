import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { attachResponseHandlers, createStore, rooms, server } from '../../src';
import { MAX_USER_MESSAGES, MAX_PRIVATE_CHAT_NOTICES } from '../../src/store/server/server.reducer.users';

const Code = Data.Response_ResponseCode;

describe('room and private chat state boundaries', () => {
  it('stores a transport-failure room notice with an exact receive time', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(123);
    try {
      response.room.roomSayFailed(7, 'unsent', Code.RespNotConnected, WebsocketTypes.CommandFailure.Timeout);
      expect(store.getState().rooms.messages[7]).toEqual([{
        ...create(Data.Event_RoomSaySchema, { name: '', message: '' }),
        id: expect.any(Number), timeReceived: 123, notice: 'notSent', failure: WebsocketTypes.CommandFailure.Timeout,
      }]);
    } finally {
      clock.mockRestore();
    }
  });

  it('settles a correlated successful game join and a transport failure', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.room.setJoinGamePending(true, 'join-a');
    expect(store.getState().rooms.joinGamePending).toBe(true);
    response.room.setJoinGamePending(false, 'join-a');
    const dispatch = vi.spyOn(store, 'dispatch');
    try {
      response.room.joinedGame(7, 42, 'join-a');
      expect(dispatch).toHaveBeenCalledExactlyOnceWith(rooms.Actions.joinedGame({ roomId: 7, gameId: 42, requestId: 'join-a' }));
      expect(store.getState().rooms.joinedGameIds).toEqual({ 7: { 42: true } });
    } finally {
      dispatch.mockRestore();
    }
    expect(store.getState().rooms.joinGamePending).toBe(false);
    response.room.setJoinGamePending(true, 'join-b');
    expect(store.getState().rooms.joinGamePending).toBe(true);
    response.room.setJoinGameError(Code.RespNotConnected, '', WebsocketTypes.CommandFailure.Timeout, 'join-b');
    expect(store.getState().rooms.joinGamePending).toBe(false);
    expect(store.getState().rooms.joinGameError).toEqual({
      code: Code.RespNotConnected, message: '', failure: WebsocketTypes.CommandFailure.Timeout, requestId: 'join-b',
    });
    store.dispatch(rooms.Actions.clearJoinGameError());
    expect(store.getState().rooms.joinGameError).toBeNull();
  });

  it('keeps unknown conversations and game lookups empty without creating raw state', () => {
    const store = createStore();
    expect(server.Selectors.getPrivateConversation(store.getState(), 'bob')).toEqual([]);
    expect(server.Selectors.getGamesOfUser(store.getState(), 'bob')).toEqual([]);
    expect(store.getState().server.messages.bob).toBeUndefined();
    expect(store.getState().server.privateChatNotices.bob).toBeUndefined();
    expect(store.getState().server.gamesOfUser.bob).toBeUndefined();
  });

  it('records failures without messages, ignores unrelated rejections and caps notices', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.privateMessageFailed('bob', 'unsent', Code.RespNotConnected, WebsocketTypes.CommandFailure.Timeout);
    const first = { id: expect.any(Number), kind: 'notSent', position: 0, failure: WebsocketTypes.CommandFailure.Timeout };
    expect(store.getState().server.privateChatNotices.bob).toEqual([first]);
    response.session.privateMessageFailed('bob', 'unsent', Code.RespContextError);
    expect(store.getState().server.privateChatNotices.bob).toEqual([first]);
    for (let i = 0; i < MAX_PRIVATE_CHAT_NOTICES - 1; i++) {
      response.session.privateMessageFailed('bob', 'unsent', Code.RespChatFlood);
    }
    const floodNotices = Array.from({ length: MAX_PRIVATE_CHAT_NOTICES - 1 }, () => ({
      id: expect.any(Number), kind: 'chatFlood', position: 0,
    }));
    expect(store.getState().server.privateChatNotices.bob).toEqual([first, ...floodNotices]);
    response.session.privateMessageFailed('bob', 'unsent', Code.RespInIgnoreList);
    expect(store.getState().server.privateChatNotices.bob).toEqual([
      ...floodNotices, { id: expect.any(Number), kind: 'ignoredByRecipient', position: 0 },
    ]);
    expect(store.getState().server.messages.bob).toBeUndefined();
  });

  it.each([false, true])('trims messages and preserves notice positions with notices present: %s', (withNotices) => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(create(Data.ServerInfo_UserSchema, { name: 'alice' }));
    if (withNotices) {
      response.session.privateMessageFailed('bob', 'unsent', Code.RespChatFlood);
    }
    const messages = Array.from({ length: MAX_USER_MESSAGES }, (_, i) => create(Data.Event_UserMessageSchema, {
      senderName: 'alice', receiverName: 'bob', message: String(i),
    }));
    messages.forEach((message, i) => {
      response.session.userMessage(message);
      if (withNotices && i === 0) {
        response.session.privateMessageFailed('bob', 'unsent', Code.RespInIgnoreList);
      }
    });
    const expectedMessages = messages.map(message => ({ ...message, timeReceived: expect.any(Number) }));
    expect(store.getState().server.messages.bob).toEqual(expectedMessages);
    expect(store.getState().server.privateChatNotices.bob).toEqual(withNotices ? [
      { id: expect.any(Number), kind: 'chatFlood', position: 0 },
      { id: expect.any(Number), kind: 'ignoredByRecipient', position: 1 },
    ] : undefined);
    const newest = create(Data.Event_UserMessageSchema, { senderName: 'bob', receiverName: 'alice', message: 'newest' });
    response.session.userMessage(newest);
    const expectedRetained = [...expectedMessages.slice(1), { ...newest, timeReceived: expect.any(Number) }];
    expect(store.getState().server.messages.bob).toEqual(expectedRetained);
    expect(store.getState().server.privateChatNotices.bob).toEqual(withNotices ? [
      { id: expect.any(Number), kind: 'ignoredByRecipient', position: 0 },
    ] : undefined);
    expect(server.Selectors.getPrivateConversation(store.getState(), 'bob')).toEqual([
      ...(withNotices ? [{ type: 'notice', notice: { id: expect.any(Number), kind: 'ignoredByRecipient', position: 0 } }] : []),
      ...expectedRetained.map(message => ({ type: 'message', message })),
    ]);
  });

  it('accepts games whose response omits room metadata and clears a previous result on request', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const game = create(Data.ServerInfo_GameSchema, { gameId: 42, roomId: 7, gameTypes: [1] });
    response.session.getGamesOfUser('bob', {
      ...create(Data.Response_GetGamesOfUserSchema, { gameList: [game] }), roomList: undefined,
    } as unknown as Data.Response_GetGamesOfUser);
    expect(store.getState().server.gamesOfUser.bob[42].info).toEqual(game);
    expect(store.getState().server.gamesOfUser.bob[42].gameType).toBe('');
    expect(store.getState().server.gamesOfUserStatus.bob).toEqual({ state: 'loaded' });
    response.session.getGamesOfUserPending('bob');
    expect(store.getState().server.gamesOfUser.bob).toBeUndefined();
    expect(store.getState().server.gamesOfUserStatus.bob).toEqual({ state: 'loading' });
    response.session.getGamesOfUser('bob', {
      ...create(Data.Response_GetGamesOfUserSchema, { gameList: [game] }),
      roomList: [{ ...create(Data.ServerInfo_RoomSchema, { roomId: 7 }), gametypeList: undefined }],
    } as unknown as Data.Response_GetGamesOfUser);
    expect(store.getState().server.gamesOfUser.bob[42].info).toEqual(game);
    expect(store.getState().server.gamesOfUser.bob[42].gameType).toBe('');
  });
});
