import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServerInfo_User_UserLevelFlag as Flag } from '@cockatrice/sockatrice/generated';
import { ModerationProvider } from '@app/feature-widgets/moderation';
import { connectedState, makeStoreState, renderWithProviders, makeUser } from '../../../../../__test-utils__';
import { ReportUserProvider } from '../../../../../dialogs';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import { setAdminLocked } from '@app/hooks';
import PlayerList from './PlayerList';
import { GameReadOnlyProvider } from '../../ui/GameReadOnlyContext';

function buildState(
  players: ReturnType<typeof makePlayerEntry>[],
  activePlayerId: number,
  hostId?: number,
) {
  const byId: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const p of players) {
    byId[p.properties.playerId] = p;
  }
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({
          players: byId,
          activePlayerId,
          ...(hostId != null ? { hostId } : {}),
        }),
      },
    },
  });
}

describe('PlayerList', () => {
  it('does not grant host actions when both host and local player use the -1 sentinel', () => {
    const state = buildState([makePlayerEntry({
      properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob' }) }),
    })], 2, -1);
    state.games!.games[1].localPlayerId = -1;
    renderWithProviders(<PlayerList />, { preloadedState: state });
    fireEvent.contextMenu(screen.getByTestId('player-list-item-2'));
    expect(screen.getByRole('menuitem', { name: 'PlayerListContextMenu.userDetails' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'PlayerListContextMenu.kick' })).not.toBeInTheDocument();
  });

  it('removes an already-open live menu when the list becomes read-only', () => {
    const state = buildState([makePlayerEntry({
      properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob' }) }),
    })], 2);
    const { rerender } = renderWithProviders(
      <GameReadOnlyProvider value={false}><PlayerList /></GameReadOnlyProvider>, { preloadedState: state },
    );
    fireEvent.contextMenu(screen.getByTestId('player-list-item-2'));
    expect(screen.getByRole('menuitem', { name: 'PlayerListContextMenu.userDetails' })).toBeInTheDocument();
    rerender(<GameReadOnlyProvider value><PlayerList /></GameReadOnlyProvider>);
    expect(screen.queryByRole('menuitem', { name: 'PlayerListContextMenu.userDetails' })).not.toBeInTheDocument();
  });

  it.each([Flag.IsRegistered, Flag.IsRegistered | Flag.IsModerator | Flag.IsAdmin])(
    'offers no live user actions in a replay while connected with level %s', (userLevel) => {
      const state = buildState([makePlayerEntry({
        properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob', userLevel: Flag.IsRegistered }) }),
      })], 2, -1);
      state.games!.games[1].localPlayerId = -1;
      const { webClient } = renderWithProviders(
        <ModerationProvider><GameReadOnlyProvider value><PlayerList /></GameReadOnlyProvider></ModerationProvider>,
        { preloadedState: { ...state, server: { ...connectedState.server!, user: makeUser({ name: 'Alice', userLevel }) } } },
      );
      vi.clearAllMocks();
      const row = screen.getByTestId('player-list-item-2');
      fireEvent.contextMenu(row);
      fireEvent.keyDown(row, { key: 'ContextMenu' });
      fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
      fireEvent.click(row);
      for (const name of ['Add to buddy list', 'Add to ignore list', 'Kick from game', 'Moderation.menu.warnUser']) {
        fireEvent.contextMenu(row);
        const button = screen.queryByRole('button', { name });
        if (button) {
          fireEvent.click(button);
        }
      }
      for (const scope of Object.values(webClient.request)) {
        for (const request of Object.values(scope)) {
          expect(request).not.toHaveBeenCalled();
        }
      }
      expect(document.querySelector('[data-player-context-menu]')).toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('lists every player in the game', () => {
    // Post-rewrite: PlayerList no longer renders a ping dot or ping
    // seconds — the sidebar shows avatar + name + role only. Kept the
    // test's intent (every player is listed) but removed ping assertions.
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
        pingSeconds: 10,
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
        pingSeconds: 20,
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 1),
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  // ping-dot color tests removed: the redo sidebar drops the ping
  // indicator entirely (see PlayerList.tsx — no ping dot / seconds
  // element renders). Nothing to assert against.

  // sideboard-lock icon tests removed: the redo sidebar doesn't
  // render a lock affordance in the player row (see PlayerList.tsx).

  it('highlights the active player', () => {
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 2),
    });

    // Post-Tailwind rewrite: active row uses `bg-accent/10` in place of
    // the old BEM `player-list__item--active` modifier class.
    expect(screen.getByTestId('player-list-item-2')).toHaveClass('bg-accent/10');
    expect(screen.getByTestId('player-list-item-1')).not.toHaveClass('bg-accent/10');
  });

  it('marks conceded players with the Conceded role tag', () => {
    // Post-rewrite: there's no dedicated dim class for a conceded row.
    // The signal moved to the role label under the player's name
    // ("Conceded") plus a muted avatar treatment — assert the label.
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
        conceded: true,
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1], 0),
    });

    const row = screen.getByTestId('player-list-item-1');
    expect(row.textContent).toMatch(/PlayerList\.role\.conceded/);
  });

  it('shows empty state when there are no players', () => {
    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([], 0),
    });

    expect(screen.getByText('PlayerList.empty')).toBeInTheDocument();
  });

  it('handles missing gameId without throwing', () => {
    renderWithProviders(<PlayerList />, {
      preloadedState: makeStoreState({}),
      gameId: undefined,
    });

    expect(screen.getByText('PlayerList.empty')).toBeInTheDocument();
  });

  it('renders a host badge on the host row only', () => {
    const p1 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 1,
        userInfo: makeUser({ name: 'Alice' }),
      }),
    });
    const p2 = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: 2,
        userInfo: makeUser({ name: 'Bob' }),
      }),
    });

    renderWithProviders(<PlayerList />, {
      preloadedState: buildState([p1, p2], 1, 2),
    });

    // Post-Tailwind rewrite: the host badge is a lucide-react Crown
    // icon rendered with `aria-label="Host"` in place of the old BEM
    // `.player-list__host-badge` element.
    const bobRow = screen.getByTestId('player-list-item-2');
    const aliceRow = screen.getByTestId('player-list-item-1');
    expect(bobRow.querySelector('[aria-label="PlayerList.host"]')).not.toBeNull();
    expect(aliceRow.querySelector('[aria-label="PlayerList.host"]')).toBeNull();
  });

  describe('moderator section (shared moderation widget)', () => {
    const REGULAR = Flag.IsUser | Flag.IsRegistered;
    const MODERATOR = REGULAR | Flag.IsModerator;
    const ADMIN = MODERATOR | Flag.IsAdmin;

    function renderAs(localLevel: number, hostId?: number) {
      const alice = makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, userInfo: makeUser({ name: 'Alice', userLevel: localLevel }) }),
      });
      const bob = makePlayerEntry({
        properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob', userLevel: REGULAR }) }),
      });
      const state = buildState([alice, bob], 1, hostId);
      renderWithProviders(
        <ModerationProvider>
          <PlayerList />
        </ModerationProvider>,
        {
          preloadedState: {
            ...state,
            server: { ...(connectedState.server as any), user: makeUser({ name: 'Alice', userLevel: localLevel }) },
          },
        },
      );
    }

    afterEach(() => {
      setAdminLocked(false);
    });

    const openMenu = (playerId: number) => fireEvent.contextMenu(screen.getByTestId(`player-list-item-${playerId}`));

    it('offers nothing extra to a regular user', () => {
      renderAs(REGULAR);
      openMenu(2);
      expect(screen.queryByRole('menuitem', { name: 'Moderation.menu.warnUser' })).not.toBeInTheDocument();
    });

    it('offers warn / ban / notes to a moderator, without role changes', () => {
      renderAs(MODERATOR);
      openMenu(2);
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.warnUser' })).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.banHistory' })).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.adminNotes' })).not.toHaveAttribute('aria-disabled');
      expect(screen.queryByRole('menuitem', { name: 'Moderation.menu.promoteMod' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'PlayerListContextMenu.kick' })).toBeInTheDocument();
    });

    it('hides Kick from game from a non-host moderator while the admin lock is on', () => {
      setAdminLocked(true);
      renderAs(MODERATOR, 2);
      openMenu(2);
      expect(screen.queryByRole('menuitem', { name: 'PlayerListContextMenu.kick' })).not.toBeInTheDocument();
    });

    it('still offers Kick from game to a locked moderator who hosts the game', () => {
      setAdminLocked(true);
      renderAs(MODERATOR, 1);
      openMenu(2);
      expect(screen.getByRole('menuitem', { name: 'PlayerListContextMenu.kick' })).toBeInTheDocument();
    });

    it('adds promote entries for an admin', () => {
      renderAs(ADMIN);
      openMenu(2);
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.promoteMod' })).not.toHaveAttribute('aria-disabled');
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.promoteJudge' })).not.toHaveAttribute('aria-disabled');
    });

    it('disables the section on your own seat', () => {
      renderAs(ADMIN);
      openMenu(1);
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.warnUser' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('menuitem', { name: 'Moderation.menu.demoteMod' })).toHaveAttribute('aria-disabled', 'true');
    });
  });
});

