import { act, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../__test-utils__';
import { setAdminLocked } from './useAdminLock';
import { useCanOverrideGameRestrictions } from './useCanOverrideGameRestrictions';

const Probe = () => <output aria-label="Override">{String(useCanOverrideGameRestrictions())}</output>;

afterEach(() => setAdminLocked(false));

it.each([
  [0, false, false],
  [Level.IsRegistered, false, false],
  [Level.IsAdmin, false, false],
  [Level.IsDeveloper, false, false],
  [Level.IsModerator, true, false],
  [Level.IsJudge, true, true],
  [Level.IsModerator | Level.IsJudge, true, true],
])('preserves restriction overrides for level %s across admin locking', (userLevel, unlocked, locked) => {
  const { store } = renderWithProviders(<Probe />, {
    preloadedState: { ...connectedState, server: { ...connectedState.server, user: makeUser({ userLevel }) } },
  });
  expect(screen.getByRole('status', { name: 'Override' })).toHaveTextContent(String(unlocked));
  act(() => setAdminLocked(true));
  expect(screen.getByRole('status', { name: 'Override' })).toHaveTextContent(String(locked));
  act(() => store.dispatch(server.Actions.updateUser({ user: { userLevel: Level.IsRegistered } })));
  expect(screen.getByRole('status', { name: 'Override' })).toHaveTextContent('false');
});
