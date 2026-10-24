import { create, isFieldSet, toBinary } from '@bufbuild/protobuf';
import { Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { makeServerState, makeUser } from '../../testing/fixtures/server';
import { Actions } from './server.actions';
import { serverReducer } from './server.reducer';
import { Selectors } from './server.selectors';
import { MAX_USER_MESSAGES } from './server.reducer.users';

const openChat = (userName: string) => Actions.privateChatOpened({ userName });

describe('private message receipt times', () => {
  it('retains caller-supplied timestamps through both selectors without mutating the protocol message', () => {
    const messageData = Object.freeze(create(Event_UserMessageSchema, { senderName: 'Alice', message: 'Hello' }));
    const state = makeServerState({ user: makeUser({ name: 'Me' }) });
    const action = Actions.userMessage({ messageData, timeReceived: 0 });
    const now = vi.spyOn(Date, 'now');
    try {
      const result = serverReducer(state, action);
      const messages = Selectors.getPrivateMessagesForUser({ server: result }, 'Alice');
      expect(messages[0].timeReceived).toBe(0);
      expect(Selectors.getPrivateConversation({ server: result }, 'Alice')).toEqual([
        { type: 'message', message: messages[0] },
      ]);
      expect(serverReducer(state, action)).toEqual(result);
      expect(now).not.toHaveBeenCalled();
      expect(messageData).not.toHaveProperty('timeReceived');
      expect(toBinary(Event_UserMessageSchema, messages[0])).toEqual(toBinary(Event_UserMessageSchema, messageData));
      expect(isFieldSet(messages[0], Event_UserMessageSchema.field.receiverName)).toBe(false);
    } finally {
      now.mockRestore();
    }
  });

  it('retains receipt times for both senders when trimming the conversation', () => {
    const messages = Array.from({ length: MAX_USER_MESSAGES }, (_, timeReceived) => Object.assign(
      create(Event_UserMessageSchema, { senderName: 'Alice', receiverName: 'Me', message: String(timeReceived) }),
      { timeReceived },
    ));
    let state = makeServerState({ user: makeUser({ name: 'Me' }), messages: { Alice: messages } });
    state = serverReducer(state, Actions.userMessage({
      messageData: create(Event_UserMessageSchema, { senderName: 'Me', receiverName: 'Alice', message: 'Reply' }),
      timeReceived: 987654321,
    }));
    const retained = Selectors.getPrivateMessagesForUser({ server: state }, 'Alice');
    expect(retained).toHaveLength(MAX_USER_MESSAGES);
    expect(retained[0].timeReceived).toBe(1);
    expect(retained.at(-1)).toMatchObject({ senderName: 'Me', message: 'Reply', timeReceived: 987654321 });
  });
});

describe('private chat presence before the first message', () => {
  it.each([false, true])('stops presence after closing a chat with existing messages: %s', (hasMessages) => {
    const message = Object.assign(create(Event_UserMessageSchema, { senderName: 'Alice', message: 'Hello' }), { timeReceived: 0 });
    let state = serverReducer(makeServerState({ messages: hasMessages ? { Alice: [message] } : {} }), openChat('Alice'));
    state = serverReducer(state, openChat('Bob'));
    state = serverReducer(state, Actions.userLeft({ name: 'Alice' }));
    state = serverReducer(state, Actions.privateChatClosed({ userName: 'Alice' }));
    state = serverReducer(state, Actions.userJoined({ user: makeUser({ name: 'Alice' }) }));
    state = serverReducer(state, Actions.userLeft({ name: 'Alice' }));
    state = serverReducer(state, Actions.userLeft({ name: 'Bob' }));

    expect(state.messages.Alice).toBeUndefined();
    expect(state.privateChatNotices.Alice).toBeUndefined();
    expect(Selectors.getPrivateConversation({ server: state }, 'Alice')).toEqual([]);
    expect(Selectors.getPrivateConversation({ server: state }, 'Bob')).toEqual([
      { type: 'notice', notice: { id: expect.any(Number), kind: 'userLeft', position: 0 } },
    ]);

    state = serverReducer(state, openChat('Alice'));
    state = serverReducer(state, Actions.userJoined({ user: makeUser({ name: 'Alice' }) }));
    expect(Selectors.getPrivateConversation({ server: state }, 'Alice')).toEqual([
      { type: 'notice', notice: { id: expect.any(Number), kind: 'userJoined', position: 0 } },
    ]);
  });

  it('records departures and arrivals after opening an empty conversation', () => {
    let state = serverReducer(makeServerState(), openChat('Alice'));
    state = serverReducer(state, Actions.userLeft({ name: 'Alice' }));
    state = serverReducer(state, Actions.userJoined({ user: makeUser({ name: 'Alice' }) }));

    expect(Selectors.getPrivateConversation({ server: state }, 'Alice')).toEqual([
      { type: 'notice', notice: { id: expect.any(Number), kind: 'userLeft', position: 0 } },
      { type: 'notice', notice: { id: expect.any(Number), kind: 'userJoined', position: 0 } },
    ]);
    expect(Selectors.getPrivateMessagesForUser({ server: state }, 'Alice')).toEqual([]);
  });

  it('does not reset messages or notices when the same chat is opened again', () => {
    const message = Object.assign(create(Event_UserMessageSchema, { senderName: 'Alice', message: 'Hello' }), { timeReceived: 0 });
    let state = makeServerState({ messages: { Alice: [message] } });
    state = serverReducer(state, Actions.userLeft({ name: 'Alice' }));
    const previous = state;
    state = serverReducer(state, openChat('Alice'));

    expect(state).toBe(previous);
    expect(Selectors.getPrivateConversation({ server: state }, 'Alice')).toEqual([
      { type: 'message', message },
      { type: 'notice', notice: { id: expect.any(Number), kind: 'userLeft', position: 1 } },
    ]);
  });

  it('does not collect presence for unopened chats or carry chat registration across sessions', () => {
    let state = serverReducer(makeServerState(), openChat('Alice'));
    state = serverReducer(state, Actions.userJoined({ user: makeUser({ name: 'Bob' }) }));
    expect(Selectors.getPrivateConversation({ server: state }, 'Bob')).toEqual([]);
    state = serverReducer(state, Actions.clearStore());
    state = serverReducer(state, Actions.userLeft({ name: 'Alice' }));

    expect(Selectors.getPrivateConversation({ server: state }, 'Alice')).toEqual([]);
  });
});
