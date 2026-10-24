import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ServerInfo_ModeratorLogin, ServerInfo_UserAlt, ServerInfo_UserSession } from '@cockatrice/sockatrice/generated';
import type { StaffColumn } from '@app/feature-wrappers/staff';

import { formatEpoch, formatStaffLevel } from './moderationFormat';

export interface ModerationColumns {
  alts: StaffColumn<ServerInfo_UserAlt>[];
  sessions: StaffColumn<ServerInfo_UserSession>[];
  staff: StaffColumn<ServerInfo_ModeratorLogin>[];
}

const mono = 'font-mono text-[12px]';

export function useModerationColumns(): ModerationColumns {
  const { t } = useTranslation();
  return useMemo(() => ({
    alts: [
      {
        id: 'user', header: t('ModerationPage.alts.user'), sortValue: (a) => a.userName.toLowerCase(),
        render: (a) => <span className="font-medium">{a.userName}</span>,
      },
      { id: 'email', header: t('ModerationPage.alts.email'), sortValue: (a) => a.email, render: (a) => a.email },
      {
        id: 'clientId', header: t('ModerationPage.alts.clientId'), width: 'w-[104px]',
        render: (a) => <span className={mono}>{a.clientid}</span>,
      },
      {
        id: 'registered', header: t('ModerationPage.alts.registered'), width: 'w-[104px]', sortValue: (a) => a.registrationTime,
        render: (a) => formatEpoch(a.registrationTime, t).slice(0, 10),
      },
      {
        id: 'lastLogin', header: t('ModerationPage.alts.lastLogin'), width: 'w-[140px]', sortValue: (a) => a.lastLogin,
        render: (a) => formatEpoch(a.lastLogin, t),
      },
      {
        id: 'warns', header: t('ModerationPage.alts.warns'), width: 'w-[68px]', align: 'right', sortValue: (a) => a.warnCount,
        render: (a) => a.warnCount,
      },
      {
        id: 'bans', header: t('ModerationPage.alts.bans'), width: 'w-[60px]', align: 'right', sortValue: (a) => a.banCount,
        render: (a) => a.banCount,
      },
      {
        id: 'active', header: t('ModerationPage.alts.active'), width: 'w-[68px]',
        render: (a) => (a.isActive ? t('ModerationPage.value.yes') : t('ModerationPage.value.no')),
      },
    ],
    sessions: [
      {
        id: 'ip', header: t('ModerationPage.sessions.ip'), sortValue: (s) => s.ipAddress,
        render: (s) => <span className={mono}>{s.ipAddress}</span>,
      },
      { id: 'clientId', header: t('ModerationPage.sessions.clientId'), render: (s) => <span className={mono}>{s.clientid}</span> },
      {
        id: 'start', header: t('ModerationPage.sessions.start'), width: 'w-[150px]', sortValue: (s) => s.startTime,
        render: (s) => formatEpoch(s.startTime, t),
      },
      {
        id: 'end', header: t('ModerationPage.sessions.end'), width: 'w-[150px]',
        render: (s) => (Number(s.endTime) === 0
          ? <span className="text-success">{t('ModerationPage.value.activeSession')}</span>
          : formatEpoch(s.endTime, t)),
      },
      { id: 'type', header: t('ModerationPage.sessions.type'), width: 'w-[110px]', render: (s) => s.connectionType },
    ],
    staff: [
      {
        id: 'user', header: t('ModerationPage.staff.user'), sortValue: (l) => l.userName.toLowerCase(),
        render: (l) => <span className="font-medium">{l.userName}</span>,
      },
      { id: 'level', header: t('ModerationPage.staff.level'), render: (l) => formatStaffLevel(l.userLevel, t) },
      {
        id: 'lastLogin', header: t('ModerationPage.staff.lastLogin'), width: 'w-[160px]', sortValue: (l) => l.lastLogin,
        render: (l) => formatEpoch(l.lastLogin, t),
      },
    ],
  }), [t]);
}
