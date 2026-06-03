import { ZoneName } from '@cockatrice/sockatrice';
import { memo } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

import { counterColorForId } from './counterColors';

import './CardSlot.css';

export interface CardSlotContentProps {
  card: ServerInfo_Card;
  smallUrl: string | null | undefined;
  zone: string | undefined;
  flipClass: string;
}

// Memoized inner so the ~60 CardSlots whose visual state is unchanged on drag
// activation skip re-rendering even though their parent wrappers re-render
// (dnd-kit's useDraggable subscribes to InternalContext inside useCardSlot).
// Pure and prop-driven — no Redux or dnd-kit — so the drag preview
// (CardDragOverlay) can reuse it to mirror the resting card exactly.
const CardSlotContent = memo(function CardSlotContent({
  card,
  smallUrl,
  zone,
  flipClass,
}: CardSlotContentProps) {
  // Both faces always render so the shared 3D flip (src/styles/card-flip.css) can
  // reveal the other side. restClass holds the correct static side; flipClass adds
  // the keyframe spin only when faceDown changes (see useCardSlot).
  const restClass = card.faceDown ? 'cardflip--back' : 'cardflip--front';
  return (
    <>
      <div className="card-slot__flip-frame">
        <div className={`cardflip ${restClass} ${flipClass}`}>
          <div className="cardflip__face cardflip__face--front card-slot__face-front">
            {smallUrl ? (
              <img className="card-slot__image" src={smallUrl} alt={card.name} draggable={false} />
            ) : (
              <div className="card-slot__image card-slot__image--loading" />
            )}
          </div>
          <div className="cardflip__face cardflip__face--back card-slot__back" aria-label="face-down card" />
        </div>
      </div>

      {!card.faceDown && (card.name || (zone === ZoneName.TABLE && card.annotation)) && (
        <div className="card-slot__top">
          {card.name && <div className="card-slot__name">{card.name}</div>}
          {zone === ZoneName.TABLE && card.annotation && (
            <div className="card-slot__owner">
              {card.annotation.replace(/^Owner:\s*/i, '')}
            </div>
          )}
        </div>
      )}

      {card.pt && !card.faceDown && (
        <div className="card-slot__pt">{card.pt}</div>
      )}

      {card.counterList.length > 0 && !card.faceDown && (
        <div className="card-slot__counters">
          {card.counterList.map((c) => (
            <span
              key={c.id}
              className={`card-slot__counter card-slot__counter--pos-${c.id}`}
              style={{ background: counterColorForId(c.id) }}
            >
              {c.value}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

export default CardSlotContent;
