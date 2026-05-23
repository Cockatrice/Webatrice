import { vi } from 'vitest';
import { screen, within } from '@testing-library/react';

import {
  renderWithProviders,
  createMockWebClient,
  connectedState,
  connectedWithRoomsState,
} from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Server from './Server';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

describe('Server', () => {
  it('renders the rooms table and the user count panel', () => {
    const { container } = renderWithProviders(<Server />, {
      preloadedState: connectedWithRoomsState,
    });

    // "Main Room" also appears as a LeftNav joined-room link, so scope the
    // table assertions to RoomsList's own `.rooms` container.
    const roomsTable = within(container.querySelector('.rooms') as HTMLElement);
    expect(roomsTable.getByText('Name')).toBeInTheDocument();
    expect(roomsTable.getByText('Main Room')).toBeInTheDocument();
    expect(screen.getByText(/Users connected to server:/)).toBeInTheDocument();
  });

  it('renders the sanitized server message html', () => {
    const { container } = renderWithProviders(<Server />, {
      preloadedState: connectedState,
    });
    expect(container.querySelector('.serverMessage__content')?.innerHTML).toContain('Welcome');
  });

  it('renders without rooms', () => {
    const { container } = renderWithProviders(<Server />, {
      preloadedState: connectedState,
    });
    expect(container.querySelector('.server-rooms')).toBeInTheDocument();
  });
});
