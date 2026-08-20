import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Flag, Image as ImageIcon, Layers, LogOut, X } from 'lucide-react';

import { useLeaveGame } from '@app/hooks';
import { CardImage, CardRelatedLinks } from '@app/components';

import PlayerList from '../right-sidebar/PlayerList/PlayerList';
import ChatLog from '../ChatLog/ChatLog';
import { useGameId } from '../ui/GameIdContext';
import { useGameDialogActions } from '../ui/GameDialogActionsContext';
import { useLocalIdentity } from '../../hooks/useLocalIdentity';
import { useGameAffordances } from '../../hooks/useGameAffordances';
import { useHoveredCard } from '../PlayerBox/hoveredCard';
import { CARD_CORNER_RADIUS } from '../PlayerBox/cardSize';
import { ManaSymbols, SymbolText } from '../PlayerBox/ManaSymbols';
import { useCardPreviewPopup } from '../CardPreviewPopup/useCardPreviewPopup';

/**
 * Right-rail companion for the battlefield. Four stacked sections,
 * top-down:
 *   1. Card preview  — the last card the viewer hovered over
 *   2. Player list   — every seat, active/host/ping badges, plus a
 *                      Leave button in the section header
 *   3. Chat & log    — the shared ChatLog component (same one the
 *                      pre-game lobby renders)
 *
 * Card preview reads from the same `HoveredCardProvider` the PlayerBox
 * card components write to on mouse-enter, so hovering any card
 * anywhere in the play area updates the preview here. Ported inline
 * from fancy webatrice's BattlefieldSidebar — same 5 : 7 aspect image
 * and dashed placeholder.
 *
 * Spectator affordance stays: when the viewer joined as a spectator,
 * a small pill above the card preview flags the mode explicitly.
 */

/** localStorage key for the "show description instead of image" toggle.
 *  Persistent and global (shared across games) so a user's preference
 *  survives room switches / reloads. */
const CARD_PREVIEW_MODE_STORAGE_KEY = 'webatrice.cardPreviewMode';

/** Scryfall fields the description view renders. Same shape as
 *  CardDetailModal's `ScryfallDetail`. Kept local so the sidebar can
 *  fetch on its own without dragging the modal's whole surface in. */
interface ScryfallDetail {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
  }>;
  /** Scryfall `all_parts` — tokens, meld pieces, combo pieces. Powers
   *  the "Related" link section rendered by CardRelatedLinks. */
  all_parts?: Array<{
    id?: string;
    name?: string;
    component?: string;
  }>;
}

async function fetchScryfallDetail(
  scryfallId: string | undefined,
  name: string,
  signal?: AbortSignal,
): Promise<ScryfallDetail | null> {
  try {
    const url = scryfallId
      ? `https://api.scryfall.com/cards/${encodeURIComponent(scryfallId)}`
      : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(
          name.replace(/\s*\(?\bToken\b\)?\s*$/i, ''),
        )}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as ScryfallDetail;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    return null;
  }
}

