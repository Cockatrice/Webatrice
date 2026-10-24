import { rooms, GameSortField, SortDirection, type GameFilters, type GametypeMap } from '@cockatrice/datatrice';

const DEFAULTS = rooms.DEFAULT_GAME_FILTERS;

export const MAX_AGE_OPTIONS = [0, 5 * 60, 10 * 60, 30 * 60, 60 * 60, 2 * 60 * 60];

export type FilterChipId =
  | 'creators'
  | 'maxAge'
  | 'hidePassword'
  | 'hideBuddiesOnly'
  | 'hideIgnored'
  | 'hideNotBuddy'
  | 'hideOpenDecklist'
  | 'spectators';

export interface FilterChip {
  id: FilterChipId;
  names?: string;
  seconds?: number;
}

export interface ChipOptions {
  passwordInBar: boolean;
}

const CHIP_RESET: Record<FilterChipId, Partial<GameFilters>> = {
  creators: { creatorNameFilters: DEFAULTS.creatorNameFilters },
  maxAge: { maxGameAgeSeconds: DEFAULTS.maxGameAgeSeconds },
  hidePassword: { hidePasswordProtectedGames: false },
  hideBuddiesOnly: { hideBuddiesOnlyGames: false },
  hideIgnored: { hideIgnoredUserGames: false },
  hideNotBuddy: { hideNotBuddyCreatedGames: false },
  hideOpenDecklist: { hideOpenDecklistGames: false },
  spectators: {
    showOnlyIfSpectatorsCanWatch: false,
    showSpectatorPasswordProtected: false,
    showOnlyIfSpectatorsCanChat: false,
    showOnlyIfSpectatorsCanSeeHands: false,
  },
};

export function moreFilterChips(filters: GameFilters, { passwordInBar }: ChipOptions): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.creatorNameFilters.length > 0) {
    chips.push({ id: 'creators', names: filters.creatorNameFilters.join(', ') });
  }
  if (filters.maxGameAgeSeconds > 0) {
    chips.push({ id: 'maxAge', seconds: filters.maxGameAgeSeconds });
  }
  if (!passwordInBar && filters.hidePasswordProtectedGames) {
    chips.push({ id: 'hidePassword' });
  }
  if (filters.hideBuddiesOnlyGames) {
    chips.push({ id: 'hideBuddiesOnly' });
  }
  if (filters.hideIgnoredUserGames) {
    chips.push({ id: 'hideIgnored' });
  }
  if (filters.hideNotBuddyCreatedGames) {
    chips.push({ id: 'hideNotBuddy' });
  }
  if (filters.hideOpenDecklistGames) {
    chips.push({ id: 'hideOpenDecklist' });
  }
  if (filters.showOnlyIfSpectatorsCanWatch) {
    chips.push({ id: 'spectators' });
  }
  return chips;
}

export function chipReset(id: FilterChipId): Partial<GameFilters> {
  return CHIP_RESET[id];
}

export function moreFiltersReset(options: ChipOptions): Partial<GameFilters> {
  const ids = Object.keys(CHIP_RESET) as FilterChipId[];
  return Object.assign({}, ...ids.filter((id) => id !== 'hidePassword' || !options.passwordInBar).map(chipReset));
}

export function hidesFullAndStarted(filters: GameFilters): boolean {
  return filters.hideFullGames && filters.hideGamesThatStarted;
}

export function setHideFullAndStarted(on: boolean): Partial<GameFilters> {
  return { hideFullGames: on, hideGamesThatStarted: on };
}

export type PlayersSummary =
  | { kind: 'any' }
  | { kind: 'exactly'; count: number }
  | { kind: 'between'; min: number; max: number }
  | { kind: 'atLeast'; count: number }
  | { kind: 'atMost'; count: number };

export function playersSummary({ maxPlayersFilterMin: min, maxPlayersFilterMax: max }: GameFilters): PlayersSummary {
  const lowOpen = min <= rooms.DEFAULT_MAX_PLAYERS_MIN;
  const highOpen = max >= rooms.DEFAULT_MAX_PLAYERS_MAX;
  if (lowOpen && highOpen) {
    return { kind: 'any' };
  }
  if (min === max) {
    return { kind: 'exactly', count: min };
  }
  if (highOpen) {
    return { kind: 'atLeast', count: min };
  }
  if (lowOpen) {
    return { kind: 'atMost', count: max };
  }
  return { kind: 'between', min, max };
}

export function clampPlayers(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const whole = Math.round(value);
  return Math.min(rooms.DEFAULT_MAX_PLAYERS_MAX, Math.max(rooms.DEFAULT_MAX_PLAYERS_MIN, whole));
}

export const PLAYER_PRESETS: ReadonlyArray<{ id: 'any' | 'two' | 'threeFour' | 'fivePlus'; min: number; max: number }> = [
  { id: 'any', min: rooms.DEFAULT_MAX_PLAYERS_MIN, max: rooms.DEFAULT_MAX_PLAYERS_MAX },
  { id: 'two', min: 2, max: 2 },
  { id: 'threeFour', min: 3, max: 4 },
  { id: 'fivePlus', min: 5, max: rooms.DEFAULT_MAX_PLAYERS_MAX },
];

export type FormatSummary = { kind: 'all' } | { kind: 'one'; name: string } | { kind: 'many'; count: number };

export function formatSummary(filters: GameFilters, gametypeMap: GametypeMap): FormatSummary {
  const known = filters.gameTypeFilter.filter((id) => gametypeMap[id] !== undefined);
  if (known.length === 0) {
    return { kind: 'all' };
  }
  if (known.length === 1) {
    return { kind: 'one', name: gametypeMap[known[0]] };
  }
  return { kind: 'many', count: known.length };
}

export function toggleGameType(filters: GameFilters, id: number): Partial<GameFilters> {
  const set = new Set(filters.gameTypeFilter);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  return { gameTypeFilter: Array.from(set) };
}

export function parseCreatorNames(text: string): string[] {
  return text.split(',').map((name) => name.trim()).filter(Boolean);
}

export type SortOptionId = 'newest' | 'oldest' | 'description' | 'host';

export interface SortOption {
  id: SortOptionId;
  field: string;
  order: SortDirection;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { id: 'newest', field: GameSortField.START_TIME, order: SortDirection.DESC },
  { id: 'oldest', field: GameSortField.START_TIME, order: SortDirection.ASC },
  { id: 'description', field: 'info.description', order: SortDirection.ASC },
  { id: 'host', field: 'info.creatorInfo.name', order: SortDirection.ASC },
];

export function currentSortOption(sortBy: { field: string; order: string }): SortOptionId | null {
  const order = sortBy.order.toUpperCase();
  return SORT_OPTIONS.find((option) => option.field === sortBy.field && option.order.toUpperCase() === order)?.id ?? null;
}
