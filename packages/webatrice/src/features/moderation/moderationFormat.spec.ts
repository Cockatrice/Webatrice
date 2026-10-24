import type { TFunction } from 'i18next';

import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { formatEpoch, formatStaffLevel } from './moderationFormat';

const t = ((key: string) => key) as unknown as TFunction;
const { IsAdmin, IsDeveloper, IsModerator, IsJudge, IsRegistered } = ServerInfo_User_UserLevelFlag;

describe('formatEpoch', () => {
  it('shows 0 as unknown, as the server stores "never"', () => {
    expect(formatEpoch(0n, t)).toBe('ModerationPage.value.unknown');
  });

  it('formats epoch seconds as local yyyy-MM-dd HH:mm', () => {
    const local = new Date(2026, 0, 2, 3, 4, 59);
    expect(formatEpoch(BigInt(Math.floor(local.getTime() / 1000)), t)).toBe('2026-01-02 03:04');
  });
});

describe('formatStaffLevel', () => {
  it('lists staff roles in desktop order, ignoring non-staff bits', () => {
    expect(formatStaffLevel(IsRegistered | IsJudge | IsModerator | IsDeveloper | IsAdmin, t))
      .toBe('ModerationPage.level.admin / ModerationPage.level.developer / ModerationPage.level.moderator / ModerationPage.level.judge');
    expect(formatStaffLevel(IsRegistered, t)).toBe('');
  });
});
