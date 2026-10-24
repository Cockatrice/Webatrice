import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { schemaV1 } from './v1.schema';
import { schemaV2 } from './v2.schema';
import { schemaV6 } from './v6.schema';
import { schemaV7 } from './v7.schema';
import { schemaV8 } from './v8.schema';

vi.unmock('dexie');

it('upgrades v7 without losing existing data and persists both new cache tables across reopening', async () => {
  const name = 'persistence-upgrade';
  const old = new Dexie(name);
  [schemaV1, schemaV2, schemaV6, schemaV7].forEach((schema) => schema(old));
  await old.open();
  await old.table('scryfallCache').put({ name: 'Island', card: { id: 'island' } });
  old.close();
  const current = new Dexie(name);
  [schemaV1, schemaV2, schemaV6, schemaV7, schemaV8].forEach((schema) => schema(current));
  try {
    await current.open();
    expect(await current.table('scryfallCache').get('Island')).toMatchObject({ card: { id: 'island' } });
    await current.table('scryfallPrices').put({ key: 'id:island', info: { usd: 1 }, fetchedAt: 42 });
    await current.table('deckSummaries').bulkPut([
      { scope: 'alice', deckId: 1, creationTime: 10, summary: { format: 'modern' } },
      { scope: 'bob', deckId: 1, creationTime: 10, summary: { format: 'legacy' } },
    ]);
    current.close();
    await current.open();
    expect((await current.table('scryfallPrices').get('id:island')).info.usd).toBe(1);
    expect(await current.table('deckSummaries').where('scope').equals('alice').toArray()).toEqual([
      expect.objectContaining({ summary: { format: 'modern' } }),
    ]);
    expect(await current.table('deckSummaries').get(['alice', 1, 11])).toBeUndefined();
  } finally {
    await current.delete();
  }
});
