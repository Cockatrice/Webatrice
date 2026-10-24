import { create } from '@bufbuild/protobuf';
import {
  Event_RoomSay_RoomMessageType,
  ServerInfo_User_UserLevelFlag as Level,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

import { isPrivilegedUser, isRoomMessageVisible, visiblePrivateMessages, type ChatFilterVerdicts } from './chatFilters';

const user = (name: string, userLevel: number) => create(ServerInfo_UserSchema, { name, userLevel });
const guest = user('guest', Level.IsUser);
const member = user('member', Level.IsUser | Level.IsRegistered);
const mod = user('mod', Level.IsUser | Level.IsRegistered | Level.IsModerator);

describe('isRoomMessageVisible', () => {
  const users = { guest, member };
  const show = { roomHistory: true, ignoreUnregisteredUsers: false };

  it('hides join history when room history is off', () => {
    const history = { messageType: Event_RoomSay_RoomMessageType.ChatHistory };
    expect(isRoomMessageVisible(history, users, show)).toBe(true);
    expect(isRoomMessageVisible(history, users, { ...show, roomHistory: false })).toBe(false);
  });

  it('hides unregistered senders only when asked, and only those it can look up', () => {
    const filter = { ...show, ignoreUnregisteredUsers: true };
    expect(isRoomMessageVisible({ name: 'guest' }, users, show)).toBe(true);
    expect(isRoomMessageVisible({ name: 'guest' }, users, filter)).toBe(false);
    expect(isRoomMessageVisible({ name: 'member' }, users, filter)).toBe(true);
    expect(isRoomMessageVisible({ name: 'stranger' }, users, filter)).toBe(true);
  });

  it('never hides server messages or client notices', () => {
    const filter = { roomHistory: false, ignoreUnregisteredUsers: true };
    expect(isRoomMessageVisible({ messageType: Event_RoomSay_RoomMessageType.Welcome }, users, filter)).toBe(true);
    expect(isRoomMessageVisible({ name: '' }, users, filter)).toBe(true);
  });
});

describe('visiblePrivateMessages', () => {
  const none = { ignoreAllPrivateMessages: false, ignoreUnregisteredUserMessages: false, ignoreNonBuddyUserMessages: false };
  const from = (senderName: string) => ({ senderName });
  const chat = [from('peer'), from('me'), from('peer')];

  it('shows everything by default', () => {
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: guest, peerIsBuddy: false }, none)).toEqual(chat);
  });

  it('keeps a non-buddy from opening a conversation, until the reader writes first', () => {
    const filter = { ...none, ignoreNonBuddyUserMessages: true };
    const ctx = { selfName: 'me', peer: member, peerIsBuddy: false };
    expect(visiblePrivateMessages(chat, ctx, filter)).toEqual([chat[1], chat[2]]);
    expect(visiblePrivateMessages(chat, { ...ctx, peerIsBuddy: true }, filter)).toEqual(chat);
    expect(visiblePrivateMessages(chat, { ...ctx, peer: mod }, filter)).toEqual(chat);
  });

  it('keeps unregistered users out unless the conversation is already open', () => {
    const filter = { ...none, ignoreUnregisteredUserMessages: true };
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: guest, peerIsBuddy: true }, filter)).toEqual([chat[1], chat[2]]);
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: member, peerIsBuddy: false }, filter)).toEqual(chat);
  });

  it('applies the open-conversation filters only to senders it can look up, as desktop does', () => {
    const filter = { ...none, ignoreNonBuddyUserMessages: true };
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: undefined, peerIsBuddy: false }, filter)).toEqual(chat);
  });

  it('"ignore all" silences even an open conversation, but not moderators', () => {
    const filter = { ...none, ignoreAllPrivateMessages: true };
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: member, peerIsBuddy: true }, filter)).toEqual([chat[1]]);
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: mod, peerIsBuddy: false }, filter)).toEqual(chat);
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: undefined, peerIsBuddy: false }, filter)).toEqual([chat[1]]);
  });
});

describe('verdicts taken on arrival', () => {
  let verdicts: ChatFilterVerdicts;
  beforeEach(() => {
    verdicts = new WeakMap();
  });

  const roomFilter = { roomHistory: true, ignoreUnregisteredUsers: true };
  const pmNone = { ignoreAllPrivateMessages: false, ignoreUnregisteredUserMessages: false, ignoreNonBuddyUserMessages: false };

  it('keeps an unregistered sender\'s line hidden after they leave the room', () => {
    const line = { name: 'guest' };
    expect(isRoomMessageVisible(line, { guest }, roomFilter, verdicts)).toBe(false);
    expect(isRoomMessageVisible(line, {}, roomFilter, verdicts)).toBe(false);
  });

  it('keeps a shown line when the filter is turned on later', () => {
    const line = { name: 'guest' };
    expect(isRoomMessageVisible(line, { guest }, { ...roomFilter, ignoreUnregisteredUsers: false }, verdicts)).toBe(true);
    expect(isRoomMessageVisible(line, { guest }, roomFilter, verdicts)).toBe(true);
    expect(isRoomMessageVisible({ name: 'guest' }, { guest }, roomFilter, verdicts)).toBe(false);
  });

  it('keeps a non-buddy\'s messages hidden after the peer goes offline', () => {
    const filter = { ...pmNone, ignoreNonBuddyUserMessages: true };
    const chat = [{ senderName: 'peer' }, { senderName: 'peer' }];
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: member, peerIsBuddy: false }, filter, verdicts)).toEqual([]);
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: undefined, peerIsBuddy: false }, filter, verdicts)).toEqual([]);
  });

  it('keeps a moderator\'s messages shown under "ignore all" after they log off', () => {
    const filter = { ...pmNone, ignoreAllPrivateMessages: true };
    const chat = [{ senderName: 'mod' }];
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: mod, peerIsBuddy: false }, filter, verdicts)).toEqual(chat);
    expect(visiblePrivateMessages(chat, { selfName: 'me', peer: undefined, peerIsBuddy: false }, filter, verdicts)).toEqual(chat);
  });

  it('decides a new message against the conversation as it stood when it arrived', () => {
    const filter = { ...pmNone, ignoreNonBuddyUserMessages: true };
    const first = { senderName: 'peer' };
    const ctx = { selfName: 'me', peer: member, peerIsBuddy: true };
    expect(visiblePrivateMessages([first], ctx, filter, verdicts)).toEqual([first]);
    const next = { senderName: 'peer' };
    expect(visiblePrivateMessages([first, next], { ...ctx, peerIsBuddy: false }, filter, verdicts)).toEqual([first, next]);
  });
});

describe('isPrivilegedUser', () => {
  it('is true for moderators and administrators only', () => {
    expect(isPrivilegedUser(mod)).toBe(true);
    expect(isPrivilegedUser(user('admin', Level.IsUser | Level.IsRegistered | Level.IsAdmin))).toBe(true);
    expect(isPrivilegedUser(member)).toBe(false);
    expect(isPrivilegedUser(undefined)).toBe(false);
  });
});
