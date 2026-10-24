import type { Set, SetPreference } from '../dexie/types';
import {
  compareSetPreference,
  defaultSetOrder,
  enableAllUnknown,
  firstRunPreferences,
  isKnownIgnored,
  markAllAsKnown,
  reconcileSetPreferences,
  setPriorityOf,
  sortBySetPreference,
  SetPriority,
} from './setPriority';

type SetFields = Partial<Record<'longname' | 'settype' | 'releasedate' | 'priority', string>>;

const makeSet = (code: string, extra: SetFields = {}): Set => ({
  name: { value: code },
  ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])),
});

const pref = (code: string, sortKey: number, enabled = true, isKnown = true): SetPreference => ({
  code, sortKey, enabled, isKnown,
});

const prefMap = (...prefs: SetPreference[]) => new Map(prefs.map((p) => [p.code, p]));

describe('setPriority', () => {
  describe('setPriorityOf', () => {
    it('reads the numeric <priority> and falls back when missing or junk', () => {
      expect(setPriorityOf(makeSet('A', { priority: '30' }))).toBe(SetPriority.Reprint);
      expect(setPriorityOf(makeSet('B'))).toBe(SetPriority.Fallback);
      expect(setPriorityOf(makeSet('C', { priority: 'x' }))).toBe(SetPriority.Fallback);
    });
  });

  describe('isKnownIgnored', () => {
    it('is true only when long name, type and release date are all empty', () => {
      expect(isKnownIgnored(makeSet('CUS'))).toBe(true);
      expect(isKnownIgnored(makeSet('NEO', { longname: 'Neon Dynasty' }))).toBe(false);
      expect(isKnownIgnored(makeSet('NEO', { releasedate: '2022-02-18' }))).toBe(false);
    });
  });

  describe('defaultSetOrder', () => {
    it('sorts by priority, then newest release, then code (CardSetList::defaultSort)', () => {
      const sets = [
        makeSet('ZZZ', { priority: '10', releasedate: '2020-01-01' }),
        makeSet('OLD', { priority: '10', releasedate: '1999-01-01' }),
        makeSet('REP', { priority: '30', releasedate: '2024-01-01' }),
        makeSet('AAA', { priority: '10', releasedate: '2020-01-01' }),
        makeSet('NOD', { priority: '10' }),
      ];
      expect(defaultSetOrder(sets).map((s) => s.name.value)).toEqual(['AAA', 'ZZZ', 'OLD', 'NOD', 'REP']);
    });

    it('does not mutate its input', () => {
      const sets = [makeSet('B'), makeSet('A')];
      defaultSetOrder(sets);
      expect(sets.map((s) => s.name.value)).toEqual(['B', 'A']);
    });
  });

  describe('compareSetPreference / sortBySetPreference', () => {
    it('ranks enabled sets above disabled ones, each group by sort key', () => {
      const prefs = prefMap(pref('A', 2), pref('B', 1, false), pref('C', 0, false), pref('D', 5));
      expect(sortBySetPreference(['A', 'B', 'C', 'D'], (c) => c, prefs)).toEqual(['A', 'D', 'C', 'B']);
      expect(compareSetPreference(pref('X', 9), pref('Y', 0, false))).toBeLessThan(0);
    });

    it('treats unknown codes as disabled with sort key 0 and keeps ties stable', () => {
      const prefs = prefMap(pref('A', 3));
      expect(sortBySetPreference(['U2', 'U1', 'A'], (c) => c, prefs)).toEqual(['A', 'U2', 'U1']);
    });
  });

  describe('reconcileSetPreferences', () => {
    const sets = [
      makeSet('NEO', { longname: 'Neon Dynasty', releasedate: '2022-02-18' }),
      makeSet('LEA', { longname: 'Alpha', releasedate: '1993-08-05' }),
      makeSet('CUS'),
    ];

    it('enables every set with guessed sort keys on first run', () => {
      const result = reconcileSetPreferences(sets, new Map(), false);
      expect(result.allNewSetsEnabled).toBe(true);
      expect(result.unknownSets).toEqual([]);
      expect(result.changed).toEqual([
        pref('NEO', 0),
        pref('LEA', 1),
        { code: 'CUS', sortKey: 2, enabled: true, isKnown: false },
      ]);
    });

    it('reports sets that are neither known nor known-ignored once some set is enabled', () => {
      const result = reconcileSetPreferences(sets, prefMap(pref('LEA', 1)), false);
      expect(result.unknownSets).toEqual(['NEO']);
      expect(result.changed).toEqual([]);
    });

    it('enables unknown sets when alwaysEnableNewSets is on', () => {
      const result = reconcileSetPreferences(sets, prefMap(pref('LEA', 1)), true);
      expect(result.unknownSets).toEqual([]);
      expect(result.changed).toEqual([
        { code: 'NEO', sortKey: 0, enabled: true, isKnown: true },
        { code: 'CUS', sortKey: 0, enabled: true, isKnown: false },
      ]);
    });

    it('has nothing to ask when every set is known', () => {
      const prefs = prefMap(pref('LEA', 1), pref('NEO', 0, false), pref('CUS', 2));
      expect(reconcileSetPreferences(sets, prefs, false)).toEqual({
        changed: [], unknownSets: [], allNewSetsEnabled: false,
      });
    });
  });

  it('markAllAsKnown disables unknown sets and enables known-ignored ones', () => {
    const sets = [makeSet('NEW', { longname: 'New' }), makeSet('CUS')];
    expect(markAllAsKnown(sets, new Map())).toEqual([
      { code: 'NEW', sortKey: 0, enabled: false, isKnown: true },
      { code: 'CUS', sortKey: 0, enabled: true, isKnown: false },
    ]);
  });

  it('enableAllUnknown enables and marks unknown sets known', () => {
    const sets = [makeSet('NEW', { longname: 'New' }), makeSet('OLD', { longname: 'Old' })];
    expect(enableAllUnknown(sets, prefMap(pref('OLD', 1, false)))).toEqual([
      { code: 'NEW', sortKey: 0, enabled: true, isKnown: true },
    ]);
  });

  it('firstRunPreferences keeps an existing isKnown flag', () => {
    expect(firstRunPreferences([makeSet('CUS')], prefMap(pref('CUS', 4, false, true)))).toEqual([
      pref('CUS', 0),
    ]);
  });
});
