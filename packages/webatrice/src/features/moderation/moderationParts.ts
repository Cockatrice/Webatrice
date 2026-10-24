import { useMemo } from 'react';

import { server } from '@cockatrice/datatrice';
import { commandsSupported, versionSupports, type CapabilityCheck, type StaffCommand } from '@app/feature-wrappers/staff';
import { useAppSelector } from '@app/store';

export type ModerationPart =
  | 'lookup'
  | 'sanctions'
  | 'history'
  | 'investigation'
  | 'staffLogins'
  | 'removeAvatar'
  | 'resetPassword';

export const MODERATION_PART_COMMANDS: Readonly<Record<ModerationPart, readonly StaffCommand[]>> = {
  lookup: ['getUserInfo'],
  sanctions: ['getWarnList', 'warnUser', 'banFromServer'],
  history: ['getWarnHistory', 'getBanHistory', 'getAdminNotes', 'updateAdminNotes'],
  investigation: ['reportUserInfo', 'getUserAlts', 'getUserSessions'],
  staffLogins: ['getModeratorLastLogins'],
  removeAvatar: ['removeUserAvatar'],
  resetPassword: ['resetUserPassword'],
};

export type ModerationParts = Readonly<Record<ModerationPart, boolean>>;

export function moderationParts(supports: CapabilityCheck): ModerationParts {
  const entries = Object.entries(MODERATION_PART_COMMANDS) as [ModerationPart, readonly StaffCommand[]][];
  return Object.fromEntries(entries.map(([part, commands]) => [part, commandsSupported(commands, supports)])) as ModerationParts;
}

export function useModerationParts(): ModerationParts {
  const version = useAppSelector(server.Selectors.getVersion);
  return useMemo(() => moderationParts(versionSupports(version)), [version]);
}
