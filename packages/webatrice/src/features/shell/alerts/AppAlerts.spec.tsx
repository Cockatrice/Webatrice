import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { games, rooms, server } from '@cockatrice/datatrice';
import { makeGameEntry, makeGameInfo, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { Event_RoomSay_RoomMessageType, Event_RoomSaySchema } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, makeUser, renderWithProviders } from '../../../__test-utils__';
import { playSound } from '../../../hooks/playSound';
import { getSettings, settingsStore } from '../../../hooks/useSettings';
import { soundEngine } from '../../../services/sound/SoundEngine';
import { ATTENTION_MARKER } from '../../../services/notifications/NotificationService';
import type { Preferences } from '../../../types';
import AppAlerts from './AppAlerts';
import { notificationStore } from '../../../services/notifications/notificationStore';

vi.mock('../../../hooks/playSound');

const preloadedState = {
  ...connectedWithRoomsState,
  server: {
    ...connectedWithRoomsState.server!,
    buddyList: { alice: makeUser({ name: 'alice' }) },
    ignoreList: { pest: makeUser({ name: 'pest' }) },
  },
  games: {
    games: {
      1: makeGameEntry({
        info: makeGameInfo({ description: 'casual evening', maxPlayers: 2 }),
        localPlayerId: 1,
        players: { 1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1 }) }) },
      }),
    },
    pings: { 1: {} },
  },
};

const setPreferences = async (patch: Partial<Preferences>) => {
  const settings = await getSettings();
  Object.assign(settings, patch);
  settingsStore.setValue(settings);
};

const renderAlerts = (route = '/') => renderWithProviders(<AppAlerts />, { preloadedState, route });

const roomSay = (name: string, message: string, messageType = Event_RoomSay_RoomMessageType.UserMessage) =>
  rooms.Actions.roomSayReceived({
    roomId: 1,
    message: { ...create(Event_RoomSaySchema, { name, message, messageType }), timeReceived: 0 },
  });

