export { default as Decks } from './Decks';
export { clearDecksListCache } from './hooks/useDeckList';
export { default as DeckEditor } from './DeckEditor';
export { default as SharedDeck } from './SharedDeck';
export { default as PublicDecks } from './PublicDecks';
export { DeckShareLinkRedirect } from './components/DeckShareLinkRedirect';
export { clearDeckEditorCache } from './deckEditorCache';
export { clearBracketSourceCaches } from './bracketSources';
export { writeBracketLookupsMode } from './bracketConsent';

// --- Data layer (Piece 1: foundation for MyDecks feature) ---
// The Cockatrice deck document codec and its types are root owners
// (`services/decks`, `types/cockatriceDeck`); only hydrated editor shapes live here.
export type { DeckCard, HydratedDeck } from './types';

export { hydrateDeck, loadDeckFromCod, assembleDeckCard } from './hydrate';
