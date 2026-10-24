import { fireEvent, render, screen, within } from '@testing-library/react';

import type { ParsedDeck } from '@app/types';

import { ReadOnlyDeck } from './ReadOnlyDeck';

const deck = {
  name: 'Burn',
  format: 'modern',
  meta: {},
  cards: [
    { name: 'Lightning Bolt', quantity: 4, category: 'main' },
    { name: 'Mountain', quantity: 16, category: 'main' },
    { name: 'Smash to Smithereens', quantity: 2, category: 'sideboard' },
  ],
} as unknown as ParsedDeck;

describe('ReadOnlyDeck', () => {
  it('lists the cards by zone, read-only', () => {
    render(<ReadOnlyDeck deck={deck} onImport={vi.fn()} onClose={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'Burn' });
    expect(within(section).getByText('ReadOnlyDeck.readOnly')).toBeInTheDocument();
    expect(within(section).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(within(section).getByText('Smash to Smithereens')).toBeInTheDocument();
    expect(within(section).getByText(/ReadOnlyDeck.main/)).toBeInTheDocument();
    expect(within(section).getByText(/ReadOnlyDeck.sideboard/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('imports and closes', () => {
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<ReadOnlyDeck deck={deck} onImport={onImport} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /ReadOnlyDeck.import/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ReadOnlyDeck.close' }));
    expect(onImport).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no import without a handler', () => {
    render(<ReadOnlyDeck deck={deck} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /ReadOnlyDeck.import/ })).toBeNull();
  });
});
