import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ServerStateLogs } from '@cockatrice/datatrice';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';
import LogResults from './LogResults';
import catalog from './Logs.i18n.json';

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

  it('includes a count badge in the tab label when logs are present', async () => {
    const i18n = createInstance();
    await i18n.use(ICU).init({
      lng: 'en-US',
      resources: { 'en-US': { translation: catalog } },
      interpolation: { escapeValue: false },
    });
    const logs: ServerStateLogs = {
      room: [makeMessage(), makeMessage()],
      game: [],
      chat: [],
    };
    renderWithProviders(
      <I18nextProvider i18n={i18n}><LogResults logs={logs} /></I18nextProvider>,
      { preloadedState: disconnectedState },
    );
    expect(screen.getAllByRole('tab')[0]).toHaveAccessibleName('Room logs (2)');
    expect(screen.getAllByRole('tab')[1]).toHaveAccessibleName('Game logs');
    expect(screen.getAllByRole('tab')[2]).toHaveAccessibleName('Chat logs');
  });

  it('switches to the games tab when clicked', () => {
    const logs: ServerStateLogs = {
      room: [],
      game: [makeMessage({ message: 'game-log-entry' })],
      chat: [],
    };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });

    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByText('game-log-entry')).toBeInTheDocument();
  });

  it('shows the whole message in the drawer for the chosen row and closes it again', () => {
    const logs: ServerStateLogs = {
      room: [makeMessage({ senderName: 'mallory', message: 'a long message', targetId: 'room-7' })],
      game: [],
      chat: [],
    };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });

    expect(screen.queryByRole('complementary', { name: 'Logs.details' })).toBeNull();
    fireEvent.click(screen.getByText('a long message'));
    const drawer = within(screen.getByRole('complementary', { name: 'Logs.details' }));
    expect(drawer.getByText('room-7')).toBeInTheDocument();
    expect(drawer.getByText('a long message')).toBeInTheDocument();
    fireEvent.click(drawer.getByRole('button', { name: 'Staff.drawer.close' }));
    expect(screen.queryByRole('complementary', { name: 'Logs.details' })).toBeNull();
  });
});

describe('LogResults tabs', () => {
  it('is a real tablist: one tab stop, arrows move between tabs, and the panel is labelled by the tab', () => {
    const logs: ServerStateLogs = { room: [], game: [makeMessage({ message: 'game-row' })], chat: [] };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });
    const [rooms, games] = screen.getAllByRole('tab');
    expect(rooms).toHaveAttribute('tabindex', '0');
    expect(games).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', rooms.id);

    fireEvent.keyDown(rooms, { key: 'ArrowRight' });
    expect(games).toHaveAttribute('aria-selected', 'true');
    expect(games).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', games.id);
    expect(games).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
    expect(screen.getByText('game-row')).toBeInTheDocument();
  });
});

describe('LogResults drawer focus', () => {
  it('closes the drawer with Escape from the row or the drawer and returns focus to the row', () => {
    const logs: ServerStateLogs = { room: [makeMessage({ message: 'focus-row' })], game: [], chat: [] };
    renderWithProviders(<LogResults logs={logs} />, { preloadedState: disconnectedState });
    const row = screen.getByText('focus-row').closest('tr')!;

    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByRole('complementary', { name: 'Logs.details' })).toBeInTheDocument();
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Logs.details' })).toBeNull();

    fireEvent.keyDown(row, { key: 'Enter' });
    const close = within(screen.getByRole('complementary', { name: 'Logs.details' })).getByRole('button', { name: 'Staff.drawer.close' });
    act(() => close.focus());
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Logs.details' })).toBeNull();
    expect(row).toHaveFocus();
  });
});
