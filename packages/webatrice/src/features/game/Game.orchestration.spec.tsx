// Through-<Game /> orchestration: a trigger in the seat or the side panels opens a
// game-level dialog (owned by useGameDialogs and hosted by Game.tsx), and that
// dialog sends the command. These are the routes that cross the seat (PlayerBoard)
// / Game boundary, so they are the ones the menu/dialog convergence phase can break.
//
// The seat's "Create token..." opens the game-level CreateTokenDialog
// (Game.seatPrompts.spec), and its zone views are game-level ZoneViewDialogs
// (Game.zoneViews.spec). The in-game SideboardDialog, which had no live trigger,
// is gone: sideboarding happens in the pre-game lobby.

import { act, fireEvent, screen, within } from '@testing-library/react';
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
  openContextMenu,
  pileEl,
  type SeatGameSpec,
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
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const HAND = Array.from({ length: 7 }, (_, i) => makeCard({ id: 100 + i, name: `Card ${i}` }));

function renderGame(overrides: Partial<SeatGameSpec> = {}) {
  const webClient = createMockWebClient();
  renderWithProviders(<Game />, {
    preloadedState: buildSeatGameState({
      localPlayerId: 1,
      seats: [
        { playerId: 1, table: [BOLT], hand: HAND, deckCount: 53 },
        { playerId: 2, table: [BEAR], handCount: 7 },
        { playerId: 3, handCount: 7 },
      ],
      ...overrides,
    }),
    webClient,
  });
  return webClient.request.game;
}

describe('Game orchestration', () => {
  it('Roll die: battlefield menu → RollDieDialog → rollDie', () => {
    const game = renderGame();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Roll die...');
    const dialog = screen.getByRole('dialog', { name: 'Roll Dice' });
    fireEvent.change(within(dialog).getByLabelText('Number of sides'), { target: { value: '20' } });
    fireEvent.change(within(dialog).getByLabelText('Number of dice'), { target: { value: '2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^roll$/i }));

    expect(game.rollDie).toHaveBeenCalledWith(1, { sides: 20, count: 2 });
  });

  it('Kick: player list context menu (host) → kickFromGame with that player', () => {
    const game = renderGame();

    fireEvent.click(screen.getByRole('tab', { name: /^Players/ }));
    fireEvent.contextMenu(screen.getByTestId('player-list-item-3'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'PlayerListContextMenu.kick' }));

    expect(game.kickFromGame).toHaveBeenCalledWith(1, { playerId: 3 });
  });

  describe('Mulligan (choose hand size): hand menu → prompt → mulligan', () => {
    function choose(value: string) {
      const game = renderGame();
      openContextMenu(pileEl('Hand', 0));
      chooseMenuPath('Take mulligan (Choose hand size)');
      expect(screen.getByText('0 and lower are in comparison to current hand size')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Number of cards'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: /ok/i }));
      return game;
    }

    it('translates a non-positive input relative to the hand size', () => {
      expect(choose('-1').mulligan).toHaveBeenCalledWith(1, { number: 6 });
    });

    it('passes a positive size through', () => {
      expect(choose('4').mulligan).toHaveBeenCalledWith(1, { number: 4 });
    });

    it('rejects a size outside [-handSize, handSize + deckSize]', () => {
      const game = choose('-99');
      expect(game.mulligan).not.toHaveBeenCalled();
      expect(screen.getByText(/between -7 and 60/i)).toBeInTheDocument();
    });
  });

  describe('Draw arrow: card menu → click a target → createArrow', () => {
    it('targets a card on another battlefield', () => {
      const game = renderGame();

      openContextMenu(cardEl(BOLT.id, 'battlefield'));
      chooseMenuPath('Draw arrow...');
      act(() => {
        fireEvent.click(cardEl(BEAR.id, 'battlefield'));
      });

      expect(game.createArrow).toHaveBeenCalledWith(1, {
        startPlayerId: 1,
        startZone: ZoneName.TABLE,
        startCardId: BOLT.id,
        targetPlayerId: 2,
        arrowColor: ArrowColor.RED,
        deleteInPhase: Phase.FirstMain,
        targetZone: ZoneName.TABLE,
        targetCardId: BEAR.id,
      });
    });

    it('targets a player through their life total', () => {
      const game = renderGame();

      openContextMenu(cardEl(BOLT.id, 'battlefield'));
      chooseMenuPath('Draw arrow...');
      act(() => {
        fireEvent.click(screen.getByLabelText('P2\'s life'));
      });

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

  it('Concede: sidebar → confirm → concede', () => {
    const game = renderGame();

    fireEvent.click(screen.getByTitle('Concede this game'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'GameLink.yes' }));

    expect(game.concede).toHaveBeenCalledWith(1);
  });

  it('View sideboard: sidebar button → seat sideboard view dumps the hidden zone', () => {
    const game = renderGame();

    fireEvent.click(screen.getByTitle('Open sideboard'));

    expect(game.dumpZone).toHaveBeenCalledWith(1, {
      playerId: 1,
      zoneName: ZoneName.SIDEBOARD,
      numberCards: -1,
      isReversed: false,
    });
    expect(screen.getByText('Sideboard — P1')).toBeInTheDocument();
  });

  it('Game info: battlefield menu → GameInfoDialog', () => {
    renderGame();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Game info...');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
