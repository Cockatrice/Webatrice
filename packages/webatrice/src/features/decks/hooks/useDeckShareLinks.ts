import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import type { SessionCommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useCommandFailureMessage, useReduxEffect } from '@app/hooks';
import { useAppSelector } from '@app/store';

export function useDeckShareLinks(active: boolean) {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const shares = useAppSelector(server.Selectors.getDeckSharesMine);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const settle = () => {
    pendingRef.current = null;
    setPending(null);
  };

  useReduxEffect<{ shareId: number }>(({ payload: { shareId } }) => {
    if (shareId === pendingRef.current) {
      settle();
    }
  }, server.Types.DECK_SHARE_REMOVED, []);

  const refresh = () => {
    setError(null);
    webClient.request.session.deckShareListMine();
  };

  useEffect(() => {
    if (active) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list again each time the view opens
  }, [active]);

  useReduxEffect<SessionCommandFailedPayload>(({ payload: { command, responseCode, failure, target } }) => {
    if (command === 'deckShareListMine') {
      setError(describeFailure(failure, t('DeckShareLinks.listFailed', { code: responseCode })));
    } else if (command === 'deckShareRemove' && target === String(pendingRef.current)) {
      settle();
      setError(describeFailure(failure, t('DeckShareLinks.revokeFailed', { code: responseCode })));
    }
  }, server.Types.SESSION_COMMAND_FAILED, [describeFailure, t]);

  const revoke = (shareId: number) => {
    if (pendingRef.current !== null) {
      return;
    }
    pendingRef.current = shareId;
    setPending(shareId);
    setError(null);
    webClient.request.session.deckShareRemove(shareId);
  };

  return { shares, error, refresh, revoke, pending: pending !== null };
}
