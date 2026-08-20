import type { HoveredCard } from '../PlayerBox/hoveredCard';

// Fixed channel name so the popped-out window can find the main
// window's broadcasts without needing an opaque handle. Only one main
// window is expected — if the user opens the app in two tabs, both
// will publish to the same channel, and the popup will render whichever
// broadcast arrived last (last-write-wins is fine for a preview).
const CHANNEL_NAME = 'webatrice-card-preview';

/**
 * Wire payload between main window and the popped-out preview. `card:
 * null` explicitly clears the preview (nothing hovered).
 *
 * `heartbeat` is a keep-alive tick posted by the main window on a
 * timer; the popup uses it to distinguish "quiet because nothing is
 * hovered" from "disconnected because the main window closed / refreshed".
 *
 * `close` is posted from the popup as an early-exit signal so the main
 * window can drop its "popup open" state without waiting for the
 * `beforeunload` race.
 */
export type CardPreviewMessage =
  | { kind: 'card'; card: HoveredCard | null }
  | { kind: 'heartbeat' }
  | { kind: 'close' };

/** Guards against SSR / non-browser environments. */
function makeChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/**
 * Fire a one-off message onto the shared channel. Opens a temporary
 * channel per call — cheap, and avoids the caller having to manage
 * lifetime for infrequent posts.
 */
export function postCardPreviewMessage(msg: CardPreviewMessage): void {
  const ch = makeChannel();
  if (!ch) return;
  try {
    ch.postMessage(msg);
  } finally {
    ch.close();
  }
}

/**
 * Subscribe to card-preview messages. Returns an unsubscribe function.
 * Callers pass a single handler that receives every message; the
 * popup + main-window listener sides both use this.
 */
export function subscribeToCardPreviewChannel(
  handler: (msg: CardPreviewMessage) => void,
): () => void {
  const ch = makeChannel();
  if (!ch) return () => {};
  const onMessage = (event: MessageEvent<CardPreviewMessage>) => {
    if (!event.data) return;
    handler(event.data);
  };
  ch.addEventListener('message', onMessage);
  return () => {
    ch.removeEventListener('message', onMessage);
    ch.close();
  };
}
