const scheduler = vi.hoisted(() => ({
  request: undefined as ((url: string, init?: RequestInit) => Promise<Response>) | undefined,
}));

vi.mock('../../services/scryfall/scheduler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/scryfall/scheduler')>();
  return {
    ...actual,
    scheduleScryfallRequest: (url: string, init?: RequestInit) => scheduler.request!(url, init),
  };
});

import { createScryfallScheduler } from '../../services/scryfall/scheduler';
import {
  BRACKET_SOURCE_TIMEOUT_MS,
  clearBracketSourceCaches,
  fetchGameChangers,
  fetchOracleText,
  fetchSpellbookCombos,
} from './bracketSources';
import type { DeckCard } from './types';

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function malformed(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  } as unknown as Response;
}

function hanging(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scheduler.request = createScryfallScheduler();
  clearBracketSourceCaches();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Scryfall request shapes (characterization)', () => {
  it('asks for the Game Changers list with only a timeout signal', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }] }));

    await fetchGameChangers();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/search?q=is%3Agamechanger&order=name&unique=cards',
      { signal: expect.any(AbortSignal) },
    );
    expect(Object.keys(fetchMock.mock.calls[0][1])).toEqual(['signal']);
  });

  it('posts oracle-text names 75 to a request, one request at a time', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock.mockReturnValueOnce(firstResponse).mockResolvedValue(json({ data: [] }));
    const names = Array.from({ length: 76 }, (_, i) => `Card ${i}`);

    const result = fetchOracleText(names);
    try {
      await vi.advanceTimersByTimeAsync(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      resolveFirst(json({ data: [] }));
      await vi.advanceTimersByTimeAsync(0);
      await result;
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.scryfall.com/cards/collection');
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: names.slice(0, 75).map((name) => ({ name })) }),
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ identifiers: [{ name: 'Card 75' }] });
  });
});

describe('fetchGameChangers', () => {
  it.each([null, {}, { name: 42 }, { name: '' }, { name: '  ' }])(
    'keeps valid names but retries a list containing %j', async (invalid) => {
      fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }, invalid] }));
      expect(await fetchGameChangers()).toEqual({
        status: 'partial', data: new Set(['Sol Ring']),
        failure: { kind: 'malformed' }, missing: 1, total: 2,
      });
      fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }, { name: 'Rhystic Study' }] }));
      expect(await fetchGameChangers()).toEqual({ status: 'ok', data: new Set(['Sol Ring', 'Rhystic Study']) });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('returns the list and caches it for the session', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }, { name: 'Rhystic Study' }] }));

    expect(await fetchGameChangers()).toEqual({ status: 'ok', data: new Set(['Sol Ring', 'Rhystic Study']) });
    expect(await fetchGameChangers()).toEqual({ status: 'ok', data: new Set(['Sol Ring', 'Rhystic Study']) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent callers', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }] }));
    await Promise.all([fetchGameChangers(), fetchGameChangers()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an HTTP error', () => json({}, 500), { kind: 'http', status: 500 }],
    ['malformed JSON', malformed, { kind: 'malformed' }],
    ['a body without a data array', () => json({ object: 'error' }), { kind: 'malformed' }],
    ['a list with no card names', () => json({ data: [{ id: 'x' }] }), { kind: 'malformed' }],
  ])('reports %s as unavailable instead of an empty list, and does not cache it', async (_name, respond, failure) => {
    fetchMock.mockImplementation(async () => respond());

    expect(await fetchGameChangers()).toEqual({ status: 'unavailable', failure });

    fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring' }] }));
    expect(await fetchGameChangers()).toEqual({ status: 'ok', data: new Set(['Sol Ring']) });
  });

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchGameChangers()).toEqual({ status: 'unavailable', failure: { kind: 'network' } });
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hanging);

    const result = fetchGameChangers();
    await vi.advanceTimersByTimeAsync(BRACKET_SOURCE_TIMEOUT_MS);

    expect(await result).toEqual({ status: 'unavailable', failure: { kind: 'timeout' } });
  });

  it('reports a timeout while the body is still arriving as a timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (_url: unknown, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: () => hanging(undefined, init),
    }));

    const result = fetchGameChangers();
    await vi.advanceTimersByTimeAsync(BRACKET_SOURCE_TIMEOUT_MS);

    expect(await result).toEqual({ status: 'unavailable', failure: { kind: 'timeout' } });
  });
});

