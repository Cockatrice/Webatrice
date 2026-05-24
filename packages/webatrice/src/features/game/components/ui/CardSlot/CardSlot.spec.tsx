import { ReactElement } from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { DndContext } from '@dnd-kit/core';
import { ServerInfo_CardCounterSchema } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import CardSlot from './CardSlot';

// useDraggable requires a DndContext ancestor; keep a lightweight wrapper
// for these leaf tests rather than paying for the full renderWithProviders.
const render = (ui: ReactElement) =>
  rtlRender(<DndContext>{ui}</DndContext>);

describe('CardSlot', () => {
  it('renders the Scryfall image for a normal card', () => {
    const card = makeCard({ name: 'Lightning Bolt', id: 1 });
    render(<CardSlot card={card} />);

    const img = screen.getByAltText('Lightning Bolt') as HTMLImageElement;
    expect(img.src).toContain('/cards/named');
    expect(img.src).toContain('Lightning%20Bolt');
    expect(img.src).toContain('version=small');
  });

  it('uses providerId over name when present', () => {
    const card = makeCard({ name: 'Anything', providerId: 'abc-123', id: 1 });
    render(<CardSlot card={card} />);

    const img = screen.getByAltText('Anything') as HTMLImageElement;
    expect(img.src).toContain('/cards/abc-123');
  });

  it('renders a face-down back and suppresses image/P-T/counters when faceDown', () => {
    const card = makeCard({
      name: 'Hidden',
      faceDown: true,
      pt: '3/3',
      counterList: [create(ServerInfo_CardCounterSchema, { id: 1, value: 2 })],
    });
    render(<CardSlot card={card} />);

    expect(screen.getByLabelText('face-down card')).toBeInTheDocument();
    expect(screen.queryByAltText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('3/3')).not.toBeInTheDocument();
  });

  it('adds the tapped modifier when card.tapped is true', () => {
    const card = makeCard({ tapped: true });
    render(<CardSlot card={card} />);
    expect(screen.getByTestId('card-slot')).toHaveClass('card-slot--tapped');
  });

  it('renders P/T overlay when pt is set', () => {
    const card = makeCard({ pt: '5/5' });
    render(<CardSlot card={card} />);
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  it('does not render the annotation when zone is not TABLE', () => {
    const card = makeCard({ annotation: 'note' });
    render(<CardSlot card={card} zone={Enriched.ZoneName.HAND} />);
    expect(screen.queryByText('note')).not.toBeInTheDocument();
  });

  it('renders card.annotation as the owner pill on the battlefield', () => {
    const card = makeCard({ annotation: 'Bob' });
    render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not render any pill when annotation is empty even on battlefield', () => {
    const card = makeCard({ annotation: '' });
    const { container } = render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(container.querySelector('.card-slot__owner')).toBeNull();
  });

  it('renders the annotation pill for an enemy\'s card on the local battlefield', () => {
    // The server populates card.annotation whenever the card's owner differs
    // from the controller — including stolen / cloned cards on YOUR table.
    const card = makeCard({ annotation: 'Owner: Bob' });
    render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('strips a leading "Owner: " prefix from the annotation pill', () => {
    const card = makeCard({ annotation: 'Owner: Bob' });
    render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Owner: Bob')).not.toBeInTheDocument();
  });

  it('renders the card name as a top overlay (full-text, no ellipsis)', () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    render(<CardSlot card={card} />);
    const nameEls = screen.getAllByText('Lightning Bolt');
    const overlay = nameEls.find((el) => el.classList.contains('card-slot__name'));
    expect(overlay).toBeDefined();
    expect(overlay).not.toHaveStyle({ textOverflow: 'ellipsis' });
  });

  it('renders the annotation pill only when zone is TABLE', () => {
    const card = makeCard({ name: 'Bear', annotation: 'Alice' });
    const { unmount } = render(<CardSlot card={card} />);
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    unmount();

    render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('suppresses name and annotation overlays when face-down', () => {
    const card = makeCard({ name: 'Hidden', annotation: 'Alice', faceDown: true });
    render(<CardSlot card={card} zone={Enriched.ZoneName.TABLE} />);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('renders a counter badge per card counter', () => {
    const card = makeCard({
      counterList: [
        create(ServerInfo_CardCounterSchema, { id: 1, value: 3 }),
        create(ServerInfo_CardCounterSchema, { id: 2, value: 7 }),
      ],
    });
    render(<CardSlot card={card} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('adds the attacking modifier when card.attacking is true', () => {
    const card = makeCard({ attacking: true });
    render(<CardSlot card={card} />);
    expect(screen.getByTestId('card-slot')).toHaveClass('card-slot--attacking');
  });

  it('invokes click handlers with the card payload', () => {
    const card = makeCard();
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const onContextMenu = vi.fn();
    const onMouseEnter = vi.fn();
    render(
      <CardSlot
        card={card}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onMouseEnter={onMouseEnter}
      />,
    );

    const el = screen.getByTestId('card-slot');
    fireEvent.click(el);
    fireEvent.doubleClick(el);
    fireEvent.contextMenu(el);
    fireEvent.mouseEnter(el);

    expect(onClick).toHaveBeenCalledWith(card);
    expect(onDoubleClick).toHaveBeenCalledWith(card);
    expect(onContextMenu).toHaveBeenCalled();
    expect(onContextMenu.mock.calls[0][0]).toBe(card);
    expect(onMouseEnter).toHaveBeenCalledWith(card);
  });
});
