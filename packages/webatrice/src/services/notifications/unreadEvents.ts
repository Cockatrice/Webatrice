import { games, rooms, server, type GameEntry, type Message } from '@cockatrice/datatrice';
import { Event_RoomSay_RoomMessageType, type Event_UserMessage, type ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { matchPath } from 'react-router-dom';

import type { RootState } from '@app/store';
import { RouteEnum } from '@app/types';

import type { UnreadScope } from './notificationStore';

export interface ObservedAction {
  type: string | null;
  payload: unknown;
}

export interface CurrentView {
  roomId?: number;
  gameId?: number;
  chatPeers: readonly string[];
}

export interface UnreadChange {
  op: 'bump' | 'clear';
  scope: UnreadScope;
  key: number | string;
  mention?: boolean;
}

export interface VisibilityChecks {
  roomMessage: (roomId: number, state: RootState) => boolean;
  privateMessage: (peer: string, state: RootState) => boolean;
  mentionsSelf: (text: string, sender: ServerInfo_User | undefined, state: RootState) => boolean;
}

export function currentView(pathname: string): CurrentView {
  const room = matchPath({ path: RouteEnum.ROOM, end: true }, pathname)?.params.roomId;
  const game = matchPath({ path: RouteEnum.GAME, end: true }, pathname)?.params.gameId;
  const peer = matchPath({ path: RouteEnum.PLAYER, end: true }, pathname)?.params.name;
  return {
    roomId: room != null ? Number(room) : undefined,
    gameId: game != null ? Number(game) : undefined,
    chatPeers: peer != null ? [peer] : [],
  };
}

const G = games.Types;
const GAME_GONE: ReadonlySet<string> = new Set([G.GAME_LEFT, G.GAME_CLOSED, G.KICKED]);

function liveGame(state: RootState, gameId: number): GameEntry | undefined {
  const game = state.games.games[gameId];
  return game && !game.replay ? game : undefined;
}

export function countsAsGameUnread(action: ObservedAction, before: RootState, after: RootState): boolean {
  const { gameId, playerId } = action.payload as { gameId: number; playerId?: number };
  const was = liveGame(before, gameId);
  const game = liveGame(after, gameId);
  switch (action.type) {
    case G.GAME_SAY:
      return Boolean(game) && playerId !== game?.localPlayerId;
    case G.PLAYER_JOINED: {
      const joined = (action.payload as { playerProperties: { playerId: number } }).playerProperties.playerId;
      return Boolean(game) && joined !== game?.localPlayerId && !was?.players[joined];
    }
    case G.PLAYER_LEFT:
      return Boolean(was) && playerId !== was?.localPlayerId && Boolean(was?.players[playerId ?? -1]);
    case G.ACTIVE_PLAYER_SET:
      return Boolean(game && was) && game?.activePlayerId !== was?.activePlayerId;
    case G.ACTIVE_PHASE_SET:
      return Boolean(game && was) && !game?.spectator && game?.activePlayerId === game?.localPlayerId
        && game?.activePhase !== was?.activePhase;
    default:
      return false;
  }
}

function gameChatMention(action: ObservedAction, after: RootState, checks: VisibilityChecks): boolean {
  if (action.type !== G.GAME_SAY) {
    return false;
  }
  const { gameId, playerId, message } = action.payload as { gameId: number; playerId: number; message: string };
  const sender = liveGame(after, gameId)?.players[playerId]?.properties.userInfo;
  return checks.mentionsSelf(message, sender, after);
}

function gameChange(
  action: ObservedAction,
  before: RootState,
  after: RootState,
  view: CurrentView,
  checks: VisibilityChecks,
): UnreadChange | null {
  const { gameId } = action.payload as { gameId: number };
  if (GAME_GONE.has(action.type ?? '')) {
    return { op: 'clear', scope: 'games', key: gameId };
  }
  if (gameId === view.gameId || !countsAsGameUnread(action, before, after)) {
    return null;
  }
  const change: UnreadChange = { op: 'bump', scope: 'games', key: gameId };
  return gameChatMention(action, after, checks) ? { ...change, mention: true } : change;
}

function roomChange(action: ObservedAction, after: RootState, view: CurrentView, checks: VisibilityChecks): UnreadChange | null {
  if (action.type === rooms.Types.LEAVE_ROOM) {
    return { op: 'clear', scope: 'rooms', key: (action.payload as { roomId: number }).roomId };
  }
  const { roomId, message } = action.payload as { roomId: number; message: Message };
  const selfName = after.server.user?.name;
  if (
    roomId === view.roomId
    || message.messageType === Event_RoomSay_RoomMessageType.ChatHistory
    || !message.name
    || message.name === selfName
    || !checks.roomMessage(roomId, after)
  ) {
    return null;
  }
  const change: UnreadChange = { op: 'bump', scope: 'rooms', key: roomId };
  const sender = after.rooms.rooms[roomId]?.users[message.name];
  return checks.mentionsSelf(message.message, sender, after) ? { ...change, mention: true } : change;
}

function chatChange(action: ObservedAction, after: RootState, view: CurrentView, checks: VisibilityChecks): UnreadChange | null {
  const { messageData } = action.payload as { messageData: Event_UserMessage };
  const selfName = after.server.user?.name;
  const peer = messageData.senderName;
  if (!selfName || peer === selfName || view.chatPeers.includes(peer) || !checks.privateMessage(peer, after)) {
    return null;
  }
  return { op: 'bump', scope: 'chats', key: peer };
}

const GAME_PREFIX = `${G.GAME_JOINED.split('/')[0]}/`;

export function unreadChange(
  action: ObservedAction,
  before: RootState,
  after: RootState,
  view: CurrentView,
  checks: VisibilityChecks,
): UnreadChange | null {
  if (action.type === rooms.Types.ADD_MESSAGE || action.type === rooms.Types.LEAVE_ROOM) {
    return roomChange(action, after, view, checks);
  }
  if (action.type === server.Types.USER_MESSAGE) {
    return chatChange(action, after, view, checks);
  }
  if (action.type?.startsWith(GAME_PREFIX)) {
    return gameChange(action, before, after, view, checks);
  }
  return null;
}
