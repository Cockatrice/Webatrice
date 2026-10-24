import type { Mock } from 'vitest';

import { dexieService } from '../../dexie';
import { fetchAllPrintings, lookupCard, lookupCards, lookupCardsCached } from './lookup';

vi.mock('../../dexie', () => ({
  dexieService: {
    cards: { get: vi.fn(), bulkGet: vi.fn() },
    scryfallCache: { get: vi.fn(), bulkGet: vi.fn(), put: vi.fn(), bulkPut: vi.fn() },
  },
}));

const cards = dexieService.cards as unknown as { get: Mock; bulkGet: Mock };
const cache = dexieService.scryfallCache as unknown as { get: Mock; bulkGet: Mock; put: Mock; bulkPut: Mock };

const XML_SWAN_SONG = {
  name: { value: 'Swan Song' },
  prop: {
    value: {
      type: { value: 'Instant' },
      manacost: { value: 'U' },
      cmc: { value: '1' },
      colors: { value: 'U' },
    },
  },
  set: { value: 'THS', num: '65', uuid: 'xml-uuid', picurl: 'https://mirror/swan.jpg' },
  related: { value: 'Bird', count: '1' },
};

const SCRYFALL_SWAN_SONG = {
  id: 'sf-id',
  name: 'Swan Song',
  layout: 'normal',
  type_line: 'Instant',
  set: 'ths',
  collector_number: '65',
  image_uris: { normal: 'https://cards/swan.jpg' },
  all_parts: [
    { id: 'bird-id', component: 'token', name: 'Bird', uri: '' },
    { id: 'combo-id', component: 'combo_piece', name: 'Something', uri: '' },
  ],
};

