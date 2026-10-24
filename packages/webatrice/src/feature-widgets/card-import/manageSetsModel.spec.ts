import type { Set as CardSet } from '@app/services';

import {
  buildSetRows,
  filterSetRows,
  moveSetRows,
  restoreDefaultOrder,
  rowsToPreferences,
  setEnabled,
  sortSetRows,
  type SetRow,
} from './manageSetsModel';

const row = (code: string, extra: Partial<SetRow> = {}): SetRow => ({
  code, longName: `${code} long`, setType: 'expansion', releaseDate: '', enabled: true, isKnown: true, ...extra,
});

const codes = (rows: SetRow[]) => rows.map((r) => r.code);
const rows = ['A', 'B', 'C', 'D', 'E'].map((c) => row(c));
const all = codes(rows);

describe('manageSetsModel', () => {
  it('builds rows in sort-key order with defaults for unseen sets', () => {
    const sets: CardSet[] = [{ name: { value: 'X' } }, { name: { value: 'Y' }, longname: { value: 'Why' } }];
    const built = buildSetRows(sets, new Map([['X', { code: 'X', sortKey: 5, enabled: true, isKnown: true }]]));
    expect(built).toEqual([
      { code: 'Y', longName: 'Why', setType: '', releaseDate: '', enabled: false, isKnown: false },
      { code: 'X', longName: '', setType: '', releaseDate: '', enabled: true, isKnown: true },
    ]);
  });

  it('saves rows as sort keys 1..n (SetsModel::save)', () => {
    expect(rowsToPreferences([row('A', { enabled: false }), row('B', { isKnown: false })])).toEqual([
      { code: 'A', sortKey: 1, enabled: false, isKnown: true },
      { code: 'B', sortKey: 2, enabled: true, isKnown: false },
    ]);
  });

  it('restores the default order from the set metadata', () => {
    const sets: CardSet[] = [
      { name: { value: 'OLD' }, releasedate: { value: '1999-01-01' } },
      { name: { value: 'NEW' }, releasedate: { value: '2024-01-01' } },
    ];
    expect(codes(restoreDefaultOrder([row('OLD'), row('NEW')], sets))).toEqual(['NEW', 'OLD']);
  });

  it('filters on code, long name, type and date, case-insensitively', () => {
    const list = [row('NEO', { longName: 'Kamigawa: Neon Dynasty' }), row('LEA', { setType: 'core', releaseDate: '1993' })];
    expect(codes(filterSetRows(list, 'neon'))).toEqual(['NEO']);
    expect(codes(filterSetRows(list, 'CORE'))).toEqual(['LEA']);
    expect(codes(filterSetRows(list, '1993'))).toEqual(['LEA']);
    expect(codes(filterSetRows(list, '  '))).toEqual(['NEO', 'LEA']);
  });

  it('sorts by a column in either direction', () => {
    expect(codes(sortSetRows([row('B'), row('A'), row('C')], 'code', true))).toEqual(['A', 'B', 'C']);
    expect(codes(sortSetRows([row('B'), row('A'), row('C')], 'code', false))).toEqual(['C', 'B', 'A']);
  });

  it('enables or disables all or selected rows', () => {
    expect(setEnabled(rows, 'all', false).every((r) => !r.enabled)).toBe(true);
    expect(setEnabled(rows, new Set(['B']), false).map((r) => r.enabled)).toEqual([true, false, true, true, true]);
  });

  describe('moveSetRows', () => {
    it('moves a selected row up and down by one', () => {
      expect(codes(moveSetRows(rows, all, new Set(['C']), 'up'))).toEqual(['A', 'C', 'B', 'D', 'E']);
      expect(codes(moveSetRows(rows, all, new Set(['C']), 'down'))).toEqual(['A', 'B', 'D', 'C', 'E']);
    });

    it('keeps adjacent selected rows together at the edges', () => {
      expect(codes(moveSetRows(rows, all, new Set(['A', 'B']), 'up'))).toEqual(all);
      expect(codes(moveSetRows(rows, all, new Set(['B', 'C']), 'up'))).toEqual(['B', 'C', 'A', 'D', 'E']);
    });

    it('moves selected rows to the top and bottom keeping their order', () => {
      expect(codes(moveSetRows(rows, all, new Set(['B', 'D']), 'top'))).toEqual(['B', 'D', 'A', 'C', 'E']);
      expect(codes(moveSetRows(rows, all, new Set(['B', 'D']), 'bottom'))).toEqual(['A', 'C', 'E', 'B', 'D']);
    });

    it('swaps with the visible neighbour when a search filter is active', () => {
      expect(codes(moveSetRows(rows, ['A', 'D', 'E'], new Set(['D']), 'up'))).toEqual(['D', 'B', 'C', 'A', 'E']);
    });

    it('is a no-op with nothing selected', () => {
      expect(codes(moveSetRows(rows, all, new Set(), 'top'))).toEqual(all);
    });
  });
});


describe('moveSetRows linear work', () => {
  it.each(['top', 'bottom', 'up', 'down'] as const)('keeps hidden slots and row identity for %s', (direction) => {
    const expected = {
      top: ['C', 'B', 'E', 'D', 'A'], bottom: ['A', 'B', 'C', 'D', 'E'],
      up: ['C', 'B', 'E', 'D', 'A'], down: ['A', 'B', 'C', 'D', 'E'],
    };
    const moved = moveSetRows(rows, ['A', 'C', 'E'], new Set(['B', 'C', 'E']), direction);
    expect(codes(moved)).toEqual(expected[direction]);
    expect(moved[1]).toBe(rows[1]);
    expect(moved[3]).toBe(rows[3]);
    moved.forEach((item) => expect(rows).toContain(item));
    expect(codes(rows)).toEqual(all);
  });

  it.each(['top', 'bottom', 'up', 'down'] as const)('reads row codes only linearly for %s', (direction) => {
    let reads = 0;
    const large = Array.from({ length: 200 }, (_, index) => ({
      ...row(String(index)),
      get code() {
        reads += 1; return String(index);
      },
    }));
    const visible = large.filter((_, index) => index % 2 === 0).map((item) => item.code);
    const selected = new Set(visible.filter((_, index) => index % 2 === 1));
    reads = 0;
    const moved = moveSetRows(large, visible, selected, direction);
    expect(reads).toBeLessThanOrEqual(large.length * 3);
    large.forEach((item, index) => {
      if (index % 2 === 1) {
        expect(moved[index]).toBe(item);
      }
    });
  });
});
