import Dexie from 'dexie';

import { migrateSetting } from '../settingsMigration';
import { Stores } from './v2.schema';

export const schemaV6 = (db: Dexie) => {
  db.version(6)
    .stores({})
    .upgrade((tx) => tx.table(Stores.SETTINGS).toCollection().modify((row) => {
      migrateSetting(row);
    }));
};
