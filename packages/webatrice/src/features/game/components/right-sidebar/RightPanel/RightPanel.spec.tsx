import { screen, fireEvent } from '@testing-library/react';

// Block TurnControls' Dexie-backed useSettings from firing an async settle
// after mount (the Dexie mock resolves on a microtask, which would produce
// an unwrapped React state update inside TurnControls).
vi.mock('../../../../../hooks/useSettings');

import { makeStoreState, renderWithProviders } from '../../../../../__test-utils__';
import { makeCard, makeGameEntry } from '@cockatrice/datatrice/testing';
import RightPanel from './RightPanel';

function stateWithGame() {
  return makeStoreState({ games: { games: { 1: makeGameEntry() } } });
}

describe('RightPanel', () => {
  it('renders CardPreview, PlayerList, GameLog, and TurnControls', () => {
    renderWithProviders(<RightPanel />, {
      preloadedState: stateWithGame(),
    });

    expect(screen.getByTestId('card-preview')).toBeInTheDocument();
    expect(screen.getByTestId('player-list')).toBeInTheDocument();
    expect(screen.getByTestId('game-log')).toBeInTheDocument();
    expect(screen.getByTestId('turn-controls')).toBeInTheDocument();
  });

  it('shows the hovered card in the preview (from CardPreviewContext)', () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    renderWithProviders(<RightPanel />, {
      preloadedState: stateWithGame(),
      previewCard: card,
    });

    const small = document.querySelector('.card-preview__image--small') as HTMLImageElement;
    expect(small.src).toContain('Lightning%20Bolt');
  });

  it('surfaces TurnControls wired to the Roll Die dialog action', () => {
    const onRequestRollDie = vi.fn();
    renderWithProviders(
      <RightPanel />,
      { preloadedState: stateWithGame(), gameDialogActions: { onRequestRollDie } },
    );

    fireEvent.click(screen.getByRole('button', { name: /roll die/i }));

    expect(onRequestRollDie).toHaveBeenCalled();
  });

  it('shows the Spectating tag when the local user is a spectator', () => {
    renderWithProviders(<RightPanel />, {
      preloadedState: makeStoreState({
        games: { games: { 1: makeGameEntry({ spectator: true }) } },
      }),
    });

    expect(screen.getByTestId('spectating-tag')).toBeInTheDocument();
  });

  it('hides the Spectating tag when the local user is a participant', () => {
    renderWithProviders(<RightPanel />, {
      preloadedState: stateWithGame(),
    });

    expect(screen.queryByTestId('spectating-tag')).not.toBeInTheDocument();
  });
});
