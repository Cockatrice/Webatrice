import { currentView, isPageInactive, type CurrentView } from '@app/services';

import { getVisibleChats } from './useChatDock';

export function isChatOnScreen(userName: string, pathname: string): boolean {
  return currentView(pathname).chatPeers.includes(userName) || getVisibleChats().includes(userName);
}

export function viewedNow(pathname: string): CurrentView {
  if (isPageInactive()) {
    return { chatPeers: [] };
  }
  const view = currentView(pathname);
  return { ...view, chatPeers: [...new Set([...view.chatPeers, ...getVisibleChats()])] };
}
