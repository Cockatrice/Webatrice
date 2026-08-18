import type { DeckCard, DeckCategory } from './components/PlayerBox/mockTypes';
import type { ParsedDeck } from '../decks/types';

/**
 * Dev-tool: when the local player picks a deck in the game lobby, we
 * stash its cards here so the game screen's PlayerBoxes can seed
 * their still-local libraries from it instead of the hard-coded
 * placeholder deck.
 *
 * localStorage-backed so a hard refresh mid-game keeps the same cards
 * (dev tools reload the page often). Cleared automatically on the next
 * pick — no explicit reset needed.
 *
 * This whole file goes away once the PlayerBox is wired to og's
 * Cockatrice deck-download flow proper.
 */

const STORAGE_KEY = 'webatrice.mockDeckCards';

export function setPickedMockDeck(cards: DeckCard[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // storage disabled or quota exceeded — silently drop; the current
    // session's picks still work through the in-memory path in
    // GameLobby.
  }
}

export function getPickedMockDeck(): DeckCard[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as DeckCard[];
  } catch {
    return null;
  }
}

/**
 * Convert the raw ParsedDeck coming out of `parseCod` into the mock
 * `DeckCard[]` shape PlayerBox reads. Missing metadata (mana cost,
 * type line, colors, P/T) is nulled — PlayerBox uses `card_scryfall_id`
 * (or falls back to name-lookup) to fetch card art, so those extra
 * fields are only needed if we later light up features like library
 * search sort/group modes.
 */
export function parsedDeckToMockCards(parsed: ParsedDeck): DeckCard[] {
  return parsed.cards.map((c, i) => ({
    id: `card-${i}-${c.name}`,
    card_scryfall_id: c.scryfallId ?? '',
    name: c.name,
    mana_cost: null,
    type_line: null,
    cmc: null,
    colors: [],
    set: c.set ?? null,
    collector_number: c.collectorNumber ?? null,
    power: null,
    toughness: null,
    quantity: c.quantity,
    category: c.category as DeckCategory,
  }));
}
