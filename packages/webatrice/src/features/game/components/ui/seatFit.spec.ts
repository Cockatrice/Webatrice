import { battlefieldNaturalHeight, scaledBattlefieldLayout } from '../battlefield/Battlefield/battlefieldLayout';
import {
  CARD_SCALE_MAX,
  CARD_SCALE_MIN,
  fitCardScale,
  handRowHeightPx,
  infoColumnHeightPx,
  infoFontPx,
  SEAT_BORDER_PX,
  seatHeightPx,
} from './seatFit';

describe('seatFit', () => {
  it('sizes the info column font with the cards between the readable limits', () => {
    expect(infoFontPx(0.5)).toBe(10);
    expect(infoFontPx(0.8)).toBeCloseTo(11.2);
    expect(infoFontPx(2)).toBe(14);
  });

  it('budgets the info column as its em chrome plus three card-high pile rows', () => {
    const pile = 72;
    expect(infoColumnHeightPx(1) - infoColumnHeightPx(0.75)).toBeCloseTo(3 * pile * 0.25 + (14 - 10.5) * 13.7, 5);
  });

  it('needs the taller of the play area and the info column, plus the seat border', () => {
    const battlefield = battlefieldNaturalHeight(scaledBattlefieldLayout(1.5));
    expect(seatHeightPx(1.5, { inlineHand: false })).toBe(SEAT_BORDER_PX + Math.max(battlefield, infoColumnHeightPx(1.5)));
    expect(seatHeightPx(1.5, { inlineHand: true }))
      .toBe(SEAT_BORDER_PX + Math.max(battlefield + handRowHeightPx(1.5), infoColumnHeightPx(1.5)));
  });

  it('picks the largest scale whose seat fits', () => {
    for (const height of [180, 240, 330, 423, 520, 800]) {
      const scale = fitCardScale(height, { inlineHand: false });
      if (scale > CARD_SCALE_MIN) {
        expect(seatHeightPx(scale, { inlineHand: false })).toBeLessThanOrEqual(height);
      }
      if (scale < CARD_SCALE_MAX) {
        expect(seatHeightPx(scale + 0.002, { inlineHand: false })).toBeGreaterThan(height);
      }
    }
  });

  it('bottoms out at the minimum scale and tops out at the maximum', () => {
    expect(fitCardScale(50, { inlineHand: false })).toBe(CARD_SCALE_MIN);
    expect(fitCardScale(5000, { inlineHand: false })).toBe(CARD_SCALE_MAX);
    expect(fitCardScale(0, { inlineHand: false })).toBe(1);
  });
});
