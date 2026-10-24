import type { Mock } from 'vitest';
import { waitFor } from '@testing-library/react';

import { dexieService } from '../../dexie';
import { lookupCard, lookupCards, lookupCardsCached, lookupCardsForHydration, printingKey } from './lookup';
import type { LookupResult } from './types';

const state = vi.hoisted(() => ({ preferences: {
  cardOverrides: {} as Record<string, string>, setPreferences: new Map(), setLongNames: new Map(), pictureUrlTemplates: [],
} }));
vi.mock('../../cardDatabase', async (original) => ({
  ...await original<typeof import('../../cardDatabase')>(),
  currentCardDataPreferences: async () => state.preferences,
}));
vi.mock('../../dexie', () => ({ dexieService: {
  cards: { get: vi.fn(), bulkGet: vi.fn() },
  scryfallCache: { get: vi.fn(), bulkGet: vi.fn(), put: vi.fn(), bulkPut: vi.fn() },
} }));
const cards = dexieService.cards as unknown as { get: Mock; bulkGet: Mock };
const cache = dexieService.scryfallCache as unknown as { get: Mock; bulkGet: Mock; put: Mock; bulkPut: Mock };
let stored: Map<string, LookupResult>;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function cached(name: string, id = `default-${name}`): LookupResult {
  return { found: true, name, source: 'scryfall', fetchedAt: Date.now(), printings: [{ scryfallId: id }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.preferences = { ...state.preferences, cardOverrides: { Opt: 'pin-opt', Ponder: 'pin-ponder' } };
  stored = new Map(['Opt', 'Ponder'].map((name) => [name, cached(name)]));
  cards.get.mockImplementation(async (name: string) => ({ name: { value: name }, set: { value: 'old', uuid: `xml-${name}` } }));
  cards.bulkGet.mockImplementation(async (names: string[]) => Promise.all(names.map((name) => cards.get(name))));
  cache.get.mockImplementation(async (name: string) => stored.get(name));
  cache.bulkGet.mockImplementation(async (names: string[]) => names.map((name) => stored.get(name)));
  cache.put.mockImplementation(async (row: LookupResult) => {
    stored.set(row.name, row);
  });
  cache.bulkPut.mockImplementation(async (rows: LookupResult[]) => {
    rows.forEach((row) => stored.set(row.name, row));
  });
  fetchMock = vi.fn<typeof fetch>(async () => ({ ok: true, json: async () => ({ data: [
    { name: 'Opt', id: 'pin-opt', set: 'pin', collector_number: '1' },
    { name: 'Ponder', id: 'pin-ponder', set: 'pin', collector_number: '2' },
  ] }) } as Response));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('fetches missing pins in one collection request and reuses persistent cached printings', async () => {
  const found = await lookupCards(['Opt', 'Ponder']);
  expect(found.get('Opt')).toMatchObject({
    pinnedPrintingId: 'pin-opt',
    printings: expect.arrayContaining([{ set: 'pin', collectorNumber: '1', scryfallId: 'pin-opt', imageUri: undefined }]),
  });
  expect(found.get('Ponder')).toMatchObject({ pinnedPrintingId: 'pin-ponder' });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ identifiers: [{ id: 'pin-opt' }, { id: 'pin-ponder' }] });
  fetchMock.mockClear();
  await lookupCards(['Opt', 'Ponder']);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('finds a pin in the existing cache even when XML hides that printing', async () => {
  stored.set('Opt', cached('Opt', 'pin-opt'));
  expect((await lookupCards(['Opt'])).get('Opt')).toMatchObject({
    pinnedPrintingId: 'pin-opt', printings: expect.arrayContaining([{ scryfallId: 'pin-opt' }]),
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('applies pins to single lookups and invalidates session results when preferences change', async () => {
  stored.set('Opt', cached('Opt', 'pin-opt'));
  expect(await lookupCard('Opt')).toMatchObject({ pinnedPrintingId: 'pin-opt' });
  expect((await lookupCardsCached(['Opt'])).get('Opt')).toMatchObject({ pinnedPrintingId: 'pin-opt' });
  state.preferences = { ...state.preferences, cardOverrides: {} };
  expect((await lookupCardsCached(['Opt'])).get('Opt')).not.toHaveProperty('pinnedPrintingId');
});

it('carries a cached pin through hydration and its background refresh', async () => {
  stored.set('Opt', { ...cached('Opt', 'pin-opt'), fetchedAt: 0 });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{ name: 'Opt', id: 'other', set: 'new' }] }) } as Response);
  const hydration = await lookupCardsForHydration(['Opt']);
  const key = printingKey({ name: 'Opt' });
  expect(hydration.lookups.get(key)).toMatchObject({ pinnedPrintingId: 'pin-opt' });
  expect((await hydration.refreshed).get(key)).toMatchObject({
    pinnedPrintingId: 'pin-opt', printings: expect.arrayContaining([{ scryfallId: 'pin-opt' }]),
  });
  expect(stored.get('Opt')?.printings).toContainEqual({ scryfallId: 'pin-opt' });
});

it('keeps a missing pin as a pin and rejects a different card returned for its id', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{ name: 'Ponder', id: 'pin-opt' }] }) } as Response);
  const card = (await lookupCards(['Opt'])).get('Opt');
  expect(card).toMatchObject({ pinnedPrintingId: 'pin-opt' });
  expect(card?.printings.some((printing) => printing.scryfallId === 'pin-opt')).toBe(false);
});

