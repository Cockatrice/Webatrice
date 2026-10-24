import { render, screen } from '@testing-library/react';

import { emptyPriceLookup } from '../../pricing';
import type { DeckCard } from '../../types';
import { DeckBuyButton } from './DeckBuyButton';

function card(name: string, quantity = 1): DeckCard {
  return { name, quantity, category: 'main', lookupSource: 'scryfall' };
}

function prices() {
  const lookup = emptyPriceLookup();
  lookup.byName.set('lightning bolt', { usd: 2, tcgplayer: null });
  return lookup;
}

describe('DeckBuyButton', () => {
  it('is disabled for an empty deck', () => {
    render(<DeckBuyButton cards={[]} prices={emptyPriceLookup()} loading={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'DeckEditor.buy.deck' })).toBeDisabled();
  });

  it('links the whole deck to TCGplayer mass entry with its total', () => {
    render(<DeckBuyButton cards={[card('Lightning Bolt', 4)]} prices={prices()} loading={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('massentry?c=4%20Lightning%20Bolt'));
    expect(link).toHaveAttribute('title', 'DeckEditor.buy.openDeck');
    expect(link).not.toHaveTextContent('DeckEditor.buy.missingShort');
  });

  it('shows pricing progress while loading', () => {
    render(<DeckBuyButton cards={[card('Lightning Bolt'), card('Mystery')]} prices={prices()} loading />);
    expect(screen.getByRole('link')).toHaveAttribute('title', 'DeckEditor.buy.pricing');
  });

  it('names the cards that have no price once loaded', () => {
    render(<DeckBuyButton cards={[card('Lightning Bolt'), card('Mystery', 2)]} prices={prices()} loading={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('title', 'DeckEditor.buy.missing: 2× Mystery');
    expect(link).toHaveTextContent('DeckEditor.buy.missingShort');
  });
});
