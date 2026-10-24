import type { Store } from '@reduxjs/toolkit';
import {
  Response_CardArtRuleEntry,
  Response_ReplayDownloadByGameId,
  Response_ReportStats,
  Response_ReportUserInfo,
  Response_WarnList,
  ServerInfo_Ban,
  ServerInfo_ChatMessage,
  ServerInfo_ModeratorLogin,
  ServerInfo_UserAlt,
  ServerInfo_UserSession,
  ServerInfo_Report,
  ServerInfo_Warning,
} from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as ServerActions } from '../store/server/server.actions';
import { Selectors as ServerSelectors } from '../store/server/server.selectors';

export class ModeratorResponseImpl implements WebsocketTypes.IModeratorResponse {
  constructor(private store: Store) {}

  banFromServer(userName: string): void {
    this.store.dispatch(ServerActions.banFromServer({ userName }));
  }

  banHistory(userName: string, banHistory: ServerInfo_Ban[], requestId?: string): void {
    this.store.dispatch(ServerActions.banHistory({ userName, banHistory, requestId }));
  }

  viewLogs(logs: ServerInfo_ChatMessage[], requestId?: string): void {
    this.store.dispatch(ServerActions.viewLogs({ logs, requestId }));
  }

  warnHistory(userName: string, warnHistory: ServerInfo_Warning[], requestId?: string): void {
    this.store.dispatch(ServerActions.warnHistory({ userName, warnHistory, requestId }));
  }

  warnListOptions(warnList: Response_WarnList[], requestId?: string): void {
    this.store.dispatch(ServerActions.warnListOptions({ warnList, requestId }));
  }

  warnUser(userName: string): void {
    this.store.dispatch(ServerActions.warnUser({ userName }));
  }

  grantReplayAccess(replayId: number, moderatorName: string): void {
    this.store.dispatch(ServerActions.grantReplayAccess({ replayId, moderatorName }));
  }

  forceActivateUser(usernameToActivate: string, moderatorName: string): void {
    this.store.dispatch(ServerActions.forceActivateUser({ usernameToActivate, moderatorName }));
  }

  getAdminNotes(userName: string, notes: string, requestId?: string): void {
    this.store.dispatch(ServerActions.getAdminNotes({ userName, notes, requestId }));
  }

  updateAdminNotes(userName: string, notes: string): void {
    this.store.dispatch(ServerActions.updateAdminNotes({ userName, notes }));
  }

  commandFailed(
    command: WebsocketTypes.ModeratorCommandName,
    responseCode: number,
    target: string,
    failure?: WebsocketTypes.CommandFailure,
    requestId?: string,
  ): void {
    this.store.dispatch(ServerActions.moderatorCommandFailed({ command, responseCode, target, failure, requestId }));
  }

  reportUserInfo(info: Response_ReportUserInfo, requestId?: string): void {
    if (!ServerSelectors.getUserInvestigation(this.store.getState(), info.userName)) {
      return;
    }
    this.store.dispatch(ServerActions.userInfoReport({ info, requestId }));
  }

  userAlts(userName: string, alts: ServerInfo_UserAlt[]): void {
    if (!ServerSelectors.getUserInvestigation(this.store.getState(), userName)) {
      return;
    }
    this.store.dispatch(ServerActions.userAlts({ userName, alts }));
  }

  userSessions(userName: string, sessions: ServerInfo_UserSession[]): void {
    if (!ServerSelectors.getUserInvestigation(this.store.getState(), userName)) {
      return;
    }
    this.store.dispatch(ServerActions.userSessions({ userName, sessions }));
  }

  moderatorLastLogins(logins: ServerInfo_ModeratorLogin[]): void {
    this.store.dispatch(ServerActions.moderatorLastLogins({ logins }));
  }

  userAvatarRemoved(userName: string): void {
    this.store.dispatch(ServerActions.userAvatarRemoved({ userName }));
  }

  cardArtRules(entries: Response_CardArtRuleEntry[]): void {
    this.store.dispatch(ServerActions.cardArtRules({ entries }));
  }

  cardArtRuleAdded(cardName: string, cardProviderId: string, mode: string, reason: string): void {
    this.store.dispatch(ServerActions.cardArtRuleAdded({ cardName, cardProviderId, mode, reason }));
  }

  cardArtRuleRemoved(cardName: string, cardProviderId: string): void {
    this.store.dispatch(ServerActions.cardArtRuleRemoved({ cardName, cardProviderId }));
  }

  reportList(reports: ServerInfo_Report[], totalCount: number, requestId?: string): void {
    this.store.dispatch(ServerActions.reportList({ reports, totalCount, requestId }));
  }

  reportAssigned(reportId: number, requestId?: string): void {
    this.store.dispatch(ServerActions.reportAssigned({ reportId, requestId }));
  }

  reportResolved(reportId: number, dismissed: boolean, requestId?: string): void {
    this.store.dispatch(ServerActions.reportResolved({ reportId, dismissed, requestId }));
  }

  reportStats(stats: Response_ReportStats, requestId?: string): void {
    this.store.dispatch(ServerActions.reportStats({ stats, requestId }));
  }

  replayDownloadByGameIdPending(): void {
    this.store.dispatch(ServerActions.reportReplayRequested());
  }

  replayDownloadedByGameId(gameId: number, response: Response_ReplayDownloadByGameId, requestId?: string): void {
    this.store.dispatch(ServerActions.reportReplayDownloaded({
      gameId,
      replayId: response.replayId,
      replayData: response.replayData,
      requestId,
    }));
  }
}
