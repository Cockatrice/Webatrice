import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { captureDeckShareLink, takePendingDeckShareLink } from '../deckSharing';

export function DeckShareLinkRedirect() {
  const navigate = useNavigate();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  useState(captureDeckShareLink);

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    const query = takePendingDeckShareLink();
    if (query !== null) {
      navigate({ pathname: RouteEnum.SHARED_DECK, search: `?${query}` });
    }
  }, [isConnected, navigate]);

  return null;
}
