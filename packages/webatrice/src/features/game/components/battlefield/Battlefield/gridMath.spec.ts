import { makeCard } from '@cockatrice/datatrice/testing';
import {
  MAX_SUBPOS,
  applyInvertY,
  getStackColumn,
  getSubPosition,
  gridXFromColumn,
  nextAvailableColumn,
} from './gridMath';

describe('gridMath', () => {

  describe('getStackColumn / getSubPosition / gridXFromColumn', () => {
    it('round-trips (col, subPos) through gridXFromColumn', () => {
      for (let col = 0; col < 4; col++) {
        for (let sub = 0; sub < MAX_SUBPOS; sub++) {
          const gridX = gridXFromColumn(col, sub);
          expect(getStackColumn(gridX)).toBe(col);
          expect(getSubPosition(gridX)).toBe(sub);
        }
      }
    });

    it('defaults gridXFromColumn subPos to 0', () => {
      expect(gridXFromColumn(2)).toBe(2 * MAX_SUBPOS);
    });
  });

  describe('nextAvailableColumn', () => {
    it('returns 0 for an empty row', () => {
      expect(nextAvailableColumn([], 1)).toBe(0);
    });

    it('returns one past the rightmost column on the target row', () => {
      const cards = [
        makeCard({ id: 1, x: gridXFromColumn(0), y: 1 }),
        makeCard({ id: 2, x: gridXFromColumn(2), y: 1 }),
      ];
      expect(nextAvailableColumn(cards, 1)).toBe(3);
    });

    it('ignores cards on other rows', () => {
      const cards = [
        makeCard({ id: 1, x: gridXFromColumn(5), y: 0 }),
        makeCard({ id: 2, x: gridXFromColumn(1), y: 1 }),
      ];
      expect(nextAvailableColumn(cards, 1)).toBe(2);
    });
  });

  describe('applyInvertY', () => {
    it('returns y unchanged when not inverted', () => {
      expect(applyInvertY(0, false)).toBe(0);
      expect(applyInvertY(1, false)).toBe(1);
      expect(applyInvertY(2, false)).toBe(2);
    });

    it('mirrors y across the 3-row span when inverted', () => {
      expect(applyInvertY(0, true)).toBe(2);
      expect(applyInvertY(1, true)).toBe(1);
      expect(applyInvertY(2, true)).toBe(0);
    });

    it('clamps out-of-range y before inverting', () => {
      expect(applyInvertY(-1, false)).toBe(0);
      expect(applyInvertY(99, false)).toBe(2);
      expect(applyInvertY(-1, true)).toBe(2);
    });
  });
});
