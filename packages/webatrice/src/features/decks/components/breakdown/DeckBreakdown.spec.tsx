import { act, render, screen } from '@testing-library/react';

import { getSettings, settingsStore } from '@app/hooks';
import { CommanderSpellbookIntegration } from '@app/types';

import { writeBracketLookupsMode } from '../../bracketConsent';
import type { DeckCard } from '../../types';
import { DeckBreakdown } from './DeckBreakdown';

vi.mock('./BracketSection', () => ({ BracketSection: () => <div>bracket section</div> }));

const cards: DeckCard[] = [
  { name: 'Forest', quantity: 10, category: 'main', lookupSource: 'scryfall', typeLine: 'Basic Land — Forest' },
  { name: 'Elves', quantity: 4, category: 'main', lookupSource: 'scryfall', typeLine: 'Creature', cmc: 1, colors: ['G'] },
  { name: 'Ugin', quantity: 1, category: 'main', lookupSource: 'scryfall', typeLine: 'Planeswalker', cmc: 8, colors: [] },
];

describe('DeckBreakdown', () => {
  it('renders nothing for an empty deck', () => {
    const { container } = render(<DeckBreakdown cards={[]} format="commander" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows totals, curve, colours and types', () => {
    render(<DeckBreakdown cards={cards} format="modern" />);

    expect(screen.getByText('15').nextSibling).toHaveTextContent('DeckBreakdown.stat.total');
    expect(screen.getByText('DeckBreakdown.stat.nonland').previousSibling).toHaveTextContent('5');
    expect(screen.getByText('2.40')).toBeInTheDocument();
    const bars = screen.getAllByTitle('DeckBreakdown.curve.barTitle');
    expect(bars).toHaveLength(8);
    expect(bars[1]).toHaveStyle({ height: '100%' });
    expect(bars[7]).toHaveStyle({ height: '25%' });
    expect(bars[0]).toHaveStyle({ height: '2px' });
    expect(screen.getByText('DeckBreakdown.curve.sevenPlus')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DeckBreakdown.colorBar' })).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('CardSearch.cardType.Planeswalker')).toBeInTheDocument();
  });

  it('adds the bracket estimate for commander-family formats only', () => {
    const { rerender } = render(<DeckBreakdown cards={cards} format="modern" />);
    expect(screen.queryByText('bracket section')).toBeNull();
    rerender(<DeckBreakdown cards={cards} format="paupercommander" />);
    expect(screen.getByText('DeckBreakdown.bracketEstimate')).toBeInTheDocument();
    expect(screen.getByText('bracket section')).toBeInTheDocument();
  });

  it('leaves the bracket estimate out when Commander Spellbook is disabled', async () => {
    settingsStore.reset();
    await getSettings();
    await act(() => writeBracketLookupsMode(CommanderSpellbookIntegration.Disabled));

    render(<DeckBreakdown cards={cards} format="commander" />);

    expect(screen.queryByText('Bracket estimate')).toBeNull();
    expect(screen.queryByText('bracket section')).toBeNull();
    settingsStore.reset();
  });
});
