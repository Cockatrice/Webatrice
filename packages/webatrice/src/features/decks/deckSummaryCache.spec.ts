import 'fake-indexeddb/auto';
import { dexieService } from '../../services/dexie/DexieService';
import { deckSummaryRevision, invalidateDeckSummary, readDeckSummary, writeDeckSummary } from './deckSummaryCache';
import { summarizeDeck } from './deckSummary';
import { parseCod } from '@app/services';

vi.unmock('dexie');

const document = '<cockatrice_deck version="1"><deckname>Saved</deckname><zone name="main"/></cockatrice_deck>';
const row = (scope = 'account', deckId = 5, creationTime = 10) => ({
  scope, deckId, creationTime, document, summary: summarizeDeck(parseCod(document)),
});

beforeEach(async () => {
  await dexieService.deckSummaries.clear();
});

it('reads only the requested deck index and timestamp without pruning any cached documents', async () => {
  const current = row();
  await writeDeckSummary(current, deckSummaryRevision(current.scope, current.deckId));
  await dexieService.deckSummaries.bulkPut([row('account', 5, 9), row('account', 6), row('other')]);
  const where = vi.spyOn(dexieService.deckSummaries, 'where');
  const bulkDelete = vi.spyOn(dexieService.deckSummaries, 'bulkDelete');
  expect(await readDeckSummary('account', 5, 10)).toEqual(current);
  expect(where).toHaveBeenCalledExactlyOnceWith('[scope+deckId]');
  expect(bulkDelete).not.toHaveBeenCalled();
  expect(await dexieService.deckSummaries.count()).toBe(4);
});

it.each([
  ['other account', 'other', 5, 10],
  ['other deck', 'account', 6, 10],
  ['stale timestamp', 'account', 5, 11],
] as const)('rejects a copy with %s', async (_label, scope, id, timestamp) => {
  await writeDeckSummary(row(), deckSummaryRevision('account', 5));
  expect(await readDeckSummary(scope, id, timestamp)).toBeUndefined();
  expect(await dexieService.deckSummaries.count()).toBe(1);
});

it('rejects an invalidated row even when its deletion failed', async () => {
  await writeDeckSummary(row(), deckSummaryRevision('account', 5));
  vi.spyOn(dexieService.deckSummaries, 'where').mockImplementationOnce(() => {
    throw new Error('unavailable');
  });
  await invalidateDeckSummary('account', 5);
  expect(await readDeckSummary('account', 5, 10)).toBeUndefined();
  expect(await dexieService.deckSummaries.count()).toBe(1);
});

it('returns no saved copy when IndexedDB fails', async () => {
  await writeDeckSummary(row(), deckSummaryRevision('account', 5));
  vi.spyOn(dexieService.deckSummaries, 'where').mockImplementationOnce(() => {
    throw new Error('unavailable');
  });
  expect(await readDeckSummary('account', 5, 10)).toBeUndefined();
});
