import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';
import { useActionFeed } from '../../../hooks/useActionFeed';
import { deckSummaryScope, invalidateDeckSummary } from '../deckSummaryCache';

export function useDeckSummaryInvalidation(): void {
  const client = useWebClient();
  useActionFeed((action, _before, state) => {
    const scope = deckSummaryScope(state, client);
    const payload = action.payload as { deckId?: number; treeItem?: ServerInfo_DeckStorage_TreeItem };
    const deckId = payload.deckId ?? payload.treeItem?.id;
    if (scope && deckId != null) {
      void invalidateDeckSummary(scope, deckId);
    }
  }, (action) => action.type === server.Types.DECK_UPDATED || action.type === server.Types.DECK_UPLOAD);
}
