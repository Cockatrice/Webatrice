import type { Store } from '@reduxjs/toolkit';
import { Data } from '../types';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as ServerActions } from '../store/server/server.actions';

export class ModeratorResponseImpl implements WebsocketTypes.IModeratorResponse {
  constructor(private store: Store) {}

  banFromServer(userName: string): void {
    this.store.dispatch(ServerActions.banFromServer({ userName }));
  }

  banHistory(userName: string, banHistory: Data.ServerInfo_Ban[]): void {
    this.store.dispatch(ServerActions.banHistory({ userName, banHistory }));
  }

  viewLogs(logs: Data.ServerInfo_ChatMessage[]): void {
    this.store.dispatch(ServerActions.viewLogs({ logs }));
  }

  warnHistory(userName: string, warnHistory: Data.ServerInfo_Warning[]): void {
    this.store.dispatch(ServerActions.warnHistory({ userName, warnHistory }));
  }

  warnListOptions(warnList: Data.Response_WarnList[]): void {
    this.store.dispatch(ServerActions.warnListOptions({ warnList }));
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

  getAdminNotes(userName: string, notes: string): void {
    this.store.dispatch(ServerActions.getAdminNotes({ userName, notes }));
  }

  updateAdminNotes(userName: string, notes: string): void {
    this.store.dispatch(ServerActions.updateAdminNotes({ userName, notes }));
  }
}
