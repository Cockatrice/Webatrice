import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import { CardImage, CardRelatedLinks } from '@app/components';
import type { PreviewMode } from '../BattlefieldSidebar/BattlefieldSidebar';
import type { HoveredCard } from '../PlayerBox/hoveredCard';
import { ManaSymbols, SymbolText } from '../PlayerBox/ManaSymbols';
import {
  postCardPreviewMessage,
  subscribeToCardPreviewChannel,
  type CardPreviewDetail,
  type CardPreviewFetchState,
} from './cardPreviewChannel';

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
 * The popup honors the same tri-state view mode as the sidebar
 * (image / text / both). It doesn't do its own Scryfall fetch —
 * the main window ships the detail record on the channel so both
 * surfaces show the same content without racing.
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
  const [mode, setMode] = useState<PreviewMode>('image');
  const [detail, setDetail] = useState<CardPreviewDetail | null>(null);
  const [fetchState, setFetchState] = useState<CardPreviewFetchState>('idle');
  const [previousName, setPreviousName] = useState<string | undefined>(undefined);
  const [connected, setConnected] = useState<boolean>(false);
  const lastHeardRef = useRef<number>(Date.now());

  useEffect(() => {
    const unsubscribe = subscribeToCardPreviewChannel((msg) => {
      lastHeardRef.current = Date.now();
      setConnected(true);
      if (msg.kind === 'card') {
        setCard(msg.card);
      } else if (msg.kind === 'mode') {
        setMode(msg.mode);
        setDetail(msg.detail);
        setFetchState(msg.fetchState);
        setPreviousName(msg.previousName);
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

  // Prefer the face matching the hovered card's name — mirrors the
  // sidebar's face-selection so a transformed DFC surfaces its back
  // face oracle/PT instead of the front's.
  const face =
    detail?.card_faces?.find(
      (f) => f.name?.toLowerCase() === card?.name.toLowerCase(),
    ) ?? detail?.card_faces?.[0];
  const displayName = face?.name ?? detail?.name ?? card?.name ?? '';
  const displayMana = face?.mana_cost ?? detail?.mana_cost ?? '';
  const displayType = face?.type_line ?? detail?.type_line ?? '';
  const displayOracle = face?.oracle_text ?? detail?.oracle_text ?? '';
  const displayFlavor = face?.flavor_text ?? detail?.flavor_text ?? '';
  const displayPT =
    (face?.power ?? detail?.power) != null &&
    (face?.toughness ?? detail?.toughness) != null
      ? `${face?.power ?? detail?.power}/${face?.toughness ?? detail?.toughness}`
      : undefined;
  const displayLoyalty = face?.loyalty ?? detail?.loyalty;

  const showImage = mode === 'image' || mode === 'both';
  const showText = mode === 'text' || mode === 'both';

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

      {/* Body layout:
       *
       *   • Single-pane mode: stack whichever pane is enabled, small
       *     fixed gap, outer scroll if the pane is taller than the
       *     window.
       *   • Both mode: split the body into two equal fixed-height
       *     slots (48.75% each with a 2.5% gap between = 100%). No
       *     outer scroll — the text pane scrolls internally so a
       *     long oracle can never push the image off-screen. Image
       *     slot centers the CardImage inside; text slot is full-
       *     width. Matches the sidebar's stacked "both" layout but
       *     with equal-sized halves instead of natural sizing. */}
      <div
        className={[
          'flex-1 min-h-0 flex flex-col p-4',
          mode === 'both'
            ? 'gap-[2.5vh]'
            : 'items-center gap-3 overflow-y-auto',
        ].join(' ')}
      >
        {showImage && (
          <div
            className={[
              // Container for the image slot. `both` gets the fixed
              // 48.75% height + centers the image inside; single-pane
              // just wraps the image at its natural size.
              mode === 'both'
                ? 'h-[43.75vh] flex items-center justify-center min-h-0'
                : 'contents',
            ].join(' ')}
          >
            {imageUrl ? (
              <CardImage
                src={imageUrl}
                name={card?.name}
                draggable={false}
                className={[
                  'shadow-glow rounded-lg shrink-0',
                  // `both`: fit within the 48.75% slot height,
                  // aspect ratio does the rest for width. The image
                  // width is intentionally NOT clamped to 50% here —
                  // the height cap keeps the width naturally bounded.
                  // Single-pane: keep image full-width.
                  mode === 'both' ? 'h-full max-h-full w-auto max-w-full' : 'max-w-full',
                ].join(' ')}
                style={{ aspectRatio: '5 / 7' }}
              />
            ) : (
              <div
                // Mirror the CardImage sizing so the placeholder occupies
                // the exact same footprint a real MTG card would — height
                // fills the `both`-mode slot, single-pane fills the pane
                // width. Text stays centered inside via the flex layout.
                className={[
                  'rounded-lg border border-dashed border-border-subtle bg-bg-surface',
                  'flex items-center justify-center text-sm text-text-muted italic p-4 text-center',
                  'shrink-0',
                  mode === 'both'
                    ? 'h-full max-h-full w-auto max-w-full'
                    : 'w-full max-w-full',
                ].join(' ')}
                style={{ aspectRatio: '5 / 7' }}
              >
                {connected
                  ? 'Hover a card in the main window to preview it here'
                  : 'Waiting for the main window to reconnect…'}
              </div>
            )}
          </div>
        )}
        {showText && (
          card ? (
            <div
              className={[
                'rounded-md border border-border-subtle bg-bg-surface p-3 flex flex-col gap-2 text-sm text-text-primary',
                // `both`: full-width slot with fixed height + internal
                // scroll so long oracle text doesn't push the image.
                // Single-pane: natural width (max-w-md) and no
                // internal scroll (outer body scrolls if needed).
                mode === 'both'
                  ? 'w-full h-[40vh] min-h-0 overflow-y-auto'
                  : 'w-full max-w-md',
              ].join(' ')}
            >
              {previousName && (
                // Mirror of the sidebar's back affordance. Post-only —
                // the main window owns the override stack, so we don't
                // manipulate popup state directly; the next `mode`
                // broadcast will refresh the button label / hide it.
                <button
                  type="button"
                  onClick={() => postCardPreviewMessage({ kind: 'back' })}
                  className={[
                    'self-start inline-flex items-center gap-1',
                    'text-xs font-medium text-text-secondary',
                    'hover:text-text-primary transition-colors',
                  ].join(' ')}
                  title={`Back to ${previousName}`}
                >
                  <ChevronLeft size={14} />
                  <span className="truncate max-w-[20rem]">
                    Back to {previousName}
                  </span>
                </button>
              )}
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-base leading-tight">
                  {displayName}
                </span>
                {displayMana && (
                  <span className="shrink-0">
                    <ManaSymbols cost={displayMana} />
                  </span>
                )}
              </div>
              {displayType && (
                <div className="italic text-text-secondary">{displayType}</div>
              )}
              {displayOracle && (
                <div className="whitespace-pre-line leading-snug">
                  <SymbolText text={displayOracle} />
                </div>
              )}
              {displayFlavor && (
                <div className="whitespace-pre-line italic text-text-muted leading-snug border-t border-border-subtle pt-2">
                  {displayFlavor}
                </div>
              )}
              {/* Annotation (Cockatrice AttrAnnotation) if the hovered
               *  card carries one — same behavior as the sidebar. */}
              {card.annotation && (
                <div className="italic text-text-secondary">
                  {card.annotation}
                </div>
              )}
              {(displayPT || displayLoyalty) && (
                <div className="text-right font-semibold tabular-nums">
                  {displayPT ?? displayLoyalty}
                </div>
              )}
              {/* Fallback in-game PT for user-created tokens with no
               *  Scryfall record. Mirrors the sidebar's behavior. */}
              {!displayPT && !displayLoyalty && card.pt && (
                <div className="text-right font-semibold tabular-nums">
                  {card.pt}
                </div>
              )}
              {fetchState === 'loading' && (
                <div className="text-text-muted italic">Loading…</div>
              )}
              {detail && (
                // Related-card links (DFC faces, tokens, meld/combo
                // pieces). Clicks post a `navigate` message back to
                // the main window — the sidebar applies it as the
                // shared override so both surfaces swap together.
                <CardRelatedLinks
                  faces={detail.card_faces}
                  allParts={detail.all_parts}
                  parentName={detail.name}
                  parentTypeLine={displayType || detail.type_line}
                  currentFaceName={displayName}
                  onNavigate={(next) =>
                    postCardPreviewMessage({
                      kind: 'navigate',
                      target: { name: next.name, scryfallId: next.scryfallId },
                    })
                  }
                />
              )}
            </div>
          ) : (
            // Only show a standalone "hover a card" placeholder when
            // text is the sole pane. In `both` mode the image pane
            // above already carries that prompt.
            mode === 'text' && (
              <div className="w-full max-w-md rounded-md border border-dashed border-border-subtle bg-bg-surface flex items-center justify-center text-sm text-text-muted italic p-4 text-center">
                {connected
                  ? 'Hover a card in the main window to preview it here'
                  : 'Waiting for the main window to reconnect…'}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
