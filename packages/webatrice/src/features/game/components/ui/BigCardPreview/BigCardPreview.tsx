import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { ScryfallImageSize } from '@cockatrice/datatrice';

import { CardRelatedLinks, ManaSymbols, SymbolText } from '@app/components';
import {
  detailTargetKey,
  fetchScryfallDetail,
  getScryfallUrlById,
  getScryfallUrlByName,
  type ScryfallDetail,
} from '@app/services';

import { useBigPreviewAnchor, useBigPreviewCard, useCardPreviewActions } from '../CardPreviewContext';

import { CARD_CORNER_RADIUS } from '../SeatCard/cardSize';
import PreviewCardImage from '../PreviewCardImage/PreviewCardImage';
import { HoverCardZoom } from './HoverCardZoom';
import { useFloatingPreviewLayout } from './useFloatingPreview';

export const ZOOM_CHROME = { x: 24, y: 24, textWidth: 292 } as const;

export function BigCardPreview() {
  const { t } = useTranslation();
  const card = useBigPreviewCard();
  const anchor = useBigPreviewAnchor();
  const layout = useFloatingPreviewLayout(anchor, ZOOM_CHROME);
  const { openBigPreview } = useCardPreviewActions();
  const [detail, setDetail] = useState<ScryfallDetail | null>(null);

  const hoverKey = card ? detailTargetKey(card) : null;

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
        if ((e as { name?: string })?.name === 'AbortError') {
          return;
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the card identity (`hoverKey`) changes
  }, [hoverKey]);

  // `card.imageUri` wins when set — mirrors PreviewCard.imageUri so
  // DFC back-face art shows correctly in the zoom modal.
  const imageUrl = card
    ? card.imageUri
      ? card.imageUri
      : card.scryfallId
        ? getScryfallUrlById(card.scryfallId, ScryfallImageSize.Large)
        : getScryfallUrlByName(card.name, ScryfallImageSize.Large)
    : null;

  // Pick the face matching the hovered name — same logic as
  // CardPreviewPane. Falls back to face-0 for classic single-face
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

  if (!card) {
    return <HoverCardZoom />;
  }

  return createPortal(
    <div
      data-testid="big-card-preview"
      className="pointer-events-none fixed z-[1400] flex rounded-lg border border-border-subtle bg-bg-surface p-3 shadow-2xl"
      style={{ left: layout.left, top: layout.top }}
    >
      {imageUrl && (
        <PreviewCardImage
          src={imageUrl}
          name={displayName}
          className="block shrink-0 shadow-lg"
          style={{
            width: layout.imageWidth,
            borderRadius: CARD_CORNER_RADIUS,
            imageRendering: '-webkit-optimize-contrast',
          }}
        />
      )}
      {layout.textWidth > 0 && (
        <div
          className="flex min-h-0 flex-col gap-3 overflow-y-auto pl-3 text-sm text-text-primary"
          style={{ width: layout.textWidth, maxHeight: layout.imageHeight }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold leading-tight">{displayName}</div>
              {displayType && <div className="mt-1 text-sm italic text-text-secondary">{displayType}</div>}
            </div>
            {displayMana && (
              <div className="shrink-0">
                <ManaSymbols cost={displayMana} size={18} />
              </div>
            )}
          </div>
          {displayOracle && (
            <div className="whitespace-pre-line border-t border-border-subtle pt-3 leading-relaxed">
              <SymbolText text={displayOracle} size={14} />
            </div>
          )}
          {displayFlavor && (
            <div className="whitespace-pre-line border-t border-border-subtle pt-3 italic leading-snug text-text-muted">
              {displayFlavor}
            </div>
          )}
          {(displayPT || displayLoyalty) && (
            <div className="mt-auto border-t border-border-subtle pt-3 text-right text-base font-semibold tabular-nums">
              {displayPT ?? displayLoyalty}
            </div>
          )}
          {!detail && <div className="italic text-text-muted">{t('CardPreviewPane.loading')}</div>}
          {detail && (
            <CardRelatedLinks
              faces={detail.card_faces}
              allParts={detail.all_parts}
              parentName={detail.name}
              parentTypeLine={displayType || detail.type_line}
              currentFaceName={displayName}
              onNavigate={openBigPreview}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
