import { render, screen } from '@testing-library/react';

import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import CardDragOverlay from './CardDragOverlay';

describe('CardDragOverlay', () => {
  it('renders the Scryfall image for a face-up card', () => {
    render(<CardDragOverlay card={makeCard({ name: 'Lightning Bolt' })} />);

    const img = screen.getByAltText('Lightning Bolt') as HTMLImageElement;
    expect(img.src).toContain('Lightning%20Bolt');
    expect(img.src).toContain('version=small');
  });

  it('renders the face-down placeholder for hidden cards', () => {
    render(<CardDragOverlay card={makeCard({ faceDown: true })} />);

    expect(screen.getByLabelText('face-down card')).toBeInTheDocument();
  });

  it('mirrors tapped state so the preview stays rotated', () => {
    render(<CardDragOverlay card={makeCard({ tapped: true })} />);

    expect(screen.getByTestId('card-drag-overlay')).toHaveClass('card-slot--tapped');
  });

  it('renders P/T and counter overlays like the resting card', () => {
    render(
      <CardDragOverlay
        card={makeCard({ name: 'Grizzly Bears', pt: '2/2', counterList: [{ id: 1, value: 3 }] })}
      />,
    );

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the owner pill when dragging from the battlefield', () => {
    render(
      <CardDragOverlay
        card={makeCard({ name: 'Grizzly Bears', annotation: 'Owner: Alice' })}
        zone={ZoneName.TABLE}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
