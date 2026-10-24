import { menuAllows } from './userSanctions';

describe('menuAllows', () => {
  it('allows an action the menu offers and enables', () => {
    const groups = [[{ action: 'warnUser' as const, disabled: false }], [{ action: 'banUser' as const, disabled: true }]];
    expect(menuAllows(groups, 'warnUser')).toBe(true);
    expect(menuAllows(groups, 'banUser')).toBe(false);
    expect(menuAllows(groups, 'adminNotes')).toBe(false);
  });

  it('allows nothing from an empty menu, as when locked or not staff', () => {
    expect(menuAllows([], 'warnUser')).toBe(false);
  });
});
