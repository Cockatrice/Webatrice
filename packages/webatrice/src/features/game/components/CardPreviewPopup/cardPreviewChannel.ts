import type { PreviewMode } from '../BattlefieldSidebar/BattlefieldSidebar';
import type { HoveredCard } from '../PlayerBox/hoveredCard';

// Fixed channel name so the popped-out window can find the main
// window's broadcasts without needing an opaque handle. Only one main
// window is expected — if the user opens the app in two tabs, both
// will publish to the same channel, and the popup will render whichever
// broadcast arrived last (last-write-wins is fine for a preview).
const CHANNEL_NAME = 'webatrice-card-preview';

/**
 * Wire payload between main window and the popped-out preview.
 *
 *   • `card` — the currently hovered card, or `null` to clear.
 *   • `mode` — image / text / both. Mirrors the sidebar's segmented
 *              control so the popup honors the same preference. Also
 *              carries the extra Scryfall record fields the popup's
 *              text mode needs to render without doing its own fetch.
 *   • `heartbeat` — keep-alive tick from the main window so the popup
 *              can distinguish "quiet because nothing is hovered" from
 *              "disconnected because the main window closed / refreshed".
 *   • `close` — early-exit signal from the popup so the main window
 *              drops its "popup open" flag without waiting for the
 *              `beforeunload` race.
 */
export type CardPreviewMessage =
  | { kind: 'card'; card: HoveredCard | null }
  | {
      kind: 'mode';
      mode: PreviewMode;
      detail: CardPreviewDetail | null;
      fetchState: CardPreviewFetchState;
      // Name of the card one step back on the navigation stack, or
      // undefined when there's nowhere to go back to. The popup uses
      // this to render its "← Back to {name}" affordance.
      previousName?: string;
    }
  | { kind: 'heartbeat' }
  | { kind: 'close' }
  // Popup → main: user clicked a related-card link in the popup's
  // text pane. Main window applies it as the sidebar override so the
  // fetch + broadcast cycle updates both surfaces.
  | { kind: 'navigate'; target: { name: string; scryfallId?: string } }
  // Popup → main: user clicked the back affordance in the popup.
  // Main window pops its override stack, which triggers the usual
  // fetch + broadcast so both surfaces revert together.
  | { kind: 'back' };

// Subset of the sidebar's ScryfallDetail — just the fields the popup
// text panel needs. Kept structural (no import from ScryfallDetail)
// so this file has no dependency direction back into the sidebar.
export interface CardPreviewFace {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
}
export interface CardPreviewRelatedPart {
  id?: string;
  name?: string;
  component?: string;
  type_line?: string;
}
export interface CardPreviewDetail {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  card_faces?: readonly CardPreviewFace[];
  // Scryfall `all_parts` — powers the popup's related-links section
  // (tokens, meld pieces, combo pieces). Same shape as CardRelatedLinks
  // consumes so the popup can pass it straight through.
  all_parts?: readonly CardPreviewRelatedPart[];
}

// Matches the sidebar's fetch state enum. Popup shows "Loading…" only
// while the main window says the fetch is actually in flight.
export type CardPreviewFetchState = 'idle' | 'loading' | 'loaded' | 'not-found';

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
