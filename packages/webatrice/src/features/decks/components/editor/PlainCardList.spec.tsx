import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';
import type { DeckCard } from '../../types';
import { PlainAddCard, PlainCardList } from './PlainCardList';

function card(name: string, quantity = 1): DeckCard {
  return { name, quantity, category: 'main', lookupSource: 'unknown' };
}

describe('PlainAddCard', () => {
  it('adds the trimmed name on Enter and clears the field', () => {
    const onAdd = vi.fn();
    renderWithProviders(<PlainAddCard onAdd={onAdd} />);
    const input = screen.getByPlaceholderText('DeckEditor.list.addPlaceholder');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  Hedge Wizard ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Hedge Wizard');
    expect(input).toHaveValue('');
  });
});

describe('PlainCardList', () => {
  it('lists cards alphabetically and edits them by their deck index', () => {
    const onInc = vi.fn();
    const onDelete = vi.fn();
    renderWithProviders(<PlainCardList cards={[card('zebra', 2), card('Apple')]} onInc={onInc} onDelete={onDelete} />);

    expect(screen.getByRole('grid', { name: 'DeckEditor.list.label' })).toBeInTheDocument();
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual(['1Apple', '2zebra']);
    const [apple, zebra] = screen.getAllByRole('row');
    fireEvent.click(within(zebra).getByRole('button', { name: 'DeckEditor.list.increaseCard' }));
    fireEvent.click(within(apple).getByRole('button', { name: 'DeckEditor.list.decreaseCard' }));
    fireEvent.click(within(zebra).getByRole('button', { name: 'DeckEditor.list.removeCard' }));
    expect(onInc.mock.calls).toEqual([[0, 1], [1, -1]]);
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it('draws its rows in the order the keyboard grid was given', () => {
    renderWithProviders(
      <PlainCardList cards={[card('Apple'), card('Mango'), card('zebra')]} onInc={vi.fn()} onDelete={vi.fn()} order={[2, 0, 1]} />,
    );
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual(['1zebra', '1Apple', '1Mango']);
  });
});
