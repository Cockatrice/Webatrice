import { act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, connectedState, makeUser } from '../../__test-utils__';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import ModGuard from './ModGuard';

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

function modState() {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsModerator }),
    },
  };
}

function ModShell() {
  return (
    <Routes>
      <Route path="/server" element={<div>server-page</div>} />
      <Route
        path="/logs"
        element={
          <>
            <ModGuard />
            <div>mod-page</div>
          </>
        }
      />
    </Routes>
  );
}

describe('ModGuard', () => {
  it('redirects when user is not a moderator', () => {
    const { container } = renderWithProviders(<ModGuard />, {
      preloadedState: connectedState,
      route: '/logs',
    });

    expect(container.textContent).toBe('');
  });

  it('renders nothing visible when user is a moderator', () => {
    const { container } = renderWithProviders(<ModGuard />, {
      preloadedState: modState(),
      route: '/logs',
    });

    expect(container.textContent).toBe('');
  });

  it('sends a non-moderator to /server on first mount', () => {
    renderWithProviders(<ModShell />, {
      preloadedState: connectedState,
      route: '/logs',
    });

    expect(screen.getByText('server-page')).toBeInTheDocument();
    expect(screen.queryByText('mod-page')).not.toBeInTheDocument();
  });

  it('keeps the protected mod page mounted when the user is already a moderator', () => {
    renderWithProviders(<ModShell />, {
      preloadedState: modState(),
      route: '/logs',
    });

    expect(screen.getByText('mod-page')).toBeInTheDocument();
    expect(screen.queryByText('server-page')).not.toBeInTheDocument();
  });

  it('unmounts the protected mod page when the user loses moderator role', () => {
    const { store } = renderWithProviders(<ModShell />, {
      preloadedState: modState(),
      route: '/logs',
    });

    expect(screen.getByText('mod-page')).toBeInTheDocument();

    act(() => {
      store.dispatch({
        type: 'server/updateUser',
        payload: { user: makeUser({ userLevel: 0 }) },
      });
    });

    expect(screen.queryByText('mod-page')).not.toBeInTheDocument();
    expect(screen.getByText('server-page')).toBeInTheDocument();
  });

  it('preserves the protected mod page across an unrelated user update', () => {
    const { store } = renderWithProviders(<ModShell />, {
      preloadedState: modState(),
      route: '/logs',
    });

    expect(screen.getByText('mod-page')).toBeInTheDocument();

    act(() => {
      store.dispatch({
        type: 'server/updateUser',
        payload: {
          user: makeUser({
            name: 'new-name',
            userLevel: ServerInfo_User_UserLevelFlag.IsModerator,
          }),
        },
      });
    });

    expect(screen.getByText('mod-page')).toBeInTheDocument();
    expect(screen.queryByText('server-page')).not.toBeInTheDocument();
  });
});
