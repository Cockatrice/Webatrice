import type { Store } from '@reduxjs/toolkit';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as ServerActions } from '../store/server/server.actions';

export class AdminResponseImpl implements WebsocketTypes.IAdminResponse {
  constructor(private store: Store) {}

  adjustMod(userName: string, shouldBeMod?: boolean, shouldBeJudge?: boolean, shouldBeDeveloper?: boolean, requestId?: string): void {
    this.store.dispatch(ServerActions.adjustMod({ userName, shouldBeMod, shouldBeJudge, shouldBeDeveloper, requestId }));
  }

  reloadConfig(): void {
    this.store.dispatch(ServerActions.reloadConfig());
  }

  shutdownServer(): void {
    this.store.dispatch(ServerActions.shutdownServer());
  }

  updateServerMessage(): void {
    this.store.dispatch(ServerActions.updateServerMessage());
  }

  commandFailed(
    command: WebsocketTypes.AdminCommandName,
    responseCode: number,
    target: string,
    failure?: WebsocketTypes.CommandFailure,
    requestId?: string,
  ): void {
    this.store.dispatch(ServerActions.adminCommandFailed({ command, responseCode, target, failure, requestId }));
  }
}
