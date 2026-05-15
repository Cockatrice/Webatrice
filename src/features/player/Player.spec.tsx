import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { renderWithProviders, createMockWebClient, connectedState, makeUser } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Player from './Player';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

function renderPlayer(preloadedState: any, name = 'alice') {
  return renderWithProviders(
    <Routes>
      <Route path="/player/:name" element={<Player />} />
    </Routes>,
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
  it('shows the not-found message when the player is unknown', () => {
    renderPlayer(connectedState, 'ghost');
    expect(screen.getByText('Player.action.notFound')).toBeInTheDocument();
  });

  it('renders the player name and details when the user is found', () => {
    const user = makeUser({ name: 'alice', realName: 'Alice A', country: 'us', userLevel: 0 });
    renderPlayer(stateWithPlayer(user), 'alice');
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Alice A')).toBeInTheDocument();
  });

  it('shows action buttons for another user and wires the buddy action', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    renderPlayer(stateWithPlayer(user), 'alice');

    const addBuddy = screen.getByRole('button', { name: /Player\.action\.addBuddy/ });
    fireEvent.click(addBuddy);
    expect(hoisted.mockWebClient.request.session.addToBuddyList).toHaveBeenCalledWith('alice');
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
    expect(screen.getByRole('button', { name: /Player\.action\.warn/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Player\.action\.ban/ })).toBeInTheDocument();
  });

  it('renders the remove-buddy label when the player is already a buddy', () => {
    const user = makeUser({ name: 'alice', userLevel: 0 });
    const state = stateWithPlayer(user, { buddyList: { alice: user } });
    renderPlayer(state, 'alice');
    expect(screen.getByRole('button', { name: /Player\.action\.removeBuddy/ })).toBeInTheDocument();
  });
});
