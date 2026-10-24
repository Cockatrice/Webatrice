import { fireEvent, screen, within } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { PREFERENCE_DEFAULTS } from '@app/types';
import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { usePreferences } from '../../hooks/useSettings';
import Game from './Game';
import { buildSeatGameState, cardEl, layoutBoxes, pointerDrag, type SeatGameSpec } from './__test-utils__/seatFixtures';

vi.mock('../../components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../hooks/useSettings');
vi.mock('../../services/cards/catalog/lookup', async () =>
  (await import('./__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 2,
  seats: [
    {
      playerId: 1,
      name: 'Alice',
      hand: [makeCard({ id: 30, name: 'Forest' }), makeCard({ id: 31, name: 'Shock' })],
      stack: [makeCard({ id: 40, name: 'Counterspell' })],
      deckCount: 12,
    },
    { playerId: 2, name: 'Bob', handCount: 3, stack: [makeCard({ id: 50, name: 'Lightning Bolt' })] },
  ],
};

const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');

function renderBoard(spec: SeatGameSpec = SPEC) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(<Game />, { preloadedState: buildSeatGameState(spec), webClient, route: '/game/1' });
  return { ...utils, game: webClient.request.game };
}

describe('Game board arrangement', () => {
  it('moves the local hand into the tray and keeps opponents to a hand count', () => {
    renderBoard();
    const tray = screen.getByTestId('board-tray');
    const hand = within(tray).getByTestId('hand-zone-1');
    expect(within(hand).getAllByTitle(/^(Forest|Shock)$/)).toHaveLength(2);
    expect(screen.queryByTestId('hand-zone-2')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hand, 3 cards' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hand, 2 cards' })).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Hand — 2 cards' })).toBeEnabled();
    expect(setProperty).toHaveBeenCalledWith('--tray-card-height', expect.stringMatching(/px$/));
  });

  it('runs the labelled tray actions through the seat commands and prints their bindings', () => {
    const { game } = renderBoard();
    const tray = screen.getByTestId('board-tray');
    const draw = within(tray).getByRole('button', { name: /^Draw.*Ctrl\+D$/ });
    fireEvent.click(draw);
    expect(game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
    fireEvent.click(within(tray).getByRole('button', { name: /^Untap all/ }));
    expect(game.setCardAttr).toHaveBeenCalledTimes(1);
    fireEvent.click(within(tray).getByRole('button', { name: /^Shuffle/ }));
    expect(game.shuffle).toHaveBeenCalled();
  });

  it('keeps the library, graveyard and exile piles in the tray as menu buttons', () => {
    renderBoard();
    const tray = screen.getByTestId('board-tray');
    const library = within(tray).getByRole('button', { name: /^Library, 12 cards/ });
    fireEvent.contextMenu(library);
    expect(screen.getByRole('menu', { name: 'Library' })).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Sideboard, 0 cards' })).toBeInTheDocument();
  });

  it('puts the active player, the phases, a shared stack and Pass turn in the turn bar', () => {
    renderBoard();
    const bar = screen.getByTestId('turn-bar');
    expect(within(bar).getByTestId('turn-bar-active')).toHaveTextContent('Bob\'s turn');
    expect(within(bar).getByRole('navigation', { name: 'PhaseTrack.label' })).toBeInTheDocument();
    const stack = within(bar).getByRole('group', { name: 'Stack' });
    expect(within(stack).getAllByRole('button').map((b) => b.textContent)).toEqual(['AliceCounterspell', 'BobLightning Bolt']);
    expect(within(bar).getByRole('button', { name: /^Pass turn/ })).toBeEnabled();
  });

  it('drops into the tray hand by pointer x even when the vertical-hand preference is on', () => {
    vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, horizontalHand: false });
    let boxes: ReturnType<typeof layoutBoxes> | undefined;
    try {
      const { game } = renderBoard();
      const hand = within(screen.getByTestId('board-tray')).getByTestId('hand-zone-1');
      expect(hand).toHaveAttribute('aria-orientation', 'horizontal');
      const forest = cardEl(30, 'hand');
      const shock = cardEl(31, 'hand');
      boxes = layoutBoxes([
        [(el) => el === hand, { left: 0, top: 500, width: 800, height: 120 }],
        [(el) => el === forest, { left: 0, top: 500, width: 72, height: 100 }],
        [(el) => el === shock, { left: 80, top: 500, width: 72, height: 100 }],
      ]);
      pointerDrag(forest, { x: 10, y: 505 }, { x: 200, y: 505 });
      expect(game.moveCard).toHaveBeenCalledTimes(1);
      expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ x: 1, cardsToMove: { card: [{ cardId: 30 }] } });
    } finally {
      vi.mocked(usePreferences).mockReturnValue(PREFERENCE_DEFAULTS);
      boxes?.mockRestore();
    }
  });

  it('shows the hand inline again when every hand is visible', () => {
    renderBoard({
      ...SPEC,
      spectator: true,
      omniscient: true,
      seats: SPEC.seats.map((s) => ({ ...s, hand: s.hand ?? [makeCard({ id: 60, name: 'Opt' })] })),
    });
    expect(screen.queryByTestId('board-tray')).not.toBeInTheDocument();
    expect(screen.getByTestId('hand-zone-1')).toBeInTheDocument();
    expect(screen.getByTestId('hand-zone-2')).toBeInTheDocument();
  });
});
