import { renderWithProviders, connectedState, makeUser } from '../../__test-utils__';
import { ServerInfo_User_UserLevelFlag } from 'sockatrice/generated';
import ModGuard from './ModGuard';

vi.mock('datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

describe('ModGuard', () => {
  it('redirects when user is not a moderator', () => {
    const { container } = renderWithProviders(<ModGuard />, {
      preloadedState: connectedState,
      route: '/logs',
    });

    expect(container.textContent).toBe('');
  });

  it('renders nothing visible when user is a moderator', () => {
    const modUser = makeUser({
      userLevel: ServerInfo_User_UserLevelFlag.IsModerator,
    });

    const { container } = renderWithProviders(<ModGuard />, {
      preloadedState: {
        ...connectedState,
        server: {
          ...(connectedState.server as any),
          user: modUser,
        },
      },
      route: '/logs',
    });

    expect(container.textContent).toBe('');
  });
});
