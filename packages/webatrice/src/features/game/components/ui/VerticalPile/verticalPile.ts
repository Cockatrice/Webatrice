
export const VERTICAL_PILE_X_SPACE_PX = 5;
export const STACK_MIN_CARD_VISIBLE_PX = 10;

export interface VerticalPileOptions {
  overlapPercent: number;
  minOffset?: number;
  xSpace?: number;
}

export interface VerticalPileLayout {
  positions: { x: number; y: number }[];
  offset: number;
}

export function layoutVerticalPile(
  count: number,
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  { overlapPercent, minOffset = 0, xSpace = VERTICAL_PILE_X_SPACE_PX }: VerticalPileOptions,
): VerticalPileLayout {
  if (count <= 0) {
    return { positions: [], offset: 0 };
  }
  let offset = (cardH * (100 - overlapPercent)) / 100;
  if (count > 1) {
    const fitOffset = Math.min((containerH - cardH) / (count - 1), containerH / (count - 1));
    offset = Math.min(offset, fitOffset);
    if (fitOffset >= minOffset) {
      offset = Math.max(minOffset, offset);
    }
    offset = Math.max(0, offset);
  }
  const pileHeight = (count - 1) * offset + cardH;
  const start = pileHeight <= containerH ? (containerH - pileHeight) / 2 : 0;
  const left = xSpace;
  const right = containerW - xSpace - cardW;
  const centred = (containerW - cardW) / 2;
  const positions = Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? centred : i % 2 ? right : left,
    y: start + i * offset,
  }));
  return { positions, offset };
}

export function verticalPileDropIndex(tops: readonly number[], pointerY: number, cardH: number): number {
  if (tops.length === 0) {
    return 0;
  }
  const offset = tops.length > 1 ? tops[1] - tops[0] : cardH;
  if (offset <= 0) {
    return 0;
  }
  const index = Math.round((pointerY - tops[0]) / offset);
  return Math.max(0, Math.min(tops.length, index));
}
