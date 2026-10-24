
import { act, fireEvent, screen } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { Phase } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { ArrowColor } from '@app/types';
import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
  battlefieldEl,
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  menuLabels,
  openContextMenu,
  pileEl,
} from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

const BOLT = makeCard({ id: 10, name: 'Bolt', x: 0, y: 0 });
const SHOCK = makeCard({ id: 30, name: 'Shock' });

function renderGame() {
  const webClient = createMockWebClient();
  renderWithProviders(<Game />, {
    preloadedState: buildSeatGameState({
      localPlayerId: 1,
      seats: [
        { playerId: 1, table: [BOLT], hand: [SHOCK], deckCount: 40 },
        { playerId: 2, handCount: 7 },
      ],
    }),
    webClient,
  });
  return webClient.request.game;
}

describe('Game seat composition', () => {
  it('a right-click on the battlefield opens the seat player menu, never the game-level one', () => {
    renderGame();
    const labels = menuLabels(openContextMenu(battlefieldEl(1)));
    expect(labels).toEqual(expect.arrayContaining(['Create token...', 'Sideboard']));
    expect(screen.queryByTestId('player-context-menu')).not.toBeInTheDocument();
  });

  it('a right-click on the hand opens the seat hand menu, never the game-level one', () => {
    renderGame();
    const labels = menuLabels(openContextMenu(pileEl('Hand', 0)));
    expect(labels).toEqual(expect.arrayContaining(['View hand', 'Sort hand by...', 'Take mulligan (Choose hand size)']));
    expect(screen.queryByTestId('hand-context-menu')).not.toBeInTheDocument();
  });

  it('a pending arrow resolves against a player through the seat, with exactly one command', () => {
    const game = renderGame();
    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    act(() => {
      fireEvent.click(screen.getByLabelText('P2\'s life'));
    });

    expect(game.createArrow).toHaveBeenCalledTimes(1);
    expect(game.createArrow).toHaveBeenCalledWith(1, {
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      startCardId: BOLT.id,
      targetPlayerId: 2,
      arrowColor: ArrowColor.RED,
      deleteInPhase: Phase.FirstMain,
    });
  });
});
