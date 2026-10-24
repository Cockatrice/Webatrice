import { useCallback, useEffect, useMemo } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { server, type PrivateConversationEntry } from '@cockatrice/datatrice';
import { formatChatContext } from '@app/dialogs';
import { usePrivateMessageFilter } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { chatFilterVerdicts, visiblePrivateMessages } from '@app/utils';
import { ServerInfo_User, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { avatarDataUri } from './avatarDataUri';

const NO_CONVERSATION: PrivateConversationEntry[] = [];

export interface PeerViewModel {
  name: string | null;
  userInfo: ServerInfo_User | undefined;
  currentUser: ServerInfo_User | null;
  isSelf: boolean;
  isABuddy: boolean;
  isIgnored: boolean;
  conversation: PrivateConversationEntry[];
  isOnline: boolean;
  avatarUrl: string | null;
  canEditLists: boolean;
  getChatContext: () => string;

  onAddBuddy: () => void;
  onRemoveBuddy: () => void;
  onAddIgnore: () => void;
  onRemoveIgnore: () => void;
  onSendMessage: (message: string) => void;
}

function isRegistered(level: number | undefined): boolean {
  return ((level ?? 0) & ServerInfo_User_UserLevelFlag.IsRegistered) !== 0;
}

export function usePeer(name: string | null): PeerViewModel {
  const webClient = useWebClient();

  const userInfo = useAppSelector((state) =>
    name ? server.Selectors.getUserInfoByName(state, name) : undefined,
  );
  const currentUser = useAppSelector(server.Selectors.getUser);
  const buddyList = useAppSelector(server.Selectors.getBuddyList);
  const ignoreList = useAppSelector(server.Selectors.getIgnoreList);
  const fullConversation = useAppSelector((state) =>
    name ? server.Selectors.getPrivateConversation(state, name) : NO_CONVERSATION,
  );
  const isOnline = useAppSelector((state) => Boolean(name && server.Selectors.getIsUserOnline(state, name)));
  const onlinePeer = useAppSelector((state) => (name ? server.Selectors.getUsers(state)[name] : undefined));
  const privateMessageFilter = usePrivateMessageFilter();

  useEffect(() => {
    if (name) {
      webClient.request.session.getUserInfo(name);
    }
  }, [name, webClient]);

  const { isSelf, isABuddy, isIgnored } = useMemo(() => ({
    isSelf: Boolean(currentUser && name && currentUser.name === name),
    isABuddy: Boolean(name && buddyList[name]),
    isIgnored: Boolean(name && ignoreList[name]),
  }), [currentUser, name, buddyList, ignoreList]);

  const conversation = useMemo(() => {
    const messages = fullConversation.flatMap((entry) => (entry.type === 'message' ? [entry.message] : []));
    const visible = new Set(visiblePrivateMessages(
      messages,
      { selfName: currentUser?.name ?? null, peer: onlinePeer, peerIsBuddy: isABuddy },
      privateMessageFilter,
      chatFilterVerdicts,
    ));
    return visible.size === messages.length
      ? fullConversation
      : fullConversation.filter((entry) => entry.type === 'notice' || visible.has(entry.message));
  }, [fullConversation, currentUser, onlinePeer, isABuddy, privateMessageFilter]);

  const avatarUrl = useMemo(() => avatarDataUri(userInfo?.avatarBmp), [userInfo?.avatarBmp]);

  const canEditLists = !isSelf && isRegistered(userInfo?.userLevel ?? onlinePeer?.userLevel) && isRegistered(currentUser?.userLevel);

  const getChatContext = useCallback(() => formatChatContext(conversation.flatMap((entry) =>
    entry.type === 'message' ? [{
      userName: entry.message.senderName,
      message: entry.message.message,
      timeReceived: entry.message.timeReceived,
    }] : [],
  )), [conversation]);

  const onAddBuddy = () => name && webClient.request.session.addToBuddyList(name);
  const onRemoveBuddy = () => name && webClient.request.session.removeFromBuddyList(name);
  const onAddIgnore = () => name && webClient.request.session.addToIgnoreList(name);
  const onRemoveIgnore = () => name && webClient.request.session.removeFromIgnoreList(name);
  const onSendMessage = (message: string) => name && webClient.request.session.message(name, message);

  return {
    name,
    userInfo,
    currentUser,
    isSelf,
    isABuddy,
    isIgnored,
    conversation,
    isOnline,
    avatarUrl,
    canEditLists,
    getChatContext,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
    onSendMessage,
  };
}
