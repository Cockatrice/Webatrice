import { screen, fireEvent } from '@testing-library/react';
import { Enriched } from '@cockatrice/datatrice';
import { makeStoreState, renderWithProviders, makeUser } from '../../../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import ZoneViewDialog from './ZoneViewDialog';

function stateWith(zone: Parameters<typeof makeZoneEntry>[0]) {
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({
          localPlayerId: 1,
          players: {
            1: makePlayerEntry({
              properties: makePlayerProperties({
                playerId: 1,
                userInfo: makeUser({ name: 'Trajer' }),
              }),
              zones: {
                [zone.name!]: makeZoneEntry(zone),
              },
            }),
          },
        }),
      },
    },
  });
}

describe('ZoneViewDialog', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <ZoneViewDialog
        isOpen={false}
        playerId={1}
        zoneName={Enriched.ZoneName.GRAVE}
        handleClose={() => {}}
      />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.GRAVE, cardCount: 0 }) },
    );

    expect(screen.queryByTestId('zone-view-dialog')).not.toBeInTheDocument();
  });

  it('renders each card in the zone with its Scryfall image', () => {
    const cards = [
      makeCard({ id: 1, name: 'Lightning Bolt' }),
      makeCard({ id: 2, name: 'Counterspell' }),
    ];
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.GRAVE}
        handleClose={() => {}}
      />,
      {
        preloadedState: stateWith({
          name: Enriched.ZoneName.GRAVE,
          cards,
          cardCount: 2,
        }),
      },
    );

    expect(screen.getByAltText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByAltText('Counterspell')).toBeInTheDocument();
  });

  it('shows the zone label in the title with the player name and count', () => {
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.GRAVE}
        handleClose={() => {}}
      />,
      {
        preloadedState: stateWith({
          name: Enriched.ZoneName.GRAVE,
          cards: [makeCard({ id: 1 })],
          cardCount: 1,
        }),
      },
    );

    expect(screen.getByText(/Trajer Graveyard \(1\)/)).toBeInTheDocument();
  });

  it('shows "This zone is empty." when the zone is fully empty', () => {
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.EXILE}
        handleClose={() => {}}
      />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.EXILE, cardCount: 0 }) },
    );

    expect(screen.getByText(/this zone is empty/i)).toBeInTheDocument();
  });

  it('shows a hidden-card fallback for hidden zones with count > 0 and no visible cards', () => {
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.DECK}
        handleClose={() => {}}
      />,
      {
        preloadedState: stateWith({
          name: Enriched.ZoneName.DECK,
          cardCount: 40,
          cards: [],
        }),
      },
    );

    expect(screen.getByText(/40 hidden cards/i)).toBeInTheDocument();
  });

  it('rests on the back face for face-down cards', () => {
    const faceDown = makeCard({ id: 1, name: 'Secret', faceDown: true });
    const { container } = renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.EXILE}
        handleClose={() => {}}
      />,
      {
        preloadedState: stateWith({
          name: Enriched.ZoneName.EXILE,
          cards: [faceDown],
          cardCount: 1,
        }),
      },
    );

    // Both faces render so the flip can reveal the other side; a face-down card rests
    // flipped to the back (its image is rotated away, not removed from the DOM).
    expect(screen.getByLabelText('face-down card')).toBeInTheDocument();
    expect(container.querySelector('.cardflip--back')).toBeInTheDocument();
    expect(container.querySelector('.cardflip--front')).toBeNull();
  });

  it('fires handleClose when the ✕ button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.GRAVE}
        handleClose={handleClose}
      />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.GRAVE, cardCount: 0 }) },
    );

    fireEvent.click(screen.getByRole('button', { name: /close zone view/i }));

    expect(handleClose).toHaveBeenCalled();
  });

  it('renders a non-modal floating panel at the provided initial position', () => {
    renderWithProviders(
      <ZoneViewDialog
        isOpen
        playerId={1}
        zoneName={Enriched.ZoneName.GRAVE}
        handleClose={() => {}}
        initialPosition={{ x: 200, y: 150 }}
      />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.GRAVE, cardCount: 0 }) },
    );

    const panel = screen.getByTestId('zone-view-dialog');
    expect(panel).toHaveStyle({ left: '200px', top: '150px' });
    expect(panel).toHaveAttribute('role', 'dialog');
  });

  it('renders the revealed library cards for the deck even though byId is empty', () => {
    const state = stateWith({ name: Enriched.ZoneName.DECK, cardCount: 2, cards: [] });
    state.games.games[1].players[1].zones[Enriched.ZoneName.DECK].revealedCards = [
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
    ];
    renderWithProviders(
      <ZoneViewDialog isOpen playerId={1} zoneName={Enriched.ZoneName.DECK} handleClose={() => {}} />,
      { preloadedState: state },
    );

    expect(screen.getByAltText('Forest')).toBeInTheDocument();
    expect(screen.getByAltText('Island')).toBeInTheDocument();
  });

  it('shows a "Shuffle on close" checkbox (default checked) for the library and passes the flag on close', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <ZoneViewDialog isOpen playerId={1} zoneName={Enriched.ZoneName.DECK} handleClose={handleClose} />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.DECK, cardCount: 0 }) },
    );

    expect(screen.getByRole('checkbox', { name: /shuffle on close/i })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /close zone view/i }));
    expect(handleClose).toHaveBeenCalledWith(true);
  });

  it('passes shuffleOnClose=false when the library checkbox is unchecked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <ZoneViewDialog isOpen playerId={1} zoneName={Enriched.ZoneName.DECK} handleClose={handleClose} />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.DECK, cardCount: 0 }) },
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /shuffle on close/i }));
    fireEvent.click(screen.getByRole('button', { name: /close zone view/i }));
    expect(handleClose).toHaveBeenCalledWith(false);
  });

  it('does not show the shuffle-on-close checkbox for non-deck zones', () => {
    renderWithProviders(
      <ZoneViewDialog isOpen playerId={1} zoneName={Enriched.ZoneName.GRAVE} handleClose={() => {}} />,
      { preloadedState: stateWith({ name: Enriched.ZoneName.GRAVE, cardCount: 0 }) },
    );

    expect(screen.queryByRole('checkbox', { name: /shuffle on close/i })).not.toBeInTheDocument();
  });
});
