import { fireEvent, render, screen } from '@testing-library/react';

import type { DeckCard } from '../../types';
import { DeckBannerPicker } from './DeckBannerPicker';

const card = (name: string, scryfallId?: string, set?: string): DeckCard => ({
  name, quantity: 1, category: 'main', lookupSource: 'scryfall', scryfallId, set,
});

const cards = [card('Shock', 's1', 'm19'), card('Bolt', 'b1', 'm11'), card('Shock', 's2', 'm21')];

function renderPicker(banner?: { name: string; providerId?: string }) {
  const onChange = vi.fn();
  render(
    <DeckBannerPicker
      cards={cards}
      bannerCard={banner?.name}
      bannerCardProviderId={banner?.providerId}
      onChange={onChange}
    />,
  );
  return { onChange, select: screen.getByRole('combobox', { name: 'DeckBanner.label' }) as HTMLSelectElement };
}

describe('DeckBannerPicker', () => {
  it('offers "-" and each distinct card, naming the set when a card has two printings', () => {
    const { select } = renderPicker();
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['-', 'Bolt', 'Shock (M19)', 'Shock (M21)']);
    expect(select.value).toBe('');
  });

  it('picks a card with its printing, and clears with "-"', () => {
    const { select, onChange } = renderPicker({ name: 'Bolt', providerId: 'b1' });
    expect(select.selectedOptions[0].textContent).toBe('Bolt');

    fireEvent.change(select, { target: { value: select.options[3].value } });
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Shock', providerId: 's2' });
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps a saved banner that is no longer in the deck selectable', () => {
    const { select } = renderPicker({ name: 'Black Lotus' });
    expect(select.selectedOptions[0].textContent).toBe('Black Lotus');
  });
});
