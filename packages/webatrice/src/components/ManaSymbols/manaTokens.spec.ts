import { isManaToken, manaCostTokens } from './manaTokens';

describe('manaTokens', () => {
  it('splits a cost into its tokens', () => {
    expect(manaCostTokens('{3}{G/W}{U}')).toEqual(['{3}', '{G/W}', '{U}']);
    expect(manaCostTokens('')).toEqual([]);
  });

  it('recognises a single symbol token', () => {
    expect(isManaToken('{T}')).toBe(true);
    expect(isManaToken('Add {G}')).toBe(false);
  });
});
