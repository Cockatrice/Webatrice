import { act, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../__test-utils__';
import { canReadLogs, useUserCapabilities } from './useUserCapabilities';

const Probe = () => <output aria-label="capabilities">{JSON.stringify(useUserCapabilities())}</output>;

describe('shared user capabilities', () => {
  it.each([
    [0, false, false, false, false],
    [Level.IsRegistered, false, false, false, false],
    [Level.IsAdmin, false, false, false, false],
    [Level.IsModerator, true, true, false, false],
    [Level.IsDeveloper, true, false, true, false],
    [Level.IsModerator | Level.IsDeveloper, true, true, false, false],
    [Level.IsJudge, false, false, false, true],
    [Level.IsModerator | Level.IsJudge, true, true, false, true],
  ])('keeps navigation, route access and command family consistent for level %s', (level, logs, moderator, developerOnly, isJudge) => {
    renderWithProviders(<Probe />, {
      preloadedState: { ...connectedState, server: { ...connectedState.server, user: makeUser({ userLevel: level }) } },
    });
    const capabilities = JSON.parse(screen.getByRole('status', { name: 'capabilities' }).textContent!);
    expect(capabilities).toMatchObject({ canReadLogs: logs, isModerator: moderator, developerOnlyLogs: developerOnly, isJudge });
    expect(canReadLogs(level)).toBe(logs);
  });

  it('removes staff capabilities when the current user changes', () => {
    const { store } = renderWithProviders(<Probe />, {
      preloadedState: { ...connectedState, server: { ...connectedState.server, user: makeUser({ userLevel: Level.IsModerator }) } },
    });
    act(() => {
      store.dispatch(server.Actions.updateUser({ user: { userLevel: Level.IsRegistered } }));
    });
    expect(JSON.parse(screen.getByRole('status', { name: 'capabilities' }).textContent!))
      .toMatchObject({ canReadLogs: false, isModerator: false });
  });
});
