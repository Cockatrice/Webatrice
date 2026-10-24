import { fireEvent, render, screen } from '@testing-library/react';
import { useCardOverride } from '../../../hooks/useCardOverride';

import { useCardPrintings } from '../hooks/useCardPrintings';
import { emptyPriceLookup } from '../pricing';
import type { DeckCard } from '../types';
import { PrintingPickerDialog } from './PrintingPickerDialog';

vi.mock('../hooks/useCardPrintings', () => ({ useCardPrintings: vi.fn() }));
vi.mock('../../../hooks/useCardOverride', () => ({ useCardOverride: vi.fn() }));

const bolt: DeckCard = {
  name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall', scryfallId: 'm11-id',
};
const m11 = { set: 'm11', collectorNumber: '149', scryfallId: 'm11-id', imageUri: 'https://cards.scryfall.io/small/front/m11.jpg' };
const a25 = { set: 'a25', collectorNumber: '141', scryfallId: 'a25-id' };

function printings(overrides: Partial<ReturnType<typeof useCardPrintings>>) {
  vi.mocked(useCardPrintings).mockReturnValue({
    printings: [], loading: false, error: null, prices: emptyPriceLookup(), ...overrides,
  });
}

describe('PrintingPickerDialog', () => {
  beforeEach(() => {
    vi.mocked(useCardOverride).mockReturnValue({ pinnedPrintingId: '', savingPin: false, togglePin: vi.fn() });
  });
  it('renders nothing without a request', () => {
    printings({});
    render(<PrintingPickerDialog request={null} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(useCardPrintings).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByText('PrintingPicker.title')).toBeNull();
  });

  it('lists printings with prices, marks the current one and picks', () => {
    const prices = emptyPriceLookup();
    prices.byId.set('a25-id', { usd: 1.5, tcgplayer: null });
    printings({ printings: [m11, a25], prices });
    const onPick = vi.fn();
    render(<PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={vi.fn()} onPick={onPick} />);

    expect(useCardPrintings).toHaveBeenLastCalledWith('Lightning Bolt');
    expect(screen.getByText('· PrintingPicker.count')).toBeInTheDocument();
    const current = screen.getByTitle('M11 · Lightning Bolt');
    expect(current).toHaveTextContent('PrintingPicker.current');
    expect(screen.getByAltText('Lightning Bolt (m11)')).toHaveAttribute('src', 'https://cards.scryfall.io/normal/front/m11.jpg');
    expect(screen.getByText('$1.50')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('A25 · Lightning Bolt'));
    expect(onPick).toHaveBeenCalledWith(a25);
  });

  it('shows loading, errors and an empty result', () => {
    printings({ loading: true });
    const { rerender } = render(
      <PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={vi.fn()} onPick={vi.fn()} />,
    );
    expect(screen.getByText('PrintingPicker.loading')).toBeInTheDocument();

    printings({ error: 'Scryfall is down' });
    rerender(<PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByText('Scryfall is down')).toBeInTheDocument();

    printings({});
    rerender(<PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByText('PrintingPicker.empty')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    printings({});
    const onClose = vi.fn();
    render(<PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={onClose} onPick={vi.fn()} />);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('lists the printings the deck holds first, as desktop\'s "Bump sets" option does', () => {
    printings({ printings: [m11, a25] });
    const deck = [{ ...bolt, scryfallId: 'a25-id' }];
    render(<PrintingPickerDialog request={{ index: 0, card: bolt }} deckCards={deck} onClose={vi.fn()} onPick={vi.fn()} />);
    const titles = screen.getAllByTitle(/· Lightning Bolt$/).map((el) => el.getAttribute('title'));
    expect(titles).toEqual(['A25 · Lightning Bolt', 'M11 · Lightning Bolt']);
  });

  it('tries every catalogue image candidate for a printing', () => {
    printings({ printings: [{
      ...m11,
      imageUris: [
        'https://cards.scryfall.io/small/front/first.jpg',
        'https://cards.scryfall.io/small/front/second.jpg',
      ],
    }] });
    render(<PrintingPickerDialog request={{ index: 0, card: bolt }} onClose={vi.fn()} onPick={vi.fn()} />);

    const image = screen.getByAltText('Lightning Bolt (m11)');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', 'https://cards.scryfall.io/normal/front/second.jpg');
  });

  it('puts the pin before deck printings and toggles it without changing the saved choice', () => {
    const togglePin = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useCardOverride).mockReturnValue({ pinnedPrintingId: 'm11-id', savingPin: false, togglePin });
    printings({ printings: [a25, m11], canonicalName: 'Lightning Bolt' });
    const onPick = vi.fn();
    render(<PrintingPickerDialog request={{ index: 0, card: { ...bolt, name: 'lightning bolt' } }}
      deckCards={[{ ...bolt, name: 'lightning bolt', scryfallId: 'a25-id' }]} onClose={vi.fn()} onPick={onPick} />);
    expect(useCardOverride).toHaveBeenLastCalledWith('Lightning Bolt');
    expect(screen.getAllByTitle(/· lightning bolt$/).map((node) => node.title)).toEqual(['M11 · lightning bolt', 'A25 · lightning bolt']);
    const unpin = screen.getByRole('button', { name: 'PrintingPicker.unpin' });
    expect(unpin).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(unpin);
    expect(togglePin).toHaveBeenCalledWith('m11-id');
    fireEvent.click(screen.getByRole('button', { name: 'PrintingPicker.pin' }));
    expect(togglePin).toHaveBeenLastCalledWith('a25-id');
    expect(onPick).not.toHaveBeenCalled();
  });
});
