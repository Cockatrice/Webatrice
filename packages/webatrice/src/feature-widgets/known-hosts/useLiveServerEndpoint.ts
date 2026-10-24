import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';
import { findLiveGameServer, type LiveGameServer } from '@app/utils';

import { useKnownHosts } from './useKnownHosts';

export function useLiveServerEndpoint(): LiveGameServer | null {
  const webClient = useWebClient();
  const connected = useAppSelector(server.Selectors.getIsConnected);
  const knownHosts = useKnownHosts();
  return connected
    ? findLiveGameServer(webClient.socket?.connectedEndpoint, knownHosts.value?.hosts ?? [])
    : null;
}
