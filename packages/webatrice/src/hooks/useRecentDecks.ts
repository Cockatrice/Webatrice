import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import {
  getRecentDecks,
  recentDeckScope,
  recentDeckSnapshot,
  recentDecksIn,
  recordRecentDeck,
  subscribeRecentDecks,
  type RecentDeck,
  type RecentDeckSource,
} from '@app/services';
import { useAppSelector } from '@app/store';

function useRecentDeckAccount(): { scope: string; owner: string } | null {
  const webClient = useWebClient();
  const connected = useAppSelector(server.Selectors.getIsConnected);
  const owner = useAppSelector(server.Selectors.getUser)?.name ?? null;
  const scope = connected ? recentDeckScope(webClient.socket?.connectedEndpoint) : null;
  return useMemo(() => (scope && owner ? { scope, owner } : null), [scope, owner]);
}

export function useRecentDecks(limit?: number): RecentDeck[] {
  const account = useRecentDeckAccount();
  const all = useSyncExternalStore(subscribeRecentDecks, getRecentDecks);
  return useMemo(() => {
    const mine = account ? recentDecksIn(all, account.scope, account.owner) : [];
    return limit == null ? mine : mine.slice(0, limit);
  }, [all, account, limit]);
}

export function useRecordRecentDeck(deckId: number | null, deck: RecentDeckSource | null | undefined): void {
  const account = useRecentDeckAccount();
  const snapshot = account && deckId != null && deck ? recentDeckSnapshot(account.scope, account.owner, deckId, deck, 0) : null;
  const key = snapshot ? JSON.stringify(snapshot) : null;
  useEffect(() => {
    if (key) {
      void recordRecentDeck({ ...(JSON.parse(key) as RecentDeck), openedAt: Date.now() });
    }
  }, [key]);
}
