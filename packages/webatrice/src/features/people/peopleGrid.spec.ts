import { chunkRows, gridColumns } from './peopleGrid';

describe('peopleGrid', () => {
  it('fits up to three columns by width, never more than there are people', () => {
    expect(gridColumns(880, 100)).toBe(3);
    expect(gridColumns(500, 100)).toBe(2);
    expect(gridColumns(200, 100)).toBe(1);
    expect(gridColumns(880, 2)).toBe(2);
    expect(gridColumns(Number.POSITIVE_INFINITY, 100)).toBe(3);
  });

  it('splits people into rows of that many columns', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
