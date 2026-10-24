import { fireEvent, screen, within } from '@testing-library/react';

import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { connectedState, makeStoreState, makeUser, renderWithProviders } from '../../../../__test-utils__';
import { GameIdProvider } from '../ui/GameIdContext';
import type { GameDialogActions } from '../ui/GameDialogActionsContext';
import GameDock from './GameDock';

vi.mock('../ChatLog/ChatLog', () => ({ default: () => <div data-testid="chat-log-stub" /> }));
vi.mock('../GameInviteControls/GameInviteControls', () => ({ default: () => null }));
vi.mock('../GameMenu/GameMenu', () => ({ default: () => null }));

function buildState() {
  const seat = (playerId: number, name: string, spectator = false) =>
    makePlayerEntry({ properties: makePlayerProperties({ playerId, spectator, userInfo: makeUser({ name }) }) });
  return makeStoreState({
    ...connectedState,
    games: {
      games: {
        1: makeGameEntry({
          localPlayerId: 1,
          started: true,
          players: { 1: seat(1, 'Alice'), 2: seat(2, 'Bob'), 3: seat(3, 'Watcher', true) },
        }),
      },
    },
  });
}

const actions: GameDialogActions = {
  onRequestRollDie: vi.fn(),
  onRequestConcede: vi.fn(),
  onRequestUnconcede: vi.fn(),
  onRequestGameInfo: vi.fn(),
  onRequestViewSideboard: vi.fn(),
  onRequestLeave: vi.fn(),
  onRotateView: vi.fn(),
};

function renderDock(props: Partial<Parameters<typeof GameDock>[0]> = {}) {
  const onCollapse = vi.fn();
  const onSelectTab = vi.fn();
  renderWithProviders(
    <GameIdProvider value={1}>
      <GameDock collapsed={false} tab="log" onCollapse={onCollapse} onSelectTab={onSelectTab} {...props} />
    </GameIdProvider>,
    { preloadedState: buildState(), gameDialogActions: actions },
  );
  return { onCollapse, onSelectTab };
}

describe('GameDock', () => {
  it('is a named complementary landmark with tabs that count players and spectators', () => {
    renderDock();
    const dock = screen.getByRole('complementary', { name: 'Game dock' });
    const tabs = within(dock).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Chat & log', 'Players2', 'Spectators1']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(dock).getByTestId('chat-log-stub')).toBeInTheDocument();
  });

  it('shows only seated players on the Players tab and only watchers on the Spectators tab', () => {
    const { onSelectTab } = renderDock({ tab: 'players' });
    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeVisible();
    expect(screen.getByText('Watcher')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: /^Spectators/ }));
    expect(onSelectTab).toHaveBeenCalledWith('spectators');
  });

  it('lists watchers on the Spectators tab', () => {
    renderDock({ tab: 'spectators' });
    expect(screen.getByText('Watcher')).toBeVisible();
    expect(screen.getByText('Alice')).not.toBeVisible();
  });

  it('collapses to a rail whose buttons reopen the dock on a tab', () => {
    const { onCollapse, onSelectTab } = renderDock({ collapsed: true });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-log-stub')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expand the dock' }));
    expect(onCollapse).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Players (2)' }));
    expect(onSelectTab).toHaveBeenCalledWith('players');
  });

  it('offers concede, sideboard, game info and leave at the bottom', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Concede' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sideboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Game info' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(actions.onRequestConcede).toHaveBeenCalled();
    expect(actions.onRequestViewSideboard).toHaveBeenCalled();
    expect(actions.onRequestGameInfo).toHaveBeenCalled();
    expect(actions.onRequestLeave).toHaveBeenCalled();
  });
});
