import { useCallback, useEffect, useMemo } from 'react';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_DeckStorage_Folder } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';

export interface BackendDeck { id: number; name: string }

export function flattenBackendDecks(folder: ServerInfo_DeckStorage_Folder | undefined): BackendDeck[] {
  return (folder?.items ?? []).flatMap(item => item.file
    ? [{ id: item.id, name: item.name }]
    : item.folder ? flattenBackendDecks(item.folder) : []);
}

export function useBackendDeckList({ beforeRequest }: { beforeRequest?: () => void } = {}) {
  const client = useWebClient();
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const refresh = useCallback(() => {
    if (!isConnected) {
      return;
    }
    beforeRequest?.();
    client.request.session.deckList();
  }, [client, isConnected, beforeRequest]);
  useEffect(() => {
    if (!backendDecks) {
      refresh();
    }
  }, [backendDecks, refresh]);
  const decks = useMemo(() => flattenBackendDecks(backendDecks?.root), [backendDecks]);
  return { backendDecks, isConnected, decks, loading: !backendDecks, refresh };
}
