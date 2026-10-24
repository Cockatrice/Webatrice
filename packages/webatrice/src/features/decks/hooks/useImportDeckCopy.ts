import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';
import { useReduxEffect, useRequestTracker } from '@app/hooks';
import { parseCod } from '@app/services';

export function useImportDeckCopy(onImported: (deckId: number) => void) {
  const webClient = useWebClient();
  const requests = useRequestTracker();

  useReduxEffect<{ path: string; treeItem: ServerInfo_DeckStorage_TreeItem; requestId?: string }>(({ payload }) => {
    const { treeItem, requestId } = payload;
    if (!requests.settle(requestId)) {
      return;
    }
    if (treeItem.id) {
      onImported(treeItem.id);
    }
  }, server.Types.DECK_UPLOAD, [requests, onImported]);

  useReduxEffect<{ requestId?: string }>(({ payload: { requestId } }) => {
    requests.settle(requestId);
  }, server.Types.DECK_UPLOAD_FAILED, [requests]);

  return (xml: string, colorIdentity?: string) => {
    try {
      parseCod(xml);
    } catch {
      return;
    }
    const requestId = requests.begin();
    requests.track(requestId);
    webClient.request.session.deckUpload('', 0, xml, undefined, colorIdentity || undefined, requestId);
  };
}
