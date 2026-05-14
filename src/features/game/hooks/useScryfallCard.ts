import { useMemo } from 'react';
import { ScryfallImageSize } from '@cockatrice/datatrice';
import { getScryfallUrl } from '@app/services';

export interface ScryfallCard {
  smallUrl: string | null;
  normalUrl: string | null;
  ready: boolean;
}

interface CardLike {
  providerId?: string;
  name?: string;
}

export function useScryfallCard(card: CardLike | null | undefined): ScryfallCard {
  return useMemo<ScryfallCard>(() => {
    if (!card) {
      return { smallUrl: null, normalUrl: null, ready: false };
    }
    const smallUrl = getScryfallUrl(card, ScryfallImageSize.Small);
    const normalUrl = getScryfallUrl(card, ScryfallImageSize.Normal);
    return {
      smallUrl,
      normalUrl,
      ready: smallUrl != null,
    };
  }, [card?.providerId, card?.name]);
}