describe('fetchOracleText', () => {
  it('reports omitted identifiers as partial and retries only the omitted card', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ name: 'Sol Ring', oracle_text: 'Add mana.' }] }));
    expect(await fetchOracleText(['Sol Ring', 'Negate'])).toEqual({
      status: 'partial', data: new Map([['sol ring', 'Add mana.']]),
      failure: { kind: 'malformed' }, missing: 1, total: 2,
    });
    fetchMock.mockResolvedValueOnce(json({ data: [{ name: 'Negate', oracle_text: 'Counter it.' }] }));
    expect(await fetchOracleText(['Sol Ring', 'Negate'])).toEqual({
      status: 'ok', data: new Map([['sol ring', 'Add mana.'], ['negate', 'Counter it.']]),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).identifiers).toEqual([{ name: 'Negate' }]);
  });

  it('does not cache a completely omitted result as empty oracle text', async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    expect(await fetchOracleText(['Negate'])).toEqual({ status: 'unavailable', failure: { kind: 'malformed' } });
    await fetchOracleText(['Negate']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts a returned card with no oracle text', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ name: 'Forest' }] }));
    expect(await fetchOracleText(['Forest'])).toEqual({ status: 'ok', data: new Map([['forest', '']]) });
  });

  function collectionResponder(failChunkContaining?: string) {
    return async (_url: unknown, init?: RequestInit) => {
      const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: Array<{ name: string }> };
      if (failChunkContaining && identifiers.some((i) => i.name === failChunkContaining)) {
        return json({}, 503);
      }
      return json({
        not_found: identifiers.filter((i) => i.name === 'Unknown Card'),
        data: identifiers
          .filter((i) => i.name !== 'Unknown Card')
          .map((i) => ({ name: i.name, oracle_text: `${i.name} text` })),
      });
    };
  }

  it('keys text by lower-cased name and caches names Scryfall has no match for as empty', async () => {
    fetchMock.mockImplementation(collectionResponder());

    const result = await fetchOracleText(['Sol Ring', 'Unknown Card']);

    expect(result).toEqual({
      status: 'ok',
      data: new Map([['sol ring', 'Sol Ring text'], ['unknown card', '']]),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).identifiers).toEqual([
      { name: 'Sol Ring' },
      { name: 'Unknown Card' },
    ]);
    await fetchOracleText(['sol ring', 'unknown card']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('joins face texts and also keys a split card by its front face', async () => {
    fetchMock.mockResolvedValue(json({
      data: [{ name: 'Fire // Ice', card_faces: [{ oracle_text: 'Fire text' }, { oracle_text: 'Ice text' }] }],
    }));
    const result = await fetchOracleText(['Fire']);
    expect(result).toEqual({ status: 'ok', data: new Map([['fire', 'Fire text\nIce text']]) });
  });

  it('reports a failed batch as partial, without caching the names it missed', async () => {
    const names = Array.from({ length: 80 }, (_, i) => `Card ${i}`);
    fetchMock.mockImplementation(collectionResponder('Card 79'));

    const result = await fetchOracleText(names);

    expect(result.status).toBe('partial');
    expect(result).toEqual(expect.objectContaining({
      failure: { kind: 'http', status: 503 },
      missing: 5,
      total: 80,
    }));

    fetchMock.mockImplementation(collectionResponder());
    expect((await fetchOracleText(names)).status).toBe('ok');
    const retried = JSON.parse(String(fetchMock.mock.calls[2][1].body)).identifiers;
    expect(retried).toHaveLength(5);
  });

  it('reports a chunk with a nameless card as malformed, without caching any of it', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ name: 'Sol Ring', oracle_text: 'x' }, { oracle_text: 'y' }] }));

    expect(await fetchOracleText(['Sol Ring', 'Negate'])).toEqual({
      status: 'unavailable',
      failure: { kind: 'malformed' },
    });

    fetchMock.mockImplementation(collectionResponder());
    await fetchOracleText(['Sol Ring']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a total failure as unavailable', async () => {
    fetchMock.mockResolvedValue(malformed());
    expect(await fetchOracleText(['Sol Ring'])).toEqual({ status: 'unavailable', failure: { kind: 'malformed' } });
  });
});

