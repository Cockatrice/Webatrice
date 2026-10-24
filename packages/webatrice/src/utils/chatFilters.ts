import {
  Event_RoomSay_RoomMessageType,
  ServerInfo_User_UserLevelFlag,
  type Event_UserMessage,
  type ServerInfo_User,
} from '@cockatrice/sockatrice/generated';

export type ChatFilterVerdicts = WeakMap<object, boolean>;

export const chatFilterVerdicts: ChatFilterVerdicts = new WeakMap();

function decideOnce(verdicts: ChatFilterVerdicts | undefined, message: object, decide: () => boolean): boolean {
  const known = verdicts?.get(message);
  if (known !== undefined) {
    return known;
  }
  const verdict = decide();
  verdicts?.set(message, verdict);
  return verdict;
}

const hasFlag = (user: ServerInfo_User | undefined, flag: ServerInfo_User_UserLevelFlag) =>
  user != null && (user.userLevel & flag) === flag;

export const isRegisteredUser = (user: ServerInfo_User | undefined) =>
  hasFlag(user, ServerInfo_User_UserLevelFlag.IsRegistered);

export const isPrivilegedUser = (user: ServerInfo_User | undefined) =>
  hasFlag(user, ServerInfo_User_UserLevelFlag.IsModerator) || hasFlag(user, ServerInfo_User_UserLevelFlag.IsAdmin);

export interface RoomChatFilter {
  roomHistory: boolean;
  ignoreUnregisteredUsers: boolean;
}

export interface RoomChatLine {
  name?: string;
  messageType?: Event_RoomSay_RoomMessageType;
}

export function isRoomMessageVisible(
  message: RoomChatLine,
  roomUsers: Readonly<Record<string, ServerInfo_User>>,
  filter: RoomChatFilter,
  verdicts?: ChatFilterVerdicts,
): boolean {
  return decideOnce(verdicts, message, () => decideRoomMessage(message, roomUsers, filter));
}

function decideRoomMessage(
  message: RoomChatLine,
  roomUsers: Readonly<Record<string, ServerInfo_User>>,
  filter: RoomChatFilter,
): boolean {
  if (message.messageType === Event_RoomSay_RoomMessageType.ChatHistory) {
    return filter.roomHistory;
  }
  if (!message.name) {
    return true;
  }
  const sender = roomUsers[message.name];
  return !(filter.ignoreUnregisteredUsers && sender && !isRegisteredUser(sender));
}

export interface PrivateMessageFilter {
  ignoreAllPrivateMessages: boolean;
  ignoreUnregisteredUserMessages: boolean;
  ignoreNonBuddyUserMessages: boolean;
}

export interface PrivateConversation {
  selfName: string | null;
  peer: ServerInfo_User | undefined;
  peerIsBuddy: boolean;
}

export function visiblePrivateMessages<T extends Pick<Event_UserMessage, 'senderName'>>(
  messages: readonly T[],
  conversation: PrivateConversation,
  filter: PrivateMessageFilter,
  verdicts?: ChatFilterVerdicts,
): T[] {
  let open = false;
  return messages.filter((message) => {
    const visible = decideOnce(verdicts, message, () => decidePrivateMessage(message, open, conversation, filter));
    open ||= visible;
    return visible;
  });
}

function decidePrivateMessage(
  message: Pick<Event_UserMessage, 'senderName'>,
  open: boolean,
  { selfName, peer, peerIsBuddy }: PrivateConversation,
  filter: PrivateMessageFilter,
): boolean {
  if (message.senderName === selfName) {
    return true;
  }
  const privileged = isPrivilegedUser(peer);
  if (filter.ignoreAllPrivateMessages && !privileged) {
    return false;
  }
  if (!open && peer) {
    if (filter.ignoreUnregisteredUserMessages && !isRegisteredUser(peer)) {
      return false;
    }
    if (filter.ignoreNonBuddyUserMessages && !peerIsBuddy && !privileged) {
      return false;
    }
  }
  return true;
}
