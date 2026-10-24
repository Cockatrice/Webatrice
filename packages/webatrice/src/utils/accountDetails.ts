import type { TFunction } from 'i18next';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';

const ROLE_KEYS = {
  administrator: 'Account.level.administrator',
  developer: 'Account.level.developer',
  moderator: 'Account.level.moderator',
  registered: 'Account.level.registered',
  unregistered: 'Account.level.unregistered',
} as const;

export function formatUserLevel(t: TFunction, level = 0, privilege = ''): string {
  const roles = [
    [Level.IsAdmin, 'administrator'],
    [Level.IsDeveloper, 'developer'],
    [Level.IsModerator, 'moderator'],
    [Level.IsRegistered, 'registered'],
  ] as const;
  const role = roles.find(([flag]) => (level & flag) !== 0)?.[1] ?? 'unregistered';
  const parts = [t(ROLE_KEYS[role])];
  if (level & Level.IsJudge) {
    parts.push(t('Account.level.judge'));
  }
  if (privilege && privilege !== 'NONE') {
    parts.push(privilege);
  }
  return parts.join(' | ');
}

function dayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function formatAccountAge(t: TFunction, seconds: bigint | undefined, level = 0, locale = 'en', now = new Date()): string {
  if (!(level & (Level.IsAdmin | Level.IsModerator | Level.IsRegistered))) {
    return t('Account.level.unregistered');
  }
  if (seconds === undefined || seconds <= 0n) {
    return t('Account.age.unknown');
  }
  const created = new Date(now.getTime() - Number(seconds) * 1000);
  if (!Number.isFinite(created.getTime())) {
    return t('Account.age.unknown');
  }
  const dayOfYear = dayNumber(created) - dayNumber(new Date(created.getFullYear(), 0, 1)) + 1;
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 - dayOfYear);
  const years = shifted.getFullYear() - created.getFullYear();
  const year = created.getFullYear() + years;
  const day = Math.min(created.getDate(), new Date(year, created.getMonth() + 1, 0).getDate());
  const anniversary = new Date(year, created.getMonth(), day);
  const days = dayNumber(now) - dayNumber(anniversary);
  const date = new Intl.DateTimeFormat(locale.replaceAll('_', '-'), { dateStyle: 'short' }).format(created);
  return years > 0
    ? t('Account.age.yearsAndDays', { years, days, date })
    : t('Account.age.days', { count: days, date });
}
