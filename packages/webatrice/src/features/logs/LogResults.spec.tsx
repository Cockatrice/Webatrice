import { fireEvent, screen } from '@testing-library/react';
import type { ServerStateLogs } from '@cockatrice/datatrice';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';
import LogResults from './LogResults';

const makeMessage = (overrides = {}) =>
  ({
    time: '2024-01-01',
    senderName: 'sender',
    senderIp: '1.2.3.4',
    message: 'a message',
    targetId: 't1',
    targetName: 'target',
    ...overrides,
  }) as any;

describe('LogResults', () => {
  it('renders the three log tabs', () => {
    const logs: ServerStateLogs = { room: [], game: [], chat: [] };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });

    expect(screen.getByRole('tab', { name: /Logs\.tab\.rooms/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Logs\.tab\.games/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Logs\.tab\.chats/ })).toBeInTheDocument();
  });

  it('shows the room log rows on the default tab', () => {
    const logs: ServerStateLogs = {
      room: [makeMessage({ message: 'room-log-entry' })],
      game: [],
      chat: [],
    };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });
    expect(screen.getByText('room-log-entry')).toBeInTheDocument();
  });

  it('includes a count badge in the tab label when logs are present', () => {
    const logs: ServerStateLogs = {
      room: [makeMessage(), makeMessage()],
      game: [],
      chat: [],
    };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });
    expect(screen.getByRole('tab', { name: /\[2\]/ })).toBeInTheDocument();
  });

  it('switches to the games tab when clicked', () => {
    const logs: ServerStateLogs = {
      room: [],
      game: [makeMessage({ message: 'game-log-entry' })],
      chat: [],
    };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });

    fireEvent.click(screen.getByRole('tab', { name: /Logs\.tab\.games/ }));
    expect(screen.getByText('game-log-entry')).toBeInTheDocument();
  });
});
