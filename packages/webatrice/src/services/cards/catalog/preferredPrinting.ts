import type { LookupResult, PrintingSummary } from './types';

export function preferredPrinting(card: Pick<LookupResult, 'printings' | 'pinnedPrintingId'>): PrintingSummary | undefined {
  return card.pinnedPrintingId
    ? card.printings.find((printing) => printing.scryfallId === card.pinnedPrintingId)
    : card.printings[0];
}
