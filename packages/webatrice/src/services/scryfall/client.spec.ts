import {
  chunkForCollection,
  cleanScryfallName,
  fetchCollection,
  fetchNamedCard,
  fetchPrintings,
  postCollection,
  SCRYFALL_COLLECTION_LIMIT,
  scryfallCardUrl,
  scryfallNamedUrl,
  scryfallSearchUrl,
} from './client';

function respond(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respond({}, false, 404));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL builders', () => {
  it('build the card, exact-name and search endpoints', () => {
    expect(scryfallCardUrl('0000-ab')).toBe('https://api.scryfall.com/cards/0000-ab');
    expect(scryfallNamedUrl('Fire // Ice')).toBe('https://api.scryfall.com/cards/named?exact=Fire%20%2F%2F%20Ice');
    expect(scryfallSearchUrl('!"Opt"', 'unique=prints')).toBe(
      'https://api.scryfall.com/cards/search?q=!%22Opt%22&unique=prints',
    );
  });

  it('strips a trailing Token suffix in either spelling', () => {
    expect(cleanScryfallName('Soldier Token')).toBe('Soldier');
    expect(cleanScryfallName('Soldier (Token)')).toBe('Soldier');
    expect(cleanScryfallName('Tokens of Value')).toBe('Tokens of Value');
  });
});

describe('chunkForCollection', () => {
  it('splits into chunks of the collection limit, in order', () => {
    const items = Array.from({ length: 151 }, (_, i) => i);
    const chunks = chunkForCollection(items);
    expect(SCRYFALL_COLLECTION_LIMIT).toBe(75);
    expect(chunks.map((c) => c.length)).toEqual([75, 75, 1]);
    expect(chunks.flat()).toEqual(items);
    expect(chunkForCollection([])).toEqual([]);
  });
});

describe('postCollection', () => {
  it('posts the identifiers as JSON, adding a signal only when given one', async () => {
    fetchMock.mockImplementation(() => respond({ data: [] }));
    const { signal } = new AbortController();

    await postCollection([{ name: 'Opt' }]);
    await postCollection([{ id: 'x' }], signal);

    expect(fetchMock.mock.calls[0]).toEqual([
      'https://api.scryfall.com/cards/collection',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"identifiers":[{"name":"Opt"}]}' },
    ]);
    expect(Object.keys(fetchMock.mock.calls[0][1])).not.toContain('signal');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ body: '{"identifiers":[{"id":"x"}]}', signal });
  });
});

describe('fetchNamedCard', () => {
  it('requests the cleaned NFC name and returns the card', async () => {
    fetchMock.mockImplementation(() => respond({ id: 'g', name: 'Goblin' }));

    await expect(fetchNamedCard('Goblin Token')).resolves.toEqual({ id: 'g', name: 'Goblin' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/named?exact=Goblin',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('returns null on a miss or a network failure', async () => {
    await expect(fetchNamedCard('Missing')).resolves.toBeNull();
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('offline')));
    await expect(fetchNamedCard('Missing')).resolves.toBeNull();
  });
});

describe('fetchCollection', () => {
  it.each([{ scryfallId: 'wanted' }, { set: 'xln', collectorNumber: '65' }, { set: 'xln' }])(
    'does not substitute a different printing for a hinted miss: %j', async (hint) => {
      fetchMock.mockImplementation(() => respond({ data: [{ id: 'other', name: 'Opt', set: 'dom', collector_number: '60' }] }));
      await expect(fetchCollection([{ name: 'Opt', ...hint }])).resolves.toEqual(new Map());
    },
  );

  it.each([['Fire', 'Fire // Ice'], ['B\u014d', 'Bo\u0304']])(
    'matches the set-hinted name %s using NFC and the front face', async (requested, name) => {
      fetchMock.mockImplementation(() => respond({ data: [
        { id: 'wrong-set', name, set: 'dom' },
        { id: 'wanted', name, set: 'mh2' },
      ] }));
      expect((await fetchCollection([{ name: requested, set: 'MH2' }])).get(requested)?.id).toBe('wanted');
    },
  );

  it('does not accept a different card that sits at the hinted set and number', async () => {
    const sword = { id: 'sword', name: 'Sword of War and Peace', set: '2xm', collector_number: '300' };
    fetchMock.mockImplementation(() => respond({ data: [sword] }));
    await expect(fetchCollection([{ name: 'Sol Ring', set: '2XM', collectorNumber: '300' }])).resolves.toEqual(new Map());
  });

  it('makes no request for no hints', async () => {
    await expect(fetchCollection([])).resolves.toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keys hits by the name the caller passed, by printing first, then by name or front face', async () => {
    fetchMock.mockImplementation(() => respond({
      data: [
        { id: 'a', name: 'Opt', set: 'xln', collector_number: '65' },
        { id: 'b', name: 'Fire // Ice', set: 'mh2', collector_number: '290' },
      ],
    }));

    const result = await fetchCollection([{ name: 'opt', set: 'XLN', collectorNumber: '65' }, { name: 'Fire' }, { name: 'Gone' }]);

    expect([...result.entries()].map(([k, v]) => [k, v.id])).toEqual([['opt', 'a'], ['Fire', 'b']]);
  });

  it('leaves a thrown chunk out without failing the others', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
      .mockImplementationOnce(() => respond({ data: [{ id: 'z', name: 'Card 75' }] }));
    const hints = Array.from({ length: 76 }, (_, i) => ({ name: `Card ${i}` }));

    const result = await fetchCollection(hints);

    expect([...result.keys()]).toEqual(['Card 75']);
  });
});

describe('fetchPrintings', () => {
  it('searches every printing of the exact name, newest first', async () => {
    fetchMock.mockImplementation(() => respond({ data: [{ id: 'p', name: 'Say "Hi"' }] }));

    await expect(fetchPrintings('Say "Hi" Token')).resolves.toEqual([{ id: 'p', name: 'Say "Hi"' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent('!"Say \\"Hi\\""')}&unique=prints&order=released&dir=desc`,
      { signal: expect.any(AbortSignal) },
    );
  });

  it('returns no printings on a failed request', async () => {
    await expect(fetchPrintings('Opt')).resolves.toEqual([]);
  });
});
