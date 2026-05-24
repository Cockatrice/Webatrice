import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { useWebClient } from '@cockatrice/datatrice/react';
import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_User } from '@cockatrice/sockatrice/generated';
export interface PlayerViewModel {
  name: string | null;
  userInfo: ServerInfo_User | undefined;
  currentUser: ServerInfo_User | null;
  isSelf: boolean;
  isABuddy: boolean;
  isIgnored: boolean;
  isModerator: boolean;

  onAddBuddy: () => void;
  onRemoveBuddy: () => void;
  onAddIgnore: () => void;
  onRemoveIgnore: () => void;
  onSendMessage: (message: string) => void;
  onWarnUser: (reason: string) => void;
  onBanFromServer: (minutes: number, reason: string, visibleReason?: string) => void;
}

export function usePlayer(): PlayerViewModel {
  const webClient = useWebClient();
  const params = useParams<{ name?: string }>();
  const name = params.name ?? null;

  const userInfo = useAppSelector((state) =>
    name ? server.Selectors.getUserInfoByName(state, name) : undefined,
  );
  const currentUser = useAppSelector(server.Selectors.getUser);
  const buddyList = useAppSelector(server.Selectors.getBuddyList);
  const ignoreList = useAppSelector(server.Selectors.getIgnoreList);
  const isModerator = useAppSelector(server.Selectors.getIsUserModerator);

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

  const onAddBuddy = () => name && webClient.request.session.addToBuddyList(name);
  const onRemoveBuddy = () => name && webClient.request.session.removeFromBuddyList(name);
  const onAddIgnore = () => name && webClient.request.session.addToIgnoreList(name);
  const onRemoveIgnore = () => name && webClient.request.session.removeFromIgnoreList(name);
  const onSendMessage = (message: string) => name && webClient.request.session.message(name, message);
  const onWarnUser = (reason: string) => name && webClient.request.moderator.warnUser(name, reason);
  const onBanFromServer = (minutes: number, reason: string, visibleReason?: string) =>
    name && webClient.request.moderator.banFromServer(minutes, name, undefined, reason, visibleReason);

  return {
    name,
    userInfo,
    currentUser,
    isSelf,
    isABuddy,
    isIgnored,
    isModerator,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
    onSendMessage,
    onWarnUser,
    onBanFromServer,
  };
}