function respond(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respond({}, false, 404));
  vi.stubGlobal('fetch', fetchMock);
  cards.get.mockResolvedValue(undefined);
  cards.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
  cache.get.mockResolvedValue(undefined);
  cache.bulkGet.mockImplementation(async (names: string[]) => names.map(() => undefined));
  cache.put.mockResolvedValue(undefined);
  cache.bulkPut.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupCard', () => {
  it('returns the unknown fallback when neither Dexie nor Scryfall knows the card', async () => {
    await expect(lookupCard('Nonexistent')).resolves.toEqual({
      found: false,
      source: 'unknown',
      name: 'Nonexistent',
      printings: [],
    });
  });

  it('reads cards.xml cipt (comes into play tapped)', async () => {
    cards.get.mockResolvedValue({ ...XML_SWAN_SONG, name: { value: 'Tapland' }, cipt: { value: '1' } });
    await expect(lookupCard('Tapland')).resolves.toMatchObject({ cipt: true });

    cards.get.mockResolvedValue(XML_SWAN_SONG);
    expect(await lookupCard('Swan Song')).not.toHaveProperty('cipt');
  });

  it('reads cards.xml tablerow as a number', async () => {
    cards.get.mockResolvedValue({ ...XML_SWAN_SONG, tablerow: { value: '3' } });
    await expect(lookupCard('Swan Song')).resolves.toMatchObject({ tableRow: 3 });

    fetchMock.mockImplementation(() => respond(SCRYFALL_SWAN_SONG));
    cache.get.mockResolvedValue(undefined);
    await expect(lookupCard('Swan Song')).resolves.toMatchObject({ source: 'dexie+scryfall', tableRow: 3 });

    cards.get.mockResolvedValue({ ...XML_SWAN_SONG, tablerow: { value: '' } });
    expect(await lookupCard('Swan Song')).not.toHaveProperty('tableRow');
  });

  it('carries cards.xml exclude on related and reverse-related cards, and through the Scryfall overlay', async () => {
    const xml = {
      ...XML_SWAN_SONG,
      related: [{ value: 'Bird', exclude: 'exclude' }, { value: 'Clue' }],
      'reverse-related': { value: 'Swan', exclude: 'exclude' },
    };
    cards.get.mockResolvedValue(xml);
    expect((await lookupCard('Swan Song')).related).toEqual([
      expect.objectContaining({ name: 'Bird', origin: 'related', exclude: 'exclude' }),
      expect.not.objectContaining({ exclude: expect.anything() }),
      expect.objectContaining({ name: 'Swan', origin: 'reverse-related', exclude: 'exclude' }),
    ]);

    fetchMock.mockImplementation(() => respond(SCRYFALL_SWAN_SONG));
    cache.get.mockResolvedValue(undefined);
    expect((await lookupCard('Swan Song')).related?.[0]).toMatchObject({ name: 'Bird', origin: 'scryfall', exclude: 'exclude' });
  });

  it('keeps an empty exclude or attach attribute, which desktop counts as present', async () => {
    cards.get.mockResolvedValue({ ...XML_SWAN_SONG, related: [{ value: 'Bird', exclude: '', attach: '' }] });
    expect((await lookupCard('Swan Song')).related).toEqual([
      expect.objectContaining({ name: 'Bird', origin: 'related', exclude: '', attach: '' }),
    ]);

    fetchMock.mockImplementation(() => respond(SCRYFALL_SWAN_SONG));
    cache.get.mockResolvedValue(undefined);
    expect((await lookupCard('Swan Song')).related?.[0]).toMatchObject({ name: 'Bird', origin: 'scryfall', exclude: '', attach: '' });
  });

  it('merges cards.xml base fields with Scryfall related cards and writes the cache', async () => {
    cards.get.mockResolvedValue(XML_SWAN_SONG);
    fetchMock.mockImplementation(() => respond(SCRYFALL_SWAN_SONG));

    const result = await lookupCard('Swan Song');

    expect(fetchMock).toHaveBeenCalledWith('https://api.scryfall.com/cards/named?exact=Swan%20Song', { signal: expect.any(AbortSignal) });
    expect(result).toMatchObject({
      found: true,
      source: 'dexie+scryfall',
      typeLine: 'Instant',
      manaCost: 'U',
      cmc: 1,
      colors: ['U'],
      printings: [{ set: 'THS', collectorNumber: '65', scryfallId: 'xml-uuid', imageUri: 'https://mirror/swan.jpg' }],
      layout: 'normal',
    });
    expect(result.related).toEqual([
      { name: 'Bird', component: 'token', origin: 'scryfall', scryfallId: 'bird-id', count: '1', persistent: undefined, attach: undefined },
    ]);
    expect(cache.put).toHaveBeenCalledWith(expect.objectContaining({ name: 'Swan Song', source: 'scryfall' }));
  });

  it('serves a cached Scryfall record without fetching and drops stale combo pieces', async () => {
    cache.get.mockResolvedValue({
      fetchedAt: Date.now(),
      found: true,
      source: 'scryfall',
      name: 'Delver of Secrets',
      printings: [],
      related: [{ name: 'Insectile Aberration', component: 'combo_piece', origin: 'scryfall' }],
    });

    const result = await lookupCard('Delver of Secrets');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ source: 'scryfall', name: 'Delver of Secrets' });
    expect(result.related).toBeUndefined();
  });

  it('carries legality and rules data: cards.xml props win, Scryfall fills in', async () => {
    cards.get.mockResolvedValue({
      ...XML_SWAN_SONG,
      text: { value: 'Counter target noncreature spell.' },
      prop: { value: { ...XML_SWAN_SONG.prop.value, 'format-modern': { value: 'legal' }, 'format-legacy': { value: 'banned' } } },
    });
    fetchMock.mockImplementation(() => respond({ ...SCRYFALL_SWAN_SONG, legalities: { modern: 'not_legal' } }));

    const result = await lookupCard('Swan Song');
    expect(result.text).toBe('Counter target noncreature spell.');
    expect(result.legalities).toEqual({ modern: 'legal', legacy: 'banned' });
    expect(result.properties).toEqual(expect.objectContaining({ type: 'Instant', 'format-modern': 'legal' }));
  });

  it('maps Scryfall legalities to cards.xml terms, dropping not_legal', async () => {
    fetchMock.mockImplementation(() => respond({
      ...SCRYFALL_SWAN_SONG,
      oracle_text: 'Counter it.',
      legalities: { modern: 'legal', vintage: 'restricted', standard: 'not_legal', legacy: 'banned' },
    }));

    const result = await lookupCard('Swan Song');
    expect(result.legalities).toEqual({ modern: 'legal', vintage: 'restricted', legacy: 'banned' });
    expect(result.properties).toEqual({ type: 'Instant' });
    expect(result.text).toBe('Counter it.');
  });

  it('keeps each face\'s own rules text', async () => {
    fetchMock.mockImplementation(() => respond({
      ...SCRYFALL_SWAN_SONG,
      name: 'Delver of Secrets // Insectile Aberration',
      layout: 'transform',
      card_faces: [
        { name: 'Delver of Secrets', oracle_text: 'At the beginning of your upkeep, look at the top card of your library.' },
        { name: 'Insectile Aberration', oracle_text: 'Flying' },
      ],
    }));

    const result = await lookupCard('Delver of Secrets');
    expect(result.faces?.map((face) => face.text)).toEqual([
      'At the beginning of your upkeep, look at the top card of your library.',
      'Flying',
    ]);
  });

  it('knows a sideways-layout card from cards.xml\'s landscapeOrientation', async () => {
    cards.get.mockResolvedValue({ ...XML_SWAN_SONG, landscapeOrientation: { value: '1' } });
    expect((await lookupCard('Swan Song')).landscape).toBe(true);
  });

  it('knows a sideways-layout card from Scryfall by Oracle\'s rule: battles, split cards, planes', async () => {
    for (const [overrides, landscape] of [
      [{ type_line: 'Battle — Siege' }, true],
      [{ layout: 'split' }, true],
      [{ layout: 'planar' }, true],
      [{}, undefined],
    ] as const) {
      fetchMock.mockImplementation(() => respond({ ...SCRYFALL_SWAN_SONG, ...overrides }));
      expect((await lookupCard(`Card ${JSON.stringify(overrides)}`)).landscape).toBe(landscape);
    }
  });

  it('has no legality data for a cards.xml record without format props', async () => {
    cards.get.mockResolvedValue(XML_SWAN_SONG);
    const result = await lookupCard('Swan Song');
    expect(result.legalities).toBeUndefined();
  });

  it('strips a trailing "Token" suffix before the exact-name request', async () => {
    await lookupCard('Goblin Token');
    expect(fetchMock).toHaveBeenCalledWith('https://api.scryfall.com/cards/named?exact=Goblin', { signal: expect.any(AbortSignal) });
  });
});

