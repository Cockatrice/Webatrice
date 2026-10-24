import { act, fireEvent, screen } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { makeStoreState, renderWithProviders } from '../../../../__test-utils__';
import { useLobbyDeckState } from './LobbyDeckStateProvider';

const DECK = '<cockatrice_deck version="1" />';

function Seat({ playerId }: { playerId: number }) {
  const { state, setState } = useLobbyDeckState(1, playerId, DECK);
  return <button onClick={() => setState({ unloaded: true })}>{state?.unloaded ? 'Unloaded' : 'Loaded'}</button>;
}

function renderSeat() {
  return renderWithProviders(<Seat playerId={1} />, {
    preloadedState: makeStoreState({
      games: { games: { 1: makeGameEntry({
        localPlayerId: 1,
        players: Object.fromEntries([1, 2].map(playerId => [playerId, makePlayerEntry({
          properties: makePlayerProperties({ playerId }), deckList: DECK,
        })])),
      }) } },
    }),
  });
}

describe('LobbyDeckStateProvider', () => {
  it('keeps separate views for seats using the same deck, across route unmounts', () => {
    const { rerender } = renderSeat();
    fireEvent.click(screen.getByRole('button', { name: 'Loaded' }));
    rerender(<Seat playerId={2} />);
    expect(screen.getByRole('button', { name: 'Loaded' })).toBeInTheDocument();
    rerender(<div>Other route</div>);
    rerender(<Seat playerId={1} />);
    expect(screen.getByRole('button', { name: 'Unloaded' })).toBeInTheDocument();
  });

  it('drops a departed game view', () => {
    const { store } = renderSeat();
    fireEvent.click(screen.getByRole('button', { name: 'Loaded' }));
    act(() => {
      store.dispatch(games.Actions.gameLeft({ gameId: 1 }));
    });
    expect(screen.getByRole('button', { name: 'Loaded' })).toBeInTheDocument();
  });
});
