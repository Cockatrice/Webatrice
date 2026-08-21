import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { CardImage, CardRelatedLinks } from '@app/components';

import { CARD_CORNER_RADIUS } from './cardSize';
import { ManaSymbols, SymbolText } from './ManaSymbols';

/**
 * "Big card preview" — Cockatrice's middle-click card zoom. A single
 * shared modal that any card on the board can open by publishing to
 * this context. Renders image + full description text side-by-side.
 *
 * Distinct from `HoveredCardProvider` (which drives the right-rail's
 * always-on hover preview): this is an explicit, click-triggered
 * affordance the user has to open and close. Kept as its own context
 * so the two lifecycles don't clash.
 */
export interface BigPreviewCard {
  name: string;
  scryfallId?: string;
  /** Optional image override for DFC back faces — mirrors
   *  HoveredCard.imageUri. See hoveredCard.tsx for rationale. */
  imageUri?: string;
}

interface BigCardPreviewContextValue {
  openBigPreview: (card: BigPreviewCard) => void;
  closeBigPreview: () => void;
}

const BigCardPreviewContext = createContext<BigCardPreviewContextValue | null>(null);

/** Scryfall fields the description panel renders. Same shape as the
 *  BattlefieldSidebar's text-mode fetch — kept local so this file can
 *  fetch on its own without cross-file coupling. */
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

export function BigCardPreviewProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<BigPreviewCard | null>(null);
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);

  const hoverKey = card ? card.scryfallId ?? `name:${card.name}` : null;

  useEffect(() => {
    if (!card) {
      setDetail(null);
      return;
    }
    setDetail(null);
    const controller = new AbortController();
    fetchScryfallDetail(card.scryfallId, card.name, controller.signal)
      .then((d) => setDetail(d))
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverKey]);

  const value: BigCardPreviewContextValue = {
    openBigPreview: setCard,
    closeBigPreview: () => setCard(null),
  };

  // `card.imageUri` wins when set — mirrors HoveredCard.imageUri so
  // DFC back-face art shows correctly in the zoom modal.
  const imageUrl = card
    ? card.imageUri
      ? card.imageUri
      : card.scryfallId
        ? `https://api.scryfall.com/cards/${card.scryfallId}?format=image&version=large`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(
            card.name.replace(/\s*\(?\bToken\b\)?\s*$/i, ''),
          )}&format=image&version=large`
    : null;

  // Pick the face matching the hovered name — same logic as
  // BattlefieldSidebar. Falls back to face-0 for classic single-face
  // records. Face-level fields win over top-level so a transformed
  // card shows its back-face oracle/PT instead of the front's.
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

  return (
    <BigCardPreviewContext.Provider value={value}>
      {children}
      {card &&
        createPortal(
          // Non-interactive overlay — no dimming, no click handlers.
          // The popup is dismissed by releasing the middle mouse
          // button (see Card.tsx), so the overlay just centers the
          // modal and floats it above the play area / context menus
          // (z-[1200]) / pile-view dialogs. `pointer-events-none`
          // keeps middle-button events from being intercepted before
          // they reach the underlying card's mouseup — otherwise
          // dragging the pointer off the card and releasing over the
          // overlay would swallow the release and leave the popup
          // stuck open.
          <div
            className="fixed inset-0 z-[1400] flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="relative bg-bg-surface border border-border-subtle rounded-lg shadow-2xl flex flex-col max-w-[340px] w-full max-h-[90vh]"
            >
              {/* Image row — full modal width, natural 5:7 aspect.
                  Cockatrice stacks image over text so the card art
                  stays large and the description gets full width to
                  breathe. Uses Scryfall's `large` version (~672×936)
                  which looks sharp at this size. */}
              <div className="shrink-0 p-4 bg-bg-base/40 rounded-t-lg">
                {imageUrl && (
                  <CardImage
                    src={imageUrl}
                    name={displayName}
                    draggable={false}
                    className="block w-full shadow-lg"
                    style={{
                      aspectRatio: '5 / 7',
                      borderRadius: CARD_CORNER_RADIUS,
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                  />
                )}
              </div>

              {/* Text row — Cockatrice's card info panel, stacked
                  below the art. Scrolls independently so a wall-of-
                  text oracle (Kozilek etc.) doesn't push the modal
                  past the viewport. */}
              <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 text-sm text-text-primary overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg leading-tight">
                      {displayName}
                    </div>
                    {displayType && (
                      <div className="italic text-text-secondary text-sm mt-1">
                        {displayType}
                      </div>
                    )}
                  </div>
                  {displayMana && (
                    <div className="shrink-0">
                      <ManaSymbols cost={displayMana} size={18} />
                    </div>
                  )}
                </div>

                {displayOracle && (
                  <div className="whitespace-pre-line leading-relaxed border-t border-border-subtle pt-3">
                    <SymbolText text={displayOracle} size={14} />
                  </div>
                )}

                {displayFlavor && (
                  <div className="whitespace-pre-line italic text-text-muted leading-snug border-t border-border-subtle pt-3">
                    {displayFlavor}
                  </div>
                )}

                {(displayPT || displayLoyalty) && (
                  <div className="text-right font-semibold text-base tabular-nums mt-auto pt-3 border-t border-border-subtle">
                    {displayPT ?? displayLoyalty}
                  </div>
                )}

                {!detail && (
                  <div className="text-text-muted italic">Loading…</div>
                )}

                {detail && (
                  <CardRelatedLinks
                    faces={detail.card_faces}
                    allParts={detail.all_parts}
                    parentName={detail.name}
                    // Face-level type wins so a transformed DFC's back
                    // face detects as its actual type (matters for
                    // rare cases like a token that transforms).
                    parentTypeLine={displayType || detail.type_line}
                    currentFaceName={displayName}
                    onNavigate={(next) => setCard(next)}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </BigCardPreviewContext.Provider>
  );
}

/**
 * Read the big-preview open/close functions. Returns no-op handlers
 * when called outside the provider so isolated component previews
 * don't crash.
 */
export function useBigCardPreview(): BigCardPreviewContextValue {
  return (
    useContext(BigCardPreviewContext) ?? {
      openBigPreview: () => {},
      closeBigPreview: () => {},
    }
  );
}
