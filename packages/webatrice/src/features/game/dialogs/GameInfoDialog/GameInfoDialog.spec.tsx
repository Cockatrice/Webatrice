import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { makeStoreState, renderWithProviders, makeUser } from '../../../../__test-utils__';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import GameInfoDialog from './GameInfoDialog';

function stateWithGame(overrides: Partial<Parameters<typeof makeGameEntry>[0]> = {}) {
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({
          hostId: 1,
          localPlayerId: 1,
          started: true,
          secondsElapsed: 3723,
          players: {
            1: makePlayerEntry({
              properties: makePlayerProperties({
                playerId: 1,
                userInfo: makeUser({ name: 'Alice' }),
              }),
            }),
            2: makePlayerEntry({
              properties: makePlayerProperties({
                playerId: 2,
                userInfo: makeUser({ name: 'Bob' }),
              }),
            }),
          },
          ...overrides,
        }),
      },
    },
  });
}

function footerCloseButton() {
  const dialog = screen.getByRole('dialog', { name: 'GameInfoDialog.title' });
  const footer = dialog.querySelector('footer');
  expect(footer).not.toBeNull();
  return within(footer!).getByRole('button', { name: 'Common.action.close' });
}

// Self-sources gameInfoOpen + closeGameInfo from GameDialogsContext and the
// gameId from GameIdContext (default 1 in the harness).
describe('GameInfoDialog', () => {
  it('renders game id, started flag, elapsed, and host name', () => {
    renderWithProviders(<GameInfoDialog />, {
      preloadedState: stateWithGame(),
      gameDialogs: { gameInfoOpen: true },
    });

    expect(screen.getByText('GameInfoDialog.row.gameId')).toBeInTheDocument();
    expect(screen.getByText('GameInfoDialog.row.elapsed')).toBeInTheDocument();
    expect(screen.getByText('01:02:03')).toBeInTheDocument();
    // Alice appears twice: once as the Host <dd>, once in the players list.
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  it('tags the local player with "you" and the host with "host"', () => {
    renderWithProviders(<GameInfoDialog />, {
      preloadedState: stateWithGame(),
      gameDialogs: { gameInfoOpen: true },
    });

    // Scope to the player-list row, not the Host <dd>.
    const aliceNameSpans = screen
      .getAllByText('Alice')
      .filter((el) => el.classList.contains('game-info-dialog__player-name'));
    const aliceRow = aliceNameSpans[0].closest('li')!;
    expect(aliceRow.textContent).toMatch(/host/);
    expect(aliceRow.textContent).toMatch(/you/);
  });

  it('calls closeGameInfo when the close button is clicked', () => {
    const closeGameInfo = vi.fn();
    renderWithProviders(<GameInfoDialog />, {
      preloadedState: stateWithGame(),
      gameDialogs: { gameInfoOpen: true, closeGameInfo },
    });

    fireEvent.click(footerCloseButton());
    expect(closeGameInfo).toHaveBeenCalled();
  });

  it('returns null when the game is missing', () => {
    renderWithProviders(<GameInfoDialog />, {
      preloadedState: stateWithGame(),
      gameId: 999,
      gameDialogs: { gameInfoOpen: true },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal named by its title that takes focus, keeps Tab inside and closes on Escape', async () => {
    const user = userEvent.setup();
    const closeGameInfo = vi.fn();
    renderWithProviders(<GameInfoDialog />, {
      preloadedState: stateWithGame(),
      gameDialogs: { gameInfoOpen: true, closeGameInfo },
    });
    const dialog = screen.getByRole('dialog', { name: 'GameInfoDialog.title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(footerCloseButton()).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(closeGameInfo).toHaveBeenCalled();
  });
});
