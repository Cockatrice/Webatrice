import { serializeCod } from '@app/services';

import type { DeckCard, HydratedDeck } from './types';

export function serializeDeckForSave(deck: HydratedDeck): string {
  return serializeCod({
    name: deck.name,
    meta: deck.meta,
    cards: deck.cards,
    format: deck.format,
    bannerCard: deck.bannerCard,
    bannerCardProviderId: deck.bannerCardProviderId,
    lastLoadedTimestamp: deck.lastLoadedTimestamp,
    playmatXml: deck.playmatXml,
    sideboardPlansXml: deck.sideboardPlansXml,
    extraZonesXml: deck.extraZonesXml,
    tagsXml: deck.tagsXml,
    bracketAssessment: deck.bracketAssessment,
  });
}

const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;

export function deckColorIdentity(cards: readonly DeckCard[]): string {
  const colors = new Set<string>();
  for (const card of cards) {
    for (const color of card.colors ?? []) {
      colors.add(color.toUpperCase());
    }
  }
  return WUBRG.filter((c) => colors.has(c)).join('');
}

export function deckSaveSignature(deck: HydratedDeck): string {
  const { updatedAt: _stamp, ...meta } = deck.meta;
  return JSON.stringify({
    name: deck.name,
    meta,
    format: deck.format,
    bannerCard: deck.bannerCard ?? null,
    bannerCardProviderId: deck.bannerCardProviderId ?? null,
    lastLoadedTimestamp: deck.lastLoadedTimestamp ?? null,
    playmatXml: deck.playmatXml ?? null,
    sideboardPlansXml: deck.sideboardPlansXml ?? [],
    extraZonesXml: deck.extraZonesXml ?? [],
    tagsXml: deck.tagsXml ?? null,
    bracketAssessment: deck.bracketAssessment ?? null,
    cards: deck.cards.map((c) => [
      c.name,
      c.quantity,
      c.category,
      c.isCommander === true,
      c.set ?? '',
      c.collectorNumber ?? '',
      c.scryfallId ?? '',
      c.zonePath ?? [],
    ]),
  });
}
