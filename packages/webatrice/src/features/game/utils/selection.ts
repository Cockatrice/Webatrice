import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { GameEntry } from '@cockatrice/datatrice';

import { makeCardKey, parseCardKey } from './CardRegistry/CardRegistryContext';

// Shared default so containers don't each allocate a per-render empty Set.
export const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

export interface SelectedCard {
  ownerPlayerId: number;
  zone: string;
  card: ServerInfo_Card;
}

const EMPTY_SELECTED_CARDS: readonly SelectedCard[] = [];

export function selectionKeyOf(c: SelectedCard): string {
  return makeCardKey(c.ownerPlayerId, c.zone, c.card.id);
}

// Keys whose card no longer exists (moved/removed since selection) are dropped.
export function resolveSelectedCards(
  game: GameEntry,
  keys: ReadonlySet<string>,
): SelectedCard[] {
  const out: SelectedCard[] = [];
  keys.forEach((key) => {
    const parsed = parseCardKey(key);
    if (!parsed) {
      return;
    }
    const card = game.players[parsed.playerId]?.zones[parsed.zone]?.byId[parsed.cardId];
    if (card) {
      out.push({ ownerPlayerId: parsed.playerId, zone: parsed.zone, card });
    }
  });
  return out;
}

// An interaction on `key` acts on the whole selection only when that card is
// part of a multi-selection (≥2). Otherwise it acts on the single card, so this
// returns an empty set and callers fall back to their single-card path.
export function bulkTargetsFor(
  selectedCards: readonly SelectedCard[],
  key: string,
): readonly SelectedCard[] {
  if (selectedCards.length > 1 && selectedCards.some((c) => selectionKeyOf(c) === key)) {
    return selectedCards;
  }
  return EMPTY_SELECTED_CARDS;
}
