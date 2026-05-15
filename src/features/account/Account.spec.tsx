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
});
