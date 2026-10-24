import { vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { Event_UserMessageSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { create } from '@bufbuild/protobuf';

import { renderWithProviders, createMockWebClient, connectedState, makeUser } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import { ModerationProvider } from '@app/feature-widgets/moderation';
import { UserGamesProvider } from '@app/feature-widgets/user-games';
import Player from './Player';
import { setAdminLocked } from '@app/hooks';

beforeEach(() => setAdminLocked(false));
afterEach(() => setAdminLocked(false));
import { ReportUserProvider } from '../../dialogs';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

function renderPlayer(preloadedState: any, name = 'alice') {
  return renderWithProviders(
    <ModerationProvider>
      <UserGamesProvider>
        <Routes>
          <Route path="/player/:name" element={<Player />} />
        </Routes>
      </UserGamesProvider>
    </ModerationProvider>,
    { preloadedState, route: `/player/${name}` },
  );
}

const stateWithPlayer = (user: ReturnType<typeof makeUser>, overrides = {}) => ({
  ...connectedState,
  server: {
    ...(connectedState.server as any),
    userInfo: { [user.name]: user },
    buddyList: {},
    ignoreList: {},
    ...overrides,
  },
});

describe('Player', () => {
  it('shares developer, privilege and calendar-age formatting with Account', () => {
    const user = makeUser({ name: 'alice', userLevel: ServerInfo_User_UserLevelFlag.IsDeveloper
      | ServerInfo_User_UserLevelFlag.IsRegistered | ServerInfo_User_UserLevelFlag.IsJudge, privlevel: 'GOLD', accountageSecs: 0n });
    renderPlayer(stateWithPlayer(user));
    expect(screen.getAllByText('Account.level.developer | Account.level.judge | GOLD')).toHaveLength(2);
    expect(screen.getByText('Account.age.unknown')).toBeInTheDocument();
  });
  it('shows the not-found message when the player is unknown', () => {
    renderPlayer(connectedState, 'ghost');
    expect(screen.getByText('Player.action.notFound')).toBeInTheDocument();
  });

  it('renders the player name and details when the user is found', () => {
    const user = makeUser({ name: 'alice', realName: 'Alice A', country: 'us', userLevel: 0 });
    const { container } = renderPlayer(stateWithPlayer(user), 'alice');
    // "alice" also appears in the TopBar's Player tab; scope to the player-view
    // card to keep this assertion about the profile details (not the tab).
    const card = within(container.querySelector('.player-view__card') as HTMLElement);
    expect(card.getByText('alice')).toBeInTheDocument();
    expect(card.getByText('Alice A')).toBeInTheDocument();
  });

  it('shows action buttons for another user and wires the buddy action', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    renderPlayer(stateWithPlayer(user), 'alice');

    const addBuddy = screen.getByRole('button', { name: /Player\.action\.addBuddy/ });
    fireEvent.click(addBuddy);
    expect(hoisted.mockWebClient.request.session.addToBuddyList).toHaveBeenCalledWith('alice');
  });

  it('offers the games action for another user, enabled only while they are online', () => {
    const alice = makeUser({ name: 'alice' });
    const { unmount } = renderPlayer(stateWithPlayer(alice));
    expect(screen.getByRole('button', { name: 'UserGamesDialog.menu.showGames' })).toBeDisabled();
    unmount();

    renderPlayer(stateWithPlayer(alice, { users: { alice } }));
    expect(screen.getByRole('button', { name: 'UserGamesDialog.menu.showGames' })).toBeEnabled();
  });

  it('hides action buttons when viewing your own profile', () => {
    const user = makeUser({ name: 'testUser', userLevel: 0 });
    renderPlayer(stateWithPlayer(user), 'testUser');
    expect(screen.queryByRole('button', { name: /Player\.action\.addBuddy/ })).not.toBeInTheDocument();
  });

  it('shows moderator-only actions when the current user is a moderator', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    const state = {
      ...stateWithPlayer(user),
      server: {
        ...(stateWithPlayer(user).server as any),
        user: makeUser({ name: 'testUser', userLevel: ServerInfo_User_UserLevelFlag.IsModerator }),
      },
    };
    renderPlayer(state, 'alice');
    const moderation = screen.getByRole('group', { name: 'Player.moderation' });
    expect(within(moderation).getByRole('button', { name: 'Moderation.menu.warnUser' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Moderation.menu.banHistory' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Moderation.menu.promoteMod' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Moderation.menu.warnUser' }));
    expect(hoisted.mockWebClient.request.session.getUserInfo).toHaveBeenCalledWith('alice');
  });

  it('hides moderator actions from regular users', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.queryByRole('button', { name: 'Moderation.menu.warnUser' })).not.toBeInTheDocument();
  });

  it('shows moderator actions disabled on your own profile', () => {
    const self = makeUser({ name: 'testUser', userLevel: ServerInfo_User_UserLevelFlag.IsModerator });
    const state = {
      ...stateWithPlayer(self),
      server: { ...(stateWithPlayer(self).server as any), user: self },
    };
    renderPlayer(state, 'testUser');
    expect(screen.getByRole('button', { name: 'Moderation.menu.warnUser' })).toBeDisabled();
  });

  it('renders the remove-buddy label when the player is already a buddy', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    const state = stateWithPlayer(user, { buddyList: { alice: user } });
    renderPlayer(state, 'alice');
    expect(screen.getByRole('button', { name: /Player\.action\.removeBuddy/ })).toBeInTheDocument();
  });

  it('labels a registered (non-mod, non-admin) user as Registered', () => {
    const user = makeUser({ name: 'alice', userLevel: ServerInfo_User_UserLevelFlag.IsRegistered });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getAllByText(/Account\.level\.registered/).length).toBeGreaterThan(0);
  });

  it('labels an admin user as Administrator', () => {
    const user = makeUser({ name: 'alice', userLevel: ServerInfo_User_UserLevelFlag.IsAdmin });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getAllByText(/Account\.level\.administrator/).length).toBeGreaterThan(0);
  });

  it('marks a judge user with the Judge label alongside the base level', () => {
    const user = makeUser({
      name: 'alice',
      userLevel:
        ServerInfo_User_UserLevelFlag.IsRegistered | ServerInfo_User_UserLevelFlag.IsJudge,
    });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getAllByText(/Account\.level\.judge/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Account\.level\.registered/).length).toBeGreaterThan(0);
  });

  it('shows the privlevel suffix on the level badge when it is set and not NONE', () => {
    const user = makeUser({
      name: 'alice',
      userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
      privlevel: 'GOLD',
    });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getAllByText('Account.level.registered | GOLD')).toHaveLength(2);
  });

  it('renders the Unknown account-age text when accountageSecs is missing on a registered user', () => {
    const user = makeUser({
      name: 'alice',
      userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
      accountageSecs: 0n,
    });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getByText(/Account\.age\.unknown/)).toBeInTheDocument();
  });

  it('formats account age with years and days when over one year', () => {
    const oneYearAndOneDay = BigInt(86400 * (365 + 1));
    const user = makeUser({
      name: 'alice',
      userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
      accountageSecs: oneYearAndOneDay,
    });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getByText(/Account\.age\.yearsAndDays/)).toBeInTheDocument();
  });

  it('renders an inline avatar img when the user has an avatar bitmap', () => {
    const user = makeUser({
      name: 'alice',
      userLevel: 0,
      avatarBmp: new Uint8Array([1, 2, 3]),
    });
    renderPlayer(stateWithPlayer(user), 'alice');
    const img = screen.getByAltText('alice') as HTMLImageElement;
    expect(img.src).toContain('data:image/png;base64,');
  });
});

