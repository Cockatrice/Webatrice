import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import { RouteEnum } from '@app/types';

export default function RouteFocus() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (previous === pathname
      || matchPath(RouteEnum.GAME, pathname) || matchPath(RouteEnum.REPLAY, pathname)) {
      return;
    }

    const main = document.querySelector('main');
    const activeElement = document.activeElement;
    if (!main || main.closest('[inert]')
      || (activeElement !== main && main.contains(activeElement))
      || activeElement?.closest('[data-game-board]')) {
      return;
    }

    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog[open]');
    const dialogOpen = Array.from(dialogs)
      .some(dialog => !dialog.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(dialog).display !== 'none');
    if (!dialogOpen) {
      main.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
}
