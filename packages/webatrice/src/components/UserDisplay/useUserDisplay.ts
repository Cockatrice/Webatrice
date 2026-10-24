import { useWebClient } from '@cockatrice/datatrice/react';
import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useContextMenu, type ContextMenuTrigger } from '../Menu';

export interface UserDisplay {
  menu: ContextMenuTrigger;
  isABuddy: boolean;
  isIgnored: boolean;
  onAddBuddy: () => void;
  onRemoveBuddy: () => void;
  onAddIgnore: () => void;
  onRemoveIgnore: () => void;
}

export function useUserDisplay(userName: string): UserDisplay {
  const isABuddy = useAppSelector((state) => Boolean(server.Selectors.getBuddyList(state)[userName]));
  const isIgnored = useAppSelector((state) => Boolean(server.Selectors.getIgnoreList(state)[userName]));
  const menu = useContextMenu();
  const webClient = useWebClient();

  const onAddBuddy = () => {
    webClient.request.session.addToBuddyList(userName);
    menu.close();
  };
  const onRemoveBuddy = () => {
    webClient.request.session.removeFromBuddyList(userName);
    menu.close();
  };
  const onAddIgnore = () => {
    webClient.request.session.addToIgnoreList(userName);
    menu.close();
  };
  const onRemoveIgnore = () => {
    webClient.request.session.removeFromIgnoreList(userName);
    menu.close();
  };

  return {
    menu,
    isABuddy,
    isIgnored,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
  };
}
