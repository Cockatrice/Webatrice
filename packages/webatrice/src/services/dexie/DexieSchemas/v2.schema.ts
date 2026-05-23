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
