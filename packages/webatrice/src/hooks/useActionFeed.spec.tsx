import { act } from '@testing-library/react';
import { StrictMode } from 'react';
import { create } from '@bufbuild/protobuf';
import { listenerMiddleware, rooms, server } from '@cockatrice/datatrice';
import { Event_RoomSay_RoomMessageType, Event_RoomSaySchema } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, makeUser, renderWithProviders } from '../__test-utils__';
import AppAlerts from '../features/shell/alerts/AppAlerts';
import PrivateMessageNotifier from '../features/player/PrivateMessageNotifier';
import { useChatDockController } from '../feature-widgets/chat-dock/useChatDockController';
import { useActionFeed, type ActionFeedHandler, type ActionFeedPredicate } from './useActionFeed';
import { useUnreadTracker } from './useUnreadTracker';

function ChatObservers() {
  useChatDockController();
  useUnreadTracker();
  return null;
}

function Probe({ handler, predicate }: { handler: ActionFeedHandler; predicate?: ActionFeedPredicate }) {
  useActionFeed(handler, predicate);
  return null;
}

describe('useActionFeed', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts only the two room listeners for room chat and none for room game-list updates', () => {
    const { store } = renderWithProviders(<><AppAlerts /><PrivateMessageNotifier /><ChatObservers /></>, {
      preloadedState: connectedWithRoomsState,
    });
    const controllers = vi.spyOn(globalThis, 'AbortController');
    act(() => store.dispatch(rooms.Actions.roomGamesBatchApplied({ roomId: 1, changes: [] })));
    expect(controllers).not.toHaveBeenCalled();
    act(() => store.dispatch(rooms.Actions.addMessage({ roomId: 1, message: {
      ...create(Event_RoomSaySchema, {
        name: 'otherUser', message: 'hello', messageType: Event_RoomSay_RoomMessageType.UserMessage,
      }), timeReceived: 0,
    } })));
    expect(controllers).toHaveBeenCalledTimes(2);
  });

  it('rejects irrelevant actions before starting listener tasks and uses the latest predicate and handler', () => {
    const listening = vi.spyOn(listenerMiddleware, 'startListening');
    const first = vi.fn();
    const second = vi.fn();
    const joins: ActionFeedPredicate = (action) => action.type === server.Types.USER_JOINED;
    const leaves: ActionFeedPredicate = (action) => action.type === server.Types.USER_LEFT;
    const { store, rerender } = renderWithProviders(<Probe handler={first} predicate={joins} />);
    const registrations = listening.mock.calls.length;
    const controllers = vi.spyOn(globalThis, 'AbortController');
    const join = server.Actions.userJoined({ user: makeUser({ name: 'arrival' }) });
    const leave = server.Actions.userLeft({ name: 'arrival' });

    act(() => store.dispatch({ type: 'unrelated' }));
    expect(controllers).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    act(() => {
      const before = store.getState();
      store.dispatch(join);
      expect(first).toHaveBeenCalledExactlyOnceWith(join, before, store.getState());
    });
    rerender(<Probe handler={second} predicate={leaves} />);
    expect(listening).toHaveBeenCalledTimes(registrations);
    controllers.mockClear();
    act(() => store.dispatch(join));
    expect(controllers).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    act(() => {
      const before = store.getState();
      store.dispatch(leave);
      expect(second).toHaveBeenCalledExactlyOnceWith(leave, before, store.getState());
    });
    expect(first).toHaveBeenCalledTimes(1);
    rerender(<Probe handler={second} />);
    act(() => store.dispatch({ type: 'unrelated' }));
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('captures before and after state synchronously, once in StrictMode', () => {
    const handler = vi.fn();
    const { store, unmount } = renderWithProviders(<StrictMode><Probe handler={handler} /></StrictMode>);
    const action = server.Actions.userJoined({ user: makeUser({ name: 'arrival' }) });
    act(() => {
      const before = store.getState();
      store.dispatch(action);
      expect(handler).toHaveBeenCalledExactlyOnceWith(action, before, store.getState());
    });
    unmount();
    store.dispatch(server.Actions.userLeft({ name: 'arrival' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not observe another provider using the shared middleware', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { store } = renderWithProviders(<Probe handler={first} />);
    renderWithProviders(<Probe handler={second} />);
    act(() => {
      store.dispatch(server.Actions.userJoined({ user: makeUser({ name: 'arrival' }) }));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
