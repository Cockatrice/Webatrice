import { DragOverlay, useDndContext } from '@dnd-kit/core';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { cx } from '@app/utils';

import CardSlotContent from '../CardSlot/CardSlotContent';
import { useScryfallCard } from '../../../hooks/useScryfallCard';

import './CardDragOverlay.css';

export interface CardDragOverlayProps {
  card: ServerInfo_Card;
  zone?: string;
}

function CardDragOverlay({ card, zone }: CardDragOverlayProps) {
  const { smallUrl } = useScryfallCard(card);

  // Reuse the resting card's presentation so the preview mirrors it — tapped
  // rotation plus name/P-T/annotation/counter overlays. flipClass='' keeps the
  // preview on its static face (no spin animation).
  const className = cx('card-slot', 'card-drag-overlay', {
    'card-slot--tapped': card.tapped,
    'card-slot--face-down': card.faceDown,
  });

  return (
    <div className={className} data-testid="card-drag-overlay">
      <CardSlotContent card={card} smallUrl={smallUrl} zone={zone} flipClass="" />
    </div>
  );
}

export function CardDragOverlayHost() {
  const { active } = useDndContext();
  const data = active?.data.current as
    | { card?: ServerInfo_Card; sourceZone?: string }
    | undefined;
  const card = data?.card ?? null;
  return (
    <DragOverlay dropAnimation={null}>
      {card ? <CardDragOverlay card={card} zone={data?.sourceZone} /> : null}
    </DragOverlay>
  );
}

export default CardDragOverlay;
