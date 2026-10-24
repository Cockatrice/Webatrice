import { useMemo } from 'react';
import { sortIndicesByName, type DeckCardGroup } from '../deckGrouping';
import type { DeckCard } from '../types';

const SECTIONS = ['Commander', 'Main', 'Sideboard'] as const;

export function useProvisionalDeckGroups(cards: DeckCard[]): DeckCardGroup[] {
  return useMemo(() => SECTIONS.map((label) => {
    const indices = cards.flatMap((card, index) => {
      const section = card.isCommander ? 'Commander' : card.category === 'sideboard' ? 'Sideboard' : 'Main';
      return section === label ? [index] : [];
    });
    return { label, indices: sortIndicesByName(cards, indices) };
  }).filter(({ indices }) => indices.length > 0), [cards]);
}
