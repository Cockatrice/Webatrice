import { render, screen } from '@testing-library/react';

import { SectionHeader, StatCard } from './BreakdownBlocks';
import { ColorBar } from './ColorBar';
import { ManaCurve } from './ManaCurve';
import { TypeBreakdown } from './TypeBreakdown';

describe('breakdown building blocks', () => {
  it('StatCard and SectionHeader render their content', () => {
    render(
      <>
        <SectionHeader>Overview</SectionHeader>
        <StatCard label="Lands" value={36} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('36').nextSibling).toHaveTextContent('Lands');
  });

  it('ManaCurve scales every bucket against the tallest and keeps empty buckets visible', () => {
    render(<ManaCurve curve={{ 1: 2, 3: 4 }} />);
    const bars = screen.getAllByTitle('DeckBreakdown.curve.barTitle');
    expect(bars[3]).toHaveStyle({ height: '100%' });
    expect(bars[1]).toHaveStyle({ height: '50%' });
    expect(bars[0]).toHaveStyle({ height: '2px' });
    expect(screen.getByText('DeckBreakdown.curve.sevenPlus')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DeckBreakdown.curve.label' })).toBeInTheDocument();
  });

  it('ColorBar shows an empty track without pips, else proportional segments and a legend', () => {
    const { rerender, container } = render(<ColorBar pips={{ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();

    rerender(<ColorBar pips={{ W: 1, U: 0, B: 0, R: 3, G: 0, C: 0 }} />);
    const bar = screen.getByRole('img', { name: 'DeckBreakdown.colorBar' });
    expect(bar.children).toHaveLength(2);
    expect(bar.children[1]).toHaveStyle({ width: '75%' });
    expect(screen.getByTitle('CardSearch.color.R')).toHaveTextContent('75%');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('TypeBreakdown lists the most common types first', () => {
    const { rerender } = render(<TypeBreakdown counts={{ Land: 2, Creature: 5, Instant: 0 }} />);
    expect(screen.getAllByText(/Creature|Land|Instant/).map((el) => el.textContent)).toEqual([
      'CardSearch.cardType.Creature',
      'CardSearch.cardType.Land',
    ]);
    rerender(<TypeBreakdown counts={{}} />);
    expect(screen.getByText('DeckBreakdown.noCards')).toBeInTheDocument();
  });
});
