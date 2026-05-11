import { WebsocketTypes } from '@app/websocket/types';

import { listenerMiddleware } from '../listenerMiddleware';
import { serverSlice } from './server.reducer';

listenerMiddleware.startListening({
  actionCreator: serverSlice.actions.updateStatus,
  effect: (action, api) => {
    if (action.payload.status.state === WebsocketTypes.StatusEnum.DISCONNECTED) {
      api.dispatch(serverSlice.actions.disconnected());
    }
  },
});
