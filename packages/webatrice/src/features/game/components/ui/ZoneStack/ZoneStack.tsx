import { useDroppable } from '@dnd-kit/core';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { cx } from '@app/utils';

import { useGameAccess } from '../../../hooks/useGameAccess';
import { useScryfallCard } from '../../../hooks/useScryfallCard';

import './ZoneStack.css';

export interface ZoneStackProps {
  gameId: number;
  playerId: number;
  zoneName: string;
  label: string;
  rotated?: boolean;
  onCardHover?: (card: ServerInfo_Card) => void;
  onClick?: (zoneName: string) => void;
  onContextMenu?: (zoneName: string, event: React.MouseEvent) => void;
}

function ZoneStack({
  gameId,
  playerId,
  zoneName,
  label,
  rotated = false,
  onCardHover,
  onClick,
  onContextMenu,
}: ZoneStackProps) {
  const zone = useAppSelector((state) =>
    games.Selectors.getZone(state, gameId, playerId, zoneName),
  );
  const topCard: ServerInfo_Card | undefined = zone
    ? zone.byId[zone.order[zone.order.length - 1]]
    : undefined;

  const { smallUrl } = useScryfallCard(topCard ?? null);
  const count = zone?.cardCount ?? 0;

  // Disable drops onto zones the local user can't act on (opponent zones
  // for non-judges, etc.). Server rejects the same moves; this keeps the
  // dnd-kit over-feedback honest.
  const { canAct } = useGameAccess(gameId, playerId);
  const { setNodeRef, isOver } = useDroppable({
    id: `zone-${playerId}-${zoneName}`,
    data: { targetPlayerId: playerId, targetZone: zoneName },
    disabled: !canAct,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx('zone-stack', {
        'zone-stack--drop-over': isOver,
        'zone-stack--rotated': rotated,
      })}
      data-testid={`zone-stack-${zoneName}`}
      onMouseEnter={() => topCard && onCardHover?.(topCard)}
      onClick={() => onClick?.(zoneName)}
      onContextMenu={(e) => {
        // Stop bubbling so the parent PlayerInfoPanel's onContextMenu (player
        // menu) doesn't also fire — without this, right-clicking a zone stack
        // opens both menus on top of each other.
        e.stopPropagation();
        onContextMenu?.(zoneName, e);
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(zoneName);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="zone-stack__thumb">
        {topCard && smallUrl && !topCard.faceDown ? (
          <img className="zone-stack__image" src={smallUrl} alt={topCard.name} />
        ) : (
          <div className="zone-stack__placeholder" />
        )}
        <div className="zone-stack__count">{count}</div>
      </div>
      <div className="zone-stack__label">{label}</div>
    </div>
  );
}

export default ZoneStack;
