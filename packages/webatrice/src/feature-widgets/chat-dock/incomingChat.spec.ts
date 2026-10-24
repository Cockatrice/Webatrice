import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser } from '../../__test-utils__';
import type { RootState } from '@app/store';
import { chatFilterVerdicts, visiblePrivateMessages } from '@app/utils';

import { incomingChatPeer } from './incomingChat';

const filter = { ignoreAllPrivateMessages: false, ignoreUnregisteredUserMessages: true, ignoreNonBuddyUserMessages: true };
const message = (senderName: string) => ({
  ...create(Event_UserMessageSchema, { senderName, receiverName: 'testUser', message: 'hello' }), timeReceived: 0,
});
const stateWith = (list: ReturnType<typeof message>[]): RootState => ({
  ...connectedState,
  server: { ...connectedState.server!, users: { alice: makeUser({ name: 'alice', userLevel: 1 }) }, messages: { alice: list } },
} as RootState);
const action = server.Actions.userMessage({ messageData: message('alice'), timeReceived: 0 });

describe('incomingChatPeer', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([true, false])('reuses a cached %s verdict without traversing history', (visible) => {
    const list = [message('alice'), message('alice')];
    const state = stateWith(list);
    visiblePrivateMessages(list, { selfName: 'testUser', peer: state.server.users.alice, peerIsBuddy: true }, {
      ...filter, ignoreAllPrivateMessages: !visible, ignoreUnregisteredUserMessages: false,
    }, chatFilterVerdicts);
    const reads = vi.spyOn(chatFilterVerdicts, 'get');
    expect(incomingChatPeer(action, state, filter)).toBe(visible ? 'alice' : null);
    expect(reads).toHaveBeenCalledExactlyOnceWith(list[1]);
  });

  it.each([true, false])('calculates a missing verdict using conversation history (already open: %s)', (open) => {
    const list = [message(open ? 'testUser' : 'alice'), message('alice')];
    expect(incomingChatPeer(action, stateWith(list), filter)).toBe(open ? 'alice' : null);
    expect(chatFilterVerdicts.get(list[1])).toBe(open);
  });
});
