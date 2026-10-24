import type { Set, SetPreference } from '../dexie/types';

export enum SetPriority {
  Fallback = 0,
  Primary = 10,
  Secondary = 20,
  Reprint = 30,
  Other = 40,
  Lowest = 100,
}

export type SetPreferenceMap = ReadonlyMap<string, SetPreference>;

export function defaultSetPreference(code: string): SetPreference {
  return { code, sortKey: 0, enabled: false, isKnown: false };
}

export function setCode(set: Set): string {
  return set.name?.value ?? '';
}

export function setPriorityOf(set: Set): number {
  const n = parseInt(set.priority?.value ?? '', 10);
  return Number.isNaN(n) ? SetPriority.Fallback : n;
}

export function isKnownIgnored(set: Set): boolean {
  return !set.longname?.value && !set.settype?.value && !set.releasedate?.value;
}

function releaseTime(set: Set): number {
  const t = Date.parse(set.releasedate?.value ?? '');
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function defaultSetOrder<T extends Set>(sets: readonly T[]): T[] {
  return [...sets].sort((a, b) => {
    const byPriority = setPriorityOf(a) - setPriorityOf(b);
    if (byPriority !== 0) {
      return byPriority;
    }
    const byDate = releaseTime(b) - releaseTime(a);
    if (byDate !== 0 && !Number.isNaN(byDate)) {
      return byDate;
    }
    const codeA = setCode(a);
    const codeB = setCode(b);
    return codeA < codeB ? -1 : codeA > codeB ? 1 : 0;
  });
}

export function getSetPreference(prefs: SetPreferenceMap, code: string): SetPreference {
  return prefs.get(code) ?? defaultSetPreference(code);
}

export function compareSetPreference(a: SetPreference, b: SetPreference): number {
  if (a.enabled !== b.enabled) {
    return a.enabled ? -1 : 1;
  }
  return a.sortKey - b.sortKey;
}

export function sortBySetPreference<T>(
  items: readonly T[],
  codeOf: (item: T) => string,
  prefs: SetPreferenceMap,
): T[] {
  return items
    .map((item, index) => ({ item, index, pref: getSetPreference(prefs, codeOf(item)) }))
    .sort((a, b) => compareSetPreference(a.pref, b.pref) || a.index - b.index)
    .map(({ item }) => item);
}

export function firstRunPreferences(sets: readonly Set[], prefs: SetPreferenceMap = new Map()): SetPreference[] {
  return defaultSetOrder(sets).map((set, i) => ({
    code: setCode(set),
    sortKey: i,
    enabled: true,
    isKnown: getSetPreference(prefs, setCode(set)).isKnown || !isKnownIgnored(set),
  }));
}

export interface SetPreferenceReconciliation {
  changed: SetPreference[];
  unknownSets: string[];
  allNewSetsEnabled: boolean;
}

export function reconcileSetPreferences(
  sets: readonly Set[],
  prefs: SetPreferenceMap,
  alwaysEnableNewSets: boolean,
): SetPreferenceReconciliation {
  const anyEnabled = sets.some((set) => getSetPreference(prefs, setCode(set)).enabled);
  if (sets.length > 0 && !anyEnabled) {
    return { changed: firstRunPreferences(sets, prefs), unknownSets: [], allNewSetsEnabled: true };
  }

  const unknown = sets.filter((set) => {
    const pref = getSetPreference(prefs, setCode(set));
    return !pref.isKnown && !isKnownIgnored(set);
  });

  if (unknown.length === 0) {
    return { changed: markAllAsKnown(sets, prefs), unknownSets: [], allNewSetsEnabled: false };
  }
  if (alwaysEnableNewSets) {
    return { changed: enableAllUnknown(sets, prefs), unknownSets: [], allNewSetsEnabled: false };
  }
  return { changed: [], unknownSets: unknown.map(setCode), allNewSetsEnabled: false };
}

export function enableAllUnknown(sets: readonly Set[], prefs: SetPreferenceMap): SetPreference[] {
  const changed: SetPreference[] = [];
  for (const set of sets) {
    const pref = getSetPreference(prefs, setCode(set));
    if (!pref.isKnown && !isKnownIgnored(set)) {
      changed.push({ ...pref, isKnown: true, enabled: true });
    } else if (isKnownIgnored(set) && !pref.enabled) {
      changed.push({ ...pref, enabled: true });
    }
  }
  return changed;
}

export function markAllAsKnown(sets: readonly Set[], prefs: SetPreferenceMap): SetPreference[] {
  const changed: SetPreference[] = [];
  for (const set of sets) {
    const pref = getSetPreference(prefs, setCode(set));
    if (!pref.isKnown && !isKnownIgnored(set)) {
      changed.push({ ...pref, isKnown: true, enabled: false });
    } else if (isKnownIgnored(set) && !pref.enabled) {
      changed.push({ ...pref, enabled: true });
    }
  }
  return changed;
}
