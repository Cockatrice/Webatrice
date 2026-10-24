import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { games, rooms, server, type GamesState, type Message } from '@cockatrice/datatrice';
import { Event_RoomSay_RoomMessageType, type ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { useNotify } from '@app/components';
import { getPreferencesSnapshot, playSound, settingsStore, useActionFeed } from '@app/hooks';
import { detectGameReady, isPageInactive, requestAttention, soundEngine } from '@app/services';
import type { RootState } from '@app/store';
import { RouteEnum } from '@app/types';
import { chatFilterVerdicts, findChatAlert, isPrivilegedUser, isRoomMessageVisible, parseHighlightWords } from '@app/utils';

import { gameEventSound, isGameAttentionEvent, type ObservedAction } from './gameEventSound';

const GAME_ACTION_PREFIX = `${games.Types.GAME_JOINED.split('/')[0]}/`;

export default function AppAlerts() {
  const notify = useNotify();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => settingsStore.subscribe(() => {
    if (!getPreferencesSnapshot().soundEnabled) {
      soundEngine.stop();
    }
  }), []);

  useActionFeed((action, before, after) => {
    if (action.type?.startsWith(GAME_ACTION_PREFIX)) {
      onGameEvent(action, before.games, after.games);
    } else if (action.type === rooms.Types.ADD_MESSAGE) {
      onRoomMessage(action.payload as { roomId: number; message: Message }, after);
    } else if (action.type === server.Types.USER_JOINED) {
      onUserJoined((action.payload as { user: ServerInfo_User }).user.name, before);
    } else if (action.type === server.Types.USER_LEFT) {
      onUserLeft((action.payload as { name: string }).name, before);
    }
  }, (action) => Boolean(action.type?.startsWith(GAME_ACTION_PREFIX))
    || action.type === rooms.Types.ADD_MESSAGE
    || action.type === server.Types.USER_JOINED
    || action.type === server.Types.USER_LEFT);

  function onGameEvent(action: ObservedAction, before: GamesState, after: GamesState) {
    const sound = gameEventSound(action, before, after);
    if (sound) {
      playSound(sound);
    }
    const prefs = getPreferencesSnapshot();
    announceGameReady(action, before, after, prefs.notificationsEnabled);
    if (!prefs.notificationsEnabled || !isGameAttentionEvent(action.type)) {
      return;
    }
    const { gameId } = action.payload as { gameId: number };
    const spectating = (after.games[gameId] ?? before.games[gameId])?.spectator ?? false;
    if (!spectating || prefs.spectatorNotificationsEnabled) {
      requestAttention();
    }
  }

  function onRoomMessage({ roomId, message }: { roomId: number; message: Message }, state: RootState) {
    const prefs = getPreferencesSnapshot();
    const users = state.rooms.rooms[roomId]?.users ?? {};
    const stored = state.rooms.messages[roomId]?.at(-1) ?? message;
    const filter = { roomHistory: prefs.roomHistory, ignoreUnregisteredUsers: prefs.ignoreUnregisteredUsers };
    if (!isRoomMessageVisible(stored, users, filter, chatFilterVerdicts)) {
      return;
    }
    const selfName = state.server.user?.name ?? null;
    if (message.messageType === Event_RoomSay_RoomMessageType.ChatHistory || !message.name || message.name === selfName) {
      return;
    }
    const alert = findChatAlert(message.message, {
      selfName,
      userNames: Object.keys(state.server.users),
      mentions: prefs.chatMention,
      highlightWords: parseHighlightWords(prefs.chatHighlightWords),
      senderIsModerator: isPrivilegedUser(users[message.name]),
    });
    if (!alert) {
      return;
    }
    requestAttention();
    if (alert === 'word') {
      return;
    }
    playSound(alert === 'mention' ? 'chat_mention' : 'all_mention');

    const onRoomPage = matchPath({ path: RouteEnum.ROOM, end: true }, pathnameRef.current)
      ?.params.roomId === String(roomId);
    const seen = onRoomPage && !isPageInactive();
    notify({
      entry: {
        kind: 'mention',
        actor: message.name,
        place: state.rooms.rooms[roomId]?.info.name,
        body: message.message,
        target: { type: 'room', roomId },
      },
      tag: `mention:${roomId}`,
      system: prefs.showMentionPopups && !seen,
      toast: prefs.showMentionPopups && !onRoomPage,
      read: seen,
    });
  }

  function announceGameReady(action: ObservedAction, before: GamesState, after: GamesState, system: boolean) {
    const ready = detectGameReady(action, before, after);
    if (!ready) {
      return;
    }
    const onGamePage = matchPath({ path: RouteEnum.GAME, end: true }, pathnameRef.current)
      ?.params.gameId === String(ready.gameId);
    notify({
      entry: {
        kind: 'game',
        place: ready.description,
        seats: { taken: ready.taken, max: ready.max },
        target: { type: 'game', gameId: ready.gameId },
      },
      tag: `game-ready:${ready.gameId}`,
      system,
      toast: !onGamePage,
      read: onGamePage && !isPageInactive(),
    });
  }

  function onUserJoined(name: string, before: RootState) {
    if (!before.server.buddyList[name]) {
      return;
    }
    playSound('buddy_join');
    const prefs = getPreferencesSnapshot();
    if (!prefs.notificationsEnabled || !prefs.buddyConnectNotificationsEnabled) {
      return;
    }
    requestAttention();
    notify({
      entry: { kind: 'buddy', actor: name, target: { type: 'chat', userName: name } },
      tag: `buddy:${name}`,
      system: true,
      toast: true,
    });
  }

  function onUserLeft(name: string, before: RootState) {
    if (before.server.buddyList[name]) {
      playSound('buddy_leave');
    }
  }

  return null;
}
