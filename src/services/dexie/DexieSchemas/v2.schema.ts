import Dexie from 'dexie';

export enum Stores {
  SETTINGS = 'settings',
  CARDS = 'cards',
  SETS = 'sets',
  TOKENS = 'tokens',
  HOSTS = 'hosts',
  FORMATS = 'formats',
  INFO = 'info',
}

/**
 * v1 keyed `cards` by `name` (top-level string) and `sets` by `code`. The XSD
 * v4 shape moves the short code into `name.value`, which is a different
 * primary key. Dexie can't change a primary key in place ("Not yet support
 * for changing primary key"), so we drop the affected tables in v2 and
 * recreate them under the new key in v3. The plan accepts a clean re-import.
 */
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
};
