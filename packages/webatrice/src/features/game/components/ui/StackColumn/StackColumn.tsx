import { useEffect, useId, useRef, useState } from 'react';
import { useForkRef } from '@mui/material/utils';
import { useTranslation } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import { usePlayerSeatContext } from '../PlayerBoard/PlayerSeatContext';
import { useSeatCardFocus } from '../PlayerBoard/useSeatCardFocus';
import { cardLabel } from '../SeatCard/cardLabel';
import { GAME_FOCUS_RING } from '../focusRing';
import { layoutVerticalPile } from '../VerticalPile/verticalPile';
import ZoneBackground from '../ZoneBackground/ZoneBackground';
import { CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from '../SeatCard/cardSize';
import Card from '../SeatCard/SeatCard';
import { SELECTED_RING } from '../seatColors/seatColors';

export default function StackColumn() {
  const { t } = useTranslation();
  const {
    CARD_H_PX,
    CARD_W_PX,
    cardMetaByName,
    isDragging,
    isSelf,
    menuOwnerId,
    name,
    onCardDoubleClick,
    openSeatCardMenu,
    playerId,
    seatGrid,
    selection,
    stackDisplayList,
    stackPileOptions,
    stackZoneRef,
    startSeatCardDrag,
  } = usePlayerSeatContext();
  const sizeRef = useRef<HTMLDivElement>(null);
  const stackRef = useForkRef(stackZoneRef, sizeRef);
  const [stackSize, setStackSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = sizeRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      setStackSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const keysHintId = useId();
  const visible = stackDisplayList.filter((c) => !isDragging(c.id, 'stack'));
  const { cardProps } = useSeatCardFocus('stack', {
    cards: visible,
    orientation: 'vertical',
    labelOf: (c) => cardLabel(t, { name: c.name, pt: cardMetaByName.get(c.name)?.pt, annotation: c.annotation }),
    previewOf: (c) => ({
      name: c.name,
      scryfallId: c.scryfallId || cardMetaByName.get(c.name)?.scryfallId,
      pt: cardMetaByName.get(c.name)?.pt,
      annotation: c.annotation,
    }),
  });

  return (
    <div
      role="listbox"
      aria-multiselectable
      aria-orientation="vertical"
      aria-describedby={keysHintId}
      aria-label={t('PlayerBoard.stack', { name, count: stackDisplayList.length })}
      className="relative isolate border-r border-border-subtle flex flex-col min-h-0 p-2"
      style={seatGrid.stack}
    >
      <ZoneBackground zone="stack" />
      <span id={keysHintId} hidden>{t('PlayerBoard.cardKeys')}</span>
      <div ref={stackRef} className="flex-1 min-h-0 relative">
        {(() => {
          const { positions } = layoutVerticalPile(
            visible.length,
            stackSize.w,
            stackSize.h,
            CARD_W_PX,
            CARD_H_PX,
            stackPileOptions,
          );
          return visible.map((c, i) => {
            const pos = positions[i];
            if (!pos) {
              return null;
            }
            const selected =
            selection?.zone === 'stack' && selection.ids.has(c.id);
            return (
              <div
                key={c.id}
                {...cardProps(c)}
                data-card
                data-zone="stack"
                data-card-id={c.id}
                data-selected={selected || undefined}
                // Same arrow-interaction attrs as battlefield cards
                // so useGameArrowInteractions can hit-test stack
                // cards as arrow sources AND arrow targets
                // (counterspells, on-stack triggers, etc.).
                data-card-owner={playerId}
                data-card-zone={ZoneName.STACK}
                onPointerDown={(e) =>
                  startSeatCardDrag(e, c, 'stack', stackDisplayList)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openSeatCardMenu({
                    kind: 'stack',
                    playerId: menuOwnerId,
                    cardId: c.id,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                onDoubleClick={(e) => onCardDoubleClick('stack', c, e)}
                className={`absolute hover:z-10 focus-visible:z-10 ${GAME_FOCUS_RING}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  touchAction: isSelf ? 'none' : undefined,
                  cursor: isSelf ? 'grab' : 'default',
                  boxShadow: selected
                    ? SELECTED_RING
                    : undefined,
                  borderRadius: CARD_CORNER_RADIUS,
                }}
              >
                <Card
                  name={c.name}
                  scryfallId={
                    c.scryfallId
                  || cardMetaByName.get(c.name)?.scryfallId
                  }
                  pt={cardMetaByName.get(c.name)?.pt}
                  // Stack keeps annotations while other non-battlefield
                  // zones don't (Cockatrice's `keepAnnotations =
                  // (targetzone == STACK)` carve-out). Show the tag
                  // — usually "Owner: <name>" — so the caster stays
                  // visible while the spell sits on the stack.
                  annotation={c.annotation}
                />
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
