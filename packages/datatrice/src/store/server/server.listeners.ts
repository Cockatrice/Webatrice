import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { serverSlice } from './server.reducer';

export function registerServerListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: serverSlice.actions.updateStatus,
    effect: (action, api) => {
      if (action.payload.status.state === WebsocketTypes.StatusEnum.DISCONNECTED) {
        api.dispatch(serverSlice.actions.disconnected());
      }
    },
  });
}
