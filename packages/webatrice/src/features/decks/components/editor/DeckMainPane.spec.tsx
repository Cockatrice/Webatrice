import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';

import { renderWithProviders } from '../../../../__test-utils__';
import { groupDeckCards } from '../../deckGrouping';
import type { HydratedDeck } from '../../types';
import { DeckMainPane, type DeckMainPaneProps } from './DeckMainPane';

const deck: HydratedDeck = {
  name: 'Burn',
  meta: { v: 1, updatedAt: 'x' },
  format: 'modern',
  cards: [
    { name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall', typeLine: 'Instant' },
    { name: 'Mountain', quantity: 16, category: 'main', lookupSource: 'scryfall', typeLine: 'Basic Land' },
  ],
};

function renderPane(overrides: Partial<DeckMainPaneProps> = {}) {
  const props: DeckMainPaneProps = {
    deck,
    groups: groupDeckCards(deck.cards, false),
    selectedIndex: -1,
    onSelect: vi.fn(),
    onInc: vi.fn(),
    onDelete: vi.fn(),
    onSetCategory: vi.fn(),
    onSetCommander: vi.fn(),
    onChangePrinting: vi.fn(),
    onShowDetails: vi.fn(),
    onLastRowRemoved: vi.fn(),
    isMtg: true,
    isCommander: false,
    ...overrides,
  };
  function StatefulPane() {
    const [currentDeck, setDeck] = useState(props.deck);
    return (
      <>
        <DeckMainPane
          {...props}
          deck={currentDeck}
          groups={groupDeckCards(currentDeck.cards, props.isCommander)}
          onDelete={(index) => {
            props.onDelete(index);
            setDeck((current) => ({ ...current, cards: current.cards.filter((_, i) => i !== index) }));
          }}
        />
      </>
    );
  }
  renderWithProviders(<StatefulPane />);
  return props;
}

describe('DeckMainPane', () => {
  it('lays an MTG deck out in type sections', () => {
    renderPane();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['DeckEditor.section.instant4', 'DeckEditor.section.land16']);
  });

  it('selects a card from its row', () => {
    const props = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Mountain' }));
    expect(props.onSelect).toHaveBeenCalledWith(deck.cards[1]);
  });

  it('shows a plain list for non-MTG decks', () => {
    renderPane({ isMtg: false });
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.getByRole('grid', { name: 'DeckEditor.list.label' })).toBeInTheDocument();
  });

  it('explains how to start an empty deck', () => {
    renderPane({ deck: { ...deck, cards: [] }, groups: [] });
    expect(screen.getByText('DeckEditor.shell.noCards')).toBeInTheDocument();
  });

  it.each([true, false])('reports the last card being removed so focus can move on (MTG: %s)', (isMtg) => {
    const one = { ...deck, cards: [deck.cards[0]] };
    const props = renderPane({ deck: one, groups: groupDeckCards(one.cards, false), isMtg });
    const row = screen.getByRole('row');
    row.focus();
    fireEvent.keyDown(row, { key: 'Delete' });
    expect(props.onDelete).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
    expect(props.onLastRowRemoved).toHaveBeenCalled();
  });
});

it('shows loading rather than edit instructions for an empty provisional deck', () => {
  renderPane({ deck: { ...deck, cards: [] }, groups: [], readOnly: true });
  expect(screen.getByText('DeckEditor.shell.loadingDeck')).toHaveAttribute('role', 'status');
  expect(screen.queryByText('DeckEditor.shell.emptyMtg')).not.toBeInTheDocument();
});