describe('fetchSpellbookCombos', () => {
  it.each([
    null, {}, { id: '' }, { id: 7 }, { id: 'bad', uses: {} },
    { id: 'bad', uses: [null] }, { id: 'bad', uses: [{ card: {} }] },
    { id: 'bad', uses: [{ card: { name: 'Sol Ring' }, quantity: '1' }] },
    { id: 'bad', uses: [{ card: { name: 'Sol Ring' }, zoneLocations: [1] }] },
    { id: 'bad', produces: [{ feature: { id: '1' } }] },
    { id: 'bad', requires: [{ template: { id: '1' } }] },
    { id: 'bad', manaValueNeeded: '0' }, { id: 'bad', notablePrerequisites: [] },
  ])('reports malformed combo %j as partial without losing valid combos', async (invalid) => {
    fetchMock.mockResolvedValue(json({ results: { included: [{ id: 'valid' }, invalid] } }));
    expect(await fetchSpellbookCombos(cards)).toEqual({
      status: 'partial', data: [{ id: 'valid' }], failure: { kind: 'malformed' }, missing: 1, total: 2,
    });
  });

  it('reports an entirely malformed combo list as unavailable', async () => {
    fetchMock.mockResolvedValue(json({ results: { included: [null] } }));
    expect(await fetchSpellbookCombos(cards)).toEqual({ status: 'unavailable', failure: { kind: 'malformed' } });
  });

  const cards: DeckCard[] = [
    { name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall', set: 'c21' },
    { name: 'Negate', quantity: 1, category: 'main', lookupSource: 'scryfall' },
    { name: 'Negate', quantity: 2, category: 'sideboard', lookupSource: 'scryfall' },
  ];

  it('sends only main-deck names and quantities, and returns the included combos', async () => {
    fetchMock.mockResolvedValue(json({ results: { included: [{ id: 'c1' }] } }));

    expect(await fetchSpellbookCombos(cards)).toEqual({ status: 'ok', data: [{ id: 'c1' }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backend.commanderspellbook.com/find-my-combos/');
    expect(JSON.parse(String(init.body))).toEqual({
      main: [{ card: 'Sol Ring', quantity: 1 }, { card: 'Negate', quantity: 1 }],
      commanders: [],
    });
  });

  it('preserves valid nested assessment fields and accepts omitted legacy fields', async () => {
    const combo = {
      id: 'full', uses: [{ card: { name: 'Sol Ring' }, quantity: 1, zoneLocations: ['B'] }],
      produces: [{ feature: { id: 1 }, quantity: 2 }],
      requires: [{ template: { id: 2 }, quantity: 1, zoneLocations: ['H'] }],
      manaValueNeeded: 3, notablePrerequisites: 'A prerequisite',
    };
    fetchMock.mockResolvedValue(json({ results: { included: [combo, { id: 'legacy' }] } }));
    expect(await fetchSpellbookCombos(cards)).toEqual({ status: 'ok', data: [combo, { id: 'legacy' }] });
  });

  it('sends designated commanders in their own list', async () => {
    fetchMock.mockResolvedValue(json({ results: { included: [] } }));

    await fetchSpellbookCombos([
      { name: 'Thrasios, Triton Hero', quantity: 1, category: 'main', isCommander: true, lookupSource: 'scryfall' },
      ...cards,
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      main: [{ card: 'Sol Ring', quantity: 1 }, { card: 'Negate', quantity: 1 }],
      commanders: [{ card: 'Thrasios, Triton Hero', quantity: 1 }],
    });
  });

  it('makes no request when only the sideboard has cards', async () => {
    expect(await fetchSpellbookCombos([cards[2]])).toEqual({ status: 'ok', data: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty included list as no combos', async () => {
    fetchMock.mockResolvedValue(json({ results: { included: [] } }));
    expect(await fetchSpellbookCombos(cards)).toEqual({ status: 'ok', data: [] });
  });

  it.each([
    ['results without an included list', () => json({ results: {} }), { kind: 'malformed' }],
    ['an included value that is not a list', () => json({ results: { included: {} } }), { kind: 'malformed' }],
    ['an outage', () => json({ detail: 'down' }, 502), { kind: 'http', status: 502 }],
    ['malformed JSON', malformed, { kind: 'malformed' }],
    ['a body without results', () => json({ detail: 'x' }), { kind: 'malformed' }],
  ])('reports %s as unavailable rather than "no combos"', async (_name, respond, failure) => {
    fetchMock.mockImplementation(async () => respond());
    expect(await fetchSpellbookCombos(cards)).toEqual({ status: 'unavailable', failure });
  });
});
