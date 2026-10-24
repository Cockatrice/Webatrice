import { useCallback, useRef } from 'react';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useReduxEffect } from '@app/hooks';

import { saveTextFile } from '../browserHandoff';
import { exportFileName } from '../deckExport';
import type { FlatDeck } from '../deckTree';

export function deckFileName(deck: FlatDeck, fromFolder: string): string {
  let relative = deck.path;
  if (deck.path === fromFolder) {
    relative = '';
  } else if (fromFolder && deck.path.startsWith(`${fromFolder}/`)) {
    relative = deck.path.slice(fromFolder.length + 1);
  }
  const folders = relative.split('/').filter(Boolean);
  return exportFileName([...folders, deck.name].join(' '), 'cod');
}

export function useDeckFileDownloads(): { download: (decks: readonly FlatDeck[], fromFolder?: string) => void } {
  const webClient = useWebClient();
  const pendingRef = useRef<Map<number, string>>(new Map());

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      const fileName = pendingRef.current.get(payload.deckId);
      if (fileName === undefined) {
        return;
      }
      pendingRef.current.delete(payload.deckId);
      saveTextFile(fileName, payload.deck, 'application/xml');
    },
    server.Types.DECK_DOWNLOADED,
    [],
  );

  const download = useCallback((decks: readonly FlatDeck[], fromFolder = '') => {
    for (const deck of decks) {
      pendingRef.current.set(deck.id, deckFileName(deck, fromFolder));
      webClient.request.session.deckDownload(deck.id);
    }
  }, [webClient]);

  return { download };
}