describe('Player report user (#7091)', () => {
  it('prefills the latest 50 private messages from both senders using receipt times', () => {
    const state = withServer('3.1.0 ()');
    state.server.messages = { alice: Array.from({ length: 52 }, (_, index) => Object.assign(
      create(Event_UserMessageSchema, { senderName: index % 2 ? 'testUser' : 'alice', message: `message ${index}` }),
      { timeReceived: new Date(2026, 0, 1, 9, 5, index).getTime() },
    )) };
    renderWithProviders(<ReportUserProvider><Routes>
      <Route path="/player/:name" element={<Player />} />
    </Routes></ReportUserProvider>, { preloadedState: state, route: '/player/alice' });
    fireEvent.click(screen.getByRole('button', { name: 'ReportUserDialog.menuItem' }));
    const lines = (screen.getByLabelText('ReportUserDialog.chatGroup') as HTMLTextAreaElement).value.split('\n');
    expect(lines).toHaveLength(50);
    expect(lines[0]).toBe('[09:05:02] alice: message 2');
    expect(lines[49]).toBe('[09:05:51] testUser: message 51');
  });

  const withServer = (version: string) => stateWithPlayer(makeUser({ name: 'alice', userLevel: 0 }), {
    info: { message: null, name: 'Test Server', version },
    user: makeUser({ name: 'testUser', userLevel: ServerInfo_User_UserLevelFlag.IsRegistered }),
  });

  it('opens the report dialog for this user, with no game or chat attached', () => {
    renderWithProviders(
      <ReportUserProvider>
        <Routes>
          <Route path="/player/:name" element={<Player />} />
        </Routes>
      </ReportUserProvider>,
      { preloadedState: withServer('3.1.0 ()'), route: '/player/alice' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'ReportUserDialog.menuItem' }));
    expect(screen.getByTestId('report-reported-user').textContent).toBe('alice');
    expect((screen.getByLabelText('ReportUserDialog.chatGroup') as HTMLTextAreaElement).value).toBe('');
  });

  it('hides the action on a 3.0 server', () => {
    renderPlayer(withServer('3.0.0 ()'), 'alice');
    expect(screen.queryByRole('button', { name: 'ReportUserDialog.menuItem' })).toBeNull();
  });
});
