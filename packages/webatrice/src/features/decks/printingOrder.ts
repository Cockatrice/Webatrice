import type { PrintingSummary } from '@app/services';

import type { DeckCard } from './types';

const samePrinting = (printing: PrintingSummary, card: DeckCard) =>
  printing.scryfallId && card.scryfallId
    ? printing.scryfallId === card.scryfallId
    : !!printing.set && printing.set === card.set && printing.collectorNumber === card.collectorNumber;

export function bumpPrintingsInDeck(
  printings: readonly PrintingSummary[],
  cardName: string,
  deckCards: readonly DeckCard[],
): PrintingSummary[] {
  const copies = new Map<PrintingSummary, number>();
  for (const printing of printings) {
    const count = deckCards
      .filter((card) => card.category === 'main' && card.name === cardName && samePrinting(printing, card))
      .reduce((sum, card) => sum + card.quantity, 0);
    if (count > 0) {
      copies.set(printing, count);
    }
  }
  const inDeck = [...copies.keys()].sort((a, b) => copies.get(b)! - copies.get(a)!);
  return [...inDeck, ...printings.filter((printing) => !copies.has(printing))];
}
