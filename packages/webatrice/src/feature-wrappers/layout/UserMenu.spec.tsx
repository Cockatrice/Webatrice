import { act, fireEvent, screen, within } from '@testing-library/react';
import type { i18n as I18n } from 'i18next';
import { useTranslation } from 'react-i18next';

import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';
import { connectedState, renderWithProviders } from '../../__test-utils__';
import { RouteEnum } from '@app/types';

import { staffToolStates, versionSupports } from '../staff/staffTools';

import UserMenu, { type UserMenuProps } from './UserMenu';
import { UserMenuDialog } from './userMenuEntries';

function renderMenu(overrides: Partial<UserMenuProps> = {}) {
  const props: UserMenuProps = {
    userName: 'testUser',
    userLevel: Level.IsUser | Level.IsRegistered,
    snapGridVisible: false,
    onToggleSnapGrid: vi.fn(),
    phaseTrackPinned: true,
    onTogglePhaseTrackPinned: vi.fn(),
    onNavigate: vi.fn(),
    onOpenDialog: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<UserMenu {...props} />, { preloadedState: connectedState });
  return props;
}

const trigger = () => screen.getByRole('button', { name: 'testUser' });

describe('UserMenu', () => {
  it('opens a menu labelled with the user from its button', () => {
    renderMenu();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'testUser' })).toBeInTheDocument();
  });

  it('opens with ArrowDown, as a menu button does', () => {
    renderMenu();

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('falls back to a generic label before the user is known', () => {
    renderMenu({ userName: null });

    expect(screen.getByRole('button', { name: 'TopBar.user.signedIn' })).toBeInTheDocument();
  });

  it('shows the board toggles, auto-hide as the inverse of the pinned phase track', () => {
    const props = renderMenu({ snapGridVisible: true, phaseTrackPinned: true });
    fireEvent.click(trigger());

    expect(screen.getByRole('menuitemcheckbox', { name: 'TopBar.game.snapGrid' })).toHaveAttribute('aria-checked', 'true');
    const autoHide = screen.getByRole('menuitemcheckbox', { name: 'TopBar.game.phaseTrackToggle' });
    expect(autoHide).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(autoHide);

    expect(props.onTogglePhaseTrackPinned).toHaveBeenCalledTimes(1);
  });

  it('navigates to a route entry and closes', () => {
    const props = renderMenu();
    fireEvent.click(trigger());

    fireEvent.click(screen.getByRole('menuitem', { name: 'UserMenu.account' }));

    expect(props.onNavigate).toHaveBeenCalledWith(RouteEnum.ACCOUNT);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a dialog entry in place', () => {
    const props = renderMenu();
    fireEvent.click(trigger());

    fireEvent.click(screen.getByRole('menuitem', { name: 'UserMenu.debugLog' }));

    expect(props.onOpenDialog).toHaveBeenCalledWith(UserMenuDialog.DebugLog);
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it('lists the staff tools it is given in their own group and opens one', () => {
    const userLevel = Level.IsUser | Level.IsRegistered | Level.IsModerator;
    const props = renderMenu({ userLevel, staffTools: staffToolStates(userLevel, () => true) });
    fireEvent.click(trigger());

    const staff = screen.getByRole('group', { name: 'UserMenu.staff' });
    expect(within(staff).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'UserMenu.reportQueue', 'UserMenu.moderation', 'UserMenu.logs', 'UserMenu.administration', 'UserMenu.cardArtRules',
    ]);
    fireEvent.click(within(staff).getByRole('menuitem', { name: 'UserMenu.moderation' }));
    expect(props.onNavigate).toHaveBeenCalledWith(RouteEnum.MODERATION);
  });

  it('keeps a tool the server cannot serve visible but disabled, with the reason', () => {
    const userLevel = Level.IsUser | Level.IsRegistered | Level.IsModerator;
    const props = renderMenu({ userLevel, staffTools: staffToolStates(userLevel, versionSupports('3.0.0 ()')) });
    fireEvent.click(trigger());

    const reports = screen.getByRole('menuitem', { name: 'UserMenu.reportQueue' });
    expect(reports).toHaveAttribute('aria-disabled', 'true');
    expect(reports).toHaveAccessibleDescription('Staff.needsServer');
    fireEvent.click(reports);
    expect(props.onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'UserMenu.moderation' })).not.toHaveAttribute('aria-disabled');
  });

  it('shows no staff group to a regular user', () => {
    renderMenu();
    fireEvent.click(trigger());

    expect(screen.queryByRole('group', { name: 'UserMenu.staff' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'UserMenu.administration' })).not.toBeInTheDocument();
  });

  it('groups the board toggles', () => {
    renderMenu();
    fireEvent.click(trigger());

    const board = screen.getByRole('group', { name: 'UserMenu.onTheBoard' });
    expect(within(board).getAllByRole('menuitemcheckbox')).toHaveLength(2);
  });

  describe('account identity', () => {
    let i18n: I18n;
    function I18nProbe() {
      i18n = useTranslation().i18n;
      return null;
    }

    afterEach(async () => {
      await act(() => i18n.changeLanguage('en-US'));
      i18n.removeResourceBundle('en-US', 'translation');
      i18n.addResourceBundle('en-US', 'translation', {});
    });

    async function withCatalogue() {
      renderWithProviders(<I18nProbe />);
      i18n.addResourceBundle('en-US', 'translation', {
        UserMenu: {
          roleOnServer: '{role} · {server}',
          role: { admin: 'Administrator', moderator: 'Moderator', registered: 'Registered user' },
        },
      });
      await act(() => i18n.changeLanguage('en-US'));
    }

    it.each([
      [Level.IsUser | Level.IsRegistered, 'Registered user · Rooster Ranges'],
      [Level.IsUser | Level.IsRegistered | Level.IsModerator, 'Moderator · Rooster Ranges'],
      [Level.IsUser | Level.IsRegistered | Level.IsModerator | Level.IsAdmin, 'Administrator · Rooster Ranges'],
    ])('describes the menu with the role and server (level %i)', async (userLevel, description) => {
      await withCatalogue();
      renderMenu({ userLevel, serverName: 'Rooster Ranges' });
      fireEvent.click(trigger());

      expect(screen.getByRole('menu', { name: 'testUser' })).toHaveAccessibleDescription(description);
    });

    it('describes the menu with the role alone before the server is named', async () => {
      await withCatalogue();
      renderMenu({ serverName: null });
      fireEvent.click(trigger());

      expect(screen.getByRole('menu')).toHaveAccessibleDescription('Registered user');
    });
  });

  it('signs out last', () => {
    const props = renderMenu();
    fireEvent.click(trigger());
    const items = screen.getAllByRole('menuitem');

    fireEvent.click(items[items.length - 1]);

    expect(items[items.length - 1]).toHaveTextContent('TopBar.user.signOut');
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });
});
