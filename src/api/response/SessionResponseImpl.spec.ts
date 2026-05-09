vi.mock('@app/store', () => ({
  GameDispatch: { gameJoined: vi.fn(), playerPropertiesChanged: vi.fn() },
  ServerDispatch: {
    initialized: vi.fn(),
    updateStatus: vi.fn(),
    updateUser: vi.fn(),
  },
}));

import { ServerDispatch } from '@app/store';
import { WebsocketTypes } from '@app/websocket/types';
import { SessionResponseImpl } from './SessionResponseImpl';

describe('SessionResponseImpl.updateStatus', () => {
  let impl: SessionResponseImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    impl = new SessionResponseImpl();
  });

  it('dispatches updateStatus when transitioning to DISCONNECTED', () => {
    impl.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'gone');
    expect(ServerDispatch.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.DISCONNECTED,
      'gone',
    );
  });

  it('dispatches updateStatus on non-DISCONNECTED transitions', () => {
    impl.updateStatus(WebsocketTypes.StatusEnum.CONNECTED, 'connected');
    expect(ServerDispatch.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.CONNECTED,
      'connected',
    );
  });

  it('dispatches updateStatus on LOGGED_IN transition', () => {
    impl.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');
    expect(ServerDispatch.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.LOGGED_IN,
      'in',
    );
  });
});
