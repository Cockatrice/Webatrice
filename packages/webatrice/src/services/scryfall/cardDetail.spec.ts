import { detailTargetKey, fetchScryfallDetail, selectCardFace, type ScryfallDetail } from './cardDetail';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchScryfallDetail', () => {
  it('fetches by id when known, else by exact name without a Token suffix', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ id: 'x', name: 'X' }) }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchScryfallDetail('abc', 'Ignored');
    await fetchScryfallDetail(undefined, 'Soldier Token');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.scryfall.com/cards/abc',
      'https://api.scryfall.com/cards/named?exact=Soldier',
    ]);
  });

  it('uses subscriber-owned abort signals as the only request option', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ id: 'x', name: 'X' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { signal } = new AbortController();

    await fetchScryfallDetail('abc', 'Ignored', signal);
    await fetchScryfallDetail(undefined, 'Fire // Ice');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.scryfall.com/cards/abc',
      { signal: expect.any(AbortSignal) },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent('Fire // Ice')}`,
      { signal: expect.any(AbortSignal) },
    );
    expect(fetchMock.mock.calls[0][1]?.signal).not.toBe(signal);
  });

  it('returns null on an HTTP or network failure and rethrows an abort', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await fetchScryfallDetail(undefined, 'X')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline');
    }));
    expect(await fetchScryfallDetail(undefined, 'X')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }));
    await expect(fetchScryfallDetail(undefined, 'X')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('selectCardFace', () => {
  const detail: ScryfallDetail = {
    id: 'd',
    name: 'Delver of Secrets // Insectile Aberration',
    card_faces: [{ name: 'Delver of Secrets' }, { name: 'Insectile Aberration' }],
  };

  it('matches exactly, ignoring case', () => {
    expect(selectCardFace(detail, 'insectile aberration')?.name).toBe('Insectile Aberration');
  });

  it('matches after stripping a Token suffix, then by containment either way', () => {
    const tokens: ScryfallDetail = {
      id: 't',
      name: 'Human Soldier // Goblin',
      card_faces: [{ name: 'Goblin' }, { name: 'Human Soldier' }],
    };
    expect(selectCardFace(tokens, 'Human Soldier Token')?.name).toBe('Human Soldier');
    expect(selectCardFace(tokens, 'Elite Human Soldier')?.name).toBe('Human Soldier');
    expect(selectCardFace(tokens, 'Soldier')?.name).toBe('Human Soldier');
  });

  it('falls back to the first face, and to none for single-faced cards', () => {
    expect(selectCardFace(detail, 'Something Else')?.name).toBe('Delver of Secrets');
    expect(selectCardFace({ id: 's', name: 'Sol Ring' }, 'Sol Ring')).toBeUndefined();
    expect(selectCardFace(null, 'Sol Ring')).toBeUndefined();
  });
});

describe('detailTargetKey', () => {
  it('keys a target by id, else by name', () => {
    expect(detailTargetKey({ name: 'X', scryfallId: 'id' })).toBe('id');
    expect(detailTargetKey({ name: 'X' })).toBe('name:X');
  });
});
