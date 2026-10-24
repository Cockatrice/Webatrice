import { configureStore } from '@reduxjs/toolkit';
import { rooms, server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { markLoadTiming } from '../utils/loadTimings';
import { loadTimingMiddleware } from './loadTimingMiddleware';

vi.mock('../utils/loadTimings', () => ({ markLoadTiming: vi.fn() }));

it('records transport open, login outcome and even an empty first Home list, without changing dispatch', () => {
  const reducer = vi.fn((state = 0) => state + 1);
  const store = configureStore({ reducer, middleware: getDefault => getDefault().concat(loadTimingMiddleware) });
  const connected = server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.CONNECTED, description: 'Connected' } });
  expect(store.dispatch(connected)).toBe(connected);
  expect(markLoadTiming).toHaveBeenLastCalledWith('websocket-open');
  store.dispatch(server.Actions.loginFailed(undefined));
  expect(markLoadTiming).toHaveBeenLastCalledWith('login-response', 'failed');
  store.dispatch({ type: server.Types.LOGIN_SUCCESSFUL });
  expect(markLoadTiming).toHaveBeenLastCalledWith('login-response', 'success');
  store.dispatch(rooms.Actions.updateRooms({ rooms: [] }));
  expect(markLoadTiming).toHaveBeenLastCalledWith('home-data');
  store.dispatch({ type: 'unrelated' });
  expect(markLoadTiming).toHaveBeenCalledTimes(4);
  expect(reducer).toHaveBeenCalledTimes(6);
});
