import { seatGrid } from './seatGrid';

describe('seatGrid', () => {
  it('leaves out the hand when it lives in the tray or is hidden', () => {
    for (const horizontalHand of [true, false]) {
      const grid = seatGrid({ horizontalHand, handOnTop: false, inlineHand: false });
      expect(grid.template.gridTemplateRows).toBe('1fr');
      expect(grid.template.gridTemplateColumns).not.toContain('* 1.5)');
      expect(grid.hand).toEqual({});
      expect([grid.info, grid.stack, grid.battlefield]).toEqual([
        { gridColumn: 1, gridRow: 1 },
        { gridColumn: 2, gridRow: 1 },
        { gridColumn: 3, gridRow: 1 },
      ]);
    }
  });

  it('puts a horizontal hand in a row under the stack and battlefield', () => {
    const grid = seatGrid({ horizontalHand: true, handOnTop: false, inlineHand: true });
    expect(grid.template.gridTemplateRows).toMatch(/^1fr calc\(/);
    expect(grid.info).toEqual({ gridColumn: 1, gridRow: '1 / -1' });
    expect(grid.stack).toEqual({ gridColumn: 2, gridRow: 1 });
    expect(grid.battlefield).toEqual({ gridColumn: 3, gridRow: 1 });
    expect(grid.hand).toEqual({ gridColumn: '2 / 4', gridRow: 2 });
  });

  it('puts a mirrored seat\'s hand row on top', () => {
    const grid = seatGrid({ horizontalHand: true, handOnTop: true, inlineHand: true });
    expect(grid.template.gridTemplateRows).toMatch(/ 1fr$/);
    expect(grid.hand).toEqual({ gridColumn: '2 / 4', gridRow: 1 });
    expect(grid.stack).toEqual({ gridColumn: 2, gridRow: 2 });
    expect(grid.battlefield).toEqual({ gridColumn: 3, gridRow: 2 });
  });

  it('puts a vertical hand in a column between the info column and the stack, mirrored or not', () => {
    for (const handOnTop of [false, true]) {
      const grid = seatGrid({ horizontalHand: false, handOnTop, inlineHand: true });
      expect(grid.template.gridTemplateRows).toBe('1fr');
      expect(grid.template.gridTemplateColumns).toContain('calc(var(--card-width, 72px) * 1.5)');
      expect([grid.info, grid.hand, grid.stack, grid.battlefield]).toEqual([
        { gridColumn: 1, gridRow: 1 },
        { gridColumn: 2, gridRow: 1 },
        { gridColumn: 3, gridRow: 1 },
        { gridColumn: 4, gridRow: 1 },
      ]);
    }
  });
});
