import Dexie from 'dexie';

import { schemaV1 } from './DexieSchemas/v1.schema';
import { Stores, schemaV2 } from './DexieSchemas/v2.schema';

class DexieService {
  private db: Dexie = new Dexie('Webatrice');

  constructor() {
    schemaV1(this.db);
    schemaV2(this.db);
  }

  get settings() {
    return this.db.table(Stores.SETTINGS);
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

  testConnection() {
    return this.db.open();
  }
}

export const dexieService = new DexieService();
