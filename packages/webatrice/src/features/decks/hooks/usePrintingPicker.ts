import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCardOverride, usePreference } from '@app/hooks';

import { bumpPrintingsInDeck } from '../printingOrder';
import type { DeckCard } from '../types';
import { useCardPrintings } from './useCardPrintings';

export function usePrintingPicker(card: DeckCard | undefined, deckCards: readonly DeckCard[]) {
  const loaded = useCardPrintings(card?.name);
  const { t } = useTranslation();
  const { pinnedPrintingId, savingPin, togglePin } = useCardOverride(loaded.canonicalName ?? card?.name);
  const [pinError, setPinError] = useState<string | null>(null);
  const bumpSetsInDeck = usePreference('bumpSetsWithCardsInDeckToTop');
  const ordered = bumpSetsInDeck && card
    ? bumpPrintingsInDeck(loaded.printings, card.name, deckCards) : loaded.printings;
  const printings = pinnedPrintingId
    ? [...ordered.filter((printing) => printing.scryfallId === pinnedPrintingId),
      ...ordered.filter((printing) => printing.scryfallId !== pinnedPrintingId)]
    : ordered;
  const pin = (id: string) => {
    setPinError(null);
    void togglePin(id).catch(() => setPinError(t('PrintingPicker.pinFailed')));
  };
  return { ...loaded, printings, pinnedPrintingId, savingPin, pin, pinError };
}
