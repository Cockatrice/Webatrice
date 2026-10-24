import { useLayoutEffect } from 'react';

import { usePreference } from './useSettings';

const ROUNDED_CARD_CORNER_RADIUS = '7.5%';

const MIN_CARD_FONT_SIZE_PX = 9;

export function useApplyCardPresentation(): void {
  const roundCardCorners = usePreference('roundCardCorners');
  const scaleCards = usePreference('scaleCards');
  const maxFontSize = usePreference('maxFontSizeForCards');
  const cardCounterColorA = usePreference('cardCounterColorA');
  const cardCounterColorB = usePreference('cardCounterColorB');
  const cardCounterColorC = usePreference('cardCounterColorC');
  const cardCounterColorD = usePreference('cardCounterColorD');
  const cardCounterColorE = usePreference('cardCounterColorE');
  const cardCounterColorF = usePreference('cardCounterColorF');

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--card-corner-radius', roundCardCorners ? ROUNDED_CARD_CORNER_RADIUS : '0px');
    root.setProperty('--card-hover-scale', scaleCards ? '1.1' : '1');
    root.setProperty('--card-info-font-size', `${Math.max(MIN_CARD_FONT_SIZE_PX, maxFontSize)}px`);
  }, [roundCardCorners, scaleCards, maxFontSize]);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    [cardCounterColorA, cardCounterColorB, cardCounterColorC, cardCounterColorD, cardCounterColorE, cardCounterColorF]
      .forEach((color, id) => root.setProperty(`--card-counter-${id}`, `#${color}`));
  }, [cardCounterColorA, cardCounterColorB, cardCounterColorC, cardCounterColorD, cardCounterColorE, cardCounterColorF]);
}
