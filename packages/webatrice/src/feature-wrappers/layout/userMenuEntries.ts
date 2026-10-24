import { Download, Flag, Keyboard, ScrollText, UserCircle2, type LucideIcon } from 'lucide-react';

import { ServerCapability } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';
import { isAdmin, isJudge, isModerator, type UserLevelPredicate } from '@app/hooks';
import { RouteEnum } from '@app/types';

import type { StaffToolId } from '../staff/staffTools';

export type { UserLevelPredicate } from '@app/hooks';
export { isModerator, isAdmin, isDeveloper, canReadLogs } from '@app/hooks';

export enum UserMenuDialog {
  CardImport = 'cardImport',
  DebugLog = 'debugLog',
}

export type UserMenuSection = 'account' | 'tools';

interface UserMenuEntryBase {
  label: string;
  section: UserMenuSection;
  icon: LucideIcon;
  visibleTo?: UserLevelPredicate;
  requires?: ServerCapability;
}

export type CapabilityCheck = (capability: ServerCapability) => boolean;

export interface UserMenuRouteEntry extends UserMenuEntryBase {
  route: RouteEnum;
  dialog?: never;
}

export interface UserMenuDialogEntry extends UserMenuEntryBase {
  dialog: UserMenuDialog;
  route?: never;
}

export type UserMenuEntry = UserMenuRouteEntry | UserMenuDialogEntry;

const { REPORTS } = ServerCapability;

export const USER_MENU_ENTRIES: readonly UserMenuEntry[] = [
  { label: 'UserMenu.account', section: 'account', icon: UserCircle2, route: RouteEnum.ACCOUNT },
  { label: 'UserMenu.shortcuts', section: 'account', icon: Keyboard, route: RouteEnum.SHORTCUTS },
  { label: 'UserMenu.myReports', section: 'account', icon: Flag, route: RouteEnum.MY_REPORTS, requires: REPORTS },
  { label: 'UserMenu.importCards', section: 'tools', icon: Download, dialog: UserMenuDialog.CardImport },
  { label: 'UserMenu.debugLog', section: 'tools', icon: ScrollText, dialog: UserMenuDialog.DebugLog },
];

export const visibleUserMenuEntries = (userLevel: number, supports: CapabilityCheck = () => true): UserMenuEntry[] =>
  USER_MENU_ENTRIES.filter((entry) =>
    (!entry.visibleTo || entry.visibleTo(userLevel)) && (!entry.requires || supports(entry.requires)));

export const STAFF_MENU_LABEL_KEYS: Record<StaffToolId, string> = {
  reports: 'UserMenu.reportQueue',
  moderation: 'UserMenu.moderation',
  logs: 'UserMenu.logs',
  administration: 'UserMenu.administration',
  cardArtRules: 'UserMenu.cardArtRules',
  developer: 'UserMenu.developer',
};

export type AccountRole = 'admin' | 'moderator' | 'judge' | 'registered' | 'unregistered';

export const ACCOUNT_ROLE_KEYS: Record<AccountRole, string> = {
  admin: 'UserMenu.role.admin',
  moderator: 'UserMenu.role.moderator',
  judge: 'UserMenu.role.judge',
  registered: 'UserMenu.role.registered',
  unregistered: 'UserMenu.role.unregistered',
};

export function accountRole(userLevel: number): AccountRole {
  if (isAdmin(userLevel)) {
    return 'admin';
  }
  if (isModerator(userLevel)) {
    return 'moderator';
  }
  if (isJudge(userLevel)) {
    return 'judge';
  }
  return (userLevel & Level.IsRegistered) !== 0 ? 'registered' : 'unregistered';
}
