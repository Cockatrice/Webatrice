import { useCallback, useEffect, useRef, useState } from 'react';

import type { PreviewMode } from '../BattlefieldSidebar/BattlefieldSidebar';
import type { HoveredCard } from '../PlayerBox/hoveredCard';
import {
  postCardPreviewMessage,
  subscribeToCardPreviewChannel,
  type CardPreviewDetail,
  type CardPreviewFetchState,
} from './cardPreviewChannel';

// Main window → popup keep-alive cadence. Every tick, the main window
// posts a heartbeat so the popup can distinguish "quiet" from
// "disconnected". Half of the popup's HEARTBEAT_TIMEOUT_MS (5s) so a
// single dropped message is still tolerated.
const HEARTBEAT_INTERVAL_MS = 2_000;

const POPUP_NAME = 'webatrice-card-preview';
const POPUP_FEATURES = 'width=420,height=580,menubar=no,toolbar=no,location=no,status=no';

/**
 * Owns the popped-out card-preview window. The main window's sidebar
 * calls `toggle()` to open/close; while `isOpen` is true, changes to
 * `card` are broadcast via BroadcastChannel and a heartbeat ticks in
 * the background.
 *
 * Reasons `isOpen` can flip back to false without the caller touching it:
 *   • user closed the popup via its OS window controls (detected by
 *     the polling `popupRef.current.closed` check),
 *   • popup posted a `close` message on its own beforeunload,
 *   • popup.window failed to open (blocked / navigation restrictions).
 */
export function useCardPreviewPopup(
  card: HoveredCard | null,
  mode: PreviewMode,
  detail: CardPreviewDetail | null,
  fetchState: CardPreviewFetchState,
  // Called when the popup posts a `navigate` message (user clicked a
  // related-card link there). The main window forwards it into its
  // sidebar override so the fetch + broadcast cycle keeps both
  // surfaces synced.
  onNavigate?: (target: { name: string; scryfallId?: string }) => void,
  // Name of the card one step back on the navigation stack, or
  // undefined when there's nowhere to go back. Mirrored into the
  // popup so it can render its own "← Back to {name}" button.
  previousName?: string,
  // Called when the popup posts a `back` message.
  onBack?: () => void,
): {
  isOpen: boolean;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Broadcast the current card + heartbeat whenever the popup is open.
  // Runs the "post card" effect on every card change so the popup
  // updates in real time; the heartbeat runs on its own interval.
  useEffect(() => {
    if (!isOpen) return;
    postCardPreviewMessage({ kind: 'card', card });
  }, [card, isOpen]);

  // Mirror the sidebar's mode + text-detail state to the popup so it
  // renders the same view (image / text / both) with the same fetched
  // Scryfall record. Fires on any of these changing so the popup
  // reflects user toggles immediately and text-mode transitions
  // (loading → loaded → not-found) update in real time.
  useEffect(() => {
    if (!isOpen) return;
    postCardPreviewMessage({ kind: 'mode', mode, detail, fetchState, previousName });
  }, [mode, detail, fetchState, previousName, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Fire an immediate heartbeat so a freshly-opened popup gets
    // marked "connected" without waiting for the first interval tick.
    postCardPreviewMessage({ kind: 'heartbeat' });
    const ticker = window.setInterval(() => {
      postCardPreviewMessage({ kind: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(ticker);
  }, [isOpen]);

  // Listen for the popup's `close`, `navigate`, and `back` broadcasts.
  // Callbacks live behind refs so this subscription doesn't have to
  // re-bind whenever the caller passes a fresh function identity.
  const onNavigateRef = useRef(onNavigate);
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  useEffect(() => {
    if (!isOpen) return;
    return subscribeToCardPreviewChannel((msg) => {
      if (msg.kind === 'close') {
        popupRef.current = null;
        setIsOpen(false);
      } else if (msg.kind === 'navigate') {
        onNavigateRef.current?.(msg.target);
      } else if (msg.kind === 'back') {
        onBackRef.current?.();
      }
    });
  }, [isOpen]);

  // Watchdog: user could close the popup via its OS window controls
  // without our `close` broadcast landing. Poll `popup.closed` on a
  // slow timer so we drop the state anyway.
  useEffect(() => {
    if (!isOpen) return;
    const poll = window.setInterval(() => {
      const win = popupRef.current;
      if (!win || win.closed) {
        popupRef.current = null;
        setIsOpen(false);
      }
    }, 1_000);
    return () => window.clearInterval(poll);
  }, [isOpen]);

  const toggle = useCallback(() => {
    if (isOpen) {
      try {
        popupRef.current?.close();
      } catch {
        // Cross-origin or already-closed — ignore, we'll just drop the flag.
      }
      popupRef.current = null;
      setIsOpen(false);
      return;
    }
    // Open a real browser popup. The URL points to the AppShellRoutes
    // entry that renders CardPreviewPopupPage (no Layout / AuthGuard).
    // If the browser blocks it (popup blocker), `open` returns null —
    // in which case we don't flip the flag so the button reads as
    // "still off" and the user can retry.
    const opened = window.open('#/card-preview-popup', POPUP_NAME, POPUP_FEATURES);
    if (!opened) return;
    popupRef.current = opened;
    setIsOpen(true);
  }, [isOpen]);

  return { isOpen, toggle };
}
