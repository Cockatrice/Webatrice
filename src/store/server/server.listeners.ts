import { createListenerMiddleware } from '@reduxjs/toolkit';
import { WebsocketTypes } from '@app/websocket/types';

import { serverSlice } from './server.reducer';

export const serverListenerMiddleware = createListenerMiddleware();

serverListenerMiddleware.startListening({
  actionCreator: serverSlice.actions.updateStatus,
  effect: (action, api) => {
    if (action.payload.status.state === WebsocketTypes.StatusEnum.DISCONNECTED) {
      api.dispatch(serverSlice.actions.disconnected());
    }
  },
});
