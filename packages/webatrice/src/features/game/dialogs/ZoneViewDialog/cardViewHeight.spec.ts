import { cardViewRowsHeight, toggledCardViewHeight } from './cardViewHeight';

describe('cardViewRowsHeight', () => {
  it('is desktop\'s rowsToHeight: N + 1 thirds of a card and 5 px', () => {
    expect(cardViewRowsHeight(14, 102)).toBe(515);
    expect(cardViewRowsHeight(20, 102)).toBe(719);
    expect(cardViewRowsHeight(2, 300)).toBe(305);
  });
});

describe('toggledCardViewHeight', () => {
  const heights = { initial: 500, expanded: 700, maxHeight: 900 };

  it('expands a view at or above its initial height', () => {
    expect(toggledCardViewHeight(500, heights)).toBe(700);
    expect(toggledCardViewHeight(600, heights)).toBe(700);
    expect(toggledCardViewHeight(800, heights)).toBe(700);
  });

  it('goes back to the initial height from the expanded one, or from below the initial one', () => {
    expect(toggledCardViewHeight(700, heights)).toBe(500);
    expect(toggledCardViewHeight(300, heights)).toBe(500);
  });

  it('keeps within the room the page has', () => {
    const cramped = { initial: 500, expanded: 700, maxHeight: 600 };
    expect(toggledCardViewHeight(500, cramped)).toBe(600);
    expect(toggledCardViewHeight(600, cramped)).toBe(500);
    expect(toggledCardViewHeight(500, { initial: 500, expanded: 700, maxHeight: 400 })).toBe(400);
  });
});
