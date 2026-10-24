import { Code2, ImageOff, ScrollText, ServerCog, ShieldAlert, UserSearch, type LucideIcon } from 'lucide-react';

import { server, ServerCapability } from '@cockatrice/datatrice';
import { canReadLogs, isDeveloper, isModerator, type UserLevelPredicate } from '@app/hooks';
import { RouteEnum } from '@app/types';

export type StaffCommand =
  | 'getUserInfo'
  | 'warnUser'
  | 'getWarnList'
  | 'getWarnHistory'
  | 'banFromServer'
  | 'getBanHistory'
  | 'getAdminNotes'
  | 'updateAdminNotes'
  | 'viewLogHistory'
  | 'grantReplayAccess'
  | 'forceActivateUser'
  | 'updateServerMessage'
  | 'shutdownServer'
  | 'reloadConfig'
  | 'reportUserInfo'
  | 'getUserAlts'
  | 'getUserSessions'
  | 'getModeratorLastLogins'
  | 'removeUserAvatar'
  | 'resetUserPassword'
  | 'reportList'
  | 'reportStats'
  | 'reportAssign'
  | 'reportResolve'
  | 'replayDownloadByGameId'
  | 'listCardArtRules'
  | 'addCardArtRule'
  | 'removeCardArtRule'
  | 'developerViewLogHistory'
  | 'getServerStats';

const { CARD_ART, DEVELOPER_ROLE, MODERATION_TOOLS } = ServerCapability;

export const SERVER_BASELINE = 'baseline';

export type StaffRequirement = ServerCapability | typeof SERVER_BASELINE;

export const STAFF_COMMAND_REQUIRES: Readonly<Record<StaffCommand, StaffRequirement>> = {
  getUserInfo: SERVER_BASELINE,
  warnUser: SERVER_BASELINE,
  getWarnList: SERVER_BASELINE,
  getWarnHistory: SERVER_BASELINE,
  banFromServer: SERVER_BASELINE,
  getBanHistory: SERVER_BASELINE,
  getAdminNotes: SERVER_BASELINE,
  updateAdminNotes: SERVER_BASELINE,
  viewLogHistory: SERVER_BASELINE,
  grantReplayAccess: SERVER_BASELINE,
  forceActivateUser: SERVER_BASELINE,
  updateServerMessage: SERVER_BASELINE,
  shutdownServer: SERVER_BASELINE,
  reloadConfig: SERVER_BASELINE,
  reportUserInfo: MODERATION_TOOLS,
  getUserAlts: MODERATION_TOOLS,
  getUserSessions: MODERATION_TOOLS,
  getModeratorLastLogins: MODERATION_TOOLS,
  removeUserAvatar: MODERATION_TOOLS,
  resetUserPassword: MODERATION_TOOLS,
  reportList: MODERATION_TOOLS,
  reportStats: MODERATION_TOOLS,
  reportAssign: MODERATION_TOOLS,
  reportResolve: MODERATION_TOOLS,
  replayDownloadByGameId: MODERATION_TOOLS,
  listCardArtRules: CARD_ART,
  addCardArtRule: CARD_ART,
  removeCardArtRule: CARD_ART,
  developerViewLogHistory: DEVELOPER_ROLE,
  getServerStats: DEVELOPER_ROLE,
};

export type CapabilityCheck = (requirement: StaffRequirement) => boolean;

export const versionSupports = (version: string | null | undefined): CapabilityCheck => (requirement) =>
  (requirement === SERVER_BASELINE
    ? server.parseServerVersion(version) !== null
    : server.serverSupports(version, requirement));

export const commandsSupported = (commands: readonly StaffCommand[], supports: CapabilityCheck): boolean =>
  commands.every((command) => supports(STAFF_COMMAND_REQUIRES[command]));

export type StaffToolId = 'reports' | 'moderation' | 'logs' | 'administration' | 'cardArtRules' | 'developer';

export interface StaffTool {
  id: StaffToolId;
  icon: LucideIcon;
  route: RouteEnum;
  visibleTo: UserLevelPredicate;
  commands: (userLevel: number) => readonly StaffCommand[];
  lockable?: boolean;
}

const uses = (...commands: StaffCommand[]) => () => commands;

export const STAFF_TOOLS: readonly StaffTool[] = [
  {
    id: 'reports', icon: ShieldAlert, route: RouteEnum.REPORT_QUEUE, visibleTo: isModerator,
    commands: uses('reportList', 'reportStats', 'reportUserInfo', 'reportAssign', 'reportResolve'),
  },
  {
    id: 'moderation', icon: UserSearch, route: RouteEnum.MODERATION, visibleTo: isModerator,
    commands: uses('getUserInfo', 'warnUser', 'banFromServer'),
  },
  {
    id: 'logs', icon: ScrollText, route: RouteEnum.LOGS, visibleTo: canReadLogs,
    commands: (userLevel) => [isModerator(userLevel) ? 'viewLogHistory' : 'developerViewLogHistory'],
  },
  {
    id: 'administration', icon: ServerCog, route: RouteEnum.ADMINISTRATION, visibleTo: isModerator, lockable: true,
    commands: uses('updateServerMessage', 'shutdownServer', 'reloadConfig', 'grantReplayAccess', 'forceActivateUser'),
  },
  {
    id: 'cardArtRules', icon: ImageOff, route: RouteEnum.CARD_ART_RULES, visibleTo: isModerator,
    commands: uses('listCardArtRules', 'addCardArtRule', 'removeCardArtRule'),
  },
  {
    id: 'developer', icon: Code2, route: RouteEnum.DEVELOPER, visibleTo: isDeveloper,
    commands: uses('getServerStats', 'developerViewLogHistory'),
  },
];

export interface StaffToolState {
  tool: StaffTool;
  available: boolean;
}

export const staffToolStates = (userLevel: number, supports: CapabilityCheck): StaffToolState[] =>
  STAFF_TOOLS
    .filter((tool) => tool.visibleTo(userLevel))
    .map((tool) => ({ tool, available: commandsSupported(tool.commands(userLevel), supports) }));

export const isStaff = (userLevel: number): boolean => STAFF_TOOLS.some((tool) => tool.visibleTo(userLevel));

export const staffHomeRoute = (states: readonly StaffToolState[]): RouteEnum | null =>
  states.find((state) => state.available)?.tool.route ?? null;

export const STAFF_ROUTES: readonly RouteEnum[] = STAFF_TOOLS.map((tool) => tool.route);
