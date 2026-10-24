import { create } from '@bufbuild/protobuf';
import { games, rooms, server } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { Event_RoomSay_RoomMessageType, Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, makeUser } from '../../__test-utils__';
import type { RootState } from '@app/store';

import { currentView, unreadChange, type VisibilityChecks } from './unreadEvents';

const state = {
  ...connectedWithRoomsState,
  server: { ...connectedWithRoomsState.server!, user: makeUser({ name: 'me' }) },
  games: {
    games: {
      4: makeGameEntry({
        localPlayerId: 1,
        players: {
          1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }),
          2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2 }) }),
        },
      }),
    },
    pings: {},
  },
} as unknown as RootState;

const visible: VisibilityChecks = { roomMessage: () => true, privateMessage: () => true, mentionsSelf: () => false };
const change = (action: { type: string; payload: unknown }, pathname = '/', checks = visible) =>
  unreadChange(action, state, state, currentView(pathname), checks);

const withGame = (patch: Record<string, unknown>) => ({
  ...state,
  games: { ...state.games, games: { 4: { ...state.games.games[4], ...patch } } },
}) as RootState;

const roomLine = (name: string, messageType = Event_RoomSay_RoomMessageType.UserMessage) =>
  rooms.Actions.addMessage({ roomId: 1, message: { name, message: 'hi', messageType, timeReceived: 0 } as never });

describe('currentView', () => {
  it('reads the room, game or conversation on screen from the route', () => {
    expect(currentView('/room/3')).toEqual({ roomId: 3, gameId: undefined, chatPeers: [] });
    expect(currentView('/game/9')).toMatchObject({ gameId: 9 });
    expect(currentView('/player/bob')).toMatchObject({ chatPeers: ['bob'] });
  });
});

describe('unreadChange', () => {
  it('counts room lines from others in rooms you are not viewing', () => {
    expect(change(roomLine('bob'))).toEqual({ op: 'bump', scope: 'rooms', key: 1 });
    expect(change(roomLine('bob'), '/room/1')).toBeNull();
    expect(change(roomLine('me'))).toBeNull();
    expect(change(roomLine('bob', Event_RoomSay_RoomMessageType.ChatHistory))).toBeNull();
    expect(change(roomLine('bob'), '/', { ...visible, roomMessage: () => false })).toBeNull();
    expect(change(rooms.Actions.leaveRoom({ roomId: 1 }))).toEqual({ op: 'clear', scope: 'rooms', key: 1 });
  });

  it('counts private messages by sender unless that conversation is open', () => {
    const pm = (senderName: string) => server.Actions.userMessage({
      timeReceived: 0,
      messageData: create(Event_UserMessageSchema, { senderName, receiverName: 'me', message: 'yo' }),
    });
    expect(change(pm('bob'))).toEqual({ op: 'bump', scope: 'chats', key: 'bob' });
    expect(change(pm('bob'), '/player/bob')).toBeNull();
    expect(change(pm('me'))).toBeNull();
  });

  it('counts game chat and seat changes from others in games you are not viewing', () => {
    const say = (playerId: number) => games.Actions.gameSay({ gameId: 4, playerId, message: 'gg', timeReceived: 0 } as never);
    expect(change(say(2))).toEqual({ op: 'bump', scope: 'games', key: 4 });
    expect(change(say(1))).toBeNull();
    expect(change(say(2), '/game/4')).toBeNull();
    const left = games.Actions.playerLeft({ gameId: 4, playerId: 2, reason: 0 } as never);
    expect(change(left)).toEqual({ op: 'bump', scope: 'games', key: 4 });
    expect(change(games.Actions.gameLeft({ gameId: 4 }))).toEqual({ op: 'clear', scope: 'games', key: 4 });
  });

  it('counts turn changes and phase changes on your turn, not every card move', () => {
    const view = currentView('/');
    const turn = games.Actions.activePlayerSet({ gameId: 4, activePlayerId: 2 });
    expect(unreadChange(turn, withGame({ activePlayerId: 1 }), withGame({ activePlayerId: 2 }), view, visible))
      .toEqual({ op: 'bump', scope: 'games', key: 4 });

    const phase = games.Actions.activePhaseSet({ gameId: 4, phase: 3 });
    const mine = { activePlayerId: 1 };
    expect(unreadChange(phase, withGame({ ...mine, activePhase: 2 }), withGame({ ...mine, activePhase: 3 }), view, visible))
      .toEqual({ op: 'bump', scope: 'games', key: 4 });
    const theirs = { activePlayerId: 2 };
    expect(unreadChange(phase, withGame({ ...theirs, activePhase: 2 }), withGame({ ...theirs, activePhase: 3 }), view, visible))
      .toBeNull();

    const moved = { type: games.Types.CARD_MOVED, payload: { gameId: 4, playerId: 2, data: {} } };
    expect(unreadChange(moved, state, state, view, visible)).toBeNull();
    expect(unreadChange(turn, withGame({ activePlayerId: 1, replay: true }), withGame({ activePlayerId: 2, replay: true }), view, visible))
      .toBeNull();
  });

  it('flags room and game chat that mentions you, asking with the sender', () => {
    const mentionsSelf = vi.fn((text: string) => text.includes('@me'));
    const checks = { ...visible, mentionsSelf };
    const line = (message: string) =>
      rooms.Actions.addMessage({ roomId: 1, message: { name: 'bob', message, messageType: 1, timeReceived: 0 } as never });
    expect(change(line('hi @me'), '/', checks)).toEqual({ op: 'bump', scope: 'rooms', key: 1, mention: true });
    expect(change(line('hi all'), '/', checks)).toEqual({ op: 'bump', scope: 'rooms', key: 1 });
    expect(change(line('hi @me'), '/room/1', checks)).toBeNull();

    const say = (message: string) => games.Actions.gameSay({ gameId: 4, playerId: 2, message, timeReceived: 0 } as never);
    expect(change(say('gg @me'), '/', checks)).toEqual({ op: 'bump', scope: 'games', key: 4, mention: true });
    expect(mentionsSelf).toHaveBeenLastCalledWith('gg @me', state.games.games[4].players[2].properties.userInfo, state);
    expect(change(say('gg'), '/', checks)).toEqual({ op: 'bump', scope: 'games', key: 4 });

    const left = games.Actions.playerLeft({ gameId: 4, playerId: 2, reason: 0 } as never);
    mentionsSelf.mockClear();
    expect(change(left, '/', checks)).toEqual({ op: 'bump', scope: 'games', key: 4 });
    expect(mentionsSelf).not.toHaveBeenCalled();
  });
});
