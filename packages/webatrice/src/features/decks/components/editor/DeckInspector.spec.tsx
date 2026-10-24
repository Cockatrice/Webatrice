import { fireEvent, render, screen } from '@testing-library/react';

import { emptyPriceLookup } from '../../pricing';
import type { DeckCard } from '../../types';
import { DeckInspector, type DeckInspectorProps } from './DeckInspector';

const bolt: DeckCard = {
  name: 'Lightning Bolt',
  quantity: 2,
  category: 'main',
  lookupSource: 'scryfall',
  manaCost: '{R}',
  typeLine: 'Instant',
  set: 'lea',
  imageUri: 'https://cards.scryfall.io/small/front/b.jpg',
};
const sideBolt: DeckCard = { ...bolt, category: 'sideboard', quantity: 1 };

function renderInspector(overrides: Partial<DeckInspectorProps> = {}) {
  const props: DeckInspectorProps = {
    selected: { name: 'Lightning Bolt', category: 'main' },
    index: 0,
    deckCards: [bolt, sideBolt],
    prices: emptyPriceLookup(),
    isCommanderDeck: false,
    onInc: vi.fn(),
    onDelete: vi.fn(),
    onSetCategory: vi.fn(),
    onChangePrinting: vi.fn(),
    onShowDetails: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };
  render(<DeckInspector {...props} />);
  return props;
}

describe('DeckInspector', () => {
  it('keeps a sized placeholder until the preview loads and after failure', () => {
    renderInspector();
    const image = screen.getByAltText('Lightning Bolt');
    expect(image).toHaveStyle({ opacity: '0' });
    expect(image.closest('.aspect-\\[5\\/7\\]')).not.toBeNull();
    expect(screen.queryByText('DeckInspector.noImage')).toBeNull();
    fireEvent.load(image);
    expect(image).toHaveStyle({ opacity: '1' });
    expect(screen.queryByText('DeckInspector.noImage')).toBeNull();
    fireEvent.error(image);
    expect(screen.getByText('DeckInspector.noImage')).toBeVisible();
    expect(screen.queryByAltText('Lightning Bolt')).toBeNull();
  });

  it('shows no failure message while candidates load and shows it only when all fail', () => {
    renderInspector({ deckCards: [{
      ...bolt,
      imageUris: [bolt.imageUri!, 'https://img/fallback.jpg'],
    }] });
    const image = screen.getByAltText('Lightning Bolt');
    expect(screen.queryByText('DeckInspector.noImage')).toBeNull();
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', 'https://img/fallback.jpg');
    expect(screen.queryByText('DeckInspector.noImage')).toBeNull();
    fireEvent.error(image);
    expect(screen.getByText('DeckInspector.noImage')).toBeVisible();
    expect(screen.queryByAltText('Lightning Bolt')).toBeNull();
  });

  it('invites a selection before any card is picked', () => {
    renderInspector({ selected: null });
    expect(screen.getByText('DeckInspector.empty')).toBeInTheDocument();
  });

  it('shows the selected row at preview size with its details and price', () => {
    const prices = emptyPriceLookup();
    prices.byName.set('lightning bolt', { usd: 2, tcgplayer: null });
    renderInspector({ prices });
    expect(screen.getByRole('img', { name: 'Lightning Bolt' }))
      .toHaveAttribute('src', 'https://cards.scryfall.io/normal/front/b.jpg');
    expect(screen.getByText('Instant')).toBeInTheDocument();
    expect(screen.getByText('lea')).toBeInTheDocument();
    expect(screen.getByText('DeckInspector.price')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'DeckInspector.quantity' })).toHaveTextContent('2');
  });

  it('routes the quantity, printing, zone, details and remove actions to the live row', () => {
    const props = renderInspector();
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.increase' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.decrease' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.changePrinting' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.toSideboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.details' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.remove' }));
    expect(props.onInc).toHaveBeenNthCalledWith(1, 0, 1);
    expect(props.onInc).toHaveBeenNthCalledWith(2, 0, -1);
    expect(props.onChangePrinting).toHaveBeenCalledWith(0, bolt);
    expect(props.onSetCategory).toHaveBeenCalledWith(0, 'sideboard');
    expect(props.onShowDetails).toHaveBeenCalledWith(bolt);
    expect(props.onDelete).toHaveBeenCalledWith(0);
  });

  it('offers the way back to the main deck for a sideboard row', () => {
    const props = renderInspector({ selected: { name: 'Lightning Bolt', category: 'sideboard' }, index: 1 });
    expect(screen.getByRole('group', { name: 'DeckInspector.quantity' })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.toMain' }));
    expect(props.onSetCategory).toHaveBeenCalledWith(1, 'main');
  });

  it('keeps the commander in the main deck', () => {
    renderInspector({ deckCards: [{ ...bolt, isCommander: true }], isCommanderDeck: true });
    expect(screen.getByRole('button', { name: 'DeckInspector.toSideboard' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'DeckInspector.removeCommander' })).toBeInTheDocument();
  });

  it('offers to add a card that is not in the deck yet', () => {
    const props = renderInspector({
      selected: {
        name: 'Ponder',
        category: 'main',
        scryfallId: 'p1',
        preview: { name: 'Ponder', quantity: 1, category: 'main', lookupSource: 'scryfall', typeLine: 'Sorcery', scryfallId: 'p1' },
      },
      index: -1,
      deckCards: [bolt],
    });
    expect(screen.getByText('DeckInspector.noImage')).toBeInTheDocument();
    expect(screen.getByText('Sorcery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckInspector.addToSideboard' }));
    expect(props.onAdd).toHaveBeenNthCalledWith(1, 'Ponder', 'main', 'p1');
    expect(props.onAdd).toHaveBeenNthCalledWith(2, 'Ponder', 'side', 'p1');
  });
});
