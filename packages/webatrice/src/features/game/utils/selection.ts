import type { CardLocation } from '@cockatrice/sockatrice';
import { GameEntry } from '@cockatrice/datatrice';

import { makeCardKey, parseCardKey } from './CardRegistry/CardRegistryContext';

// Shared default so containers don't each allocate a per-render empty Set.
export const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

// A selected card is a card located in a zone — the protocol-level CardLocation
// the sockatrice bulk commands consume. Aliased here to keep the UI vocabulary.
export type SelectedCard = CardLocation;

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

// The set a card interaction acts on: the multi-selection when `card` is part of
// a ≥2 selection, otherwise just `card`. Always ≥1 element, so callers feed it
// straight to a bulk dispatcher (single = the n=1 case) with no single/bulk fork.
export function effectiveTargets(
  selectedCards: readonly SelectedCard[],
  card: SelectedCard,
): readonly SelectedCard[] {
  const bulk = bulkTargetsFor(selectedCards, selectionKeyOf(card));
  return bulk.length ? bulk : [card];
}
