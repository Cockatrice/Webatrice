import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, createMockWebClient, connectedState } from '../../__test-utils__';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const hoisted = vi.hoisted(() => ({ mockWebClient: undefined as any }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => hoisted.mockWebClient };
});

import Logs from './Logs';

beforeAll(() => {
  hoisted.mockWebClient = createMockWebClient();
});

beforeEach(() => {
  (hoisted.mockWebClient.request.moderator.viewLogHistory as any).mockClear?.();
});

const makeMessage = (overrides: Record<string, unknown> = {}) =>
  ({
    time: '2024-01-01',
    senderName: 'sender',
    senderIp: '1.2.3.4',
    message: 'a message',
    targetId: 't1',
    targetName: 'target',
    ...overrides,
  }) as any;

describe('Logs', () => {
  it('renders the search form and the results tabs', () => {
    const { container } = renderWithProviders(<Logs />, { preloadedState: connectedState });

    expect(container.querySelector('.moderator-logs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LogSearchForm\.button\.search/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Logs\.tab\.rooms/ })).toBeInTheDocument();
  });

  it('dispatches viewLogHistory through the web client when the form is submitted with a userName', async () => {
    renderWithProviders(<Logs />, { preloadedState: connectedState });

    const [userNameInput] = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(userNameInput, { target: { value: 'targetUser' } });
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }).closest('form')!,
      );
    });
    await flush();

    await waitFor(() => {
      expect(hoisted.mockWebClient.request.moderator.viewLogHistory).toHaveBeenCalledTimes(1);
    });
    const params = (hoisted.mockWebClient.request.moderator.viewLogHistory as any).mock.calls[0][0];
    expect(params.userName).toBe('targetUser');
    expect(params.maximumResults).toBe(1000);
  });

  it('does not dispatch viewLogHistory when the form is submitted with no required fields', async () => {
    renderWithProviders(<Logs />, { preloadedState: connectedState });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }).closest('form')!,
      );
    });
    await flush();

    expect(hoisted.mockWebClient.request.moderator.viewLogHistory).not.toHaveBeenCalled();
  });

  it('renders existing room log rows from the state slice', () => {
    const stateWithLogs = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        logs: {
          room: [makeMessage({ message: 'pre-loaded-room-entry' })],
          game: [],
          chat: [],
        },
      },
    };
    renderWithProviders(<Logs />, { preloadedState: stateWithLogs });

    expect(screen.getByText('pre-loaded-room-entry')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /\[1\]/ })).toBeInTheDocument();
  });

  it('switches to the games tab and reveals game-tab results', () => {
    const stateWithLogs = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        logs: {
          room: [],
          game: [makeMessage({ message: 'in-game-log' })],
          chat: [],
        },
      },
    };
    renderWithProviders(<Logs />, { preloadedState: stateWithLogs });

    fireEvent.click(screen.getByRole('tab', { name: /Logs\.tab\.games/ }));
    expect(screen.getByText('in-game-log')).toBeInTheDocument();
  });

  it('clears the logs slice when the page unmounts', () => {
    const stateWithLogs = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        logs: {
          room: [makeMessage({ message: 'leftover' })],
          game: [],
          chat: [],
        },
      },
    };
    const { store, unmount } = renderWithProviders(<Logs />, { preloadedState: stateWithLogs });
    expect(store.getState().server.logs.room).toHaveLength(1);

    unmount();
    expect(store.getState().server.logs.room).toHaveLength(0);
  });
});
