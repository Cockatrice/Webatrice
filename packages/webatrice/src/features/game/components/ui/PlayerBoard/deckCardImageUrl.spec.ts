import { deckCardImageUrl } from './deckCardImageUrl';

describe('deckCardImageUrl', () => {
  it('uses the Scryfall id when the deck row has one', () => {
    expect(deckCardImageUrl({ scryfallId: 'a1b2', name: 'Forest' }))
      .toBe('https://api.scryfall.com/cards/a1b2?format=image&version=large');
  });

  it('falls back to the exact name instead of requesting /cards/ with no id', () => {
    expect(deckCardImageUrl({ scryfallId: '', name: 'Llanowar Elves' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Llanowar%20Elves&format=image&version=large');
  });

  it('keeps the exact name, Token suffix and all', () => {
    expect(deckCardImageUrl({ scryfallId: '', name: 'Rhino, Warrior Token' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior%20Token&format=image&version=large');
  });
});
