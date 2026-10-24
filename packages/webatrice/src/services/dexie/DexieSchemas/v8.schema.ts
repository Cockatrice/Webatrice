import type Dexie from 'dexie';

export const schemaV8 = (db: Dexie) => {
  db.version(8).stores({
    scryfallPrices: 'key',
    deckSummaries: '[scope+deckId+creationTime], scope, [scope+deckId]',
  });
};
