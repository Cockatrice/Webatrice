import {
  defaultSetOrder,
  getSetPreference,
  setCode,
  type Set,
  type SetPreference,
  type SetPreferenceMap,
} from '@app/services';

export interface SetRow {
  code: string;
  longName: string;
  setType: string;
  releaseDate: string;
  enabled: boolean;
  isKnown: boolean;
}

export type SetSortColumn = 'code' | 'longName' | 'setType' | 'releaseDate';

function toRow(set: Set, pref: SetPreference): SetRow {
  return {
    code: setCode(set),
    longName: set.longname?.value ?? '',
    setType: set.settype?.value ?? '',
    releaseDate: set.releasedate?.value ?? '',
    enabled: pref.enabled,
    isKnown: pref.isKnown,
  };
}

export function buildSetRows(sets: readonly Set[], prefs: SetPreferenceMap): SetRow[] {
  return sets
    .map((set, index) => ({ set, index, pref: getSetPreference(prefs, setCode(set)) }))
    .sort((a, b) => a.pref.sortKey - b.pref.sortKey || a.index - b.index)
    .map(({ set, pref }) => toRow(set, pref));
}

export function rowsToPreferences(rows: readonly SetRow[]): SetPreference[] {
  return rows.map((row, i) => ({ code: row.code, sortKey: i + 1, enabled: row.enabled, isKnown: row.isKnown }));
}

export function restoreDefaultOrder(rows: readonly SetRow[], sets: readonly Set[]): SetRow[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return defaultSetOrder(sets)
    .map((set) => byCode.get(setCode(set)))
    .filter((row): row is SetRow => Boolean(row));
}

export function filterSetRows(rows: readonly SetRow[], search: string): SetRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }
  return rows.filter((row) => [row.setType, row.longName, row.code, row.releaseDate]
    .some((field) => field.toLowerCase().includes(needle)));
}

export function sortSetRows(rows: readonly SetRow[], column: SetSortColumn, ascending: boolean): SetRow[] {
  const sorted = [...rows].sort((a, b) => a[column].localeCompare(b[column]));
  return ascending ? sorted : sorted.reverse();
}

export function setEnabled(rows: readonly SetRow[], codes: ReadonlySet<string> | 'all', enabled: boolean): SetRow[] {
  return rows.map((row) => (codes === 'all' || codes.has(row.code) ? { ...row, enabled } : row));
}

function swap(rows: SetRow[], a: number, b: number): void {
  [rows[a], rows[b]] = [rows[b], rows[a]];
}

export type MoveDirection = 'top' | 'up' | 'down' | 'bottom';

export function moveSetRows(
  rows: readonly SetRow[],
  visibleCodes: readonly string[],
  selected: ReadonlySet<string>,
  direction: MoveDirection,
): SetRow[] {
  const next = [...rows];
  if (!visibleCodes.some((code) => selected.has(code))) {
    return next;
  }
  const positions = new Map(rows.map((row, index) => [row.code, index]));
  const slots = visibleCodes.map((code) => positions.get(code)!);
  if (direction === 'top' || direction === 'bottom') {
    const picked: SetRow[] = [];
    const rest: SetRow[] = [];
    visibleCodes.forEach((code, index) => {
      (selected.has(code) ? picked : rest).push(rows[slots[index]]);
    });
    const ordered = direction === 'top' ? [...picked, ...rest] : [...rest, ...picked];
    slots.forEach((slot, index) => {
      next[slot] = ordered[index];
    });
  } else if (direction === 'up') {
    for (let i = 1; i < slots.length; i += 1) {
      if (selected.has(next[slots[i]].code) && !selected.has(next[slots[i - 1]].code)) {
        swap(next, slots[i], slots[i - 1]);
      }
    }
  } else {
    for (let i = slots.length - 2; i >= 0; i -= 1) {
      if (selected.has(next[slots[i]].code) && !selected.has(next[slots[i + 1]].code)) {
        swap(next, slots[i], slots[i + 1]);
      }
    }
  }
  return next;
}