it('preserves the unpinned default in the cache when adding a missing pin', async () => {
  cards.get.mockResolvedValue(undefined);
  await lookupCards(['Opt']);
  state.preferences = { ...state.preferences, cardOverrides: {} };
  expect((await lookupCards(['Opt'])).get('Opt')?.printings[0].scryfallId).toBe('default-Opt');
});

it.each(['batch', 'hydration'] as const)('applies canonical-name pins after an uncached %s response', async (path) => {
  cards.get.mockResolvedValue(undefined);
  stored.clear();
  fetchMock.mockImplementation(async (_url, options) => {
    const { identifiers } = JSON.parse(options!.body as string) as { identifiers: Array<{ id?: string }> };
    return { ok: true, json: async () => ({ data: [{ name: 'Opt', id: identifiers[0].id ?? 'default-Opt' }] }) } as Response;
  });
  const card = path === 'batch'
    ? (await lookupCards(['opt'])).get('opt')
    : (await lookupCardsForHydration(['opt'])).lookups.get(printingKey({ name: 'opt' }));
  expect(card).toMatchObject({ name: 'Opt', pinnedPrintingId: 'pin-opt' });
  expect(card?.printings).toContainEqual(expect.objectContaining({ scryfallId: 'pin-opt' }));
});

it('returns local hydration before fetching missing pins together in the background', async () => {
  let release!: (response: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
    release = resolve;
  }));
  let initial: Awaited<ReturnType<typeof lookupCardsForHydration>> | undefined;
  const task = lookupCardsForHydration(['Opt', 'Ponder']).then((result) => {
    initial = result; return result;
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  try {
    expect(initial?.lookups.get(printingKey({ name: 'Opt' }))).toMatchObject({ pinnedPrintingId: 'pin-opt' });
  } finally {
    release({ ok: true, json: async () => ({ data: [
      { name: 'Opt', id: 'pin-opt' }, { name: 'Ponder', id: 'pin-ponder' },
    ] }) } as Response);
    const result = await task;
    await result.refreshed;
  }
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ identifiers: [{ id: 'pin-opt' }, { id: 'pin-ponder' }] });
  expect((await initial!.refreshed).get(printingKey({ name: 'Opt' }))?.printings)
    .toContainEqual(expect.objectContaining({ scryfallId: 'pin-opt' }));
});

it('batches known names and newly resolved canonical names in the same pin request', async () => {
  cards.get.mockResolvedValue(undefined);
  stored.delete('Ponder');
  fetchMock.mockImplementation(async (_url, options) => {
    const { identifiers } = JSON.parse(options!.body as string) as { identifiers: Array<{ id?: string }> };
    const data = identifiers[0].id
      ? identifiers.map(({ id }) => ({ name: id === 'pin-opt' ? 'Opt' : 'Ponder', id }))
      : [{ name: 'Ponder', id: 'default-Ponder' }];
    return { ok: true, json: async () => ({ data }) } as Response;
  });
  const cardsByName = await lookupCards(['Opt', 'ponder']);
  expect(cardsByName.get('Opt')?.pinnedPrintingId).toBe('pin-opt');
  expect(cardsByName.get('ponder')?.pinnedPrintingId).toBe('pin-ponder');
  const pinRequests = fetchMock.mock.calls.map(([, options]) => JSON.parse(options!.body as string) as {
    identifiers: Array<{ id?: string }>;
  }).filter(({ identifiers }) => identifiers[0].id);
  expect(pinRequests).toEqual([{ identifiers: [{ id: 'pin-opt' }, { id: 'pin-ponder' }] }]);
});

it.each([
  { path: 'memo', id: 'default-Opt' }, { path: 'hydration', id: 'default-Opt' },
  { path: 'memo', id: undefined }, { path: 'hydration', id: undefined },
])('reconciles a changed pin $id during $path refresh', async ({ path, id }) => {
  state.preferences = { ...state.preferences, cardOverrides: { Opt: 'xml-Opt' } };
  stored.set('Opt', { ...cached('Opt'), fetchedAt: 0 });
  let release!: (response: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
    release = resolve;
  }));
  const pending = path === 'memo' ? lookupCardsCached(['Opt'])
    : lookupCardsForHydration(['Opt']).then((result) => result.refreshed);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  state.preferences = { ...state.preferences, cardOverrides: id ? { Opt: id } : {} };
  release({ ok: true, json: async () => ({ data: [{ name: 'Opt', id: 'default-Opt' }] }) } as Response);
  expect([...(await pending).values()][0]?.pinnedPrintingId).toBe(id);
  expect((await lookupCardsCached(['Opt'])).get('Opt')?.pinnedPrintingId).toBe(id);
});
