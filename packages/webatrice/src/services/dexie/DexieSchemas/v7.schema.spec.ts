import type { Transaction } from 'dexie';

import { Stores } from './v2.schema';
import { LEGACY_SOURCE_ID, migrateToV7 } from './v7.schema';

function fakeTransaction(rows: Partial<Record<Stores, unknown[]>>) {
  const writes: Record<string, unknown[]> = {};
  const table = (name: Stores) => ({
    toArray: () => Promise.resolve(rows[name] ?? []),
    count: () => Promise.resolve((rows[name] ?? []).length),
    toCollection: () => ({ first: () => Promise.resolve(rows[name]?.[0]) }),
    bulkPut: (items: unknown[]) => {
      writes[name] = [...(writes[name] ?? []), ...items];
      return Promise.resolve();
    },
    put: (item: unknown) => {
      writes[name] = [...(writes[name] ?? []), item];
      return Promise.resolve();
    },
  });
  return { tx: { table } as unknown as Transaction, writes };
}

describe('migrateToV7', () => {
  it('writes nothing for a fresh install', async () => {
    const { tx, writes } = fakeTransaction({});
    await migrateToV7(tx);
    expect(writes).toEqual({});
  });

  it('seeds set preferences in default order with every set enabled', async () => {
    const { tx, writes } = fakeTransaction({
      [Stores.SETS]: [
        { name: { value: 'LEA' }, longname: { value: 'Alpha' }, releasedate: { value: '1993-08-05' } },
        { name: { value: 'NEO' }, longname: { value: 'Neon' }, releasedate: { value: '2022-02-18' } },
        { name: { value: 'CUS' } },
      ],
    });

    await migrateToV7(tx);

    expect(writes[Stores.SET_PREFERENCES]).toEqual([
      { code: 'NEO', sortKey: 0, enabled: true, isKnown: true },
      { code: 'LEA', sortKey: 1, enabled: true, isKnown: true },
      { code: 'CUS', sortKey: 2, enabled: true, isKnown: false },
    ]);
  });

  it('marks previously imported records as a legacy source without copying them', async () => {
    const cards = [{ name: { value: 'Counterspell' } }];
    const tokens = [{ name: { value: 'Goblin' } }];
    const info = { id: 'singleton', source: 'oracle-local-fs', importedAt: '2026-01-01T00:00:00.000Z', author: 'Oracle' };
    const { tx, writes } = fakeTransaction({
      [Stores.CARDS]: cards,
      [Stores.TOKENS]: tokens,
      [Stores.INFO]: [info],
    });

    await migrateToV7(tx);

    expect(writes[Stores.CARD_SOURCES]).toEqual([
      {
        id: LEGACY_SOURCE_ID,
        kind: 'legacy',
        fileName: 'cards.xml',
        origin: 'migration',
        order: 0,
        importedAt: info.importedAt,
        author: 'Oracle',
        sourceVersion: undefined,
        createdAt: undefined,
        counts: { cards: 1, sets: 0, tokens: 1, formats: 0 },
      },
    ]);
    expect(writes[Stores.CARD_SOURCE_PAYLOADS]).toBeUndefined();
  });
});
