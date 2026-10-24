import { render, screen } from '@testing-library/react';

import { DeckLegalitySummary, type DeckLegalitySummaryProps } from './DeckLegalitySummary';

function renderSummary(overrides: Partial<DeckLegalitySummaryProps>) {
  const props: DeckLegalitySummaryProps = {
    format: 'modern', status: 'legal', illegalCount: 0, unknownCount: 0, loading: false, ...overrides,
  };
  return render(<DeckLegalitySummary {...props} />);
}

describe('DeckLegalitySummary', () => {
  it.each([
    [{ loading: true }, 'DeckLegality.checking'],
    [{ status: 'legal' as const }, 'DeckLegality.legal'],
    [{ status: 'illegal' as const, illegalCount: 2 }, 'DeckLegality.illegal'],
    [{ status: 'unavailable' as const }, 'DeckLegality.unavailable'],
  ])('%o shows %s', (overrides, text) => {
    renderSummary(overrides);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('counts unchecked cards under a verdict, but not when nothing could be checked', () => {
    renderSummary({ status: 'illegal', illegalCount: 1, unknownCount: 2 });
    expect(screen.getByText('DeckLegality.unchecked')).toBeInTheDocument();
  });

  it('renders nothing for a deck without a format', () => {
    const { container } = renderSummary({ status: 'none' });
    expect(container).toBeEmptyDOMElement();
  });
});
