import { rooms, SortDirection } from '@cockatrice/datatrice';

import {
  chipReset,
  clampPlayers,
  currentSortOption,
  formatSummary,
  hidesFullAndStarted,
  moreFilterChips,
  moreFiltersReset,
  parseCreatorNames,
  playersSummary,
  setHideFullAndStarted,
  toggleGameType,
} from './quickFilters';

const DEFAULTS = rooms.DEFAULT_GAME_FILTERS;

describe('moreFilterChips', () => {
  it('lists only the filters that live under More filters', () => {
    const filters = {
      ...DEFAULTS,
      gameNameFilter: 'cube',
      hideFullGames: true,
      creatorNameFilters: ['alice', 'bob'],
      maxGameAgeSeconds: 3600,
      hideIgnoredUserGames: true,
      showOnlyIfSpectatorsCanWatch: true,
    };
    expect(moreFilterChips(filters, { passwordInBar: true })).toEqual([
      { id: 'creators', names: 'alice, bob' },
      { id: 'maxAge', seconds: 3600 },
      { id: 'hideIgnored' },
      { id: 'spectators' },
    ]);
  });

  it('adds the password filter when the bar has no room for its toggle', () => {
    const filters = { ...DEFAULTS, hidePasswordProtectedGames: true };
    expect(moreFilterChips(filters, { passwordInBar: true })).toEqual([]);
    expect(moreFilterChips(filters, { passwordInBar: false })).toEqual([{ id: 'hidePassword' }]);
  });

  it('removes a chip back to the default and resets every spectator rule together', () => {
    const filters = {
      ...DEFAULTS,
      showOnlyIfSpectatorsCanWatch: true,
      showOnlyIfSpectatorsCanChat: true,
      creatorNameFilters: ['alice'],
    };
    expect({ ...filters, ...chipReset('spectators') }).toEqual({ ...DEFAULTS, creatorNameFilters: ['alice'] });
    expect({ ...filters, ...moreFiltersReset({ passwordInBar: true }) }).toEqual(DEFAULTS);
  });

  it('keeps the bar password toggle when More filters resets', () => {
    const filters = { ...DEFAULTS, hidePasswordProtectedGames: true, hideBuddiesOnlyGames: true };
    expect({ ...filters, ...moreFiltersReset({ passwordInBar: true }) }).toEqual({ ...DEFAULTS, hidePasswordProtectedGames: true });
    expect({ ...filters, ...moreFiltersReset({ passwordInBar: false }) }).toEqual(DEFAULTS);
  });
});

describe('hide full & started', () => {
  it('is on only when both hide flags are on, and sets both', () => {
    expect(hidesFullAndStarted({ ...DEFAULTS, hideFullGames: true })).toBe(false);
    expect(hidesFullAndStarted({ ...DEFAULTS, ...setHideFullAndStarted(true) })).toBe(true);
  });
});

describe('playersSummary', () => {
  it.each([
    [1, 99, { kind: 'any' }],
    [2, 2, { kind: 'exactly', count: 2 }],
    [3, 99, { kind: 'atLeast', count: 3 }],
    [1, 4, { kind: 'atMost', count: 4 }],
    [3, 4, { kind: 'between', min: 3, max: 4 }],
  ])('reads %i–%i', (min, max, expected) => {
    expect(playersSummary({ ...DEFAULTS, maxPlayersFilterMin: min, maxPlayersFilterMax: max })).toEqual(expected);
  });

  it('clamps typed player counts to the filter range', () => {
    expect(clampPlayers(0)).toBe(1);
    expect(clampPlayers(150)).toBe(99);
    expect(clampPlayers(3.4)).toBe(3);
    expect(clampPlayers(Number.NaN)).toBeNull();
  });
});

describe('formats', () => {
  it('summarises the chosen game types and ignores ones the room no longer has', () => {
    const map = { 1: 'Commander', 2: 'Modern' };
    expect(formatSummary(DEFAULTS, map)).toEqual({ kind: 'all' });
    expect(formatSummary({ ...DEFAULTS, gameTypeFilter: [1, 7] }, map)).toEqual({ kind: 'one', name: 'Commander' });
    expect(formatSummary({ ...DEFAULTS, gameTypeFilter: [1, 2] }, map)).toEqual({ kind: 'many', count: 2 });
  });

  it('toggles one game type in or out', () => {
    expect(toggleGameType({ ...DEFAULTS, gameTypeFilter: [1] }, 2)).toEqual({ gameTypeFilter: [1, 2] });
    expect(toggleGameType({ ...DEFAULTS, gameTypeFilter: [1, 2] }, 1)).toEqual({ gameTypeFilter: [2] });
  });
});

describe('parseCreatorNames', () => {
  it('splits on commas and drops blanks', () => {
    expect(parseCreatorNames(' alice, ,bob ,')).toEqual(['alice', 'bob']);
  });
});

describe('currentSortOption', () => {
  it('matches the stored sort to a menu option, whatever the case of the direction', () => {
    expect(currentSortOption({ field: 'info.startTime', order: SortDirection.DESC })).toBe('newest');
    expect(currentSortOption({ field: 'info.startTime', order: 'asc' })).toBe('oldest');
    expect(currentSortOption({ field: 'info.maxPlayers', order: SortDirection.ASC })).toBeNull();
  });
});
