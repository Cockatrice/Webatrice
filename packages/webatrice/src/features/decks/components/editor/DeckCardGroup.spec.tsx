import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';
import type { DeckCard } from '../../types';
import { DeckCardGroup, type DeckCardGroupProps } from './DeckCardGroup';

const cards: DeckCard[] = [
  { name: 'Forest', quantity: 10, category: 'main', lookupSource: 'scryfall', typeLine: 'Land' },
  { name: 'Mystery', quantity: 1, category: 'main', lookupSource: 'unknown', manaCost: '{2}{G}' },
  { name: 'Bayou', quantity: 2, category: 'main', lookupSource: 'scryfall', typeLine: 'Land' },
];

function renderGroup(overrides: Partial<DeckCardGroupProps> = {}) {
  const props: DeckCardGroupProps = {
    label: 'Land',
    indices: [2, 0],
    deck: cards,
    selectedIndex: -1,
    onSelect: vi.fn(),
    onInc: vi.fn(),
    onDelete: vi.fn(),
    onSetCategory: vi.fn(),
    onSetCommander: vi.fn(),
    onChangePrinting: vi.fn(),
    onShowDetails: vi.fn(),
    isMtg: true,
    isCommander: false,
    ...overrides,
  };
  renderWithProviders(<DeckCardGroup {...props} />);
  return props;
}

describe('DeckCardGroup', () => {
  it('heads the section with its total quantity and lists rows in the given order', () => {
    renderGroup();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('DeckEditor.section.land12');
    expect(screen.getAllByRole('button', { name: /Bayou|Forest/ }).map((b) => b.textContent)).toEqual(['Bayou', 'Forest']);
  });

  it('wires each row to its deck index', () => {
    const props = renderGroup();
    fireEvent.click(screen.getByRole('button', { name: 'Bayou' }));
    expect(props.onSelect).toHaveBeenCalledWith(cards[2]);
  });

  it('marks the selected row', () => {
    renderGroup({ selectedIndex: 0 });
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });

  it('flags cards the catalog could not find and draws mana costs', () => {
    renderGroup({ label: 'Other', indices: [1] });
    expect(screen.getByRole('img', { name: 'DeckEditor.row.unknown' })).toHaveAttribute('title', 'DeckEditor.row.unknown');
    expect(screen.getAllByRole('img').flatMap((img) => img.getAttribute('alt') ?? [])).toEqual(['{2}', '{G}']);
  });
});