describe('lookupCards', () => {
  it('dedupes names, batches one collection request preferring set + collector number, and caches hits', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/cards/collection')
        ? respond({
          data: [
            { id: 'a', name: 'Opt', set: 'xln', collector_number: '65' },
            { id: 'b', name: 'Fire // Ice', set: 'mh2', collector_number: '290' },
          ],
        })
        : respond({}, false, 404));

    const result = await lookupCards([{ name: 'Opt', set: 'XLN', collectorNumber: '65' }, 'Opt', 'Fire']);

    const collectionCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://api.scryfall.com/cards/collection');
    expect(collectionCalls).toHaveLength(1);
    expect(JSON.parse(collectionCalls[0][1].body)).toEqual({
      identifiers: [{ set: 'xln', collector_number: '65' }, { name: 'Fire' }],
    });
    expect([...result.keys()]).toEqual(['Opt', 'Fire']);
    expect(result.get('Opt')).toMatchObject({ found: true, source: 'scryfall', printings: [{ scryfallId: 'a' }] });
    expect(result.get('Fire')).toMatchObject({ found: true, name: 'Fire // Ice' });
    expect(cache.bulkPut).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Opt' }),
      expect.objectContaining({ name: 'Fire // Ice' }),
    ]);
  });

  it('retries batch misses one by one through the exact-name endpoint', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/cards/collection')
        ? respond({ data: [] })
        : url.includes('exact=Brainstorm')
          ? respond({ id: 'bs', name: 'Brainstorm' })
          : respond({}, false, 404));

    const result = await lookupCards(['Brainstorm', 'Missing']);

    expect(result.get('Brainstorm')).toMatchObject({ found: true, source: 'scryfall' });
    expect(result.get('Missing')).toEqual({ found: false, source: 'unknown', name: 'Missing', printings: [] });
  });

  it('skips per-name retries when more than 50 names are unresolved (no request storm)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockImplementation(() => respond({}, false, 500));
    const names = Array.from({ length: 51 }, (_, i) => `Card ${i}`);

    const result = await lookupCards(names);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...result.values()].every((r) => r.source === 'unknown')).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('51 names unresolved'));
    warn.mockRestore();
  });

  it('does not fetch names already in the Scryfall cache', async () => {
    cache.bulkGet.mockImplementation(async (names: string[]) =>
      names.map((n) => (n === 'Cached'
        ? { found: true, source: 'scryfall', name: 'Cached', printings: [], fetchedAt: Date.now() }
        : undefined)));

    const result = await lookupCards(['Cached']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.get('Cached')).toMatchObject({ found: true });
  });
});

