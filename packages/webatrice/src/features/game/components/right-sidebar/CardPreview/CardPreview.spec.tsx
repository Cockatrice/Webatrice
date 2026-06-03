import { render, screen, fireEvent, act } from '@testing-library/react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { makeCard } from '@cockatrice/datatrice/testing';
import CardPreview from './CardPreview';
import { CardPreviewProvider } from '../../ui/CardPreviewContext';

// CardPreview triggers an async CardDTO.get(name) inside a useEffect. The
// setupTests Dexie mock resolves immediately, but the resulting setState
// lands after the test's synchronous body — flush it within act() so React
// doesn't warn.
const flushDtoLookup = () => act(async () => {});

// CardPreview reads the hovered card from CardPreviewContext (Game provides it).
const previewTree = (card: ServerInfo_Card | null) => (
  <CardPreviewProvider value={card}>
    <CardPreview />
  </CardPreviewProvider>
);

describe('CardPreview', () => {
  it('shows an empty hint when no card is hovered', () => {
    render(previewTree(null));
    expect(screen.getByText(/hover a card/i)).toBeInTheDocument();
  });

  it('renders the small image immediately on hover', () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    render(previewTree(card));

    const small = document.querySelector('.card-preview__image--small') as HTMLImageElement;
    expect(small).not.toBeNull();
    expect(small.src).toContain('version=small');
    expect(small.src).toContain('Lightning%20Bolt');
  });

  it('renders a normal image that stays transparent until it loads', () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    render(previewTree(card));

    const normal = screen.getByTestId('card-preview-normal') as HTMLImageElement;
    expect(normal.src).toContain('version=normal');
    expect(normal).not.toHaveClass('card-preview__image--loaded');
  });

  it('reveals the normal image once onLoad fires', async () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    render(previewTree(card));

    const normal = screen.getByTestId('card-preview-normal');
    fireEvent.load(normal);
    expect(normal).toHaveClass('card-preview__image--loaded');
    await flushDtoLookup();
  });

  it('resets the loaded flag when the card changes', async () => {
    const a = makeCard({ id: 1, name: 'A' });
    const b = makeCard({ id: 2, name: 'B' });
    const { rerender } = render(previewTree(a));

    fireEvent.load(screen.getByTestId('card-preview-normal'));
    expect(screen.getByTestId('card-preview-normal')).toHaveClass(
      'card-preview__image--loaded',
    );

    rerender(previewTree(b));
    expect(screen.getByTestId('card-preview-normal')).not.toHaveClass(
      'card-preview__image--loaded',
    );
    await flushDtoLookup();
  });
});
