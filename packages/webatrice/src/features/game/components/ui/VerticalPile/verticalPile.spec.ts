import { layoutVerticalPile, verticalPileDropIndex } from './verticalPile';

describe('layoutVerticalPile', () => {
  it('lays out nothing for an empty hand', () => {
    expect(layoutVerticalPile(0, 108, 600, 72, 102, { overlapPercent: 33 })).toEqual({ positions: [], offset: 0 });
  });

  it('centres a lone card in the column', () => {
    const { positions } = layoutVerticalPile(1, 108, 600, 72, 102, { overlapPercent: 33 });
    expect(positions).toEqual([{ x: 18, y: 249 }]);
  });

  it('advances each card by the share of a card the overlap leaves showing, zig-zagging left and right', () => {
    const { positions, offset } = layoutVerticalPile(3, 108, 1000, 72, 100, { overlapPercent: 33 });
    expect(offset).toBe(67);
    expect(positions).toEqual([
      { x: 5, y: 383 },
      { x: 31, y: 450 },
      { x: 5, y: 517 },
    ]);
  });

  it('follows the overlap preference', () => {
    expect(layoutVerticalPile(3, 108, 1000, 72, 100, { overlapPercent: 80 }).offset).toBe(20);
    expect(layoutVerticalPile(3, 108, 1000, 72, 100, { overlapPercent: 0 }).offset).toBe(100);
  });

  it('compresses a hand that does not fit so the last card stays whole inside the column', () => {
    const { positions, offset } = layoutVerticalPile(11, 108, 600, 72, 100, { overlapPercent: 33 });
    expect(offset).toBe(50);
    expect(positions[0].y).toBe(0);
    expect(positions[10].y + 100).toBe(600);
  });

  it('keeps the stack\'s minimum offset while the pile still fits', () => {
    expect(layoutVerticalPile(11, 108, 600, 72, 100, { overlapPercent: 80, minOffset: 30 }).offset).toBe(30);
    expect(layoutVerticalPile(11, 108, 300, 72, 100, { overlapPercent: 80, minOffset: 30 }).offset).toBe(20);
    expect(layoutVerticalPile(11, 108, 200, 72, 100, { overlapPercent: 0, minOffset: 30 }).offset).toBe(10);
  });

  it('never stacks cards upward in a column shorter than a card', () => {
    const { positions } = layoutVerticalPile(3, 108, 50, 72, 100, { overlapPercent: 33 });
    expect(positions.map((p) => p.y)).toEqual([0, 0, 0]);
  });
});

describe('verticalPileDropIndex', () => {
  const tops = [100, 150, 200];

  it('is 0 for an empty hand', () => {
    expect(verticalPileDropIndex([], 500, 100)).toBe(0);
  });

  it('picks the nearest gap between card tops', () => {
    expect(verticalPileDropIndex(tops, 90, 100)).toBe(0);
    expect(verticalPileDropIndex(tops, 120, 100)).toBe(0);
    expect(verticalPileDropIndex(tops, 130, 100)).toBe(1);
    expect(verticalPileDropIndex(tops, 180, 100)).toBe(2);
  });

  it('allows dropping after the last card, and no further', () => {
    expect(verticalPileDropIndex(tops, 230, 100)).toBe(3);
    expect(verticalPileDropIndex(tops, 900, 100)).toBe(3);
  });

  it('uses a card height as the step for a single card', () => {
    expect(verticalPileDropIndex([100], 140, 100)).toBe(0);
    expect(verticalPileDropIndex([100], 160, 100)).toBe(1);
  });
});