export default function BattlefieldSidebar() {
  const gameId = useGameId();
  const { isSpectator } = useLocalIdentity();
  const { hoveredCard } = useHoveredCard();
  const {
    onRequestConcede,
    onRequestUnconcede,
    onRequestViewSideboard,
    onRequestLeave,
  } = useGameDialogActions();
  const { canConcede, canUnconcede } = useGameAffordances(gameId ?? undefined);

  // Preview mode — image (default) vs. description text. Persisted in
  // localStorage so the toggle survives reloads and stays consistent
  // across games. Reads lazily on first render; a missing / invalid
  // stored value falls back to "image".
  const [previewMode, setPreviewMode] = useState<'image' | 'text'>(() => {
    if (typeof window === 'undefined') return 'image';
    try {
      return window.localStorage.getItem(CARD_PREVIEW_MODE_STORAGE_KEY) === 'text'
        ? 'text'
        : 'image';
    } catch {
      return 'image';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CARD_PREVIEW_MODE_STORAGE_KEY, previewMode);
    } catch {
      // Ignore quota / disabled-storage errors — toggle still works
      // in-session, just won't persist.
    }
  }, [previewMode]);

  // Optional override — set when the user clicks a related-card link
  // in the preview. Takes precedence over `hoveredCard` for the
  // preview panel. Auto-clears when `hoveredCard` changes so hovering
  // a different card immediately shows that card (no stale override).
  const [override, setOverride] = useState<{ name: string; scryfallId?: string } | null>(null);
  const hoveredKeyForReset = hoveredCard
    ? hoveredCard.scryfallId ?? `name:${hoveredCard.name}`
    : null;
  useEffect(() => {
    // Reset the override whenever the hovered card identity changes —
    // otherwise a stale click-follow-through would keep showing an
    // old related card even after the user has hovered something new.
    setOverride(null);
  }, [hoveredKeyForReset]);

  // The card actually driving the preview: override if the user is
  // exploring related cards, otherwise the hovered card.
  const activeCard = override ?? (hoveredCard
    ? { name: hoveredCard.name, scryfallId: hoveredCard.scryfallId }
    : null);

  // Popped-out preview window. When active, `isPopupOpen` flips the
  // inline preview slot to a "popped-out" placeholder and the popup
  // window mirrors `activeCard` via BroadcastChannel. The payload
  // preserves `imageUri` (DFC back face) only when the base hovered
  // card is what's showing — override navigations shouldn't inherit
  // an unrelated back-face image.
  const popupPayload = activeCard
    ? {
      name: activeCard.name,
      scryfallId: activeCard.scryfallId,
      imageUri: !override ? hoveredCard?.imageUri : undefined,
    }
    : null;
  const { isOpen: isPopupOpen, toggle: togglePopup } = useCardPreviewPopup(popupPayload);

  // Full-fat Scryfall record for the currently displayed card. Only
  // fetched when text mode is active AND a card is active — image
  // mode uses Scryfall's redirect endpoints directly via <img src>,
  // no JSON round-trip needed. Cleared between changes so a stale
  // record can't flash for the previous card while the new fetch
  // is in flight.
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);
  // Distinguish "fetch pending" from "fetch resolved with no data"
  // (Scryfall 404 — user-created tokens, custom cards). Without this,
  // both states looked identical to the UI and it kept showing
  // "Loading…" forever for cards Scryfall doesn't know about.
  const [detailFetchState, setDetailFetchState] = useState<'idle' | 'loading' | 'loaded' | 'not-found'>('idle');
  const activeKey = activeCard
    ? activeCard.scryfallId ?? `name:${activeCard.name}`
    : null;

  useEffect(() => {
    if (previewMode !== 'text' || !activeCard) {
      setDetail(null);
      setDetailFetchState('idle');
      return;
    }
    setDetail(null);
    setDetailFetchState('loading');
    const controller = new AbortController();
    fetchScryfallDetail(activeCard.scryfallId, activeCard.name, controller.signal)
      .then((d) => {
        setDetail(d);
        setDetailFetchState(d ? 'loaded' : 'not-found');
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setDetailFetchState('not-found');
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, activeKey]);

  // Route through `onRequestLeave` (opens the "Leave this game?"
  // confirmation) rather than firing Command_LeaveGame directly —
  // matches the concede guard-rail, so an accidental sidebar click
  // doesn't drop the user out of a game they meant to stay in. The
  // confirm's `onConfirm` fires the wire command + local dispatch.
  const handleLeave = () => {
    if (gameId != null) onRequestLeave();
  };

  // Fancy's exact URL pattern — prefer the exact printing by id,
  // fall back to the named endpoint. `png` is heavier than `large`
  // but the preview panel is big enough to warrant the higher fidelity.
  // `hoveredCard.imageUri` wins over both when set — that's how DFC
  // back-face art survives to the preview (Scryfall's default image
  // endpoint always returns the front face). The `override` (from a
  // related-link click) doesn't carry an imageUri, so it just uses
  // the id/name endpoints.
  const hoveredImageUrl = activeCard
    ? (!override && hoveredCard?.imageUri)
      ? hoveredCard.imageUri
      : activeCard.scryfallId
        ? `https://api.scryfall.com/cards/${activeCard.scryfallId}?format=image&version=png`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(activeCard.name)}&format=image&version=png`
    : null;

  // Pick the matching face for multi-faced cards. When the active
  // card's name matches a `card_faces[N].name`, use that face — this
  // is how a transformed DFC's back face gets its correct oracle text
  // in the preview instead of always showing face-0. Falls back to
  // face-0 for classic single-face cards where the top-level record
  // may not carry these fields.
  const face =
    detail?.card_faces?.find(
      (f) => f.name?.toLowerCase() === activeCard?.name.toLowerCase(),
    ) ?? detail?.card_faces?.[0];
  // Prefer face-level fields when a face was picked — face.name for a
  // transformed DFC is `"Insectile Aberration"`, whereas detail.name
  // is the combined `"Delver of Secrets // Insectile Aberration"`.
  // For classic single-face cards `face` is undefined and detail.* wins.
  const displayName = face?.name ?? detail?.name ?? activeCard?.name ?? '';
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

  return (
    <aside
      data-testid="right-panel"
      // Width comes from the parent `.game` grid's `--sidebar-width`
      // column (user-resizable via SidebarResizer). `w-full` fills
      // that column; the old fixed `w-72` fought the CSS grid.
      className="w-full h-full border-l border-border-subtle bg-bg-surface flex flex-col min-h-0 overflow-hidden"
    >
      {isSpectator && (
        <div
          data-testid="spectating-tag"
          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-300 bg-yellow-500/10 border-b border-yellow-500/30 text-center"
        >
          Spectating
        </div>
      )}

      {/* Card preview — 5 : 7 aspect image when a card is hovered,
           otherwise a dashed placeholder frame. Reads the hover state
           from PlayerBox's HoveredCardProvider so any card on the
           board (hand / battlefield / library / graveyard / etc.)
           lights up the preview when its mouse-enter fires. Header
           row hosts the image/text toggle — persisted globally in
           localStorage so it survives reloads and applies across all
           games the user joins. */}
      <div className="shrink-0 p-3 border-b border-border-subtle">
        <div className="flex items-center justify-between pb-2 gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Preview
          </span>
          <div className="flex items-center gap-1.5">
            {/* Pop-out toggle. Opens a small browser window that mirrors
             *  the preview via BroadcastChannel — Cockatrice-parity for
             *  moving the preview to a second monitor. Clicking again
             *  closes the popup and restores the inline slot. */}
            <button
              type="button"
              onClick={togglePopup}
              title={isPopupOpen ? 'Close preview window' : 'Open preview in a separate window'}
              aria-pressed={isPopupOpen}
              className={[
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                isPopupOpen
                  ? 'text-accent bg-accent/10 border-accent/40 hover:bg-accent/20'
                  : 'text-text-primary bg-bg-elevated hover:bg-border-subtle border-border-subtle',
              ].join(' ')}
            >
              {isPopupOpen ? (
                <>
                  <X size={12} /> Popped out
                </>
              ) : (
                <>
                  <ExternalLink size={12} /> Pop out
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setPreviewMode((m) => (m === 'image' ? 'text' : 'image'))
              }
              title={
                previewMode === 'image'
                  ? 'Show card description'
                  : 'Show card image'
              }
              aria-pressed={previewMode === 'text'}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
            >
              {previewMode === 'image' ? (
                <>
                  <ImageIcon size={12} /> Image
                </>
              ) : (
                <>
                  <FileText size={12} /> Text
                </>
              )}
            </button>
          </div>
        </div>

        {isPopupOpen ? (
          // Preview is mirroring in a separate window; keep the sidebar
          // slot compact rather than showing a duplicate image inline.
          <button
            type="button"
            onClick={togglePopup}
            className="w-full aspect-[5/7] rounded-md border border-dashed border-accent/40 bg-accent/5 flex flex-col items-center justify-center gap-2 text-xs text-text-muted p-4 text-center hover:bg-accent/10 transition-colors"
            style={{ borderRadius: CARD_CORNER_RADIUS }}
          >
            <ExternalLink size={22} className="text-accent" />
            <span className="italic">Preview is open in a separate window</span>
            <span className="text-[10px] uppercase tracking-widest text-accent">
              Click to bring back
            </span>
          </button>
        ) : previewMode === 'image' ? (
          hoveredImageUrl ? (
            <CardImage
              src={hoveredImageUrl}
              name={activeCard?.name}
              draggable={false}
              className="w-full shadow-md"
              style={{
                aspectRatio: '5 / 7',
                borderRadius: CARD_CORNER_RADIUS,
                imageRendering: '-webkit-optimize-contrast',
              }}
            />
          ) : (
            <div
              className="aspect-[5/7] rounded-md border border-dashed border-border-subtle bg-bg-base/30 flex items-center justify-center text-xs text-text-muted italic p-3 text-center"
              style={{ borderRadius: CARD_CORNER_RADIUS }}
            >
              Hover a card to preview it here
            </div>
          )
        ) : activeCard ? (
          <div
            className="rounded-md border border-border-subtle bg-bg-base/30 p-3 flex flex-col gap-2 text-xs text-text-primary"
            style={{ borderRadius: CARD_CORNER_RADIUS }}
          >
            {/* Name row + inline mana cost. Cockatrice's card info
                dialog puts these together at the top of the panel. */}
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm leading-tight">
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
            {/* In-game annotation (Cockatrice AttrAnnotation) —
             *  surfaces on ANY card that has one, even when Scryfall
             *  has a full record. Shows above the PT row so the flow
             *  reads name → annotation → PT. `override` is a
             *  related-link click, which is unrelated to the hovered
             *  card's annotation, so skip it in that case. */}
            {!override && hoveredCard?.annotation && (
              <div className="italic text-text-secondary">
                {hoveredCard.annotation}
              </div>
            )}
            {(displayPT || displayLoyalty) && (
              <div className="text-right font-semibold tabular-nums">
                {displayPT ?? displayLoyalty}
              </div>
            )}
            {/* Fallback PT — for user-created tokens Scryfall has no
             *  record for, `displayPT` is empty but the card still
             *  has an in-game AttrPT string. Show it so a Rhino
             *  Warrior token still displays "3/3" in text mode. Skip
             *  when we're following a related-link override (that
             *  target should show Scryfall's PT for the linked card). */}
            {!override && !displayPT && !displayLoyalty && hoveredCard?.pt && (
              <div className="text-right font-semibold tabular-nums">
                {hoveredCard.pt}
              </div>
            )}
            {/* Loading indicator only while the Scryfall fetch is
             *  actually in flight. A 404 flips state to `not-found`
             *  which no longer looks like "loading" — the visible
             *  card info above (name + PT + annotation) is all we
             *  can show for a token without a Scryfall entry. */}
            {detailFetchState === 'loading' && (
              <div className="text-text-muted italic">Loading…</div>
            )}
            {detail && (
              <CardRelatedLinks
                faces={detail.card_faces}
                allParts={detail.all_parts}
                parentName={detail.name}
                // Prefer the actively-displayed face's type_line (a
                // transformed DFC surfaces the back face's type). The
                // component uses this to detect when the parent is a
                // token and dial back the noisy reverse-graph sections.
                parentTypeLine={displayType || detail.type_line}
                currentFaceName={displayName}
                onNavigate={(next) => setOverride(next)}
              />
            )}
          </div>
        ) : (
          <div
            className="aspect-[5/7] rounded-md border border-dashed border-border-subtle bg-bg-base/30 flex items-center justify-center text-xs text-text-muted italic p-3 text-center"
            style={{ borderRadius: CARD_CORNER_RADIUS }}
          >
            Hover a card to preview it here
          </div>
        )}
      </div>

      {/* Player list — og's PlayerList inside a section header row
           that carries the Leave button (fancy's pattern). */}
      <div className="shrink-0 border-b border-border-subtle">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Players
          </span>
          <button
            type="button"
            onClick={handleLeave}
            disabled={gameId == null}
            title="Leave the game"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut size={12} /> Leave
          </button>
        </div>
        <PlayerList />
      </div>

      {/* Action-buttons row — sits between the player list and the
           chat & log so only the chat section (the flex-1 slot) gives
           up space when this row grows. Starts as just Concede /
           Rejoin; future buttons (Roll die, Game info, etc.) land
           here rather than being tucked into other panels. `shrink-0`
           keeps the row at its natural height regardless of
           available viewport. Hidden entirely for spectators and
           pre-game states where none of the buttons apply, so we
           don't reserve blank space for nothing. */}
      {(canConcede || canUnconcede) && (
        <div className="shrink-0 border-b border-border-subtle px-3 py-2 flex items-center gap-2">
          {canConcede && (
            <button
              type="button"
              onClick={onRequestConcede}
              title="Concede this game"
              // Same visual as the Leave button above — matching the
              // rest of this button row keeps the sidebar reading as
              // one consistent affordance strip. flex-1 makes it (and
              // any future sibling in this row) share the available
              // width evenly.
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
            >
              <Flag size={12} /> Concede
            </button>
          )}
          {canUnconcede && (
            <button
              type="button"
              onClick={onRequestUnconcede}
              title="Rejoin the game"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
            >
              <Flag size={12} /> Rejoin
            </button>
          )}
          <button
            type="button"
            onClick={onRequestViewSideboard}
            title="Open sideboard"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
          >
            <Layers size={12} /> Sideboard
          </button>
        </div>
      )}

      {/* Chat & log — the shared ChatLog gets the remaining flex-1
           height. Its own component owns the header + timer + input,
           so the sidebar just gives it a slot. No padding here — the
           chat log flows edge-to-edge into the sidebar like fancy. */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatLog />
      </div>
    </aside>
  );
}
