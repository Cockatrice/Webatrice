import { primaryType, type DeckCard } from './types';

export const DECK_SECTION_ORDER = [
  'Commander',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Other',
  'Sideboard',
] as const;

export type DeckSection = typeof DECK_SECTION_ORDER[number];

export interface DeckCardGroup {
  label: DeckSection | 'Main';
  indices: number[];
}

export function deckSectionOf(card: DeckCard, isCommanderDeck: boolean): DeckSection {
  if (isCommanderDeck && card.isCommander) {
    return 'Commander';
  }
  if (card.category === 'sideboard') {
    return 'Sideboard';
  }
  return primaryType(card.typeLine);
}

export function sortIndicesByName(cards: DeckCard[], indices: number[]): number[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  return indices.sort((a, b) =>
    collator.compare(cards[a].name, cards[b].name),
  );
}

export function groupDeckCards(cards: DeckCard[], isCommanderDeck: boolean): DeckCardGroup[] {
  const map = new Map<DeckSection, number[]>();
  cards.forEach((card, index) => {
    const label = deckSectionOf(card, isCommanderDeck);
    const bucket = map.get(label) ?? [];
    bucket.push(index);
    map.set(label, bucket);
  });
  return DECK_SECTION_ORDER
    .map((label) => ({ label, indices: sortIndicesByName(cards, map.get(label) ?? []) }))
    .filter((g) => g.indices.length > 0);
}

export function countDeckCards(cards: DeckCard[] | undefined): {
  totalMainboardCount: number;
  totalSideboardCount: number;
} {
  let main = 0;
  let side = 0;
  for (const c of cards ?? []) {
    if (c.category === 'sideboard') {
      side += c.quantity;
    } else {
      main += c.quantity;
    }
  }
  return { totalMainboardCount: main, totalSideboardCount: side };
}
