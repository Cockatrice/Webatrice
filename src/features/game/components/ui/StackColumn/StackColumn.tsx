import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import { useScryfallCard } from '../../../hooks/useScryfallCard';

import './StackColumn.css';

export interface StackColumnProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  onCardHover?: (card: ServerInfo_Card) => void;
}

interface StackThumbProps {
  card: ServerInfo_Card;
  onHover?: (card: ServerInfo_Card) => void;
}

function StackThumb({ card, onHover }: StackThumbProps) {
  const { smallUrl } = useScryfallCard(card);
  return (
    <div
      className="stack-column__thumb"
      onMouseEnter={() => onHover?.(card)}
      title={card.name}
    >
      {smallUrl && !card.faceDown ? (
        <img className="stack-column__image" src={smallUrl} alt={card.name} />
      ) : (
        <div className="stack-column__placeholder" />
      )}
    </div>
  );
}

function StackColumn({ gameId, playerId, mirrored = false, onCardHover }: StackColumnProps) {
  const zone = useAppSelector((state) =>
    games.Selectors.getZone(state, gameId, playerId, Enriched.ZoneName.STACK),
  );
  const cards = zone ? zone.order.map((id) => zone.byId[id]).filter(Boolean) : [];

  return (
    <div
      className={cx('stack-column', { 'stack-column--mirrored': mirrored })}
      data-testid={`stack-column-${playerId}`}
    >
      <div className="stack-column__cards" data-testid={`stack-column-cards-${playerId}`}>
        {cards.map((c) => (
          <StackThumb key={c.id} card={c} onHover={onCardHover} />
        ))}
      </div>
    </div>
  );
}

export default StackColumn;
