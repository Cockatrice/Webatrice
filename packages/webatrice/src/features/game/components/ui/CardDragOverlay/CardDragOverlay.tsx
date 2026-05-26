import { DragOverlay, useDndContext } from '@dnd-kit/core';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { useScryfallCard } from '../../../hooks/useScryfallCard';

import './CardDragOverlay.css';

export interface CardDragOverlayProps {
  card: ServerInfo_Card;
}

function CardDragOverlay({ card }: CardDragOverlayProps) {
  const { smallUrl } = useScryfallCard(card);

  return (
    <div className="card-drag-overlay" data-testid="card-drag-overlay">
      {card.faceDown || !smallUrl ? (
        <div className="card-drag-overlay__back" aria-label="face-down card" />
      ) : (
        <img className="card-drag-overlay__image" src={smallUrl} alt={card.name} />
      )}
    </div>
  );
}

export function CardDragOverlayHost() {
  const { active } = useDndContext();
  const card = (active?.data.current as { card?: ServerInfo_Card } | undefined)?.card ?? null;
  return <DragOverlay dropAnimation={null}>{card ? <CardDragOverlay card={card} /> : null}</DragOverlay>;
}

export default CardDragOverlay;
