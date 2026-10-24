import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

export type ModerationAction =
  | 'warnUser'
  | 'warnHistory'
  | 'banUser'
  | 'banHistory'
  | 'adminNotes'
  | 'investigateUser'
  | 'promoteMod'
  | 'demoteMod'
  | 'promoteJudge'
  | 'demoteJudge'
  | 'promoteDeveloper'
  | 'demoteDeveloper';

export interface ModerationMenuEntry {
  action: ModerationAction;
  disabled: boolean;
}

export type ModerationMenuGroups = ModerationMenuEntry[][];

export interface ModerationMenuInput {
  localUserLevel: number;
  targetUserLevel: number;
  isSelf: boolean;
  supportsDeveloperRole: boolean;
  adminLocked?: boolean;
  canInvestigate?: boolean;
}

export const MODERATION_MENU_LABEL_KEYS: Record<ModerationAction, string> = {
  warnUser: 'Moderation.menu.warnUser',
  warnHistory: 'Moderation.menu.warnHistory',
  banUser: 'Moderation.menu.banUser',
  banHistory: 'Moderation.menu.banHistory',
  adminNotes: 'Moderation.menu.adminNotes',
  investigateUser: 'Moderation.menu.investigateUser',
  promoteMod: 'Moderation.menu.promoteMod',
  demoteMod: 'Moderation.menu.demoteMod',
  promoteJudge: 'Moderation.menu.promoteJudge',
  demoteJudge: 'Moderation.menu.demoteJudge',
  promoteDeveloper: 'Moderation.menu.promoteDeveloper',
  demoteDeveloper: 'Moderation.menu.demoteDeveloper',
};

const hasFlag = (level: number, flag: ServerInfo_User_UserLevelFlag): boolean => (level & flag) === flag;

export function buildModerationMenu({
  localUserLevel,
  targetUserLevel,
  isSelf,
  supportsDeveloperRole,
  adminLocked = false,
  canInvestigate = false,
}: ModerationMenuInput): ModerationMenuGroups {
  if (adminLocked || !hasFlag(localUserLevel, ServerInfo_User_UserLevelFlag.IsModerator)) {
    return [];
  }

  const entry = (action: ModerationAction): ModerationMenuEntry => ({ action, disabled: isSelf });
  const groups: ModerationMenuGroups = [
    [entry('warnUser'), entry('warnHistory')],
    [entry('banUser'), entry('banHistory')],
    canInvestigate ? [entry('adminNotes'), entry('investigateUser')] : [entry('adminNotes')],
  ];

  if (hasFlag(localUserLevel, ServerInfo_User_UserLevelFlag.IsAdmin)) {
    const isRegistered = hasFlag(targetUserLevel, ServerInfo_User_UserLevelFlag.IsRegistered);
    const roles: ModerationMenuEntry[] = [];
    if (hasFlag(targetUserLevel, ServerInfo_User_UserLevelFlag.IsModerator)) {
      roles.push(entry('demoteMod'));
    } else if (isRegistered) {
      roles.push(entry('promoteMod'));
    }
    if (hasFlag(targetUserLevel, ServerInfo_User_UserLevelFlag.IsJudge)) {
      roles.push(entry('demoteJudge'));
    } else if (isRegistered) {
      roles.push(entry('promoteJudge'));
    }
    if (supportsDeveloperRole) {
      if (hasFlag(targetUserLevel, ServerInfo_User_UserLevelFlag.IsDeveloper)) {
        roles.push(entry('demoteDeveloper'));
      } else if (isRegistered) {
        roles.push(entry('promoteDeveloper'));
      }
    }
    if (roles.length > 0) {
      groups.push(roles);
    }
  }

  return groups;
}
