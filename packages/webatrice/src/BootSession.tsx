import { useLayoutEffect, type ReactNode } from 'react';
import { useStore } from 'react-redux';
import type { Store } from '@reduxjs/toolkit';
import { rooms, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { WebClient } from '@cockatrice/sockatrice';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import type { ServerInfo_Room } from '@cockatrice/sockatrice/generated';
import type { RootState } from '@app/store';
import { getHostKey, getHostPort } from '@app/utils';
import { getSettings, settingsStore } from './hooks/useSettings';
import { getKnownHosts, knownHostsStore, updateKnownHost } from './feature-widgets/known-hosts/useKnownHosts';
import { loginAttempt } from './features/login/loginAttempt';
import { persistLoginCredentials } from './features/login/persistLoginCredentials';
import { captureHomeSnapshot } from './features/server/homeSnapshot';
import { autoLoginGate } from './services/session/autoLoginGate';
import { clearHomeSnapshot, homePreview, loadHomeSnapshot, saveHomeSnapshot } from './services/storage/homeSnapshot';

export const prepareBootSession = () => Promise.all([getSettings(), getKnownHosts()]);
type Preparation = ReturnType<typeof prepareBootSession>;

export function observeHomeSession(store: Store<RootState>, client: WebClient): () => void {
  let roomsReady = false;
  let usersReady = false;
  const pendingRooms = new Set<number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = store.getState();
  let persistenceRevision = homePreview.revision;

  const ready = (state: RootState) => roomsReady && usersReady && server.Selectors.getIsConnected(state)
    && pendingRooms.size === 0;

  const persist = () => {
    clearTimeout(timer);
    timer = undefined;
    const settings = settingsStore.peek();
    const host = knownHostsStore.peek()?.selectedHost;
    const state = store.getState();
    const endpoint = client.socket?.connectedEndpoint;
    if (persistenceRevision !== homePreview.revision
      || !settings?.autoConnect || !host?.remember || !host.hashedPassword || !endpoint
      || host.userName !== server.Selectors.getUser(state)?.name || !ready(state)) {
      return;
    }
    try {
      const live = new URL(endpoint);
      const address = host.host.includes('/') ? host.host : `${host.host}:${host.port}`;
      if (new URL(`${live.protocol}//${address}`).href !== live.href) {
        return;
      }
    } catch {
      return;
    }
    const snapshot = captureHomeSnapshot(state, getHostKey(host), settings.startupRoom);
    if (snapshot) {
      saveHomeSnapshot(snapshot);
    }
  };

  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    const action = state.action;
    if (action.type === server.Types.DISCONNECTED || action.type === server.Types.LOGIN_FAILED
      || action.type === server.Types.CONNECTION_FAILED || action.type === server.Actions.connectUnreachable.type) {
      roomsReady = usersReady = false;
      pendingRooms.clear();
      clearTimeout(timer);
      timer = undefined;
      homePreview.set(null);
      autoLoginGate.inFlight = false;
      loginAttempt.failed();
    } else if (action.type === server.Types.LOGIN_SUCCESSFUL) {
      persistenceRevision = homePreview.revision;
      roomsReady = usersReady = false;
      pendingRooms.clear();
      if (autoLoginGate.inFlight && autoLoginGate.source === 'boot') {
        const host = knownHostsStore.peek()?.selectedHost;
        const { options } = action.payload as { options: WebsocketTypes.LoginSuccessContext };
        if (host && autoLoginGate.target === getHostKey(host)
          && host.userName === server.Selectors.getUser(state)?.name) {
          void persistLoginCredentials(options.hashedPassword, {
            selectedHost: host, remember: true, userName: host.userName,
          }, updateKnownHost)?.catch(() => undefined);
        }
        loginAttempt.succeeded();
      }
    } else if (action.type === rooms.Types.UPDATE_ROOMS) {
      roomsReady = true;
      if (client.clientOptions.autojoinrooms) {
        for (const room of (action.payload as { rooms: ServerInfo_Room[] }).rooms) {
          if (room.autoJoin && !rooms.Selectors.getJoinedRoomIds(state)[room.roomId]) {
            pendingRooms.add(room.roomId);
          }
        }
      }
    } else if (action.type === server.Types.UPDATE_USERS) {
      usersReady = true;
    } else if (action.type === rooms.Types.JOIN_ROOM_FAILED) {
      pendingRooms.delete((action.payload as { roomId: number }).roomId);
    } else if (action.type === rooms.Types.JOIN_ROOM) {
      pendingRooms.delete((action.payload as { roomInfo: ServerInfo_Room }).roomInfo.roomId);
    }
    if (server.Selectors.getIsConnected(state)) {
      autoLoginGate.inFlight = false;
    }
    if (ready(state)) {
      homePreview.set(null);
      if (!timer && (state.rooms !== previous.rooms || state.server.users !== previous.server.users
        || state.server.buddyList !== previous.server.buddyList || state.server.info !== previous.server.info)) {
        timer = setTimeout(persist, 250);
      }
    }
    previous = state;
  });

  const settingsChanged = () => {
    if (settingsStore.peek()?.autoConnect === false) {
      clearHomeSnapshot();
    }
  };
  const unsubscribeSettings = settingsStore.subscribe(settingsChanged);
  const unsubscribeHosts = knownHostsStore.subscribe(() => {
    const snapshot = homePreview.get();
    const host = knownHostsStore.peek()?.selectedHost;
    if (snapshot && (!host?.remember || !host.hashedPassword
      || snapshot.host !== getHostKey(host) || snapshot.userName !== host.userName)) {
      homePreview.set(null);
    }
  });
  window.addEventListener('pagehide', persist);
  return () => {
    clearTimeout(timer);
    unsubscribe();
    unsubscribeSettings();
    unsubscribeHosts();
    window.removeEventListener('pagehide', persist);
  };
}

export default function BootSession({ preparation, children }: { preparation: Preparation; children: ReactNode }) {
  const client = useWebClient();
  const store = useStore<RootState>();
  useLayoutEffect(() => {
    let cancelled = false;
    const unsubscribe = observeHomeSession(store, client);
    void preparation.then(([settings, hosts]) => {
      if (cancelled) {
        return;
      }
      const host = hosts.selectedHost;
      if (!autoLoginGate.hasChecked && !server.Selectors.getConnectionAttemptMade(store.getState())) {
        autoLoginGate.hasChecked = true;
        if (!settings.autoConnect) {
          clearHomeSnapshot();
        } else if (host?.remember && host.hashedPassword && host.userName) {
          homePreview.set(loadHomeSnapshot(getHostKey(host), host.userName));
          autoLoginGate.inFlight = true;
          autoLoginGate.source = 'boot';
          autoLoginGate.target = getHostKey(host);
          loginAttempt.started(getHostKey(host));
          client.request.authentication.login({
            ...getHostPort(host), userName: host.userName, password: '', hashedPassword: host.hashedPassword,
          });
        }
      }
    }).catch(() => {
      if (!cancelled && autoLoginGate.source === 'boot') {
        autoLoginGate.inFlight = false;
        homePreview.set(null);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, preparation, store]);
  return children;
}
