import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerInfo_User_UserLevelFlag as Flag } from '@cockatrice/sockatrice/generated';

import { makeUser, renderWithProviders } from '../../../../../__test-utils__';
import { UserDetailsModal } from './PlayerListDialogs';

const BOB = makeUser({
  name: 'Bob',
  realName: 'Robert',
  privlevel: 'VIP',
  userLevel: Flag.IsRegistered | Flag.IsJudge,
  accountageSecs: 86_400n * 3n,
});

describe('UserDetailsModal', () => {
  it('is a modal named by the user', () => {
    renderWithProviders(<UserDetailsModal user={BOB} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Bob' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Robert')).toBeInTheDocument();
  });

  it('formats the user level and privilege with the shared desktop-style formatter', () => {
    renderWithProviders(<UserDetailsModal user={BOB} onClose={vi.fn()} />);
    expect(within(screen.getByRole('dialog', { name: 'Bob' }))
      .getByText('Account.level.registered | Account.level.judge | VIP')).toBeInTheDocument();
  });

  it('formats the account age with the shared desktop-style formatter', () => {
    renderWithProviders(<UserDetailsModal user={{ ...BOB, accountageSecs: 86_400n * 400n }} onClose={vi.fn()} />);
    expect(within(screen.getByRole('dialog', { name: 'Bob' })).getByText('Account.age.yearsAndDays')).toBeInTheDocument();
  });

  it('takes focus on its Close button, keeps Tab inside and closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<UserDetailsModal user={BOB} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Bob' });
    expect(within(dialog).getByRole('button', { name: 'PlayerListDialogs.close' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
