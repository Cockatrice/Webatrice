import { useEffect, useRef, useState } from 'react';

import { CardImage } from '@app/components';
import type { HoveredCard } from '../PlayerBox/hoveredCard';
import { postCardPreviewMessage, subscribeToCardPreviewChannel } from './cardPreviewChannel';

// If we haven't heard a heartbeat OR a card update in this window,
// treat the main window as gone (refresh, close, network hiccup) and
// flip the popup to a "reconnecting" state. Kept generous (double the
// main-window post cadence of 2s) so a slow tick doesn't false-alarm.
const HEARTBEAT_TIMEOUT_MS = 5_000;

/**
 * Standalone card-preview page rendered inside a browser popup window
 * spawned by the main game view. Not wrapped in Layout / TopBar /
 * AuthGuard — the popup is a dumb mirror of whatever the main window
 * broadcasts on the card-preview channel.
 *
 * Lifecycle:
 *   • Mount → subscribe to the channel, start a "last message" timer,
 *     signal `close` on `beforeunload` so the main window can drop
 *     its "popped-out" flag.
 *   • Main window disappears → heartbeat stops → we flip to a dimmed
 *     "Reconnecting…" state without closing. When the user reloads /
 *     re-opens the main window, the next broadcast pulls us back.
 */
export default function CardPreviewPopupPage() {
  const [card, setCard] = useState<HoveredCard | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const lastHeardRef = useRef<number>(Date.now());

  useEffect(() => {
    const unsubscribe = subscribeToCardPreviewChannel((msg) => {
      lastHeardRef.current = Date.now();
      setConnected(true);
      if (msg.kind === 'card') {
        setCard(msg.card);
      }
      // 'heartbeat' just refreshes lastHeardRef; 'close' is a main-window
      // signal not relevant here (the popup owns its own close behaviour).
    });

    // Notify the main window we're going away so it doesn't wait for
    // the beforeunload race to update its popup state.
    const onUnload = () => postCardPreviewMessage({ kind: 'close' });
    window.addEventListener('beforeunload', onUnload);

    // Watchdog: if we haven't heard anything in HEARTBEAT_TIMEOUT_MS,
    // mark disconnected. Runs on a slow timer since this only reacts
    // to prolonged silence.
    const watchdog = window.setInterval(() => {
      if (Date.now() - lastHeardRef.current > HEARTBEAT_TIMEOUT_MS) {
        setConnected(false);
      }
    }, 1_000);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', onUnload);
      window.clearInterval(watchdog);
    };
  }, []);

  const imageUrl = card
    ? card.imageUri
      ? card.imageUri
      : card.scryfallId
        ? `https://api.scryfall.com/cards/${card.scryfallId}?format=image&version=png`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=png`
    : null;

  return (
    <div className="min-h-screen w-full flex flex-col bg-bg-base text-text-primary">
      {/* Small header strip — keeps the window identifiable as the
       *  webatrice preview vs. any other tab/window the user opens. */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between border-b border-border-subtle bg-bg-surface">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Card Preview
        </span>
        <span
          className={[
            'text-[10px] font-medium',
            connected ? 'text-emerald-400' : 'text-yellow-400',
          ].join(' ')}
          title={connected
            ? 'Receiving updates from the main window.'
            : 'Waiting for the main window to reconnect…'}
        >
          {connected ? '● Live' : '○ Reconnecting…'}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {imageUrl ? (
          <CardImage
            src={imageUrl}
            name={card?.name}
            draggable={false}
            className="max-h-full shadow-glow rounded-lg"
            style={{ aspectRatio: '5 / 7' }}
          />
        ) : (
          <div className="w-full max-w-xs aspect-[5/7] rounded-lg border border-dashed border-border-subtle bg-bg-surface flex items-center justify-center text-sm text-text-muted italic p-4 text-center">
            {connected
              ? 'Hover a card in the main window to preview it here'
              : 'Waiting for the main window to reconnect…'}
          </div>
        )}
      </div>
    </div>
  );
}
