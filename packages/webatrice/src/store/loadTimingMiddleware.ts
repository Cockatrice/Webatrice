import { isAction, type Middleware } from '@reduxjs/toolkit';
import { rooms, server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { markLoadTiming } from '../utils/loadTimings';

export const loadTimingMiddleware: Middleware = () => next => action => {
  if (server.Actions.updateStatus.match(action) && action.payload.status.state === WebsocketTypes.StatusEnum.CONNECTED) {
    markLoadTiming('websocket-open');
  } else if (isAction(action)) {
    if (action.type === server.Types.LOGIN_SUCCESSFUL || action.type === server.Types.LOGIN_FAILED) {
      markLoadTiming('login-response', action.type === server.Types.LOGIN_SUCCESSFUL ? 'success' : 'failed');
    } else if (action.type === rooms.Types.UPDATE_ROOMS) {
      markLoadTiming('home-data');
    }
  }
  return next(action);
};
