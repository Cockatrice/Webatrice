import { act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { renderWithProviders, connectedState, disconnectedState, makeUser } from '../../__test-utils__';
import AuthGuard from './AuthGuard';

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

function AuthShell() {
  return (
    <Routes>
      <Route path="/login" element={<div>login-page</div>} />
      <Route
        path="/server"
        element={
          <>
            <AuthGuard />
            <div>protected-page</div>
          </>
        }
      />
    </Routes>
  );
}

describe('AuthGuard', () => {
  it('redirects to LOGIN when disconnected', () => {
    renderWithProviders(<AuthGuard />, {
      preloadedState: disconnectedState,
      route: '/server',
    });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders nothing visible when connected', () => {
    const { container } = renderWithProviders(<AuthGuard />, {
      preloadedState: connectedState,
      route: '/server',
    });

    expect(container.textContent).toBe('');
  });

  it('sends the user to /login on first mount when disconnected', () => {
    renderWithProviders(<AuthShell />, {
      preloadedState: disconnectedState,
      route: '/server',
    });

    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('protected-page')).not.toBeInTheDocument();
  });

  it('keeps protected content mounted when already connected on mount', () => {
    renderWithProviders(<AuthShell />, {
      preloadedState: connectedState,
      route: '/server',
    });

    expect(screen.getByText('protected-page')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });

  it('redirects to /login when the connection drops after mount', () => {
    const { store } = renderWithProviders(<AuthShell />, {
      preloadedState: connectedState,
      route: '/server',
    });

    expect(screen.getByText('protected-page')).toBeInTheDocument();

    act(() => {
      store.dispatch({
        type: 'server/updateStatus',
        payload: { status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } },
      });
    });

    expect(screen.queryByText('protected-page')).not.toBeInTheDocument();
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('keeps protected content visible across a no-op user update', () => {
    const { store } = renderWithProviders(<AuthShell />, {
      preloadedState: connectedState,
      route: '/server',
    });

    expect(screen.getByText('protected-page')).toBeInTheDocument();

    act(() => {
      store.dispatch({
        type: 'server/updateUser',
        payload: { user: makeUser({ name: 'renamed' }) },
      });
    });

    expect(screen.getByText('protected-page')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });
});
