import {
  searchCardArt,
  searchCardAsPreview,
  searchCardImage,
  searchCardManaCost,
  searchCards,
  searchCardTypeLine,
  searchCardUsd,
  searchScryfallPage,
  scryfallSearchUrl,
  type ScryfallSearchCard,
} from './search';

function json(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('searchCards', () => {
  it('autocompletes queries of two or more characters, capped at the limit', async () => {
    const fetchMock = vi.fn(async () => json({ data: ['Risen Reef', 'Risen Riptide', 'Risen Executioner'] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchCards('r')).toEqual([]);
    expect(await searchCards(' risen ', 2)).toEqual([
      { name: 'Risen Reef', source: 'scryfall' },
      { name: 'Risen Riptide', source: 'scryfall' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('https://api.scryfall.com/cards/autocomplete?q=risen', undefined);
  });

  it('returns no suggestions on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, false)));
    expect(await searchCards('risen')).toEqual([]);
  });
});

const searchPage = (query: string) => searchScryfallPage(scryfallSearchUrl(query));

describe('searchScryfallPage errors', () => {
  it('searches unique cards by name order and treats a 404 as no results', async () => {
    const fetchMock = vi.fn(async (_url: string) => json({ object: 'error', code: 'not_found' }, false, 404));
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchPage('c:r t:instant')).toEqual({ cards: [], total: 0, nextPage: null });
    expect(fetchMock.mock.calls[0][0])
      .toBe('https://api.scryfall.com/cards/search?q=c%3Ar%20t%3Ainstant&unique=cards&order=name');
  });

  it('carries Scryfall details for a bad query', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      object: 'error', code: 'bad_request', details: 'Unknown color: purple',
    }, false, 400)));
    await expect(searchPage('c:purple')).rejects.toMatchObject({
      failure: { kind: 'badQuery', details: 'Unknown color: purple' },
    });
  });

  it.each([500, 503, 404])('rejects HTTP %s without a not_found error object', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, false, status)));
    await expect(searchPage('bolt')).rejects.toMatchObject({ failure: { kind: 'failed' } });
  });

  it('rejects a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(searchPage('bolt')).rejects.toMatchObject({ failure: { kind: 'failed' } });
  });

  it('rejects an unreadable error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    }));
    await expect(searchPage('bolt')).rejects.toMatchObject({ failure: { kind: 'failed' } });
  });

  it('rethrows an abort so the caller can ignore it', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(searchPage('bolt')).rejects.toBe(abort);
  });

  it('rejects an exhausted HTTP 429 retry sequence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 10_000);
    const fetchMock = vi.fn(async () => json({}, false, 429));
    vi.stubGlobal('fetch', fetchMock);

    const result = expect(searchPage('bolt')).rejects.toMatchObject({ failure: { kind: 'failed' } });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('search results as previews', () => {
  const dfc: ScryfallSearchCard = {
    id: 'id-1',
    name: 'Delver of Secrets // Insectile Aberration',
    type_line: 'Creature',
    mana_cost: '{U}',
    set: 'isd',
    collector_number: '51',
    card_faces: [{ image_uris: { small: 'front-small' } }],
  };

  it('uses the card image, else the front face', () => {
    expect(searchCardImage({ ...dfc, image_uris: { small: 's', normal: 'n' } })).toBe('n');
    expect(searchCardImage(dfc)).toBe('front-small');
  });

  it('builds a not-in-deck card for the sidebar preview', () => {
    expect(searchCardAsPreview(dfc)).toEqual({
      name: dfc.name,
      quantity: 1,
      category: 'main',
      typeLine: 'Creature',
      manaCost: '{U}',
      set: 'isd',
      collectorNumber: '51',
      scryfallId: 'id-1',
      imageUri: 'front-small',
      lookupSource: 'scryfall',
    });
  });
});

describe('searchScryfallPage', () => {
  it('reports the total and the next page', async () => {
    const fetchMock = vi.fn(async () => json({
      data: [{ id: 'a', name: 'Ponder' }],
      total_cards: 412,
      has_more: true,
      next_page: 'https://api.scryfall.com/cards/search?page=2&q=t%3Asorcery',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const page = await searchScryfallPage(scryfallSearchUrl(' t:sorcery '));
    expect(page).toEqual({
      cards: [{ id: 'a', name: 'Ponder' }],
      total: 412,
      nextPage: 'https://api.scryfall.com/cards/search?page=2&q=t%3Asorcery',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/search?q=t%3Asorcery&unique=cards&order=name',
      expect.anything(),
    );
  });

  it('treats a not-found search as an empty last page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ object: 'error', code: 'not_found' }, false, 404)));
    expect(await searchScryfallPage(scryfallSearchUrl('zzz'))).toEqual({ cards: [], total: 0, nextPage: null });
  });
});

describe('search card fields', () => {
  const dfc: ScryfallSearchCard = {
    id: 'x',
    name: 'Delver of Secrets // Insectile Aberration',
    card_faces: [
      { mana_cost: '{U}', type_line: 'Creature — Human Wizard', image_uris: { normal: 'n.jpg', art_crop: 'art.jpg' } },
      { mana_cost: '', type_line: 'Creature — Human Insect' },
    ],
    prices: { usd: null, usd_foil: '2.50' },
  };

  it('reads cost, type and art from the front face of double-faced cards', () => {
    expect(searchCardManaCost(dfc)).toBe('{U}');
    expect(searchCardTypeLine(dfc)).toBe('Creature — Human Wizard');
    expect(searchCardArt(dfc)).toBe('art.jpg');
  });

  it('prices from the non-foil USD, then foil, else none', () => {
    expect(searchCardUsd(dfc)).toBe(2.5);
    expect(searchCardUsd({ id: 'y', name: 'Y', prices: { usd: '43.37' } })).toBe(43.37);
    expect(searchCardUsd({ id: 'z', name: 'Z' })).toBeUndefined();
  });
});
