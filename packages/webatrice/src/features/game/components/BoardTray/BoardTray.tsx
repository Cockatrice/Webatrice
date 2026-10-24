import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const TRAY_CARD_HEIGHT_VAR = '--tray-card-height';
export const TRAY_CARD_WIDTH_VAR = '--tray-card-width';
export const TRAY_CHROME_PX = 46;

export function trayCardSize(trayHeight: number): { height: number; width: number } {
  const height = Math.max(0, trayHeight - TRAY_CHROME_PX);
  return { height, width: Math.round((height * 72) / 102) };
}

export const TRAY_FLEX_ATTRIBUTE = 'data-tray-flex';
export const TRAY_HAND_MIN_PX = 160;
export const TRAY_DOCK_GAP_PX = 16;

export function trayKeepPx({ trayWidth, paddingRight, flexWidth, hasHand }: {
  trayWidth: number;
  paddingRight: number;
  flexWidth: number;
  hasHand: boolean;
}): number {
  return Math.ceil(trayWidth - paddingRight - flexWidth + (hasHand ? TRAY_HAND_MIN_PX : 0) + TRAY_DOCK_GAP_PX);
}

function measureTrayKeep(tray: HTMLElement, host: HTMLElement | null): number {
  const hand = tray.querySelector<HTMLElement>(`[${TRAY_FLEX_ATTRIBUTE}]`);
  const flex = hand ?? host;
  return trayKeepPx({
    trayWidth: tray.getBoundingClientRect().width,
    paddingRight: parseFloat(getComputedStyle(tray).paddingRight) || 0,
    flexWidth: flex?.getBoundingClientRect().width ?? 0,
    hasHand: hand !== null,
  });
}

const TRAY_STYLE = { paddingRight: 'calc(0.5rem + var(--chat-dock-footprint, 0px))' };

interface BoardTrayProps {
  hostRef: (el: HTMLDivElement | null) => void;
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}

export default function BoardTray({ hostRef, onMouseDown, children }: BoardTrayProps) {
  const { t } = useTranslation();
  const trayRef = useRef<HTMLDivElement | null>(null);
  const seatRef = useRef<HTMLDivElement | null>(null);
  const setHost = useCallback((el: HTMLDivElement | null) => {
    seatRef.current = el;
    hostRef(el);
  }, [hostRef]);

  useEffect(() => {
    const tray = trayRef.current;
    if (!tray || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const publish = () => tray.setAttribute('data-chat-dock-keep', String(measureTrayKeep(tray, seatRef.current)));
    publish();
    const resize = new ResizeObserver(publish);
    const observeChildren = () => {
      resize.disconnect();
      resize.observe(tray);
      tray.querySelectorAll<HTMLElement>(`:scope > *, [${TRAY_FLEX_ATTRIBUTE}]`).forEach((el) => resize.observe(el));
      publish();
    };
    observeChildren();
    const children = new MutationObserver(observeChildren);
    children.observe(tray, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      children.disconnect();
    };
  }, []);

  useEffect(() => {
    const tray = trayRef.current;
    if (!tray) {
      return;
    }
    const root = document.documentElement;
    const apply = () => {
      const { height, width } = trayCardSize(tray.offsetHeight);
      root.style.setProperty(TRAY_CARD_HEIGHT_VAR, `${height}px`);
      root.style.setProperty(TRAY_CARD_WIDTH_VAR, `${width}px`);
    };
    apply();
    const clear = () => {
      root.style.removeProperty(TRAY_CARD_HEIGHT_VAR);
      root.style.removeProperty(TRAY_CARD_WIDTH_VAR);
    };
    if (typeof ResizeObserver === 'undefined') {
      return clear;
    }
    const ro = new ResizeObserver(apply);
    ro.observe(tray);
    return () => {
      ro.disconnect();
      clear();
    };
  }, []);

  return (
    <div
      ref={trayRef}
      data-testid="board-tray"
      aria-label={t('BoardTray.label')}
      role="region"
      onMouseDown={onMouseDown}
      className="game__tray flex shrink-0 gap-2 border-t border-border-subtle bg-bg-surface p-2"
      style={TRAY_STYLE}
    >
      <div ref={setHost} className="flex min-h-0 min-w-0 flex-1" data-testid="board-tray-seat" />
      {children}
    </div>
  );
}
