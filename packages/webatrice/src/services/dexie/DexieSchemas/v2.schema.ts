import Dexie from 'dexie';

export enum Stores {
  SETTINGS = 'settings',
  CARDS = 'cards',
  SETS = 'sets',
  TOKENS = 'tokens',
  HOSTS = 'hosts',
  FORMATS = 'formats',
  INFO = 'info',
  // Scryfall-shaped read-through cache for `lookupCard`. Kept in a
  // dedicated table (rather than folded into `cards`) because the
  // `cards` table is Cockatrice-XML-shaped and squeezing Scryfall
  // records in is lossy — see the note in
  // services/cards/catalog/lookup.ts (header comment). This is the "dedicated
  // deckCardCache table" that same note anticipated. Also stores
  // related-card/token refs (from Scryfall `all_parts`) that back
  // the card context menu's "Token: …" items.
  SCRYFALL_CACHE = 'scryfallCache',
  REPLAYS = 'replays',
  REPLAY_DATA = 'replayData',
  CARD_SOURCES = 'cardSources',
  CARD_SOURCE_PAYLOADS = 'cardSourcePayloads',
  SET_PREFERENCES = 'setPreferences',
  CARD_DATA_SETTINGS = 'cardDataSettings',
}

export const schemaV2 = (db: Dexie) => {
  db.version(2).stores({
    [Stores.CARDS]: null,
    [Stores.SETS]: null,
  });

  db.version(3).stores({
    [Stores.CARDS]: 'name.value',
    [Stores.SETS]: 'name.value',
    [Stores.FORMATS]: 'formatName',
    [Stores.INFO]: 'id',
  });

  // Version 4 adds the Scryfall cache table. Keyed by the exact
  // Scryfall card name (case-sensitive, as returned by
  // /cards/named). Lookups against user-typed names normalize case
  // at the query layer.
  db.version(4).stores({
    [Stores.SCRYFALL_CACHE]: 'name',
  });

  db.version(5).stores({
    [Stores.REPLAYS]: '++id, parentId',
    [Stores.REPLAY_DATA]: 'id',
  });
};