describe('PlayerList actions from the keyboard', () => {
  function renderPair() {
    const alice = makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, userInfo: makeUser({ name: 'Alice' }) }) });
    const bob = makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob' }) }) });
    renderWithProviders(<PlayerList />, { preloadedState: buildState([alice, bob], 1) });
  }

  it('gives each row a "More actions" button that opens the row menu with focus in it', async () => {
    const user = userEvent.setup();
    renderPair();
    const more = within(screen.getByTestId('player-list-item-2')).getByRole('button', { name: 'PlayerList.moreActions' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');

    more.focus();
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'PlayerListContextMenu.label' });
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();
    expect(within(menu).getByRole('menuitem', { name: 'PlayerListContextMenu.userDetails' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it('opens the menu with Shift+F10 and runs an entry with the arrows and Enter', async () => {
    const user = userEvent.setup();
    renderPair();
    within(screen.getByTestId('player-list-item-2')).getByRole('button', { name: 'PlayerList.moreActions' }).focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = screen.getByRole('menu', { name: 'PlayerListContextMenu.label' });
    await user.keyboard('{End}');
    expect(within(menu).getAllByRole('menuitem').at(-1)).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'PlayerListContextMenu.privateChat' })).toHaveFocus();
  });
});

describe('PlayerList report user (#7091)', () => {
  function stateOn(version: string) {
    const bob = makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob' }) }) });
    const base = buildState([bob], 2);
    return makeStoreState({
      ...base,
      server: {
        ...(connectedState.server as object),
        info: { message: null, name: 'Test Server', version },
        user: makeUser({ name: 'alice', userLevel: Flag.IsRegistered }),
      },
    } as Parameters<typeof makeStoreState>[0]);
  }

  it('offers "Report user" on a 3.1 server and opens the dialog with this game attached', () => {
    renderWithProviders(<ReportUserProvider><PlayerList /></ReportUserProvider>, { preloadedState: stateOn('3.1.0 ()') });
    fireEvent.contextMenu(screen.getByText('Bob'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ReportUserDialog.menuItem' }));
    expect(screen.getByTestId('report-reported-user').textContent).toBe('Bob');
    expect((screen.getByLabelText('ReportUserDialog.chatGroup') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('1', { selector: '#report-user-game-id' })).toBeTruthy();
  });

  it('does not offer it on a 3.0 server', () => {
    renderWithProviders(<ReportUserProvider><PlayerList /></ReportUserProvider>, { preloadedState: stateOn('3.0.0 ()') });
    fireEvent.contextMenu(screen.getByText('Bob'));
    expect(screen.queryByRole('menuitem', { name: 'ReportUserDialog.menuItem' })).toBeNull();
  });
});
