export { default as Decks, clearDecksListCache } from './Decks';
export { default as DeckEditor } from './DeckEditor';
export { clearDeckEditorCache } from './useDeckEditor';

// --- Data layer (Piece 1: foundation for MyDecks feature) ---
export type {
  DeckCard,
  DeckCategory,
  DeckMeta,
  HydratedDeck,
  ParsedCard,
  ParsedDeck,
} from './types';

export { parseCod, serializeCod, emptyCod } from './cod';
export { defaultMeta, parseMeta, serializeMeta, touchMeta } from './meta';
export {
  lookupCard,
  lookupCards,
  type LookupResult,
  type PrintingSummary,
} from './cardLookup';
export { hydrateDeck, loadDeckFromCod, assembleDeckCard } from './hydrate';
