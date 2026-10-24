import { serializeCod } from '@app/services';

import { plainDeckText } from './deckServices';
import type { DeckCard, HydratedDeck } from './types';

export type DeckExportFormat = 'plain' | 'arena' | 'cockatrice';

function exportSections(cards: DeckCard[]): Array<{ key: 'commander' | 'main' | 'side'; cards: DeckCard[] }> {
  return [
    { key: 'commander', cards: cards.filter((c) => c.isCommander) },
    { key: 'main', cards: cards.filter((c) => c.category === 'main' && !c.isCommander) },
    { key: 'side', cards: cards.filter((c) => c.category === 'sideboard') },
  ];
}

function writeSections(
  cards: DeckCard[],
  headers: Record<'commander' | 'main' | 'side', string>,
  line: (c: DeckCard) => string,
): string {
  const parts: string[] = [];
  for (const section of exportSections(cards)) {
    if (section.cards.length === 0) {
      continue;
    }
    if (parts.length > 0) {
      parts.push('');
    }
    parts.push(headers[section.key]);
    for (const c of section.cards) {
      parts.push(line(c));
    }
  }
  return parts.join('\n');
}

export function toPlainText(cards: DeckCard[]): string {
  return plainDeckText(cards, { sectionHeaders: true }).trimEnd();
}

export function toArenaText(cards: DeckCard[]): string {
  return writeSections(
    cards,
    { commander: 'Commander', main: 'Deck', side: 'Sideboard' },
    (c) => {
      const set = c.set ? c.set.toUpperCase() : '';
      const num = c.collectorNumber ?? '';
      if (set && num) {
        return `${c.quantity} ${c.name} (${set}) ${num}`;
      }
      return `${c.quantity} ${c.name}`;
    },
  );
}

export function exportDeck(deck: HydratedDeck, format: DeckExportFormat): string {
  switch (format) {
    case 'arena':
      return toArenaText(deck.cards);
    case 'cockatrice':
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
      });
    case 'plain':
    default:
      return toPlainText(deck.cards);
  }
}

export function exportFileName(deckName: string, extension: string): string {
  const slug = deckName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'deck';
  return `${slug}.${extension}`;
}
