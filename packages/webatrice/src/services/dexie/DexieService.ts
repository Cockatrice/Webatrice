import Dexie, { type Table } from 'dexie';

import { schemaV1 } from './DexieSchemas/v1.schema';
import { Stores, schemaV2 } from './DexieSchemas/v2.schema';
import { schemaV6 } from './DexieSchemas/v6.schema';
import { schemaV7 } from './DexieSchemas/v7.schema';
import { schemaV8 } from './DexieSchemas/v8.schema';

class DexieService {
  private db: Dexie = new Dexie('Webatrice');

  constructor() {
    schemaV1(this.db);
    schemaV2(this.db);
    schemaV6(this.db);
    schemaV7(this.db);
    schemaV8(this.db);
  }

  get settings() {
    return this.db.table(Stores.SETTINGS);
  }

  get scryfallPrices() {
    return this.db.table('scryfallPrices');
  }

  get deckSummaries() {
    return this.db.table('deckSummaries');
  }

  get cards() {
    return this.db.table(Stores.CARDS);
  }

  get sets() {
    return this.db.table(Stores.SETS);
  }

  get tokens() {
    return this.db.table(Stores.TOKENS);
  }

  get hosts() {
    return this.db.table(Stores.HOSTS);
  }

  get formats() {
    return this.db.table(Stores.FORMATS);
  }

  get info() {
    return this.db.table(Stores.INFO);
  }

  // Scryfall read-through cache. Persisted so a Scryfall response
  // survives a page reload — see the note on Stores.SCRYFALL_CACHE.
  get scryfallCache() {
    return this.db.table(Stores.SCRYFALL_CACHE);
  }

  get replays() {
    return this.db.table(Stores.REPLAYS);
  }

  get replayData() {
    return this.db.table(Stores.REPLAY_DATA);
  }

  readWrite<T>(tables: Table[], scope: () => Promise<T>): Promise<T> {
    return this.db.transaction('rw', tables, scope);
  }

  get cardSources() {
    return this.db.table(Stores.CARD_SOURCES);
  }

  get cardSourcePayloads() {
    return this.db.table(Stores.CARD_SOURCE_PAYLOADS);
  }

  get setPreferences() {
    return this.db.table(Stores.SET_PREFERENCES);
  }

  get cardDataSettings() {
    return this.db.table(Stores.CARD_DATA_SETTINGS);
  }

  cardDataTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(
      'rw',
      [
        Stores.CARDS,
        Stores.SETS,
        Stores.TOKENS,
        Stores.FORMATS,
        Stores.INFO,
        Stores.CARD_SOURCES,
        Stores.CARD_SOURCE_PAYLOADS,
        Stores.SET_PREFERENCES,
        Stores.CARD_DATA_SETTINGS,
      ],
      work,
    );
  }

  count(store: Stores): Promise<number> {
    return this.db.table(store).count();
  }

  async clear(stores: readonly Stores[]): Promise<void> {
    const tables = stores.map((store) => this.db.table(store));
    await this.db.transaction('rw', tables, () => Promise.all(tables.map((table) => table.clear())));
  }

  testConnection() {
    return this.db.open();
  }
}

export const dexieService = new DexieService();
