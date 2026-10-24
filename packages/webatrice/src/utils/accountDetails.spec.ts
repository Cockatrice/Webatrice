import type { TFunction } from 'i18next';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

import { formatAccountAge, formatUserLevel } from './accountDetails';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as TFunction;

describe('account details', () => {
  it.each([
    [Level.IsAdmin | Level.IsDeveloper | Level.IsModerator, 'administrator'],
    [Level.IsDeveloper | Level.IsModerator, 'developer'],
    [Level.IsModerator | Level.IsRegistered, 'moderator'],
    [Level.IsRegistered, 'registered'],
    [0, 'unregistered'],
  ])('formats level %i using desktop precedence', (level, role) => {
    expect(formatUserLevel(t, level, 'NONE')).toBe(`Account.level.${role}`);
    expect(formatUserLevel(t, level | Level.IsJudge, 'GOLD')).toBe(`Account.level.${role} | Account.level.judge | GOLD`);
  });

  it.each([0, Level.IsJudge, Level.IsDeveloper])('shows unregistered age for level %i', (level) => {
    expect(formatAccountAge(t, 12345n, level)).toBe('Account.level.unregistered');
  });

  it.each([undefined, 0n, -1n, 2n ** 64n])('shows unknown age for %s seconds', (age) => {
    expect(formatAccountAge(t, age, Level.IsRegistered)).toBe('Account.age.unknown');
  });

  it.each([
    [new Date(2000, 0, 1, 12), new Date(2001, 0, 1, 12), 1, 0],
    [new Date(2000, 1, 28, 12), new Date(2001, 2, 1, 12), 1, 1],
    [new Date(2003, 1, 28, 12), new Date(2004, 2, 1, 12), 1, 2],
    [new Date(2000, 1, 29, 12), new Date(2001, 1, 28, 12), 0, 365],
    [new Date(2026, 9, 1, 23), new Date(2026, 9, 2, 1), 0, 1],
  ])('formats calendar age from %s to %s with its local creation date', (created, now, years, days) => {
    const seconds = BigInt((now.getTime() - created.getTime()) / 1000);
    const date = new Intl.DateTimeFormat('en-AU', { dateStyle: 'short' }).format(created);
    expect(formatAccountAge(t, seconds, Level.IsRegistered, 'en_AU', now)).toBe(years
      ? `Account.age.yearsAndDays ${JSON.stringify({ years, days, date })}`
      : `Account.age.days ${JSON.stringify({ count: days, date })}`);
  });
});
