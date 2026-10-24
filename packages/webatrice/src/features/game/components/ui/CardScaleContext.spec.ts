import { computeScale } from './CardScaleContext';
import { seatHeightPx } from './seatFit';

describe('computeScale', () => {
  it('fits each seat row of the board', () => {
    const scale = computeScale(846, 2);
    expect(seatHeightPx(scale, { inlineHand: false })).toBeLessThanOrEqual(423);
    expect(seatHeightPx(scale + 0.01, { inlineHand: false })).toBeGreaterThan(423);
    expect(computeScale(0, 2)).toBe(1);
  });

  it('leaves room for inline hands', () => {
    expect(computeScale(846, 2, true)).toBeLessThan(computeScale(846, 2));
  });

  it('clamps to the readable range', () => {
    expect(computeScale(10, 4)).toBe(0.5);
    expect(computeScale(10000, 1)).toBe(2.5);
  });
});
