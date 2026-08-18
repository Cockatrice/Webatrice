import { useEffect, useRef } from 'react';
import { generatePath, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { usePushToast } from '@app/components';
import { RouteEnum } from '@app/types';

/**
 * Global notifier for incoming private-chat messages. Renders nothing —
 * subscribes to `state.server.messages`, and on every new inbound
 * (senderName !== self) entry pushes a Toast pill that:
 *   • labels the sender + shows a message preview,
 *   • navigates to `/player/<senderName>` on click (TopBar marks
 *     player tabs sticky, so an existing chat tab is focused rather
 *     than duplicated).
 *
 * Suppressed when the user is already viewing that peer's Player page
 * — they're reading the message live; a toast would just be noise.
 *
 * Mounted once inside AppShell below the Router so `useNavigate` /
 * `useLocation` work.
 */
export default function PrivateMessageNotifier() {
  const navigate = useNavigate();
  const location = useLocation();
  const pushToast = usePushToast();
  const messagesMap = useAppSelector((state) => state.server.messages);
  const selfName = useAppSelector((state) => state.server.user?.name ?? null);

  // Per-peer "already-seen count" of messages. First observation is a
  // baseline — we don't want to toast every historical message the
  // moment the notifier mounts, only NEW arrivals. `selfName` gates
  // the whole thing (nothing to compare against pre-login) and reset
  // when it changes (login as a different user).
  const seenCountRef = useRef<Map<string, number>>(new Map());
  const initializedRef = useRef(false);
  const lastSelfRef = useRef<string | null>(null);

  // Keep the "am I looking at this peer's chat?" check inside the
  // effect via a ref so the effect doesn't re-run every path change
  // (which would race the seen-count bookkeeping).
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!selfName) {
      seenCountRef.current = new Map();
      initializedRef.current = false;
      lastSelfRef.current = null;
      return;
    }
    // Identity change (logout → login-as-other-user): re-baseline so
    // we don't fire toasts for the new user's pre-existing history.
    if (lastSelfRef.current !== selfName) {
      seenCountRef.current = new Map();
      initializedRef.current = false;
      lastSelfRef.current = selfName;
    }

    for (const [peer, list] of Object.entries(messagesMap)) {
      const previousCount = seenCountRef.current.get(peer) ?? 0;
      const currentCount = list.length;
      seenCountRef.current.set(peer, currentCount);
      // First pass across the whole map is baseline-only — don't
      // toast any of it. Subsequent passes toast only the new tail.
      if (!initializedRef.current) continue;
      if (currentCount <= previousCount) continue;

      const newEntries = list.slice(previousCount);
      for (const entry of newEntries) {
        // Skip messages we sent (server echoes them back).
        if (entry.senderName === selfName) continue;
        // Skip if already looking at that peer's page.
        const peerPath = generatePath(RouteEnum.PLAYER, { name: entry.senderName });
        const alreadyThere = matchPath({ path: RouteEnum.PLAYER, end: true }, pathnameRef.current);
        if (alreadyThere && alreadyThere.params.name === entry.senderName) continue;
        renderToast(entry.senderName, entry.message, peerPath);
      }
    }
    initializedRef.current = true;

    function renderToast(sender: string, message: string, path: string) {
      const preview = message.length > 100 ? `${message.slice(0, 100)}…` : message;
      const handle = pushToast(
        <button
          type="button"
          onClick={() => {
            handle.close();
            navigate(path);
          }}
          className="w-full text-left flex flex-col gap-0.5 min-w-0 focus:outline-none"
        >
          <span className="text-xs font-semibold text-accent truncate">
            New message from {sender}
          </span>
          <span className="text-sm text-text-primary whitespace-pre-wrap break-words line-clamp-3">
            {preview}
          </span>
        </button>,
        // Chat-related glyph — the default success checkmark reads
        // as "action confirmed", wrong for an incoming ping.
        { icon: MessageSquare },
      );
    }
  }, [messagesMap, selfName, navigate, pushToast]);

  return null;
}