describe('AppAlerts', () => {
  beforeEach(async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    document.title = 'Webatrice';
    notificationStore.reset();
    settingsStore.reset();
    await getSettings();
  });

  describe('game events', () => {
    it('plays the desktop sound for the event', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(games.Actions.activePhaseSet({ gameId: 1, phase: 4 }));
      });
      expect(playSound).toHaveBeenCalledWith('start_combat');
    });

    it('marks a hidden tab, unless tab notifications are off', async () => {
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      const { store } = renderAlerts();

      act(() => {
        store.dispatch(games.Actions.activePlayerSet({ gameId: 1, activePlayerId: 1 }));
      });
      expect(document.title).toBe(`${ATTENTION_MARKER}Webatrice`);

      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      hidden.mockReturnValue(true);
      await act(async () => {
        await setPreferences({ notificationsEnabled: false });
      });
      act(() => {
        store.dispatch(games.Actions.activePlayerSet({ gameId: 1, activePlayerId: 1 }));
      });
      expect(document.title).toBe('Webatrice');
    });

    it('announces your game is ready when the last seat fills, once', () => {
      const { store } = renderAlerts();
      const join = (playerId: number, spectator = false) => act(() => {
        store.dispatch(games.Actions.playerJoined({ gameId: 1, playerProperties: makePlayerProperties({ playerId, spectator }) }));
      });

      join(5, true);
      expect(notificationStore.getState().entries).toHaveLength(0);

      join(2);
      expect(notificationStore.getState().entries).toEqual([
        expect.objectContaining({ kind: 'game', place: 'casual evening', seats: { taken: 2, max: 2 } }),
      ]);
      expect(screen.getByRole('button', { name: 'Notifications.action.game' })).toBeInTheDocument();

      join(3, true);
      expect(notificationStore.getState().entries).toHaveLength(1);
    });
  });

  describe('room mentions', () => {
    it('plays the mention sound and toasts when you are elsewhere', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(roomSay('otherUser', 'hey @testUser, game?'));
      });

      expect(playSound).toHaveBeenCalledWith('chat_mention');
      expect(screen.getByText(/Notifications\.toastTitle/)).toBeInTheDocument();
      expect(notificationStore.getState().entries[0]).toMatchObject({ kind: 'mention', actor: 'otherUser', read: false });
    });

    it('only plays the sound while you are reading that room', () => {
      const { store } = renderAlerts('/room/1');
      act(() => {
        store.dispatch(roomSay('otherUser', 'hey @testUser'));
      });

      expect(playSound).toHaveBeenCalledWith('chat_mention');
      expect(screen.queryByText(/Notifications\.toastTitle/)).not.toBeInTheDocument();
      expect(notificationStore.getState().entries[0]).toMatchObject({ kind: 'mention', read: true });
    });

    it('stays quiet for history, your own lines and lines without a mention', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(roomSay('otherUser', 'hey @testUser', Event_RoomSay_RoomMessageType.ChatHistory));
        store.dispatch(roomSay('testUser', 'talking to myself @testUser'));
        store.dispatch(roomSay('otherUser', 'hello room'));
      });
      expect(playSound).not.toHaveBeenCalled();
    });

    it('raises nothing for an ignored sender, whose line Datatrice drops on arrival', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(roomSay('pest', 'hey @testUser'));
      });
      expect(playSound).not.toHaveBeenCalled();
      expect(screen.queryByText(/Notifications\.toastTitle/)).not.toBeInTheDocument();
    });

    it('raises nothing for the client’s own flood or not-sent notices', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(rooms.Actions.roomSayFailed({ roomId: 1, message: '@testUser hi', responseCode: 18, timeReceived: 1 }));
      });
      expect(playSound).not.toHaveBeenCalled();
      expect(screen.queryByText(/Notifications\.toastTitle/)).not.toBeInTheDocument();
    });

    it('respects the mention and popup preferences', async () => {
      await setPreferences({ showMentionPopups: false });
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(roomSay('otherUser', 'hey @testUser'));
      });
      expect(playSound).toHaveBeenCalledWith('chat_mention');
      expect(screen.queryByText(/Notifications\.toastTitle/)).not.toBeInTheDocument();

      vi.mocked(playSound).mockClear();
      await act(async () => {
        await setPreferences({ chatMention: false });
      });
      act(() => {
        store.dispatch(roomSay('otherUser', 'hey @testUser'));
      });
      expect(playSound).not.toHaveBeenCalled();
    });

    it('marks a hidden tab for an alert word, without a sound', async () => {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      await setPreferences({ chatHighlightWords: 'cube' });
      const { store } = renderAlerts();

      act(() => {
        store.dispatch(roomSay('otherUser', 'cube draft?'));
      });

      expect(document.title).toBe(`${ATTENTION_MARKER}Webatrice`);
      expect(playSound).not.toHaveBeenCalled();
    });
  });

  it('stops audio immediately when sound is disabled in settings', async () => {
    const stop = vi.spyOn(soundEngine, 'stop');
    await setPreferences({ soundEnabled: true });
    renderAlerts();
    await act(async () => {
      await setPreferences({ soundEnabled: false });
    });
    expect(stop).toHaveBeenCalled();
  });

  describe('buddies', () => {
    it('requires the parent notification preference for buddy popups', async () => {
      await setPreferences({ notificationsEnabled: false, buddyConnectNotificationsEnabled: true });
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(server.Actions.userJoined({ user: makeUser({ name: 'alice' }) }));
      });
      expect(playSound).toHaveBeenCalledWith('buddy_join');
      expect(screen.queryByText(/Notifications\.title\.buddy/)).not.toBeInTheDocument();
    });

    it('plays the buddy sounds and announces a buddy signing on', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(server.Actions.userJoined({ user: makeUser({ name: 'alice' }) }));
      });
      expect(playSound).toHaveBeenCalledWith('buddy_join');
      expect(screen.getByText(/Notifications\.title\.buddy/)).toBeInTheDocument();

      act(() => {
        store.dispatch(server.Actions.userLeft({ name: 'alice' }));
      });
      expect(playSound).toHaveBeenCalledWith('buddy_leave');
    });

    it('ignores users who are not buddies', () => {
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(server.Actions.userJoined({ user: makeUser({ name: 'stranger' }) }));
      });
      expect(playSound).not.toHaveBeenCalled();
      expect(screen.queryByText(/Notifications\.title\.buddy/)).not.toBeInTheDocument();
    });

    it('keeps the sound but skips the announcement when buddy notifications are off', async () => {
      await setPreferences({ buddyConnectNotificationsEnabled: false });
      const { store } = renderAlerts();
      act(() => {
        store.dispatch(server.Actions.userJoined({ user: makeUser({ name: 'alice' }) }));
      });
      expect(playSound).toHaveBeenCalledWith('buddy_join');
      expect(screen.queryByText(/Notifications\.title\.buddy/)).not.toBeInTheDocument();
    });
  });
});