describe('Scryfall request shapes (characterization)', () => {
  const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';

  function collectionCalls() {
    return fetchMock.mock.calls.filter(([url]) => url === COLLECTION_URL);
  }

  it('posts JSON identifiers with a method, a content type, a body and a shared signal', async () => {
    fetchMock.mockImplementation(() => respond({ data: [] }));

    await lookupCards([{ name: 'Opt', set: 'XLN', collectorNumber: '65' }]);

    expect(collectionCalls()[0]).toEqual([
      COLLECTION_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"identifiers":[{"set":"xln","collector_number":"65"}]}',
        signal: expect.any(AbortSignal),
      },
    ]);
  });

  it('sends the exact-name request with a shared signal', async () => {
    await lookupCard('Opt');
    expect(fetchMock.mock.calls).toEqual([['https://api.scryfall.com/cards/named?exact=Opt', { signal: expect.any(AbortSignal) }]]);
  });

  it('splits identifiers into chunks of 75 without waiting for prior responses', async () => {
    const pending: Array<() => void> = [];
    fetchMock.mockImplementation((url: string) =>
      url === COLLECTION_URL
        ? new Promise<Response>((resolve) => pending.push(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response)))
        : respond({}, false, 404));
    const names = Array.from({ length: 151 }, (_, i) => `Card ${i}`);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = lookupCards(names);
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending.forEach((settle) => settle());
    await result;

    expect(collectionCalls().map(([, init]) => JSON.parse(init.body).identifiers.length)).toEqual([75, 75, 1]);
    expect(JSON.parse(collectionCalls()[1][1].body).identifiers[0]).toEqual({ name: 'Card 75' });
    warn.mockRestore();
  });

  it('strips a Token suffix and NFC-normalises names in batch identifiers and exact-name retries', async () => {
    const nfd = 'Donnie\u2019s Bo\u0304';
    fetchMock.mockImplementation(() => respond({ data: [] }));

    await lookupCards([nfd, 'Soldier Token']);

    expect(JSON.parse(collectionCalls()[0][1].body)).toEqual({
      identifiers: [{ name: nfd.normalize('NFC') }, { name: 'Soldier' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nfd.normalize('NFC'))}`,
      { signal: expect.any(AbortSignal) },
    );
    expect(fetchMock).toHaveBeenCalledWith('https://api.scryfall.com/cards/named?exact=Soldier', { signal: expect.any(AbortSignal) });
  });

  it('matches an NFD name to the NFC response card', async () => {
    const nfd = 'Donnie\u2019s Bo\u0304';
    fetchMock.mockImplementation((url: string) =>
      url === COLLECTION_URL ? respond({ data: [{ id: 'd', name: nfd.normalize('NFC') }] }) : respond({}, false, 404));

    const result = await lookupCards([nfd]);

    expect(result.get(nfd)).toMatchObject({ found: true, printings: [{ scryfallId: 'd' }] });
  });

  it('rejects a different printing without retrying by name', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === COLLECTION_URL
        ? respond({ data: [{ id: 'promo', name: 'Opt', set: 'pxln', collector_number: '65p' }] })
        : respond({}, false, 404));

    const result = await lookupCards([{ name: 'Opt', set: 'XLN', collectorNumber: '65' }]);

    expect(result.get('Opt')).toMatchObject({ found: false });
    expect(cache.bulkPut).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['single', 'batch'] as const)('returns a Dexie hit after exhausted 429 retries for a %s lookup', async (kind) => {
    cards.get.mockResolvedValue(XML_SWAN_SONG);
    cards.bulkGet.mockResolvedValue([XML_SWAN_SONG]);
    fetchMock.mockImplementation(() => respond({}, false, 429));
    const result = kind === 'single' ? lookupCard('Swan Song') : lookupCards(['Swan Song']).then((hits) => hits.get('Swan Song'));
    await expect(result).resolves.toMatchObject({ found: true, source: 'dexie', name: 'Swan Song' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('warns on a non-429 collection failure while preserving Dexie results', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cards.bulkGet.mockResolvedValue([XML_SWAN_SONG]);
    fetchMock.mockImplementation(() => respond({}, false, 500));
    expect((await lookupCards(['Swan Song'])).get('Swan Song')).toMatchObject({ source: 'dexie' });
    expect(warn).toHaveBeenCalledWith('Scryfall /cards/collection returned 500 for 1 identifiers');
    warn.mockRestore();
  });
});

describe('lookupCardsCached', () => {
  it('memoizes found cards for the session but never unknown ones', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/cards/collection')
        ? respond({ data: [{ id: 'p', name: 'Ponder' }] })
        : respond({}, false, 404));

    await lookupCardsCached(['Ponder', 'Unknowable']);
    const firstFetches = fetchMock.mock.calls.length;
    const again = await lookupCardsCached(['Ponder', 'Unknowable']);

    expect(again.get('Ponder')).toMatchObject({ found: true });
    expect(again.get('Unknowable')).toMatchObject({ source: 'unknown' });
    const repeatBody = JSON.parse(fetchMock.mock.calls[firstFetches][1].body);
    expect(repeatBody).toEqual({ identifiers: [{ name: 'Unknowable' }] });
  });
});

describe('fetchAllPrintings', () => {
  it('maps every printing from an exact-name search, newest first', async () => {
    fetchMock.mockImplementation(() => respond({
      data: [
        { id: 'new', name: 'Opt', set: 'dmr', collector_number: '1', image_uris: { normal: 'n.jpg' } },
        { id: 'old', name: 'Opt', set: 'inv', collector_number: '64', card_faces: [{ image_uris: { small: 's.jpg' } }] },
      ],
    }));

    await expect(fetchAllPrintings('Opt')).resolves.toEqual([
      { name: 'Opt', set: 'dmr', collectorNumber: '1', scryfallId: 'new', imageUri: 'n.jpg' },
      { name: 'Opt', set: 'inv', collectorNumber: '64', scryfallId: 'old', imageUri: 's.jpg' },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent('!"Opt"')}&unique=prints&order=released&dir=desc`,
    );
  });

  it('returns an empty list on a failed request', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    await expect(fetchAllPrintings('Opt')).resolves.toEqual([]);
  });
});
