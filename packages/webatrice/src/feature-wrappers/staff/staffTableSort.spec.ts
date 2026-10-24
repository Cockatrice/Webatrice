import { nextSort, sortRows } from './staffTableSort';

describe('nextSort', () => {
  it('starts ascending on a new column and flips on the same one', () => {
    const first = nextSort(null, 'age');
    expect(first).toEqual({ column: 'age', ascending: true });
    expect(nextSort(first, 'age')).toEqual({ column: 'age', ascending: false });
    expect(nextSort(first, 'name')).toEqual({ column: 'name', ascending: true });
  });
});

describe('sortRows', () => {
  const rows = [{ n: 2, s: 'b' }, { n: 10, s: 'a' }, { n: 1, s: 'c' }];

  it('sorts numbers numerically in both directions', () => {
    expect(sortRows(rows, (r) => r.n, true).map((r) => r.n)).toEqual([1, 2, 10]);
    expect(sortRows(rows, (r) => r.n, false).map((r) => r.n)).toEqual([10, 2, 1]);
  });

  it('sorts strings and bigints', () => {
    expect(sortRows(rows, (r) => r.s, true).map((r) => r.s)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, (r) => BigInt(r.n), true).map((r) => r.n)).toEqual([1, 2, 10]);
  });

  it('leaves the order alone without a sort value and never mutates the input', () => {
    expect(sortRows(rows, undefined, true)).toEqual(rows);
    sortRows(rows, (r) => r.n, true);
    expect(rows.map((r) => r.n)).toEqual([2, 10, 1]);
  });
});
