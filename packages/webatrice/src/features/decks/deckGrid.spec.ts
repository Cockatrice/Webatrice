import {
  deckFilterOptions,
  deckTileView,
  filterDeckViews,
  matchesColours,
  NO_DECK_FILTERS,
  sortDeckViews,
  toggleListValue,
  type DeckGridFilters,
} from './deckGrid';
import type { DeckSummary } from './deckSummary';
import type { FlatDeck } from './deckTree';

const deck = (id: number, name: string, extra: Partial<FlatDeck> = {}): FlatDeck => ({
  id, name, path: '', creationTime: id, visibility: 'private', ...extra,
});

const filters = (patch: Partial<DeckGridFilters>): DeckGridFilters => ({ ...NO_DECK_FILTERS, ...patch });

describe('deckTileView', () => {
  it('prefers the stored preview over the downloaded file for banner and tags', () => {
    const view = deckTileView(
      deck(1, 'Elves', { bannerCardName: 'Llanowar Elves', tags: ['Tribal'], colorIdentity: 'g' }),
      { bannerCard: 'Forest', tags: ['Old'], format: 'Commander', bracketLevel: 2 },
    );
    expect(view.artUrl).toContain('Llanowar');
    expect(view.tags).toEqual(['Tribal']);
    expect(view.colours).toBe('G');
    expect(view.format).toBe('commander');
    expect(view.bracket).toBe(2);
  });

  it('falls back to the downloaded file and has no art before either is known', () => {
    expect(deckTileView(deck(1, 'A'), undefined)).toMatchObject({ artUrl: null, tags: [], format: undefined });
    expect(deckTileView(deck(1, 'A'), { commanderName: 'Atraxa', tags: ['Walkers'] }))
      .toMatchObject({ tags: ['Walkers'], artUrl: expect.stringContaining('Atraxa') });
  });
});

describe('matchesColours', () => {
  it.each([
    ['including', 'WUB', ['W', 'U'], true],
    ['including', 'W', ['W', 'U'], false],
    ['exactly', 'WU', ['U', 'W'], true],
    ['exactly', 'WUB', ['W', 'U'], false],
    ['atMost', 'W', ['W', 'U'], true],
    ['atMost', '', ['W'], true],
    ['atMost', 'WB', ['W', 'U'], false],
  ] as const)('%s %s against %j is %s', (mode, identity, colours, expected) => {
    expect(matchesColours(identity, colours, mode)).toBe(expected);
  });

  it('passes everything without colours and nothing with an unknown identity', () => {
    expect(matchesColours(undefined, [], 'including')).toBe(true);
    expect(matchesColours(undefined, ['W'], 'atMost')).toBe(false);
  });
});

describe('filterDeckViews', () => {
  const summaries: Record<number, DeckSummary> = {
    1: { format: 'commander', bracketLevel: 3, tags: ['Ramp'] },
    2: { format: 'modern', tags: ['Burn'] },
  };
  const views = [
    deckTileView(deck(1, 'Atraxa', { colorIdentity: 'WUBG' }), summaries[1]),
    deckTileView(deck(2, 'Burn', { colorIdentity: 'R' }), summaries[2]),
    deckTileView(deck(3, 'Unloaded', { colorIdentity: 'G' }), undefined),
  ];
  const ids = (f: DeckGridFilters) => {
    const out = filterDeckViews(views, f);
    return { shown: out.shown.map((v) => v.deck.id), pending: out.pending };
  };

  it('searches names and tags, holding back decks whose tags are still downloading', () => {
    expect(ids(filters({ query: 'atr' }))).toEqual({ shown: [1], pending: 1 });
    expect(ids(filters({ query: 'burn' }))).toEqual({ shown: [2], pending: 1 });
    expect(ids(filters({ query: 'unl' }))).toEqual({ shown: [3], pending: 0 });
  });

  it('filters by format, bracket and tag once downloaded and counts the rest as pending', () => {
    expect(ids(filters({ format: 'commander' }))).toEqual({ shown: [1], pending: 1 });
    expect(ids(filters({ bracket: 3 }))).toEqual({ shown: [1], pending: 1 });
    expect(ids(filters({ tags: ['Burn'] }))).toEqual({ shown: [2], pending: 1 });
  });

  it('filters by colour from the stored identity without waiting for downloads', () => {
    expect(ids(filters({ colours: ['G'] }))).toEqual({ shown: [1, 3], pending: 0 });
  });

  it('shows everything without filters', () => {
    expect(ids(NO_DECK_FILTERS)).toEqual({ shown: [1, 2, 3], pending: 0 });
  });
});

describe('sortDeckViews', () => {
  it.each(['en', 'sv'])('uses one collator per sort and preserves locale and tie ordering (%s)', (locale) => {
    const inputs = [deck(5, 'ä'), deck(3, 'a'), deck(1, 'A'), deck(7, 'z'), deck(8, 'a 10'), deck(6, 'a 2')]
      .map((d) => deckTileView({ ...d, creationTime: 1 }, undefined));
    const byName = (a: typeof inputs[number], b: typeof inputs[number]) =>
      a.deck.name.localeCompare(b.deck.name, locale, { sensitivity: 'base', numeric: true });
    const collator = vi.spyOn(Intl, 'Collator');
    try {
      for (const sort of ['nameAsc', 'nameDesc', 'oldest', 'newest'] as const) {
        collator.mockClear();
        const expected = [...inputs].sort((a, b) => {
          if (sort === 'nameAsc') {
            return byName(a, b) || a.deck.id - b.deck.id;
          }
          if (sort === 'nameDesc') {
            return byName(b, a) || a.deck.id - b.deck.id;
          }
          return byName(a, b);
        });
        expect(sortDeckViews(inputs, sort, locale)).toEqual(expected);
        expect(collator).toHaveBeenCalledExactlyOnceWith(locale, { sensitivity: 'base', numeric: true });
      }
    } finally {
      collator.mockRestore();
    }
  });

  const views = [deck(2, 'beta'), deck(1, 'Alpha'), deck(3, 'alpha 10'), deck(4, 'alpha 9')].map((d) => deckTileView(d, undefined));
  const names = (sort: Parameters<typeof sortDeckViews>[1]) => sortDeckViews(views, sort, 'en').map((v) => v.deck.name);

  it('sorts by creation time and by natural name order', () => {
    expect(names('newest')).toEqual(['alpha 9', 'alpha 10', 'beta', 'Alpha']);
    expect(names('oldest')).toEqual(['Alpha', 'beta', 'alpha 10', 'alpha 9']);
    expect(names('nameAsc')).toEqual(['Alpha', 'alpha 9', 'alpha 10', 'beta']);
    expect(names('nameDesc')).toEqual(['beta', 'alpha 10', 'alpha 9', 'Alpha']);
  });
});

describe('deckFilterOptions', () => {
  it('collects tags, formats and brackets in view and keeps the current selection offered', () => {
    const views = [
      deckTileView(deck(1, 'A', { tags: ['b', 'a'] }), { format: 'Modern', bracketLevel: 2 }),
      deckTileView(deck(2, 'B'), { tags: ['a'], format: 'commander', bracketLevel: 4 }),
    ];
    expect(deckFilterOptions(views, filters({ tags: ['z'], bracket: 5 }))).toEqual({
      tags: ['a', 'b', 'z'], formats: ['commander', 'modern'], brackets: [2, 4, 5],
    });
  });
});

it('toggles a value in a list', () => {
  expect(toggleListValue(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggleListValue(['a', 'b'], 'a')).toEqual(['b']);
});
