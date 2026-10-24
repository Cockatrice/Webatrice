import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import {
  CHAT_DOCK_MARGIN_PX,
  dispatchChatDock,
  dockCapacity,
  dockRowWidth,
  getPreferencesSnapshot,
  PAGE_KEEP_PX,
  setChatDockRoom,
  useActionFeed,
  useChatDockState,
  type DockedChat,
} from '@app/hooks';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { incomingChatPeer } from './incomingChat';
import { splitDock } from './splitDock';

export const DOCK_AVOID_ATTRIBUTE = 'data-chat-dock-avoid';
export const DOCK_KEEP_ATTRIBUTE = 'data-chat-dock-keep';
export const DOCK_FOOTPRINT_VAR = '--chat-dock-footprint';

export interface DockSpace {
  inset: number;
  room: number;
  liftedRoom: number;
  lift: number;
}

export interface DockPlacement {
  room: number;
  bottom: number;
}

export function measureDockSpace(
  root: ParentNode = document,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): DockSpace {
  const avoided = root.querySelector<HTMLElement>(`[${DOCK_AVOID_ATTRIBUTE}]`);
  const kept = root.querySelector<HTMLElement>(`[${DOCK_KEEP_ATTRIBUTE}]`);
  const right = avoided ? Math.min(viewport.width, avoided.getBoundingClientRect().left) : viewport.width;
  const dockRight = right - CHAT_DOCK_MARGIN_PX;
  const inset = Math.max(0, Math.round(viewport.width - right));
  if (!kept) {
    const room = Math.max(0, Math.floor(dockRight - PAGE_KEEP_PX));
    return { inset, room, liftedRoom: room, lift: 0 };
  }
  const box = kept.getBoundingClientRect();
  const keep = Number(kept.getAttribute(DOCK_KEEP_ATTRIBUTE)) || 0;
  return {
    inset,
    room: Math.max(0, Math.floor(dockRight - box.left - keep)),
    liftedRoom: Math.max(0, Math.floor(dockRight - box.left - CHAT_DOCK_MARGIN_PX)),
    lift: Math.max(0, Math.round(viewport.height - box.top)),
  };
}

export function placeDock(space: DockSpace, chats: number): DockPlacement {
  const fitsBeside = space.lift === 0 || dockRowWidth(1, chats > 1) <= space.room;
  return fitsBeside ? { room: space.room, bottom: 0 } : { room: space.liftedRoom, bottom: space.lift };
}

export function watchDockSpace(onChange: (space: DockSpace) => void, root: HTMLElement = document.body): () => void {
  const watched = new Set<HTMLElement>();
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => report());
  const attributes = new MutationObserver(() => report());
  let last: DockSpace | null = null;
  function report() {
    const next = measureDockSpace(root);
    if (!last || (Object.keys(next) as (keyof DockSpace)[]).some((key) => last?.[key] !== next[key])) {
      last = next;
      onChange(next);
    }
  }
  const attach = () => {
    const current = new Set(root.querySelectorAll<HTMLElement>(`[${DOCK_AVOID_ATTRIBUTE}], [${DOCK_KEEP_ATTRIBUTE}]`));
    const changed = current.size !== watched.size || [...current].some((el) => !watched.has(el));
    if (changed) {
      watched.clear();
      resize?.disconnect();
      attributes.disconnect();
      current.forEach((el) => {
        watched.add(el);
        resize?.observe(el);
        attributes.observe(el, { attributes: true, attributeFilter: [DOCK_KEEP_ATTRIBUTE] });
      });
      report();
    }
  };
  const finder = new MutationObserver(attach);
  finder.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', report);
  attach();
  if (!last) {
    report();
  }
  return () => {
    finder.disconnect();
    resize?.disconnect();
    attributes.disconnect();
    window.removeEventListener('resize', report);
  };
}

const pageSpace = (): DockSpace => {
  const room = window.innerWidth - CHAT_DOCK_MARGIN_PX - PAGE_KEEP_PX;
  return { inset: 0, room, liftedRoom: room, lift: 0 };
};

function useDockSpace(active: boolean): DockSpace {
  const [space, setSpace] = useState<DockSpace>(pageSpace);
  useLayoutEffect(() => {
    if (!active) {
      setSpace(pageSpace());
      return undefined;
    }
    return watchDockSpace(setSpace);
  }, [active]);
  return space;
}

export function useDockFootprint(regionRef: RefObject<HTMLElement | null>, inset: number, visible: boolean): void {
  useLayoutEffect(() => {
    const docRoot = document.documentElement;
    const region = visible ? regionRef.current : null;
    if (!region) {
      docRoot.style.removeProperty(DOCK_FOOTPRINT_VAR);
      return undefined;
    }
    const publish = () => {
      const footprint = Math.max(0, Math.ceil(window.innerWidth - inset - region.getBoundingClientRect().left));
      docRoot.style.setProperty(DOCK_FOOTPRINT_VAR, `${footprint}px`);
    };
    publish();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    resize?.observe(region);
    window.addEventListener('resize', publish);
    return () => {
      resize?.disconnect();
      window.removeEventListener('resize', publish);
      docRoot.style.removeProperty(DOCK_FOOTPRINT_VAR);
    };
  }, [regionRef, inset, visible]);
}

export interface ChatDockView {
  visible: boolean;
  windows: DockedChat[];
  bars: DockedChat[];
  rightInset: number;
  placement: DockPlacement;
  focus: { name: string; seq: number } | null;
}

export function useChatDockController(): ChatDockView {
  const selfName = useAppSelector((state) => server.Selectors.getUser(state)?.name ?? null);
  const dock = useChatDockState();
  const { pathname } = useLocation();
  const gameId = matchPath({ path: RouteEnum.GAME, end: true }, pathname)?.params.gameId ?? null;
  const onPopup = matchPath({ path: RouteEnum.CARD_PREVIEW_POPUP, end: true }, pathname) !== null;

  const sessionUser = useRef(selfName);
  useEffect(() => {
    if (sessionUser.current !== selfName) {
      sessionUser.current = selfName;
      dispatchChatDock({ type: 'reset' });
    }
  }, [selfName]);
  useEffect(() => () => dispatchChatDock({ type: 'reset' }), []);

  const total = dock.chats.length;
  const space = useDockSpace(total > 0);
  const placement = useMemo(() => placeDock(space, total), [space, total]);
  useLayoutEffect(() => {
    if (total === 0) {
      return undefined;
    }
    setChatDockRoom(placement.room);
    dispatchChatDock({ type: 'fit', max: dockCapacity(placement.room, total) });
    return () => setChatDockRoom(null);
  }, [placement.room, total]);

  useEffect(() => {
    if (gameId !== null) {
      dispatchChatDock({ type: 'collapseAll' });
    }
  }, [gameId]);

  useActionFeed((action, _before, after) => {
    const peer = incomingChatPeer(action, after, getPreferencesSnapshot());
    if (peer) {
      dispatchChatDock({ type: 'receive', name: peer });
    }
  }, (action) => action.type === server.Types.USER_MESSAGE);

  const { windows, bars } = useMemo(() => splitDock(dock.chats, selfName), [dock.chats, selfName]);

  return {
    visible: Boolean(selfName) && !onPopup && windows.length + bars.length > 0,
    windows,
    bars,
    rightInset: space.inset,
    placement,
    focus: dock.focus,
  };
}
