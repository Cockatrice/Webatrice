import { ScryfallImageSize } from '@cockatrice/datatrice';

import { getScryfallUrlByIdOrExactName } from '@app/services';

import type { SeatDeckCard } from './playerBoard.types';

export function deckCardImageUrl(card: Pick<SeatDeckCard, 'scryfallId' | 'name'>): string {
  return getScryfallUrlByIdOrExactName(card, ScryfallImageSize.Large);
}
