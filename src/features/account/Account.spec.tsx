import { vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

import { renderWithProviders, createMockWebClient, connectedState, makeUser } from '../../__test-utils__';

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
  it('renders server details and the current user', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    expect(screen.getByText('Server Name: Test Server')).toBeInTheDocument();
    expect(screen.getByText('Server Version: 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('testUser')).toBeInTheDocument();
    expect(screen.getByText(/Buddies Online:/)).toBeInTheDocument();
    expect(screen.getByText(/Ignored Users Online:/)).toBeInTheDocument();
  });

  it('disconnects via the web client when the Disconnect button is clicked', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    fireEvent.click(screen.getByRole('button', { name: /Common\.disconnect/ }));
    expect(hoisted.mockWebClient.request.authentication.disconnect).toHaveBeenCalled();
  });

  it('adds a buddy through the AddUserForm', async () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    const addButtons = screen.getAllByRole('button', { name: 'Add' });
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

    const addButtons = screen.getAllByRole('button', { name: 'Add' });
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

    expect(screen.getByText(/Location:\s*\(US\)/)).toBeInTheDocument();
    expect(screen.getByText(/Real Name:\s*Real Person/)).toBeInTheDocument();
    expect(screen.getByText(/User Level:\s*4/)).toBeInTheDocument();
  });

  it('renders the Edit, Change Password, and Change Avatar action buttons', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    expect(screen.getByRole('button', { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change.*Password/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change.*Avatar/ })).toBeInTheDocument();
  });

  it('clicking Edit does not invoke accountEdit on the web client (not yet wired)', () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/ }));
    expect(hoisted.mockWebClient.request.session.accountEdit).not.toHaveBeenCalled();
    expect(hoisted.mockWebClient.request.session.accountPassword).not.toHaveBeenCalled();
  });

  it('clears the buddy input after a successful submission', async () => {
    renderWithProviders(<Account />, { preloadedState: connectedState });

    hoisted.mockWebClient.request.session.addToBuddyList.mockClear();
    const addButtons = screen.getAllByRole('button', { name: 'Add' });
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
