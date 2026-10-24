import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { rooms, server } from '@cockatrice/datatrice';
import { Event_RoomSay_RoomMessageType, Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, renderWithProviders } from '../__test-utils__';
import { notificationStore } from '@app/services';
import { chatFilterVerdicts, visiblePrivateMessages } from '@app/utils';

import { settingsStore } from './useSettings';
import { useUnreadTracker } from './useUnreadTracker';
import { PREFERENCE_DEFAULTS } from '@app/types';
import { useActionFeed, type ActionFeedHandler } from './useActionFeed';

function SeedVerdict({ handler }: { handler: ActionFeedHandler }) {
  useActionFeed(handler);
  return null;
}

function Probe() {
  useUnreadTracker();
  return null;
}

const say = (message: string) => rooms.Actions.addMessage({
  roomId: 1,
  message: { name: 'otherUser', message, messageType: Event_RoomSay_RoomMessageType.UserMessage, timeReceived: 0 } as never,
});

describe('useUnreadTracker', () => {
  afterEach(() => {
    notificationStore.reset();
    vi.restoreAllMocks();
  });

  it.each([true, false])('reuses a cached %s private-message verdict without rechecking history', (visible) => {
    const reads = vi.spyOn(chatFilterVerdicts, 'get');
    const seed: ActionFeedHandler = (_action, _before, after) => {
      visiblePrivateMessages(after.server.messages.otherUser, {
        selfName: 'testUser', peer: after.server.users.otherUser, peerIsBuddy: false,
      }, { ...PREFERENCE_DEFAULTS, ignoreAllPrivateMessages: !visible }, chatFilterVerdicts);
      reads.mockClear();
    };
    const { store } = renderWithProviders(<><SeedVerdict handler={seed} /><Probe /></>, {
      preloadedState: connectedWithRoomsState, route: '/',
    });
    act(() => {
      store.dispatch(server.Actions.userMessage({ timeReceived: 0, messageData: create(Event_UserMessageSchema, {
        senderName: 'otherUser', receiverName: 'testUser', message: 'old',
      }) }));
      store.dispatch(server.Actions.userMessage({ timeReceived: 1, messageData: create(Event_UserMessageSchema, {
        senderName: 'otherUser', receiverName: 'testUser', message: 'new',
      }) }));
    });
    expect(reads).toHaveBeenCalledExactlyOnceWith(store.getState().server.messages.otherUser.at(-1));
    expect(notificationStore.getState().chats).toEqual(visible ? { otherUser: 2 } : {});
  });

  it.each([true, false])('calculates a missing private-message verdict (filtered: %s)', (filtered) => {
    vi.spyOn(settingsStore, 'peek').mockReturnValue({ ...PREFERENCE_DEFAULTS, ignoreAllPrivateMessages: filtered } as never);
    const { store } = renderWithProviders(<Probe />, { preloadedState: connectedWithRoomsState, route: '/' });
    act(() => store.dispatch(server.Actions.userMessage({ timeReceived: 0, messageData: create(Event_UserMessageSchema, {
      senderName: 'otherUser', receiverName: 'testUser', message: 'new',
    }) })));
    expect(notificationStore.getState().chats).toEqual(filtered ? {} : { otherUser: 1 });
    expect(chatFilterVerdicts.get(store.getState().server.messages.otherUser.at(-1)!)).toBe(!filtered);
  });

  it('counts a room line that mentions you as a mention as well as unread', () => {
    const { store } = renderWithProviders(<Probe />, { preloadedState: connectedWithRoomsState, route: '/' });

    act(() => {
      store.dispatch(say('hello all'));
      store.dispatch(say('hey @testUser, ready?'));
    });

    expect(notificationStore.getState().rooms).toEqual({ 1: 2 });
    expect(notificationStore.getState().mentions.rooms).toEqual({ 1: 1 });
  });

  it('counts no mentions while mentions are switched off in chat settings', () => {
    vi.spyOn(settingsStore, 'peek').mockReturnValue({ ...PREFERENCE_DEFAULTS, chatMention: false } as never);
    const { store } = renderWithProviders(<Probe />, { preloadedState: connectedWithRoomsState, route: '/' });

    act(() => {
      store.dispatch(say('hey @testUser'));
    });

    expect(notificationStore.getState().rooms).toEqual({ 1: 1 });
    expect(notificationStore.getState().mentions.rooms).toEqual({});
  });
});
