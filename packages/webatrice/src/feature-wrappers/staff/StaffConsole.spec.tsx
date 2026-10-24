import { fireEvent, screen, within } from '@testing-library/react';

import { setAdminLocked } from '@app/hooks';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import StaffConsole from './StaffConsole';

const { IsRegistered, IsModerator, IsDeveloper } = ServerInfo_User_UserLevelFlag;

function stateFor(userLevel: number, version = '3.1.0 (2026-01-01)') {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      info: { message: null, name: 'Servatrice', version },
      user: makeUser({ name: 'staff', userLevel }),
    },
  };
}

function setup(userLevel: number, version?: string, route = '/moderation') {
  return renderWithProviders(<StaffConsole><p>tool-body</p></StaffConsole>, {
    preloadedState: stateFor(userLevel, version),
    route,
    webClient: createMockWebClient(),
  });
}

beforeEach(() => {
  setAdminLocked(false);
});

describe('StaffConsole', () => {
  it('lists the tools a moderator may use and marks the current one', () => {
    setup(IsRegistered | IsModerator);
    const nav = screen.getByRole('navigation', { name: 'Staff.nav' });
    const links = within(nav).getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual([
      'Staff.tool.reports', 'Staff.tool.moderation', 'Staff.tool.logs', 'Staff.tool.administration', 'Staff.tool.cardArtRules',
    ]);
    expect(within(nav).getByRole('link', { name: 'Staff.tool.moderation' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('tool-body')).toBeInTheDocument();
  });

  it('shows a developer only Logs and Developer, without the lock', () => {
    setup(IsRegistered | IsDeveloper, undefined, '/developer');
    const nav = screen.getByRole('navigation', { name: 'Staff.nav' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Staff.tool.logs', 'Staff.tool.developer']);
    expect(screen.queryByRole('region', { name: 'Staff.lock.region' })).not.toBeInTheDocument();
  });

  it('keeps the tools a 3.0 server can serve and marks the 3.1-only ones instead of linking them', () => {
    setup(IsRegistered | IsModerator, '3.0.0 (2024-01-01)', '/logs');
    const nav = screen.getByRole('navigation', { name: 'Staff.nav' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Staff.tool.moderation', 'Staff.tool.logs', 'Staff.tool.administration',
    ]);
    const unavailable = nav.querySelectorAll('[aria-disabled="true"]');
    expect([...unavailable].map((item) => item.textContent)).toEqual([
      'Staff.tool.reportsStaff.needsServer', 'Staff.tool.cardArtRulesStaff.needsServer',
    ]);
  });

  it('locks and unlocks the shared administration lock', () => {
    setup(IsRegistered | IsModerator);
    const lock = screen.getByRole('region', { name: 'Staff.lock.region' });
    expect(within(lock).getByText('Staff.lock.unlocked')).toBeInTheDocument();

    fireEvent.click(within(lock).getByRole('button', { name: 'Staff.lock.lock' }));
    expect(within(lock).getByText('Staff.lock.locked')).toBeInTheDocument();
    expect(screen.getByLabelText('Staff.lock.lockedIcon')).toBeInTheDocument();

    fireEvent.click(within(lock).getByRole('button', { name: 'Staff.lock.unlock' }));
    expect(within(lock).getByText('Staff.lock.unlocked')).toBeInTheDocument();
  });
});
