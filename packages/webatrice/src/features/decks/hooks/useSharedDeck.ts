import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import type { SessionCommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { Response_DeckShareList, ServerInfo_DeckShareItem } from '@cockatrice/sockatrice/generated';
import { useCommandFailureMessage, useReduxEffect } from '@app/hooks';
import { parseCod } from '@app/services';
import { useAppSelector } from '@app/store';
import type { ParsedDeck } from '@app/types';

export interface OpenedDeck {
  id: number;
  xml: string;
  deck: ParsedDeck;
}

export type OpenDeckState =
  | { status: 'idle' }
  | { status: 'loading'; id: number }
  | { status: 'open'; opened: OpenedDeck }
  | { status: 'failed'; id: number; message: string };

function readDeck(xml: string): ParsedDeck | null {
  try {
    return parseCod(xml);
  } catch {
    return null;
  }
}

export type SharedDeckListing =
  | { status: 'loading' }
  | { status: 'loaded'; name: string; expiresAt: bigint; items: ServerInfo_DeckShareItem[] }
  | { status: 'failed'; message: string };

export function useSharedDeck(token: string | null) {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const [listing, setListing] = useState<SharedDeckListing>({ status: 'loading' });
  const [open, setOpen] = useState<OpenDeckState>({ status: 'idle' });
  const requestedItemRef = useRef<number | null>(null);
  const inFlightRef = useRef<{ token: string; itemId: number } | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

  const finishDownload = (replyToken: string, itemId?: number): number | null => {
    const request = inFlightRef.current;
    if (!request || request.token !== replyToken || (itemId !== undefined && request.itemId !== itemId)) {
      return null;
    }
    inFlightRef.current = null;
    setDownloadPending(false);
    const wanted = requestedItemRef.current === request.itemId && replyToken === token;
    requestedItemRef.current = null;
    return wanted ? request.itemId : null;
  };

  useEffect(() => {
    requestedItemRef.current = null;
    setOpen({ status: 'idle' });
    if (!isConnected) {
      inFlightRef.current = null;
      setDownloadPending(false);
    }
    if (token && isConnected) {
      setListing({ status: 'loading' });
      setOpen({ status: 'idle' });
      webClient.request.session.deckShareList(token);
    }
  }, [token, isConnected, webClient]);

  useReduxEffect<{ token: string; share: Response_DeckShareList }>(({ payload }) => {
    if (payload.token !== token) {
      return;
    }
    const { name, expiresAt, items } = payload.share;
    setListing(items.length === 0
      ? { status: 'failed', message: t('SharedDeck.empty') }
      : { status: 'loaded', name, expiresAt, items });
  }, server.Types.DECK_SHARE_LISTED, [token, t]);

  useReduxEffect<{ token: string; itemId: number; deck: string }>(({ payload }) => {
    if (finishDownload(payload.token, payload.itemId) === null) {
      return;
    }
    const deck = payload.deck ? readDeck(payload.deck) : null;
    setOpen(deck
      ? { status: 'open', opened: { id: payload.itemId, xml: payload.deck, deck } }
      : { status: 'failed', id: payload.itemId, message: t(payload.deck ? 'SharedDeck.unreadable' : 'SharedDeck.empty') });
  }, server.Types.DECK_SHARE_DOWNLOADED, [token, t]);

  useReduxEffect<SessionCommandFailedPayload>(({ payload: { command, target, failure } }) => {
    if (command === 'deckShareList' && target === token) {
      setListing({ status: 'failed', message: describeFailure(failure, t('SharedDeck.notFound')) });
    } else if (command === 'deckShareDownload') {
      const id = finishDownload(target);
      if (id === null) {
        return;
      }
      setOpen({ status: 'failed', id, message: describeFailure(failure, t('SharedDeck.downloadFailed')) });
    }
  }, server.Types.SESSION_COMMAND_FAILED, [token, describeFailure, t]);

  const openItem = (itemId: number) => {
    if (!token || !isConnected || inFlightRef.current) {
      return;
    }
    inFlightRef.current = { token, itemId };
    setDownloadPending(true);
    requestedItemRef.current = itemId;
    setOpen({ status: 'loading', id: itemId });
    webClient.request.session.deckShareDownload(token, itemId);
  };

  return {
    listing, open, openItem, downloadPending,
    close: () => {
      requestedItemRef.current = null;
      setOpen({ status: 'idle' });
    },
  };
}

export function usePublicDecks(userName: string) {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const deckList = useAppSelector((state) => server.Selectors.getPublicDecks(state, userName));
  const [listError, setListError] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenDeckState>({ status: 'idle' });
  const requestedRef = useRef<number | null>(null);

  const refresh = () => {
    if (!isConnected || !userName) {
      return;
    }
    setListError(null);
    webClient.request.session.deckListOtherUser(userName);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the user or the connection changes
  }, [userName, isConnected]);

  useReduxEffect<{ deckId: number; deck: string }>(({ payload }) => {
    if (payload.deckId !== requestedRef.current) {
      return;
    }
    const deck = readDeck(payload.deck);
    setOpen(deck
      ? { status: 'open', opened: { id: payload.deckId, xml: payload.deck, deck } }
      : { status: 'failed', id: payload.deckId, message: t('PublicDecks.unreadable') });
  }, server.Types.PUBLIC_DECK_DOWNLOADED, [t]);

  useReduxEffect<SessionCommandFailedPayload>(({ payload: { command, target, responseCode, failure } }) => {
    if (command === 'deckListOtherUser' && target === userName) {
      setListError(describeFailure(failure, t('PublicDecks.listFailed', { code: responseCode })));
    } else if (command === 'deckDownloadPublic' && Number(target) === requestedRef.current) {
      setOpen({
        status: 'failed',
        id: Number(target),
        message: describeFailure(failure, t('PublicDecks.openFailed', { code: responseCode })),
      });
    }
  }, server.Types.SESSION_COMMAND_FAILED, [userName, describeFailure, t]);

  const openDeck = (deckId: number) => {
    requestedRef.current = deckId;
    setOpen({ status: 'loading', id: deckId });
    webClient.request.session.deckDownloadPublic(deckId);
  };

  return {
    root: deckList?.root,
    loading: !deckList && !listError,
    listError,
    refresh,
    open,
    openDeck,
    close: () => setOpen({ status: 'idle' }),
  };
}
