import type { CSSProperties, HTMLAttributes, MouseEvent, PointerEvent, ReactElement } from 'react';

import { GAME_FOCUS_RING } from '../../components/ui/focusRing';

import Card from '../../components/ui/SeatCard/SeatCard';
import { CARD_HEIGHT, CARD_WIDTH } from '../../components/ui/SeatCard/cardSize';
import { useCardPreviewActions } from '../../components/ui/CardPreviewContext';
import { SELECTED_RING } from '../../components/ui/seatColors/seatColors';

type HandCard = { id: string; name: string; scryfallId: string };

export const PILE_STEP_FRACTION = 0.25;

export interface PilePlace {
  index: number;
  isLast: boolean;
}

export interface ZoneCardCellProps {
  card: HandCard;
  pile?: PilePlace;
  marked?: boolean;
  cardOwner?: { playerId: number; zone: string };
  selected?: boolean;
  hidden?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
  interaction?: HTMLAttributes<HTMLDivElement> & { ref?: (element: HTMLElement | null) => void };
  className?: string;
  style?: CSSProperties;
}

export function ZoneCardCell({
  card,
  pile,
  marked,
  cardOwner,
  selected,
  hidden,
  onPointerDown,
  onContextMenu,
  interaction,
  className,
  style,
}: ZoneCardCellProps): ReactElement {
  const { setHoveredCard, openBigPreview, closeBigPreview } = useCardPreviewActions();
  const preview = { name: card.name, scryfallId: card.scryfallId };

  const pileProps = pile && {
    onMouseEnter: () => setHoveredCard(preview),
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.button !== 1) {
        return;
      }
      e.preventDefault();
      openBigPreview(preview);
      const onUp = (ev: globalThis.MouseEvent) => {
        if (ev.button === 1) {
          closeBigPreview();
          window.removeEventListener('mouseup', onUp);
        }
      };
      window.addEventListener('mouseup', onUp);
    },
    onAuxClick: (e: MouseEvent<HTMLElement>) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    },
  };

  return (
    <div
      {...(marked ? { 'data-card': '', 'data-card-id': card.id } : null)}
      {...(cardOwner ? { 'data-card-owner': cardOwner.playerId, 'data-card-zone': cardOwner.zone } : null)}
      className={[pile ? 'absolute left-0 hover:z-10 group' : className, interaction && `focus-visible:z-10 ${GAME_FOCUS_RING}`]
        .filter(Boolean).join(' ') || undefined}
      onPointerDown={onPointerDown && ((e) => {
        if (e.button === 0) {
          onPointerDown(e);
        }
      })}
      onContextMenu={onContextMenu && ((e) => {
        e.preventDefault();
        onContextMenu(e);
      })}
      {...pileProps}
      {...interaction}
      style={{
        width: CARD_WIDTH,
        height: pile && !pile.isLast ? `calc(${CARD_HEIGHT} * ${PILE_STEP_FRACTION})` : CARD_HEIGHT,
        ...(pile ? { top: `calc(${CARD_HEIGHT} * ${PILE_STEP_FRACTION} * ${pile.index})` } : null),
        borderRadius: '7.5%',
        boxShadow: selected ? SELECTED_RING : undefined,
        opacity: hidden ? 0 : 1,
        touchAction: onPointerDown ? 'none' : undefined,
        cursor: onPointerDown ? 'grab' : undefined,
        ...style,
      }}
    >
      {pile ? (
        <div
          className={[
            'absolute left-0 top-0 pointer-events-none',
            'board-motion transition-transform duration-150 ease-out group-hover:scale-[var(--card-hover-scale,1.1)]',
          ].join(' ')}
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        >
          <Card name={card.name} scryfallId={card.scryfallId} />
        </div>
      ) : (
        <Card name={card.name} scryfallId={card.scryfallId} />
      )}
    </div>
  );
}
