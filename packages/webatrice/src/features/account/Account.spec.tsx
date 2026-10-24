import { vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

import { renderWithProviders, createMockWebClient, connectedState, makeUser } from '../../__test-utils__';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const t = (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key);
  return { ...actual, useTranslation: (...args: Parameters<typeof actual.useTranslation>) => ({ ...actual.useTranslation(...args), t }) };
});

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Account from './Account';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

describe('Account', () => {
  it('formats the level with judge and privilege suffixes and handles an unknown account age', () => {
    renderWithProviders(<Account />, { preloadedState: {
      ...connectedState,
      server: { ...connectedState.server!, user: makeUser({
        userLevel: Level.IsRegistered | Level.IsDeveloper | Level.IsModerator | Level.IsJudge,
        privlevel: 'GOLD', accountageSecs: 0n,
      }) },
    } });
    expect(screen.getByText('Account.details.userLevel {"userLevel":"Account.level.developer | Account.level.judge | GOLD"}'))
      .toBeInTheDocument();
    expect(screen.getByText('Account.details.accountAge {"accountAge":"Account.age.unknown"}')).toBeInTheDocument();
  });

  it('renders server details and the current user', () => {
    const { container } = renderWithProviders(<Account />, { preloadedState: connectedState });

    expect(screen.getByText(/Account\.server\.name .*"serverName":"Test Server"/)).toBeInTheDocument();
    expect(screen.getByText(/Account\.server\.version .*"serverVersion":"1\.0\.0"/)).toBeInTheDocument();
    // "testUser" also appears in the TopBar account button now; scope the
    // profile-name assertion to the account-details panel's <strong>.
    const strong = container.querySelector('.account-details strong');
    expect(strong?.textContent).toBe('testUser');
    expect(screen.getByText(/^Account\.buddies\.online /)).toBeInTheDocument();
    expect(screen.getByText(/^Account\.ignored\.online /)).toBeInTheDocument();
  });

  it('disconnects via the web client when the Disconnect button is clicked', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    fireEvent.click(screen.getByRole('button', { name: /Common\.disconnect/ }));
    expect(hoisted.mockWebClient.request.authentication.disconnect).toHaveBeenCalled();
  });

  it('adds a buddy through the AddUserForm', async () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    const addButtons = screen.getAllByRole('button', { name: 'Account.addUser.submit' });
    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'buddyA' } });
    });
    await act(async () => {
      fireEvent.submit(addButtons[0].closest('form')!);
    });
    await flush();

    expect(hoisted.mockWebClient.request.session.addToBuddyList).toHaveBeenCalledWith('buddyA');
  });

  it('adds an ignored user through the second AddUserForm', async () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    const addButtons = screen.getAllByRole('button', { name: 'Account.addUser.submit' });
    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[1], { target: { value: 'ignoreB' } });
    });
    await act(async () => {
      fireEvent.submit(addButtons[1].closest('form')!);
    });
    await flush();

    expect(hoisted.mockWebClient.request.session.addToIgnoreList).toHaveBeenCalledWith('ignoreB');
  });

  it('renders an avatar image when the user has an avatar bitmap', () => {
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:avatar');
    (globalThis.URL as any).revokeObjectURL = vi.fn();

    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ avatarBmp: new Uint8Array([9, 9]) }),
      },
    };
    renderWithProviders(<Account />, { preloadedState: state });

    const img = screen.getByAltText('testUser') as HTMLImageElement;
    expect(img.src).toContain('blob:avatar');
  });

  it('uppercases the country code in the user details panel', () => {
    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ country: 'us', realName: 'Real Person', userLevel: 4 }),
      },
    };
    renderWithProviders(<Account />, { preloadedState: state });

    expect(screen.getByText(/Account\.details\.location .*"country":"US"/)).toBeInTheDocument();
    expect(screen.getByText(/Account\.details\.realName .*"realName":"Real Person"/)).toBeInTheDocument();
    expect(screen.getByText(/Account\.details\.userLevel .*"userLevel":"Account.level.moderator"/)).toBeInTheDocument();
  });

  it('gives every detail label a value before the user info arrives, so ICU still formats it', () => {
    const state = {
      ...connectedState,
      server: { ...(connectedState.server as any), user: null },
    };
    renderWithProviders(<Account />, { preloadedState: state });

    expect(screen.getByText('Account.details.location {"country":""}')).toBeInTheDocument();
    expect(screen.getByText('Account.details.realName {"realName":""}')).toBeInTheDocument();
    expect(screen.getByText('Account.details.userLevel {"userLevel":""}')).toBeInTheDocument();
    expect(screen.getByText('Account.details.accountAge {"accountAge":""}')).toBeInTheDocument();
  });

  it('renders the Edit, Change Password, and Change Avatar action buttons', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    expect(screen.getByRole('button', { name: 'Account.action.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account.action.changePassword' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account.action.changeAvatar' })).toBeInTheDocument();
  });

  it.each([
    ['Account.action.edit', 'EditUserDialog.title'],
    ['Account.action.changePassword', 'ChangePasswordDialog.title'],
    ['Account.action.changeAvatar', 'ChangeAvatarDialog.title'],
  ])('%s opens its dialog without changing the account until confirmed', (button, title) => {
    const { store } = renderWithProviders(<Account />, { preloadedState: connectedState });

    fireEvent.click(screen.getByRole('button', { name: button }));
    if (button === 'Account.action.edit') {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(hoisted.mockWebClient.request.session.getUserInfo).toHaveBeenCalledWith('');
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser() }));
      });
    }

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(hoisted.mockWebClient.request.session.accountEdit).not.toHaveBeenCalled();
    expect(hoisted.mockWebClient.request.session.accountPassword).not.toHaveBeenCalled();
    expect(hoisted.mockWebClient.request.session.accountImage).not.toHaveBeenCalled();
  });

  it('closes an account dialog on cancel', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    fireEvent.click(screen.getByRole('button', { name: 'Account.action.changePassword' }));
    fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears the buddy input after a successful submission', async () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    hoisted.mockWebClient.request.session.addToBuddyList.mockClear();
    const addButtons = screen.getAllByRole('button', { name: 'Account.addUser.submit' });
    const [buddyInput] = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(buddyInput, { target: { value: 'tempBuddy' } });
    });
    await act(async () => {
      fireEvent.submit(addButtons[0].closest('form')!);
    });
    await flush();

    expect(hoisted.mockWebClient.request.session.addToBuddyList).toHaveBeenCalledWith('tempBuddy');
    expect((buddyInput as HTMLInputElement).value).toBe('');
  });

  it('revokes the avatar object url when the component unmounts', () => {
    const revokeObjectURL = vi.fn();
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:avatar-2');
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;

    const state = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        user: makeUser({ avatarBmp: new Uint8Array([1, 2, 3, 4]) }),
      },
    };
    const { unmount } = renderWithProviders(<Account />, { preloadedState: state });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar-2');
  });

  it('renders the language dropdown in the server details panel', () => {
    const { container } = renderWithProviders(<Account />, { preloadedState: connectedState });

    expect(container.querySelector('.account-details__lang')).toBeInTheDocument();
  });
});

describe('Account My Reports (#7091)', () => {
  const on = (version: string) => ({
    ...connectedState,
    server: { ...(connectedState.server as any), info: { message: null, name: 'Test Server', version } },
  });

  it('links to My Reports on a 3.1 server', () => {
    renderWithProviders(<Account />, { preloadedState: on('3.1.0 ()') });
    expect(screen.getByRole('button', { name: 'Reports.mine.title' })).toBeInTheDocument();
  });

  it('has no My Reports button on a 3.0 server', () => {
    renderWithProviders(<Account />, { preloadedState: on('3.0.0 ()') });
    expect(screen.queryByRole('button', { name: 'Reports.mine.title' })).toBeNull();
  });
});
