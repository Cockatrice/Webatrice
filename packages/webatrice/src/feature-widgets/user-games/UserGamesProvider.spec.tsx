import { fireEvent, screen } from '@testing-library/react';

import { UserDisplay, UserMenuSlotProvider, type UserMenuSlotProps } from '@app/components';
import { renderWithProviders, connectedState, createMockWebClient, makeUser } from '../../__test-utils__';
import type { RootState } from '../../store';
import { UserGamesProvider } from './UserGamesProvider';

const mockWebClient = createMockWebClient();

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => mockWebClient) };
});

vi.mock('@app/images', () => ({
  Images: { Countries: { us: 'us.png' } },
}));

const bob = makeUser({ name: 'bob', country: 'us' });

const withBobOnline = (online: boolean): Partial<RootState> => ({
  ...connectedState,
  server: { ...(connectedState.server as RootState['server']), users: online ? { bob } : {} },
});

const OuterSlot = ({ userName }: UserMenuSlotProps) => <button type="button" role="menuitem">{`outer ${userName}`}</button>;

function renderMenu({ online = true, showRow = true } = {}) {
  const tree = (row: boolean) => (
    <UserMenuSlotProvider value={OuterSlot}>
      <UserGamesProvider>
        {row && <UserDisplay user={bob} />}
      </UserGamesProvider>
    </UserMenuSlotProvider>
  );
  const utils = renderWithProviders(tree(showRow), { preloadedState: withBobOnline(online) });
  fireEvent.contextMenu(screen.getByText('bob'));
  return { ...utils, rerenderWithoutRow: () => utils.rerender(tree(false)) };
}

describe('UserGamesProvider', () => {
  it('adds Show games to the user menu ahead of the entries already in the slot', () => {
    renderMenu();
    const entries = screen.getAllByRole('menuitem').map((item) => item.textContent);
    const showGames = entries.findIndex((text) => text?.includes('UserGamesDialog.menu.showGames'));
    expect(showGames).toBeGreaterThan(-1);
    expect(entries.indexOf('outer bob')).toBeGreaterThan(showGames);
  });

  it('opens the games of the user and closes the menu', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /UserGamesDialog\.menu\.showGames/ }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'UserGamesDialog.title' })).toBeInTheDocument();
    expect(mockWebClient.request.session.getGamesOfUser).toHaveBeenCalledWith('bob');
  });

  it('keeps the selector open when the list row that opened it goes away', () => {
    const { rerenderWithoutRow } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /UserGamesDialog\.menu\.showGames/ }));
    rerenderWithoutRow();
    expect(screen.getByRole('dialog', { name: 'UserGamesDialog.title' })).toBeInTheDocument();
  });

  it('disables Show games for an offline user, as desktop does', () => {
    renderMenu({ online: false });
    const entry = screen.getByRole('menuitem', { name: /UserGamesDialog\.menu\.showGames/ });
    expect(entry).toHaveAttribute('aria-disabled', 'true');
    expect(entry).toHaveAccessibleDescription('UserGamesDialog.menu.offline');

    fireEvent.click(entry);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
