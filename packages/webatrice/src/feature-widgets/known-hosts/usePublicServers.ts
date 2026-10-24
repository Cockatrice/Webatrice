import { useSyncExternalStore } from 'react';

import { createSharedStore, LoadingState, type Loadable } from '@app/hooks';
import { isWebSocketReachable, loadPublicServers, SECURE_WEBSOCKET_PORT, type PublicServer, type PublicServerList } from '@app/services';
import type { Host } from '@app/types';

export const publicServersStore = createSharedStore<PublicServerList>(loadPublicServers);

const IDLE: Loadable<PublicServerList> = { status: LoadingState.LOADING };
const noopSubscribe = () => () => undefined;

const hostName = (host: string): string => host.split('/')[0].toLowerCase();

export interface PublicServerOption {
  server: PublicServer;
  unavailableReason: 'noWebSocket' | 'noSecureWebSocket' | null;
}

export function publicServerOptions(servers: PublicServer[], savedHosts: Pick<Host, 'host'>[]): PublicServerOption[] {
  const saved = new Set(savedHosts.map((h) => hostName(h.host)));
  return servers
    .filter((server) => !server.isInactive && !saved.has(hostName(server.host)))
    .map((server) => ({ server, unavailableReason: unavailableReason(server) }));
}

function unavailableReason(server: PublicServer): PublicServerOption['unavailableReason'] {
  if (server.websocketPort === undefined) {
    return 'noWebSocket';
  }
  return isWebSocketReachable(server) ? null : 'noSecureWebSocket';
}

export const toSavedHost = ({ name, host, websocketPort }: PublicServer): Host => ({
  name,
  host: `${host}/servatrice`,
  port: websocketPort ?? SECURE_WEBSOCKET_PORT,
  editable: true,
});

export function refreshPublicServers(): void {
  publicServersStore.reset();
  publicServersStore.whenReady().catch(() => undefined);
}

export function usePublicServers(enabled: boolean): Loadable<PublicServerList> {
  return useSyncExternalStore(
    enabled ? publicServersStore.subscribe : noopSubscribe,
    enabled ? publicServersStore.getSnapshot : () => IDLE,
  );
}
