import type { GroupMode, SortMode } from './zoneViewSort';

export interface ZoneViewPreferences {
  groupBy: GroupMode;
  sortBy: SortMode;
  pileView: boolean;
}

const GROUP_MODES: readonly GroupMode[] = ['none', 'type', 'cmc', 'color'];
const SORT_MODES: readonly SortMode[] = ['none', 'name', 'cmc', 'type', 'color', 'set', 'pt'];

export const DEFAULT_ZONE_VIEW_PREFERENCES: ZoneViewPreferences = { groupBy: 'type', sortBy: 'name', pileView: true };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage disabled or full: the choice holds for this view only.
  }
}

export function readZoneViewPreferences(storageKey: string): ZoneViewPreferences {
  const groupBy = read(`${storageKey}GroupBy`);
  const sortBy = read(`${storageKey}SortBy`);
  const pileView = read(`${storageKey}PileView`);
  return {
    groupBy: GROUP_MODES.find((m) => m === groupBy) ?? DEFAULT_ZONE_VIEW_PREFERENCES.groupBy,
    sortBy: SORT_MODES.find((m) => m === sortBy) ?? DEFAULT_ZONE_VIEW_PREFERENCES.sortBy,
    pileView: pileView === null ? DEFAULT_ZONE_VIEW_PREFERENCES.pileView : pileView === '1',
  };
}

export function writeZoneViewPreferences(storageKey: string, prefs: Partial<ZoneViewPreferences>): void {
  if (prefs.groupBy !== undefined) {
    write(`${storageKey}GroupBy`, prefs.groupBy);
  }
  if (prefs.sortBy !== undefined) {
    write(`${storageKey}SortBy`, prefs.sortBy);
  }
  if (prefs.pileView !== undefined) {
    write(`${storageKey}PileView`, prefs.pileView ? '1' : '0');
  }
}

const SHUFFLE_ON_CLOSE_STORAGE_KEY = 'webatrice.searchLibraryShuffleOnClose';

export function readShuffleOnClose(): boolean {
  return read(SHUFFLE_ON_CLOSE_STORAGE_KEY) !== '0';
}

export function writeShuffleOnClose(value: boolean): void {
  write(SHUFFLE_ON_CLOSE_STORAGE_KEY, value ? '1' : '0');
}
